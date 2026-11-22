const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {allowedFile}=require('./capture-policy.cjs'),{director}=require('./director-policy.cjs');
const {encoder,run}=require('./turntable-job.cjs'),{encodeArgs}=require('./turntable-policy.cjs');
async function readScene(scenePath,roots){
 const file=await allowedFile(scenePath,roots,['.json'],65536),root=path.dirname(file);
 const definition=JSON.parse((await fs.readFile(file,'utf8')).replace(/^\uFEFF/,''));
 const plan=director(definition),models=[];
 let total=0;
 for(const o of plan.objects){
  const asset=await allowedFile(path.resolve(root,o.file),[root],['.glb'],96*1024**2);
  total+=(await fs.stat(asset)).size;if(total>192*1024**2)throw Error('Director models exceed 192 MB total.');
  models.push(asset);delete o.file;
 }
 return {plan,models,definition};
}
async function directorJob({scenePath,roots,electronPath,packaged=false,signal,preview=false}){
 const {plan}=await readScene(scenePath,roots),ffmpeg=preview?null:await encoder();
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-viewer-director-')),file=path.join(dir,'job.json'),movie=path.join(dir,'director.mp4');
 let keep=false;
 try{
  await fs.writeFile(file,JSON.stringify({director:{scenePath,roots,preview}}),{flag:'wx'});
  try{await run(electronPath,packaged?['--viewer-capture-job',file]:[path.join(__dirname,'capture-main.cjs'),file],signal,preview?3600000:180000,{visible:preview});}
  catch(e){let report;try{report=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));}catch{}throw Error(report?.error||e.message);}
  if(preview)return;
  const out=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));if(!out.ok||out.frameCount!==plan.frameCount)throw Error('Incomplete director render.');
  await run(ffmpeg,encodeArgs(path.join(dir,'%04d.png'),movie,plan.frameCount),signal,90000);
  const bytes=(await fs.stat(movie)).size;if(bytes<32||bytes>200*1024**2)throw Error('Invalid MP4 output size.');
  signal?.throwIfAborted();keep=true;
  return {file:movie,bytes,width:plan.width,height:plan.height,fps:plan.fps,seconds:plan.seconds,frameCount:plan.frameCount,codec:'h264',audio:false,objects:plan.objects.length};
 }finally{
  if(keep){for(const name of await fs.readdir(dir).catch(()=>[]))if(name!=='director.mp4')await fs.rm(path.join(dir,name),{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});}
  else await fs.rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});
 }
}
module.exports={readScene,directorJob};
