const fs=require('node:fs'),path=require('node:path');const pkg=require('../package.json');const {DISPLAY_VERSION}=require('../src/version.cjs');
const out=path.resolve('release/3wa_3dviewer-'+DISPLAY_VERSION+'-win-x64'+(process.argv.includes('--preview-vrm')?'-vrm-preview':''));if(fs.existsSync(out))throw Error('Release exists. Bump version or choose another output; never overwrite a running release.');
fs.cpSync('node_modules/electron/dist',out,{recursive:true});fs.renameSync(path.join(out,'electron.exe'),path.join(out,'3wa_3dviewer.exe'));
const app=path.join(out,'resources/app');fs.mkdirSync(app,{recursive:true});for(const f of ['src','web'])fs.cpSync(f,path.join(app,f),{recursive:true});
fs.writeFileSync(path.join(app,'package.json'),JSON.stringify({name:pkg.name,version:pkg.version,main:pkg.main,productName:'3WA 3D Viewer'},null,2));
for(const f of ['README.md','LICENSE','Register-OpenWith.ps1','Unregister-OpenWith.ps1'])if(fs.existsSync(f))fs.copyFileSync(f,path.join(out,f));console.log(out);

fs.mkdirSync(path.join(out,'docs'),{recursive:true});for(const f of ['VALIDATION.md','RELEASE.md','VRM.md'])fs.copyFileSync(path.join('docs',f),path.join(out,'docs',f));
