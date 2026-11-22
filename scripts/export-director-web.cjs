const fs=require('node:fs/promises'),path=require('node:path'),{parseArgs}=require('node:util');
const {allowedFile}=require('../src/capture-policy.cjs'),{validateGlb}=require('../src/core.cjs');
const {imageDimensions}=require('../src/image-dimensions.cjs'),{readScene}=require('../src/director-job.cjs');
const {buildBrowserRuntime}=require('./build.cjs');
const MB=1024**2;

async function requireNewFolder(folder){
 try{await fs.lstat(folder);}catch(e){if(e.code==='ENOENT')return;throw e;}
 throw Error('展示包位置已存在，請指定新目錄。');
}
async function readApproved(file,roots,extensions,limit){
 const real=await allowedFile(file,roots,extensions,limit),bytes=await fs.readFile(real);
 if(bytes.length>limit)throw Error('資源超過展示包的大小上限。');
 return bytes;
}
function chapterInfo(chapter,duration){
 if(chapter===undefined)return null;
 const label=typeof chapter?.label==='string'?chapter.label.trim():'';
 const seconds=chapter?.seconds;
 if(!label||[...label].length>80||/[\u0000-\u001f\u007f-\u009f]/.test(label)||
    !Number.isFinite(seconds)||seconds<0||seconds>=duration){
  throw Error('章節需要名稱以及落在場景時長內的秒數。');
 }
 return {label,seconds};
}
async function exportDirectorWeb({scenePath,destination,roots,coverPath,mp4Path,chapter}){
 const {plan,models,definition}=await readScene(scenePath,roots);
 const manifest={version:1,cover:null,video:null,chapter:chapterInfo(chapter,plan.seconds)};
 if(!path.isAbsolute(destination)||/^\\\\|^\/\//.test(destination)||!path.basename(destination))throw Error('請指定本機輸出目錄。');
 const parent=await fs.realpath(path.dirname(destination)),folder=path.join(parent,path.basename(destination));
 if(/^\\\\|^\/\//.test(parent))throw Error('請指定本機輸出目錄。');
 await requireNewFolder(folder);
 const staging=await fs.mkdtemp(path.join(parent,'.director-web-'));
 try{
  await fs.mkdir(path.join(staging,'assets'));
  let modelBytes=0;
  const objects=[];
  for(let index=0;index<models.length;index++){
   const bytes=await readApproved(models[index],roots,['.glb'],96*MB);
   modelBytes+=bytes.length;
   if(modelBytes>192*MB)throw Error('Director models exceed 192 MB total.');
   validateGlb(bytes);
   const file=`assets/model-${index+1}.glb`;
   await fs.writeFile(path.join(staging,file),bytes);
   objects.push({...definition.objects[index],file});
  }
  if(coverPath!==undefined){
   const cover=await readApproved(coverPath,roots,['.png','.jpg','.jpeg'],16*MB);
   const size=imageDimensions(cover);
   if(size.width*size.height>24e6)throw Error('封面超過 2400 萬像素。');
   manifest.cover=cover[0]===0x89?'cover.png':'cover.jpg';
   await fs.writeFile(path.join(staging,manifest.cover),cover);
  }
  if(mp4Path!==undefined){
   const mp4=await readApproved(mp4Path,roots,['.mp4'],200*MB);
   if(mp4.length<16||mp4.toString('ascii',4,8)!=='ftyp')throw Error('備援影片需要有效的 MP4 標頭。');
   manifest.video='fallback.mp4';
   await fs.writeFile(path.join(staging,manifest.video),mp4);
  }
  await buildBrowserRuntime(staging,{director:true});
  for(const [name,data] of [['scene.json',{...definition,objects}],['manifest.json',manifest]]){
   await fs.writeFile(path.join(staging,name),JSON.stringify(data,null,2)+'\n');
  }
  await requireNewFolder(folder);
  await fs.rename(staging,folder);
 }finally{
  await fs.rm(staging,{recursive:true,force:true,maxRetries:3,retryDelay:100});
 }
 return {folder,seconds:plan.seconds,frames:plan.frameCount,models:models.length,...manifest};
}

async function main(){
 const {values,positionals}=parseArgs({allowPositionals:true,options:{
  cover:{type:'string'},mp4:{type:'string'},'chapter-label':{type:'string'},'chapter-seconds':{type:'string'},
 }});
 if(positionals.length!==2)throw Error('用法 npm run export:director-web -- 場景.json 新目錄 [--cover 封面.png] [--mp4 影片.mp4] [--chapter-label 章名 --chapter-seconds 秒數]');
 const [scenePath,destination]=positionals.map(p=>path.resolve(p));
 const coverPath=values.cover===undefined?undefined:path.resolve(values.cover);
 const mp4Path=values.mp4===undefined?undefined:path.resolve(values.mp4);
 const label=values['chapter-label'],seconds=values['chapter-seconds'];
 const chapter=label===undefined&&seconds===undefined?undefined:{
  label,seconds:seconds?.trim()?Number(seconds):NaN,
 };
 const roots=[scenePath,coverPath,mp4Path].filter(Boolean).map(file=>path.dirname(file));
 const result=await exportDirectorWeb({scenePath,destination,roots,coverPath,mp4Path,chapter});
 console.log(JSON.stringify(result,null,2));
}
if(require.main===module)main().catch(e=>{console.error(e.message);process.exitCode=1;});
module.exports={exportDirectorWeb};
