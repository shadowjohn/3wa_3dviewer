// Real stdio -> hidden Electron/WebGL -> H264/MP4 and GIF round trip (requires local FFmpeg/ffprobe).
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn,execFileSync}=require('node:child_process'),{createInterface}=require('node:readline');
async function main(){
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-turntable-fixtures-'));
 const {Document,NodeIO}=await import('@gltf-transform/core');
 async function fixture(name,color,x){
  const d=new Document(),buffer=d.createBuffer(),points=d.createAccessor().setType('VEC3').setArray(new Float32Array([-1,-.7,1,1,-.7,1,.35,1.8,.8,x,0,-1])).setBuffer(buffer);
  const index=d.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2,1,0,3,2,1,3,0,2,3])).setBuffer(buffer);
  const material=d.createMaterial().setBaseColorFactor(color).setDoubleSided(true);
  d.createScene().addChild(d.createNode().setMesh(d.createMesh().addPrimitive(d.createPrimitive().setAttribute('POSITION',points).setIndices(index).setMaterial(material))));
  const file=path.join(root,name);await new NodeIO().write(file,d);return file;
 }
 const left=await fixture('red-left.glb',[.95,.02,.02,1],.3),right=await fixture('green-right.glb',[.02,.95,.02,1],-.6);
 const p=spawn(process.execPath,[process.argv[2]||path.join(__dirname,'mcp-server.cjs'),root],{stdio:['pipe','pipe','inherit'],windowsHide:true});
 const outstanding=new Map();let id=0;
 createInterface({input:p.stdout}).on('line',l=>{const m=JSON.parse(l);outstanding.get(m.id)?.(m.result);outstanding.delete(m.id);});
 function rpc(method,params){const req=++id;return new Promise((res,rej)=>{const t=setTimeout(()=>rej(Error('MCP timeout')),190000);outstanding.set(req,r=>{clearTimeout(t);res(r);});p.stdin.write(JSON.stringify({jsonrpc:'2.0',id:req,method,params})+'\n');});}
 const call=args=>rpc('tools/call',{name:'record_model_turntable',arguments:args});
 const where=[];try{
  const tools=await rpc('tools/list');assert.ok(tools.tools.find(t=>t.name==='record_model_turntable'));
  const bad=await call({modelPath:left,axis:'diagonal'});assert.equal(bad.isError,true);
  for(const [axis,mode,seconds,format] of [['horizontal','single',5],['vertical','single',1],['horizontal','dual',1],['vertical','dual',5],['horizontal','single',5,'gif'],['vertical','single',35/30,'gif'],['horizontal','dual',2.5,'gif'],['vertical','dual',5,'gif']]){
   const r=await call({modelPath:left,...(mode==='dual'?{secondModelPath:right}:{}),axis,seconds,...(format?{format}:{})});
   assert.ok(!r.isError,JSON.stringify(r));const file=JSON.parse(r.content[0].text).file;
   const probe=JSON.parse(execFileSync('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file],{encoding:'utf8'}));
   const gif=format==='gif',expectedSeconds=gif?Math.round(seconds*100)/100:seconds,expectedFrames=gif?Math.round(seconds*15):seconds*30,pane=gif?480:640;
   assert.equal(probe.streams.length,1);const s=probe.streams[0];assert.equal(s.codec_name,gif?'gif':'h264');
   if(gif){
    const bytes=await fs.readFile(file),loop=bytes.indexOf(Buffer.from('NETSCAPE2.0'));
    assert.ok(loop>=0&&bytes.subarray(loop+11,loop+16).equals(Buffer.from([3,1,0,0,0])),'Infinite GIF loop extension');
   }else assert.equal(s.avg_frame_rate,'30/1');
   assert.equal(Number(s.duration),expectedSeconds);assert.equal(Number(s.nb_frames),expectedFrames);
   assert.equal(s.width,pane*(mode==='dual'?2:1));assert.equal(s.height,gif?360:480);
   const raw=at=>execFileSync('ffmpeg',['-v','error','-ss',String(at),'-i',file,'-frames:v','1','-f','rawvideo','-pix_fmt','rgb24','pipe:1'],{maxBuffer:4*1024**2});
   const first=raw(0),changed=raw(seconds/4);assert.notDeepEqual(first,changed);
   function panes(bytes,width){
    let red=0,green=0;for(let i=0;i<bytes.length;i+=3){const x=(i/3)%width,r=bytes[i],g=bytes[i+1],b=bytes[i+2];if(x<pane&&r>g+25&&r>b+25)red++;if(x>=pane&&g>r+25&&g>b+25)green++;}
    return {red,green};
   }
   const c=panes(first,s.width),q=panes(changed,s.width);assert.ok(c.red>1000&&q.red>1000,JSON.stringify({c,q}));
   if(mode==='dual')assert.ok(c.green>1000&&q.green>1000,JSON.stringify({c,q}));
   where.push({axis,mode,format:format??'mp4',seconds:Number(s.duration),frames:Number(s.nb_frames),width:s.width,height:s.height,bytes:(await fs.stat(file)).size,file});console.log(JSON.stringify(where.at(-1)));
  }
 }finally{p.stdin.end();await fs.rm(root,{recursive:true,force:true});}
}
main().catch(e=>{console.error(e);process.exitCode=1;});
