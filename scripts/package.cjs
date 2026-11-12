const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const pkg=require('../package.json'),{DISPLAY_VERSION}=require('../src/version.cjs'),{outputPath}=require('./package-path.cjs');
const working=process.argv.includes('--working'),out=outputPath(DISPLAY_VERSION,working);
if(fs.existsSync(out)&&!working)throw Error('Release exists. Never overwrite a published release.');
if(working&&process.platform==='win32'){
 const result=cp.execFileSync('powershell.exe',['-NoProfile','-Command',"$p=$env:VIEWER_PACKAGE_PATH;$running=Get-CimInstance Win32_Process | Where-Object {$_.ExecutablePath -and $_.ExecutablePath.StartsWith($p+'\\',[StringComparison]::OrdinalIgnoreCase)};if($running){exit 23}"],{env:{...process.env,VIEWER_PACKAGE_PATH:out},windowsHide:true});
}
fs.mkdirSync(out,{recursive:true});fs.cpSync('node_modules/electron/dist',out,{recursive:true});
fs.copyFileSync(path.join(out,'electron.exe'),path.join(out,'3wa_3dviewer.exe'));fs.unlinkSync(path.join(out,'electron.exe'));
cp.execFileSync(process.execPath,[path.join(__dirname,'brand-exe.mjs'),path.join(out,'3wa_3dviewer.exe'),DISPLAY_VERSION]);
const app=path.join(out,'resources/app');fs.mkdirSync(app,{recursive:true});for(const f of ['src','web'])fs.cpSync(f,path.join(app,f),{recursive:true});
fs.writeFileSync(path.join(app,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,main:pkg.main,productName:'3wa_3dviewer'},null,2));
for(const f of ['README.md','LICENSE','Register-OpenWith.ps1','Unregister-OpenWith.ps1'])if(fs.existsSync(f))fs.copyFileSync(f,path.join(out,f));
fs.mkdirSync(path.join(out,'docs'),{recursive:true});for(const f of ['VALIDATION.md','RELEASE.md','VRM.md','SETTINGS.md','TASKS.md'])if(fs.existsSync(path.join('docs',f)))fs.copyFileSync(path.join('docs',f),path.join(out,'docs',f));
console.log(out);
