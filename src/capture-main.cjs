// Isolated trusted Electron entry, invoked only by local stdio MCP.
const {app,BrowserWindow,ipcMain,session,nativeImage}=require('electron');
const fs=require('node:fs/promises'),path=require('node:path'),{pathToFileURL}=require('node:url'),{createHash}=require('node:crypto');
const {validateGlb,vrmInfo}=require('./core.cjs'),{validateRequest}=require('./capture-policy.cjs');
const jobPath=process.argv[2];let referencesData=[],win,job,turntable,modelPaths,index=0,referenceData,referenceInfo,modelHash,files=[];
app.setPath('userData',path.join(path.dirname(jobPath),'cache'));
async function fail(error){try{await fs.writeFile(path.join(path.dirname(jobPath),'result.json'),JSON.stringify({ok:false,error:String(error.message||error).slice(0,2000)}));}finally{app.exit(1);}}
app.whenReady().then(async()=>{try{
 const raw=JSON.parse(await fs.readFile(jobPath,'utf8'));
 if(raw.turntable){
  const {modelPaths:inputs,roots,settings}=raw.turntable;
  if(!Array.isArray(inputs)||inputs.length<1||inputs.length>2)throw Error('Invalid turntable input');
  modelPaths=await Promise.all(inputs.map(file=>require('./capture-policy.cjs').allowedFile(file,roots,['.glb'],256*1024**2)));
  turntable=require('./turntable-policy.cjs').options(settings,modelPaths.length===2);job=turntable;
 }else job=await validateRequest(raw.request,raw.allowedRoots,raw.referenceRoots||[]);
 if(job.referencePath){const b=await fs.readFile(job.referencePath);require('./image-dimensions.cjs').imageDimensions(b);let img=nativeImage.createFromBuffer(b);if(img.isEmpty())throw Error('Reference image cannot be decoded');const size=img.getSize();if(size.width*size.height>24000000)throw Error('Reference image exceeds 24 megapixels');referenceInfo={sha256:createHash('sha256').update(b).digest('hex'),size,note:job.referenceNote||'Source/license not provided; do not assume public redistribution'};if(size.width>1920||size.height>1440){const scale=Math.min(1920/size.width,1440/size.height);img=img.resize({width:Math.round(size.width*scale),height:Math.round(size.height*scale)});}referenceData=img.toDataURL();}
 for(const l of job.referenceLayers||[]){const bytes=await fs.readFile(l.path);referencesData.push({name:path.basename(l.path),data:bytes.toString('base64'),settings:l,sha256:createHash('sha256').update(bytes).digest('hex')});}
 const html=path.resolve(__dirname,'../web/index.html');session.defaultSession.setPermissionRequestHandler((_w,_p,cb)=>cb(false));session.defaultSession.webRequest.onBeforeRequest((d,cb)=>cb({cancel:/^(https?|wss?|ftp):/i.test(d.url)}));
 win=new BrowserWindow({width:job.width,height:job.height,useContentSize:true,show:false,webPreferences:{preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false,backgroundThrottling:false}});
 win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
 const handle=(name,fn)=>ipcMain.handle(name,(e,...args)=>{if(e.sender!==win.webContents||e.senderFrame.url!==pathToFileURL(html).href)throw Error('Unauthorized');return fn(...args);});
 if(turntable){
  handle('config',()=>({turntable,secondModel:modelPaths.length===2,version:'MCP-0.3'}));
  async function readModel(i){const file=modelPaths[i];if(!file)return null;const b=await fs.readFile(file),json=validateGlb(b);return {name:path.basename(file),size:b.length,kind:'glb',avatar:vrmInfo(json),data:new Uint8Array(b),extensions:json.extensionsUsed||[]};}
  handle('initial',()=>readModel(0));handle('turntable-second',()=>readModel(1));
  let writing=false;
  handle('turntable-frame',async (frame,data)=>{
   if(writing||frame!==index||index>=turntable.frameCount||typeof data!=='string'||data.length>5*1024**2||!data.startsWith('data:image/png;base64,'))throw Error('Invalid turntable frame');
   writing=true;
   try{
    const bytes=Buffer.from(data.slice(22),'base64'),size=require('./image-dimensions.cjs').imageDimensions(bytes);
    if(size.width!==turntable.width||size.height!==turntable.height)throw Error('Invalid turntable frame dimensions');
    await fs.writeFile(path.join(path.dirname(jobPath),String(index).padStart(4,'0')+'.png'),bytes,{flag:'wx'});index++;
   }finally{writing=false;}
  });
  handle('capture-finish',async report=>{
   if(!report?.ok)return fail(Error(report?.error||'Render failed'));
   if(writing||index!==turntable.frameCount)throw Error('Incomplete turntable capture');
   await fs.writeFile(path.join(path.dirname(jobPath),'result.json'),JSON.stringify({ok:true,frameCount:index}));app.exit(0);
  });
  win.webContents.on('render-process-gone',(_e,d)=>fail(Error('Renderer stopped: '+d.reason)));await win.loadFile(html);return;
 }
 handle('config',()=>({...job,capture:true,version:'MCP-0.3',referenceData,referencesData,modelPath:undefined,referencePath:undefined}));
 handle('initial',async()=>{const b=await fs.readFile(job.modelPath),json=validateGlb(b);modelHash=createHash('sha256').update(b).digest('hex');return {name:path.basename(job.modelPath),size:b.length,kind:'glb',avatar:vrmInfo(json),data:new Uint8Array(b),extensions:json.extensionsUsed||[]};});
 handle('capture-frame',async frame=>{
  if(frame?.view!==job.views[index])throw Error('Unexpected capture view');const expected=['original',...(job.grid?['grid']:[]),...(job.crop?['crop']:[]),...(referenceData?['compare']:[]),...(referencesData.length?['layers']:[])];if(Object.keys(frame.images||{}).sort().join(',')!==expected.sort().join(','))throw Error('Unexpected image variants');
  for(const variant of expected){const data=frame.images[variant];if(typeof data!=='string'||data.length>24*1024**2||!data.startsWith('data:image/png;base64,'))throw Error('Invalid capture image');const image=nativeImage.createFromDataURL(data);if(image.isEmpty())throw Error('Empty capture image');const size=image.getSize();if(size.width>job.width*2||size.height>job.height+32)throw Error('Oversize capture');if(['original','grid'].includes(variant)&&(size.width!==job.width||size.height!==job.height))throw Error('Unexpected capture resolution');const file=frame.view+(variant==='original'?'':'-'+variant)+'.png';await fs.writeFile(path.join(path.dirname(jobPath),file),image.toPNG(),{flag:'wx'});files.push({file,view:frame.view,variant,...size});}
  index++;return true;
 });
 handle('capture-finish',async report=>{if(report.ok&&index!==job.views.length)throw Error('Incomplete capture');await fs.writeFile(path.join(path.dirname(jobPath),'result.json'),JSON.stringify({...report,modelHash,views:job.views,files,referenceLayers:referencesData.map(({data,...r})=>r),reference:referenceInfo}));app.exit(report.ok?0:1);});
 win.webContents.on('render-process-gone',(_e,d)=>fail(Error('Renderer stopped: '+d.reason)));await win.loadFile(html);
 }catch(e){await fail(e);}});setTimeout(()=>{if(!turntable)fail(Error('90 second timeout; not retried'));},90000).unref();
