const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
function assertStopped(output){
 if(process.platform!=='win32')return;
 cp.execFileSync('powershell.exe',['-NoProfile','-Command',"$ErrorActionPreference='Stop';$p=$env:VIEWER_PACKAGE_PATH;$running=Get-CimInstance Win32_Process | Where-Object {($_.ExecutablePath -and $_.ExecutablePath.StartsWith($p+'\\',[StringComparison]::OrdinalIgnoreCase)) -or ($_.CommandLine -and $_.CommandLine.IndexOf($p,[StringComparison]::OrdinalIgnoreCase) -ge 0)};if($running){Write-Error 'Close the working viewer and its MCP server before building.';exit 23}"],{env:{...process.env,VIEWER_PACKAGE_PATH:output},windowsHide:true,stdio:'pipe'});
}
function promote(stage,output,archiveRoot,guard=assertStopped){
 for(const p of [stage,output,archiveRoot])if(!path.isAbsolute(p))throw Error('Absolute package paths required');
 if(stage===output||!fs.existsSync(path.join(stage,'3wa_3dviewer.exe')))throw Error('Invalid staged package');
 guard(output);
 const data=path.join(output,'portable-data');
 if(fs.existsSync(data))fs.cpSync(data,path.join(stage,'portable-data'),{recursive:true,errorOnExist:true,force:false});
 guard(output);
 let archive=null;
 if(fs.existsSync(output)){
  fs.mkdirSync(archiveRoot,{recursive:true});
  archive=path.join(archiveRoot,path.basename(output)+'-'+Date.now()+'-'+process.pid);
  fs.renameSync(output,archive);
 }
 try{fs.renameSync(stage,output);}catch(e){
  if(archive&&!fs.existsSync(output))fs.renameSync(archive,output);
  throw e;
 }
 return archive;
}
module.exports={promote,assertStopped};
