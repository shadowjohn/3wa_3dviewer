// Hardware smoke: pass a built source or packaged MCP server entry.
import {Document,NodeIO} from '@gltf-transform/core';
import {BoxGeometry} from 'three';
import {mkdtemp,readFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {spawn,execFileSync} from 'node:child_process';
import {createInterface} from 'node:readline';
import path from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const dir=await mkdtemp(path.join(tmpdir(),'3wa-path-qa-')),modelPath=path.join(dir,'portal.glb');
const k=(time,position,lookAt,fov=66)=>({time,position,lookAt,fov});
const doc=new Document(),buf=doc.createBuffer(),scene=doc.createScene();
function box(center,size,color){
 const g=new BoxGeometry(...size),pos=doc.createAccessor().setType('VEC3').setArray(g.attributes.position.array).setBuffer(buf),
  normal=doc.createAccessor().setType('VEC3').setArray(g.attributes.normal.array).setBuffer(buf),
  indices=doc.createAccessor().setType('SCALAR').setArray(g.index.array).setBuffer(buf),
  mat=doc.createMaterial().setBaseColorFactor([...color,1]).setMetallicFactor(0),
  prim=doc.createPrimitive().setAttribute('POSITION',pos).setAttribute('NORMAL',normal).setIndices(indices).setMaterial(mat);
 scene.addChild(doc.createNode().setTranslation(center).setMesh(doc.createMesh().addPrimitive(prim)));g.dispose();
}
box([0,-1,0],[4,.1,4],[.17,.17,.17]);
box([-1.35,0,.8],[1.3,2,.17],[.77,.05,.05]);box([1.35,0,.8],[1.3,2,.17],[.77,.05,.05]);box([0,.77,.8],[1.4,.46,.17],[.77,.05,.05]);
box([0,.04,-1.3],[.8,.84,.26],[.04,.60,.20]);
await new NodeIO().write(modelPath,doc);
const p=spawn(process.execPath,[path.resolve(process.argv[2]||'scripts/mcp-server.cjs'),dir],{stdio:['pipe','pipe','inherit'],windowsHide:true});
const lines=createInterface({input:p.stdout})[Symbol.asyncIterator]();let id=0,dirOut;
async function request(name,args,method='tools/call'){
 p.stdin.write(JSON.stringify({jsonrpc:'2.0',id:++id,method,params:{name,arguments:args}})+'\n');
 const {value}=await lines.next();const r=JSON.parse(value);assert.equal(r.id,id);return r.result;
}
try{
 const hash=()=>readFile(modelPath).then(bytes=>createHash('sha256').update(bytes).digest('hex')),original=await hash();
 const toolList=await request(null,null,'tools/list');assert(toolList.tools.some(t=>t.name==='record_model_camera_path'));
 const keyframes=[k(0,[0,0,1.1],[0,0,-.55]),k(1,[0,0,.04],[0,0,-.55]),k(2,[0,0,-.31],[0,0,-.55])];
 for(const arguments_ of [{modelPath,keyframes:[]},{modelPath,keyframes:[keyframes[0],keyframes[0]]},{modelPath,keyframes,secondModelPath:modelPath},{modelPath:modelPath+'.gltf',keyframes}]){
  const r=await request('record_model_camera_path',arguments_);assert(r.isError,r.content[0].text);
 }
 const r=await request('record_model_camera_path',{modelPath,keyframes,captions:[{text:'Inside',start:1,end:1.5}]});
 assert.equal(r.isError,undefined,r.content[0].text);
 const out=JSON.parse(r.content[0].text);dirOut=path.dirname(out.file);
 assert.equal(out.frameCount,60);assert.equal(out.seconds,2);assert.equal(out.motion,'camera-path');
 const open=execFileSync('ffprobe',['-v','error','-show_streams','-of','json',out.file],{encoding:'utf8'});
 const [video,...others]=JSON.parse(open).streams;assert.equal(video.codec_name,'h264');assert.equal(video.r_frame_rate,'30/1');assert.equal(video.nb_frames,'60');assert.equal(others.length,0);
 const bytes=execFileSync('ffmpeg',['-v','error','-i',out.file,'-vf','scale=64:48','-f','rawvideo','-pix_fmt','rgb24','pipe:1']);
 const dominant=frame=>{let red=0,green=0;for(let i=frame*9216;i<(frame+1)*9216;i+=3){const [r,g,b]=bytes.subarray(i,i+3);if(r>g+35&&r>b+35)red++;if(g>r+35&&g>b+35)green++;}return {red,green};};
 const outside=dominant(0),inside=dominant(40);assert(outside.red>300&&inside.red<50&&inside.green>outside.green*2,JSON.stringify({outside,inside}));assert.equal(await hash(),original);
 console.log(JSON.stringify({frames:60,seconds:2,codec:'h264',outside,inside}));
}finally{p.stdin.end();if(dirOut)await rm(dirOut,{recursive:true});await rm(dir,{recursive:true});}
