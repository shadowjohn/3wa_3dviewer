const test=require('node:test'),assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {exportDirectorWeb}=require('../scripts/export-director-web.cjs');

function makeGlb(uri){
 const json=JSON.stringify({asset:{version:'2.0'},...(uri?{buffers:[{uri,byteLength:1}]}:{})});
 const data=Buffer.from(json.padEnd(Math.ceil(Buffer.byteLength(json)/4)*4,' '));
 const header=Buffer.alloc(20);
 header.write('glTF');header.writeUInt32LE(2,4);header.writeUInt32LE(20+data.length,8);
 header.writeUInt32LE(data.length,12);header.write('JSON',16);
 return Buffer.concat([header,data]);
}
async function fixture(t){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-director-web-test-'));
 t.after(()=>fs.rm(root,{recursive:true,force:true}));
 const model=path.join(root,'private','valve.glb'),scenePath=path.join(root,'input.json');
 const destination=path.join(root,'output');
 const definition={version:1,seconds:1,camera:[
  {time:0,position:[0,0,3],lookAt:[0,0,0],fov:45},
  {time:1,position:[0,0,3],lookAt:[0,0,0],fov:45},
 ],objects:[{id:'valve',file:'private/valve.glb'}]};
 await fs.mkdir(path.dirname(model));
 await fs.writeFile(scenePath,JSON.stringify(definition));
 await fs.writeFile(model,makeGlb());
 return {root,model,definition,args:{scenePath,destination,roots:[root]}};
}
test('director web export relocates approved assets and retains the versioned scene',async t=>{
 const {model,definition,args}=await fixture(t);
 const output=await exportDirectorWeb({...args,chapter:{label:'Cutoff',seconds:.5}});
 const read=file=>fs.readFile(path.join(output.folder,file));
 assert.equal(output.frames,30);
 assert.deepEqual(JSON.parse(await read('scene.json')),{...definition,objects:[{id:'valve',file:'assets/model-1.glb'}]});
 assert.deepEqual(await read('assets/model-1.glb'),await fs.readFile(model));
 assert.deepEqual(JSON.parse(await read('manifest.json')),{version:1,cover:null,video:null,chapter:{label:'Cutoff',seconds:.5}});
 for(const file of ['index.html','player.js','player.css','blog-example.html','decoders/basis/worker.js','THREE-LICENSE.txt','LICENSE.txt']){
  assert((await read(file)).length>0,file);
 }
 await assert.rejects(exportDirectorWeb(args),/已存在/);
 assert((await read('index.html')).length>0);
});
test('director web export rejects external GLB resources and leaves no partial output',async t=>{
 const {root,model,args}=await fixture(t);
 await fs.writeFile(model,makeGlb('https://example.invalid/model.bin'));
 await assert.rejects(exportDirectorWeb(args),/外部資源/);
 assert.deepEqual((await fs.readdir(root)).sort(),['input.json','private']);
});
