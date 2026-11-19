const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process'),{randomUUID}=require('node:crypto');
const {allowedFile}=require('./capture-policy.cjs'),{options,encodeArgs,gifPaletteArgs,gifEncodeArgs}=require('./turntable-policy.cjs');
const local=p=>path.isAbsolute(p)&&!p.startsWith('//')&&!p.startsWith('\\\\');
async function encoder(){
 const name=process.platform==='win32'?'ffmpeg.exe':'ffmpeg';
 for(const dir of (process.env.PATH||'').split(path.delimiter)){
  if(!local(dir))continue;
  try{const file=await fs.realpath(path.join(dir,name));if(local(file)&&(await fs.stat(file)).isFile())return file;}catch{}
 }
 throw Error('Recording requires an existing FFmpeg on PATH (libx264 is also required for MP4). No file was written.');
}
function run(command,args,signal,timeout){
 return new Promise((resolve,reject)=>{
  if(signal?.aborted){reject(Error('Export cancelled'));return;}
  const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;
  const child=spawn(command,args,{windowsHide:true,stdio:['ignore','ignore','pipe'],env,shell:false});
  let err='',expired=false;
  const kill=()=>child.kill(),timer=setTimeout(()=>{expired=true;kill();},timeout);
  signal?.addEventListener('abort',kill,{once:true});if(signal?.aborted)kill();
  child.stderr.on('data',b=>{err=(err+b).slice(-1000);});
  const clean=()=>{clearTimeout(timer);signal?.removeEventListener('abort',kill);};
  child.once('error',e=>{clean();reject(e);});
  child.once('close',code=>{clean();if(signal?.aborted)reject(Error('Export cancelled'));else if(expired)reject(Error('Export timed out'));else if(code!==0)reject(Error('Export process failed ('+code+'): '+err));else resolve();});
 });
}
async function publish(source,target,signal){
 const ext=path.extname(source).toLowerCase();
 if(!['.mp4','.gif','.png'].includes(ext)||typeof target!=='string'||!local(target)||path.extname(target).toLowerCase()!==ext)throw Error('Choose a local '+ext+' output path.');
 const parent=await fs.realpath(path.dirname(target));if(!local(parent))throw Error('Choose a local output folder.');
 const destination=path.join(parent,path.basename(target)),part=path.join(parent,'.viewer-'+randomUUID()+ext+'.part');
 let owned=false;
 try{
  const f=await fs.open(part,'wx');owned=true;await f.close();await fs.copyFile(source,part);
  if(signal?.aborted)throw Error('Export cancelled');
  try{await fs.link(part,destination);}catch(e){if(e.code==='EEXIST')throw Error('Output already exists; choose a different filename.');if(['EPERM','ENOTSUP','EOPNOTSUPP'].includes(e.code))throw Error('Choose an output folder on a drive supporting hard links (for example local NTFS).');throw e;}
 }finally{if(owned)await fs.unlink(part).catch(()=>{});}
 return destination;
}
async function exportTurntable({modelPath,secondPath,roots,settings,signal,output,electronPath,packaged=false,onProgress=()=>{}}){
 const modelPaths=[];for(const file of secondPath?[modelPath,secondPath]:[modelPath])modelPaths.push(await allowedFile(file,roots,['.glb'],256*1024**2));
 const cfg=options(settings,modelPaths.length===2),ffmpeg=await encoder();
 const fileName=(cfg.cameraPath?'camera-path.':'turntable.')+cfg.format;
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-viewer-turntable-')),job=path.join(dir,'job.json'),encoded=path.join(dir,fileName);
 let keep=false;
 try{
  await fs.writeFile(job,JSON.stringify({turntable:{modelPaths,roots,settings}}),{flag:'wx'});
  onProgress('render');
  try{await run(electronPath,packaged?['--viewer-capture-job',job]:[path.join(__dirname,'capture-main.cjs'),job],signal,180000);}catch(e){let report;try{report=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));}catch{}throw Error(report?.error||e.message);}
  const report=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));if(!report.ok||report.frameCount!==cfg.frameCount)throw Error(report.error||'Incomplete turntable rendering');
  onProgress('encode');
  const input=path.join(dir,'%04d.png');
  if(cfg.format==='gif'){
   const palette=path.join(dir,'palette.png');
   await run(ffmpeg,gifPaletteArgs(input,palette,cfg),signal,180000);
   await run(ffmpeg,gifEncodeArgs(input,palette,encoded,cfg),signal,180000);
  }else await run(ffmpeg,encodeArgs(input,encoded,cfg.frameCount),signal,180000);
  const stat=await fs.stat(encoded);if(!stat.isFile()||stat.size<32||stat.size>200*1024**2)throw Error('Invalid '+cfg.format.toUpperCase()+' output size');
  const file=output?await publish(encoded,output,signal):encoded;
  if(!output){if(signal?.aborted)throw Error('Export cancelled');keep=true;}
  return {file,bytes:stat.size,format:cfg.format,seconds:cfg.encodedSeconds,requestedSeconds:cfg.seconds,frameCount:cfg.frameCount,fps:cfg.fps,width:cfg.width,height:cfg.height,...(cfg.cameraPath?{motion:'camera-path',keyframeCount:cfg.cameraPath.length}:{axis:cfg.axis}),models:modelPaths.length,codec:cfg.format==='gif'?'gif':'h264',audio:false,...(cfg.format==='gif'?{loop:'infinite'}:{})};
 }finally{
  if(keep){for(const name of await fs.readdir(dir).catch(()=>[]))if(name!==fileName)await fs.rm(path.join(dir,name),{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});}
  else await fs.rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});
 }
}
module.exports={exportTurntable,publish,encoder,run};
