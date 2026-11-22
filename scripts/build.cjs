const fs=require('node:fs'),path=require('node:path');
const root=path.resolve(__dirname,'..');
async function buildBrowserRuntime(output,{director=false}={}){
 const source=path.join(root,'src'),modules=path.join(root,'node_modules');
 const decoders=path.join(output,'decoders');
 fs.mkdirSync(decoders,{recursive:true});
 const files=director?[
  ['director-web.html','index.html'],['director-web.css','player.css'],
  ['director-blog.html','blog-example.html'],['director-blog.js','blog-example.js'],['director-blog.css','blog-example.css'],
 ]:[['index.html','index.html'],['style.css','style.css']];
 for(const [input,file] of files)fs.copyFileSync(path.join(source,input),path.join(output,file));
 for(const name of ['draco','basis'])fs.cpSync(path.join(modules,'three/examples/jsm/libs',name),path.join(decoders,name),{recursive:true});
 // Basis Embind uses dynamic function construction. Keep this restricted to a
 // static local worker; do NOT add unsafe-eval to the renderer document CSP.
 const {KTX2Loader}=await import('three/addons/loaders/KTX2Loader.js');
 const fn=KTX2Loader.BasisWorker.toString();
 const body=['EngineFormat','EngineType','TranscoderFormat','BasisFormat'].map(k=>'let _'+k+' = '+JSON.stringify(KTX2Loader[k])+';').concat(fs.readFileSync(path.join(decoders,'basis/basis_transcoder.js'),'utf8'),fn.substring(fn.indexOf('{')+1,fn.lastIndexOf('}'))).join('\n');
 fs.writeFileSync(path.join(decoders,'basis/worker.js'),body);
 await require('esbuild').build({
  entryPoints:[path.join(source,director?'director-web.js':'viewer.js')],bundle:true,
  outfile:path.join(output,director?'player.js':'viewer.js'),format:'esm',minify:true,legalComments:'eof',
  target:director?['chrome115','firefox115','safari17']:'chrome130',
  plugins:[{name:'static-basis-worker',setup(build){
   build.onLoad({filter:/KTX2Loader\.js$/},args=>{
    const source=fs.readFileSync(args.path,'utf8');
    const before='this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );';
    if(!source.includes(before))throw Error('KTX2Loader changed; review static worker patch.');
    const contents=source.replace(before,"this.workerSourceURL = new URL('decoders/basis/worker.js', import.meta.url).href;");
    return {contents,loader:'js'};
   });
  }}],
 });
 fs.copyFileSync(path.join(modules,'three/LICENSE'),path.join(output,'THREE-LICENSE.txt'));
 if(director)fs.copyFileSync(path.join(root,'LICENSE'),path.join(output,'LICENSE.txt'));
 else fs.copyFileSync(path.join(modules,'@pixiv/three-vrm/LICENSE'),path.join(output,'THREE-VRM-LICENSE.txt'));
}
if(require.main===module)buildBrowserRuntime(path.join(root,'web')).catch(e=>{console.error(e);process.exitCode=1;});
module.exports={buildBrowserRuntime};
