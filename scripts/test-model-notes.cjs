// Windows packaged integration: visible anchor front, hidden back, raster proof.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process'),{createInterface}=require('node:readline');
async function main(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-model-notes-'));
 const {Document,NodeIO}=await import('@gltf-transform/core');
 async function cube(name,color){
  const d=new Document(),b=d.createBuffer();
  const pos=d.createAccessor().setType('VEC3').setArray(new Float32Array([-1,-1,1,1,-1,1,1,1,1,-1,1,1,-1,-1,-1,1,-1,-1,1,1,-1,-1,1,-1])).setBuffer(b);
  const idx=d.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2,0,2,3, 5,4,7,5,7,6, 4,0,3,4,3,7, 1,5,6,1,6,2, 3,2,6,3,6,7, 4,5,1,4,1,0])).setBuffer(b);
  const m=d.createMaterial().setBaseColorFactor(color).setDoubleSided(true);
  d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',pos).setIndices(idx).setMaterial(m))));
  const f=path.join(root,name);await new NodeIO().write(f,d);return f;
 }
 const left=await cube('left.glb',[.04,.10,.75,1]),right=await cube('right.glb',[.04,.7,.06,1]);
 const mcp=spawn(process.execPath,[process.argv[2]||path.join(__dirname,'mcp-server.cjs'),root],{stdio:['pipe','pipe','inherit'],windowsHide:true});
 const pending=new Map();let id=0;
 createInterface({input:mcp.stdout}).on('line',l=>{const m=JSON.parse(l);pending.get(m.id)?.(m.result);pending.delete(m.id);});
 const call=(name,args)=>new Promise((resolve,reject)=>{const req=++id,timer=setTimeout(()=>reject(Error('MCP timeout')),200000);pending.set(req,r=>{clearTimeout(timer);if(r.isError)reject(Error(r.content[0].text));else resolve(JSON.parse(r.content[0].text));});mcp.stdin.write(JSON.stringify({jsonrpc:'2.0',id:req,method:'tools/call',params:{name,arguments:args}})+'\n');});
 const note=pane=>({text:pane===0?'FRONT <b>':'RIGHT FRONT',point:[0,0,1],pane});
 const captions=[{text:'CAPTION WINDOW',start:.6,end:1}];
 function colored(file,width,at=null,cyan=false){
  const b=execFileSync('ffmpeg',['-v','error',...(at===null?[]:['-ss',String(at)]),'-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:8*1024*1024});
  assert.ok(b.length>0,'Must decode a frame');const count=[0,0];
  for(let i=0;i<b.length;i+=3){const r=b[i],g=b[i+1],s=b[i+2];if(cyan?(r<145&&g>170&&s>195):(r>210&&g>145&&g<235&&s<120))count[(i/3)%width>=width/2?1:0]++;}
  return count;
 }
 try{
  const png=await call('capture_model_views',{modelPath:left,views:['front','back'],width:640,height:480,notes:[note(0)],returnImages:'none'});
  const front=path.join(png.directory,'front.png'),back=path.join(png.directory,'back.png');
  assert.ok(colored(front,640).reduce((a,b)=>a+b)>130);assert.deepEqual(colored(back,640),[0,0]);
  assert.deepEqual(colored(front,640,null,true),[0,0]);
  const pngCaption=await call('capture_model_views',{modelPath:left,views:['front'],width:640,height:480,captions,captionTime:.6,returnImages:'none'});
  assert.ok(colored(path.join(pngCaption.directory,'front.png'),640,null,true).reduce((a,b)=>a+b)>80);
  console.log(JSON.stringify({pngFront:front,pngBack:back}));
  for(const format of ['mp4','gif']){
   const v=await call('record_model_turntable',{modelPath:left,secondModelPath:right,seconds:2,axis:'horizontal',format,notes:[note(0),note(1)],captions});
   const first=colored(v.file,v.width,0),hidden=colored(v.file,v.width,1);
   assert.ok(first.every(n=>n>45),JSON.stringify({first,hidden}));
   assert.ok(hidden.every(n=>n<5),JSON.stringify({first,hidden}));
   const before=colored(v.file,v.width,.4,true),during=colored(v.file,v.width,.6,true),after=colored(v.file,v.width,1,true);
   assert.deepEqual(before,[0,0]);assert.ok(during.every(n=>n>40),JSON.stringify({format,before,during,after}));assert.deepEqual(after,[0,0]);
   console.log(JSON.stringify({format,file:v.file,first,hidden,before,during,after}));
  }
  await assert.rejects(call('capture_model_views',{modelPath:left,notes:[note(1)],returnImages:'none'}),/Invalid local model anchor or pane/);
  await assert.rejects(call('record_model_turntable',{modelPath:left,seconds:1,captions:[{text:'not valid',start:0,end:2}]}),/within the recording duration/);
 }finally{mcp.stdin.end();await fs.rm(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
