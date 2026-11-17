const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const {DISPLAY_VERSION}=require('../src/version.cjs');const {outputPath}=require('./package-path.cjs');
const {promote,assertStopped}=require('./working-package.cjs');
const output=outputPath(DISPLAY_VERSION,true),tag='build'+Date.now()+process.pid;
const stage=outputPath(DISPLAY_VERSION,false,tag),lock=path.join(root,'release','.working-build.lock');
fs.mkdirSync(path.dirname(lock),{recursive:true});
const fd=fs.openSync(lock,'wx');
try{
 fs.writeFileSync(fd,String(process.pid));assertStopped(output);
 const r=cp.spawnSync(process.execPath,[require.resolve('./package.cjs'),'--preview='+tag],{cwd:root,stdio:'inherit',windowsHide:true});
 if(r.error)throw r.error;if(r.status!==0)throw Error('Packaging failed. Existing working installation is unchanged.');
 fs.unlinkSync(path.join(stage,'PREVIEW.txt'));
 const archive=promote(stage,output,path.resolve(root,'..','3wa_3dviewer-build-archive'));
 console.log('Current portable: '+output);if(archive)console.log('Previous working build, including original user data: '+archive);
 console.log('Versioned releases and MCP registration were not changed.');
}finally{fs.closeSync(fd);fs.unlinkSync(lock);}
