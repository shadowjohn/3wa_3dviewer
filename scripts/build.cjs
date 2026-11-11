const fs=require('node:fs');
(async()=>{
 fs.mkdirSync('web/decoders',{recursive:true});
 for(const f of ['index.html','style.css'])fs.copyFileSync('src/'+f,'web/'+f);
 for(const name of ['draco','basis'])fs.cpSync('node_modules/three/examples/jsm/libs/'+name,'web/decoders/'+name,{recursive:true});
 // Basis Embind uses dynamic function construction. Keep this restricted to a
 // static local worker; do NOT add unsafe-eval to the renderer document CSP.
 const {KTX2Loader}=await import('three/addons/loaders/KTX2Loader.js');
 const fn=KTX2Loader.BasisWorker.toString();
 const body=['EngineFormat','EngineType','TranscoderFormat','BasisFormat'].map(k=>'let _'+k+' = '+JSON.stringify(KTX2Loader[k])+';').concat(fs.readFileSync('web/decoders/basis/basis_transcoder.js','utf8'),fn.substring(fn.indexOf('{')+1,fn.lastIndexOf('}'))).join('\n');
 fs.writeFileSync('web/decoders/basis/worker.js',body);
 await require('esbuild').build({entryPoints:['src/viewer.js'],bundle:true,outfile:'web/viewer.js',format:'esm',target:'chrome130',minify:true,legalComments:'eof',plugins:[{name:'static-basis-worker',setup(build){build.onLoad({filter:/KTX2Loader\.js$/},args=>{let contents=fs.readFileSync(args.path,'utf8');const before='this.workerSourceURL = URL.createObjectURL( new Blob( [ body ] ) );';if(!contents.includes(before))throw Error('KTX2Loader changed; review static worker patch.');contents=contents.replace(before,"this.workerSourceURL = new URL('decoders/basis/worker.js', window.location.href).href;");return {contents,loader:'js'};});}}]});
 fs.copyFileSync('node_modules/three/LICENSE','web/THREE-LICENSE.txt');
 fs.copyFileSync('node_modules/@pixiv/three-vrm/LICENSE','web/THREE-VRM-LICENSE.txt');
})().catch(e=>{console.error(e);process.exitCode=1;});
