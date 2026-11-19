const {app}=require('electron'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
async function task(){
 const inFile=process.argv[2],dir=await fs.realpath(path.dirname(inFile)),temp=await fs.realpath(os.tmpdir());
 if(path.dirname(dir).toLowerCase()!==temp.toLowerCase()||!/^3wa-viewer-web-job-[a-z0-9]+$/i.test(path.basename(dir))||path.basename(inFile)!=='options.json')throw Error('Invalid web capture job path.');
 let p;
 try{
  if((await fs.lstat(path.join(dir,'options.json'))).size>4096)throw Error('Invalid public capture request.');
  const a=JSON.parse(await fs.readFile(path.join(dir,'options.json'),'utf8')),cfg=require('./web-preview-policy.cjs').captureOptions(a);
  const wx=require('./web-preview.cjs');p=wx.createWindow(false,cfg.preset);const result=await wx.capture(p,cfg,{signal:AbortSignal.timeout(60000),stagingRoot:dir});
  await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({ok:true,result}),{flag:'wx'});
 }catch(e){await fs.writeFile(path.join(dir,'result.json'),JSON.stringify({ok:false,error:e.message}),{flag:'wx'});throw e;}
 finally{if(p&&!p.n.isDestroyed())p.n.destroy();}
}
app.on('window-all-closed',()=>{});
app.whenReady().then(task).then(()=>app.exit(0),()=>app.exit(2));
