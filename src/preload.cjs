const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('viewer',{
 initial:()=>ipcRenderer.invoke('initial'),open:()=>ipcRenderer.invoke('open'),
 drop:file=>ipcRenderer.invoke('drop',webUtils.getPathForFile(file)),snapshot:()=>ipcRenderer.invoke('snapshot'),
 config:()=>ipcRenderer.invoke('config'),checkUpdates:()=>ipcRenderer.invoke('check-updates'),releasePage:()=>ipcRenderer.invoke('release-page'),
 smokeFinish:r=>ipcRenderer.invoke('smoke-finish',r),
 onOpen:cb=>ipcRenderer.on('open-path',(_e,p)=>ipcRenderer.invoke('drop',p).then(cb).catch(error=>cb({error:error.message})))
});
