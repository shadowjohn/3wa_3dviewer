const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('viewer',{
 initial:()=>ipcRenderer.invoke('initial'),open:()=>ipcRenderer.invoke('open'),
 drop:file=>ipcRenderer.invoke('drop',webUtils.getPathForFile(file)),snapshot:()=>ipcRenderer.invoke('snapshot'),
 config:()=>ipcRenderer.invoke('config'),checkUpdates:()=>ipcRenderer.invoke('check-updates'),releasePage:()=>ipcRenderer.invoke('release-page'),
 associationOptions:()=>ipcRenderer.invoke('association-options'),registerAssociations:values=>ipcRenderer.invoke('association-register',values),associationSettings:()=>ipcRenderer.invoke('association-settings'),
 authorSite:()=>ipcRenderer.invoke('author-site'),
 projectSite:()=>ipcRenderer.invoke('project-site'),
 smokeFinish:r=>ipcRenderer.invoke('smoke-finish',r),
 onOpen:cb=>ipcRenderer.on('open-path',(_e,p)=>ipcRenderer.invoke('drop',p).then(cb).catch(error=>cb({error:error.message})))
});
