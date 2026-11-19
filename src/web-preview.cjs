const {BrowserWindow,session,Menu,dialog,app}=require('electron'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
const {randomUUID}=require('node:crypto'),{setTimeout:delay}=require('node:timers/promises');
const {WIDTH,HEIGHT,FPS,permitted,captureOptions,presetById,publicIP,loopbackIP,blockedCategory}= require('./web-preview-policy.cjs');
const {encoder,run,publish}=require('./turntable-job.cjs');
function createWindow(show,id){
 const preset=presetById(id),blocked=new Set(),checked=new Map();
 const note=(url,type)=>{if(blocked.size<8)blocked.add(blockedCategory(url,type));};
 const ses=session.fromPartition('viewer-public-e8-'+randomUUID(),{cache:false});
 ses.setPermissionCheckHandler(()=>false);ses.setPermissionRequestHandler((_w,_p,done)=>done(false));ses.setDevicePermissionHandler(()=>false);
 async function checkHost(host){
  if(!checked.has(host))checked.set(host,ses.resolveHost(host).then(r=>r.endpoints.length>0&&r.endpoints.every(e=>(preset.local?loopbackIP:publicIP)(e.address))));
  if(await checked.get(host)!==true)throw Error('Non-public resolution refused: '+host);
 }
 ses.webRequest.onBeforeRequest((r,done)=>{
  if(!permitted(r.url,r.resourceType,r.method,preset)){note(r.url,r.resourceType);done({cancel:true});return;}
  const u=new URL(r.url);
  if(u.protocol==='blob:'){done({cancel:false});return;}
  checkHost(u.hostname.replace(/^\[|\]$/g,'')).then(()=>done({cancel:false}),()=>{note(r.url,r.resourceType);done({cancel:true});});
 });
 ses.webRequest.onBeforeSendHeaders((r,done)=>{const h={...r.requestHeaders};for(const k of Object.keys(h))if(['cookie','authorization','proxy-authorization'].includes(k.toLowerCase()))delete h[k];done({requestHeaders:h});});
 ses.webRequest.onHeadersReceived((r,done)=>{const h={...r.responseHeaders};for(const k of Object.keys(h))if(k.toLowerCase()==='set-cookie')delete h[k];done({responseHeaders:h});});
 const n=new BrowserWindow({useContentSize:true,width:WIDTH,height:HEIGHT,resizable:false,maximizable:false,fullscreenable:false,show,paintWhenInitiallyHidden:true,title:'3WA 3D Viewer | '+preset.label,webPreferences:{session:ses,sandbox:true,contextIsolation:true,nodeIntegration:false,webSecurity:true,webviewTag:false,backgroundThrottling:false,disableDialogs:true,devTools:false}});
 const w=n.webContents,deny=e=>e.preventDefault();
 ses.on('will-download',deny);w.setWindowOpenHandler(()=>({action:'deny'}));w.on('will-frame-navigate',deny);w.on('will-redirect',deny);
 const login=(e,wc)=>{if(wc===w)e.preventDefault();};app.on('login',login);n.once('closed',()=>app.removeListener('login',login));
 const loaded=checkHost(new URL(preset.url).hostname.replace(/^\[|\]$/g,'')).then(()=>n.loadURL(preset.url)).catch(()=>{throw Error('Unable to open approved E8 preset: '+new URL(preset.url).hostname);});loaded.catch(()=>{});
 return {n,w,loaded,preset,blocked};
}
async function untilReady(p,signal){
 const dead=Date.now()+25000;
 await Promise.race([p.loaded,delay(15000,undefined,{signal,ref:false}).then(()=>{throw Error('Public map navigation timed out.');})]);
 while(Date.now()<dead){
  signal?.throwIfAborted();
  if(await p.w.executeJavaScript(p.preset.ready)===true){await delay(250,undefined,{signal});return;}
  await delay(250,undefined,{signal});
 }
 const diagnostic=[...p.blocked].join(', ');
 throw Error('Approved E8 map, tiles or model did not become ready in 25 seconds.'+(diagnostic?' Blocked resource categories: '+diagnostic:''));
}
async function grab(w,preset){
 if(w.isDestroyed()||w.getURL()!==preset.url)throw Error('The approved preview is no longer open.');
 const img=await w.capturePage({x:0,y:0,width:WIDTH,height:HEIGHT},{stayHidden:true}),s=img.getSize(),sample=img.resize({width:24,height:14}).toBitmap();
 if(s.width!==WIDTH||s.height!==HEIGHT||sample.length<16||new Set(sample).size<20)throw Error('The page did not render usable capture pixels.');
 return img.toPNG();
}
async function renderFrames({w,preset},cfg,dir,signal){
 const shots=[];
 const count=cfg.seconds*FPS,ms=1000/FPS,at=new Set(Array.from({length:cfg.snapshots},(_,i)=>cfg.snapshots===1?0:Math.round(i*(count-1)/(cfg.snapshots-1))));
 const motion=cfg.motion==='ride'&&count,stepped=Boolean(motion&&preset.step);
 const start=performance.now();
 for(let i=0;i<Math.max(1,count);i++){
  signal?.throwIfAborted();
  if(!stepped){
   const wait=start+i*ms-performance.now();if(wait>1)await delay(wait,undefined,{signal});
   if(count&&performance.now()-start-i*ms>500)throw Error('Map capture cannot sustain 10 fps on this computer.');
  }
  if(motion&&i===1&&await w.executeJavaScript(preset.begin)!==true)throw Error('The approved movement is unavailable.');
  if(stepped&&i>1&&await w.executeJavaScript(preset.step(i-1,count))!==true)throw Error('The approved movement stopped.');
  // Step-controlled ramp clips encode at 10 fps independent of WebGL latency.
  if(stepped&&i>0)await delay(35,undefined,{signal});
  const frame=await grab(w,preset);
  if(count)await fs.writeFile(path.join(dir,String(i).padStart(4,'0')+'.png'),frame,{flag:'wx'});
  if(cfg.snapshots&&(!count||at.has(i))){
   const file=path.join(dir,'icc-snapshot-'+(shots.length+1)+'.png');await fs.writeFile(file,frame,{flag:'wx'});shots.push(file);
  }
 }
 if(!count&&cfg.snapshots>1){
  for(let j=1;j<cfg.snapshots;j++){await delay(500,undefined,{signal});const file=path.join(dir,'icc-snapshot-'+(shots.length+1)+'.png');await fs.writeFile(file,await grab(w,preset),{flag:'wx'});shots.push(file);}
 }
 return shots;
}
async function capture(p,args,{signal,output,stagingRoot=os.tmpdir()}={}){
 const cfg=captureOptions(args),ffmpeg=cfg.seconds?await encoder():null,dir=await fs.mkdtemp(path.join(stagingRoot,'3wa-viewer-web-media-'));
 let keep=false;
 try{
  await untilReady(p,signal);
  const shots=await renderFrames(p,cfg,dir,signal);
  let video;
  if(cfg.seconds){
   video=path.join(dir,'icc-public-preview.mp4');
   await run(ffmpeg,['-hide_banner','-loglevel','error','-nostdin','-n','-framerate',String(FPS),'-i',path.join(dir,'%04d.png'),'-frames:v',String(FPS*cfg.seconds),'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-f','mp4',video],signal,60000);
   for(let i=0;i<cfg.seconds*FPS;i++)await fs.unlink(path.join(dir,String(i).padStart(4,'0')+'.png'));
  }
  if(output){await publish(video??shots[0],output,signal);return {video:video?output:undefined,shots:video?[]:[output]};}
  signal?.throwIfAborted();keep=true;
  return {preset:p.preset.id,url:p.preset.url,blocked:[...p.blocked],width:WIDTH,height:HEIGHT,video,shots,seconds:cfg.seconds,fps:cfg.seconds?FPS:undefined,motion:cfg.motion,frameCount:cfg.seconds*FPS};
 }finally{if(!keep)await fs.rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});}
}
let desktop;
function openDesktop(id){
 const preset=presetById(id);
 if(desktop&&!desktop.n.isDestroyed()){
  if(desktop.preset.id===preset.id){desktop.n.show();desktop.n.focus();return;}
  desktop.n.close();
 }
 const p=createWindow(true,preset.id),controller=new AbortController();desktop=p;
 let busy=false;
 p.n.once('closed',()=>{controller.abort();if(desktop===p)desktop=null;});
 async function act(seconds){
  if(busy)return;busy=true;
  try{
   const extension=seconds?'mp4':'png',r=await dialog.showSaveDialog(p.n,{defaultPath:preset.id+'-preview.'+extension,filters:[{name:extension.toUpperCase(),extensions:[extension]}]});
   if(r.canceled||controller.signal.aborted)return;
   p.n.setTitle('3WA 3D Viewer | Capturing public ICC demo…');
   await capture(p,{seconds,snapshots:seconds?0:1,motion:'still'},{output:r.filePath,signal:controller.signal});
   p.n.setTitle('3WA 3D Viewer | '+preset.label+' · Saved');
  }catch(e){if(!p.n.isDestroyed())dialog.showErrorBox('Public ICC capture',e.message);}
  finally{busy=false;}
 }
 p.n.setMenu(Menu.buildFromTemplate([{label:'擷取',submenu:[{label:'儲存 PNG',click:()=>act(0)},{label:'錄影 10 秒 MP4',click:()=>act(10)}]}]));
 p.n.setContentSize(WIDTH,HEIGHT);
 p.loaded.catch(e=>{if(!p.n.isDestroyed()){dialog.showErrorBox('Public ICC preview',e.message);p.n.close();}});
}
module.exports={createWindow,capture,openDesktop};
