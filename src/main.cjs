const {app,BrowserWindow,ipcMain,dialog,session,shell}=require('electron');
const fs=require('node:fs/promises'), path=require('node:path');
const {pathToFileURL}=require('node:url');
const {glbArgument,validateGlb,unpackB3dm,embedGltf,vrmInfo,SUPPORTED}=require('./core.cjs');
const {DISPLAY_VERSION,checkUpdates}=require('./version.cjs');
const smokeIndex=process.argv.indexOf('--smoke');
const smokeFile=smokeIndex>=0?process.argv[smokeIndex+1]:null;
const log=(...args)=>{if(smokeFile)require('node:fs').appendFileSync(smokeFile+'.log',args.map(String).join(' ')+'\n');};
const base=app.isPackaged?path.dirname(process.execPath):path.resolve(__dirname,'..');
const cache=smokeFile?path.join(path.dirname(smokeFile),'cache-'+process.pid):path.join(base,'portable-data');
try{require('node:fs').mkdirSync(cache,{recursive:true});app.setPath('userData',cache);}catch{}
let win,selected=glbArgument(process.argv.slice(1)),ready=false,loadRequest=0,releaseURL=null;
const html=path.join(__dirname,'../web/index.html');
function trusted(e){return e.sender===win?.webContents&&e.senderFrame?.url===pathToFileURL(html).href;}
function handle(name,fn){ipcMain.handle(name,(e,...args)=>{if(!trusted(e))throw Error('Unauthorized sender');return fn(...args);});}
async function model(file){
 const request=++loadRequest;
 if(typeof file!=='string'||!path.isAbsolute(file)||!SUPPORTED.includes(path.extname(file).toLowerCase()))throw Error('請選擇 .glb、.gltf、.b3dm 或 .vrm 檔案。');
 if(file.startsWith('\\\\')||file.startsWith('//'))throw Error('第一版僅讀取本機磁碟模型，請先複製網路分享檔案到本機。');
 const stat=await fs.stat(file);if(!stat.isFile())throw Error('不是檔案。');if(stat.size>1024**3)throw Error('單檔上限為 1 GB，請先簡化模型。');
 let bytes=await fs.readFile(file),json,note='',kind='glb';const ext=path.extname(file).toLowerCase();
 if(ext==='.gltf'){const b=await embedGltf(file,bytes);bytes=b.bytes;json=b.json;kind='gltf';note='外部資源僅讀取模型所在目錄內的檔案。';}
 else if(ext==='.b3dm'){const b=unpackB3dm(bytes);bytes=b.bytes;json=b.json;note=b.note;}
 else json=validateGlb(bytes);
 const avatar=vrmInfo(json);if(ext==='.vrm'&&!avatar)throw Error('VRM extension missing: this file is not a VRM avatar.');
 if(request!==loadRequest)return null;
 selected=file;win.setTitle(path.basename(file)+' · 3WA 3D Viewer');
 return {name:path.basename(file),size:stat.size,kind,note,avatar,data:new Uint8Array(bytes),extensions:json.extensionsUsed||[]};
}
handle('initial',()=>selected?model(path.resolve(selected)):null);
handle('open',async()=>{const r=await dialog.showOpenDialog(win,{filters:[{name:'3D 模型',extensions:['glb','gltf','b3dm','vrm']}],properties:['openFile']});return r.canceled?null:model(r.filePaths[0]);});
handle('drop',file=>model(file));
handle('snapshot',async()=>{const r=await dialog.showSaveDialog(win,{defaultPath:'model-view.png',filters:[{name:'PNG',extensions:['png']}]});if(r.canceled)return false;await fs.writeFile(r.filePath,(await win.webContents.capturePage()).toPNG());return true;});
handle('config',()=>({smoke:!!smokeFile,version:DISPLAY_VERSION}));
handle('smoke-finish',async report=>{if(!smokeFile)return;await fs.mkdir(path.dirname(smokeFile),{recursive:true});try{await fs.writeFile(smokeFile+'.png',(await win.webContents.capturePage()).toPNG());}catch(e){report.screenshotError=e.message;}await fs.writeFile(smokeFile,JSON.stringify(report,null,2));app.exit(report.ok?0:2);});
handle('check-updates',async()=>{releaseURL=null;const result=await checkUpdates();releaseURL=result.url||null;return result;});
handle('release-page',async()=>{if(!releaseURL)return false;await shell.openExternal(releaseURL);return true;});
if(!smokeFile&&!app.requestSingleInstanceLock()){app.quit();}else{
 app.on('second-instance',(_e,args)=>{const file=glbArgument(args);if(win){win.show();win.focus();if(file){selected=path.resolve(file);if(ready)win.webContents.send('open-path',selected);}}});
 app.whenReady().then(()=>{
  session.defaultSession.setPermissionRequestHandler((_w,_p,done)=>done(false));
  session.defaultSession.webRequest.onBeforeRequest((d,done)=>done({cancel:/^https?:|^wss?:/i.test(d.url)}));
  win=new BrowserWindow({width:1280,height:850,minWidth:850,minHeight:560,title:'3WA 3D Viewer',backgroundColor:'#141a23',autoHideMenuBar:true,webPreferences:{backgroundThrottling:!smokeFile,preload:path.join(__dirname,'preload.cjs'),sandbox:true,contextIsolation:true,nodeIntegration:false}});
  win.webContents.setWindowOpenHandler(()=>({action:'deny'}));win.webContents.on('will-navigate',e=>e.preventDefault());
  win.webContents.on('did-finish-load',()=>{ready=true;});
  win.webContents.on('console-message',(_e,...d)=>log('console',JSON.stringify(d)));
  win.webContents.on('render-process-gone',(_e,d)=>{if(smokeFile)fs.writeFile(smokeFile,JSON.stringify({ok:false,error:d.reason})).finally(()=>app.exit(2));else dialog.showErrorBox('3WA 3D Viewer','渲染程序已停止。模型可能超過顯示記憶體限制，請重新開啟或簡化模型。');});
  win.loadFile(html).catch(e=>log('load-failed',e.message));
  if(smokeFile)setTimeout(()=>{fs.writeFile(smokeFile,JSON.stringify({ok:false,error:'120s timeout'})).finally(()=>app.exit(2));},120000).unref();
 });
 app.on('window-all-closed',()=>app.quit());
}
