const {contextBridge,ipcRenderer,webUtils}=require('electron');
contextBridge.exposeInMainWorld('viewer',{
 captureFrame:view=>ipcRenderer.invoke('capture-frame',view),captureFinish:report=>ipcRenderer.invoke('capture-finish',report),
 turntableFrame:(index,data)=>ipcRenderer.invoke('turntable-frame',index,data),turntableSecond:()=>ipcRenderer.invoke('turntable-second'),
 recordTurntable:args=>ipcRenderer.invoke('turntable-record',args),cancelTurntable:()=>ipcRenderer.invoke('turntable-cancel'),
 onTurntableProgress:cb=>ipcRenderer.on('turntable-progress',(_e,stage)=>cb(stage)),
 openPublicICC:id=>ipcRenderer.invoke('open-public-icc',id),publicE8Presets:()=>ipcRenderer.invoke('public-e8-presets'),
 initial:()=>ipcRenderer.invoke('initial'),open:()=>ipcRenderer.invoke('open'),
 drop:file=>ipcRenderer.invoke('drop',webUtils.getPathForFile(file)),snapshot:()=>ipcRenderer.invoke('snapshot'),
 config:()=>ipcRenderer.invoke('config'),checkUpdates:()=>ipcRenderer.invoke('check-updates'),releasePage:()=>ipcRenderer.invoke('release-page'),
 associationOptions:()=>ipcRenderer.invoke('association-options'),registerAssociations:values=>ipcRenderer.invoke('association-register',values),associationSettings:()=>ipcRenderer.invoke('association-settings'),
 authorSite:()=>ipcRenderer.invoke('author-site'),
 projectSite:()=>ipcRenderer.invoke('project-site'),
 smokeFinish:r=>ipcRenderer.invoke('smoke-finish',r),
 onOpen:cb=>ipcRenderer.on('open-path',(_e,p)=>ipcRenderer.invoke('drop',p).then(cb).catch(error=>cb({error:error.message})))
});
