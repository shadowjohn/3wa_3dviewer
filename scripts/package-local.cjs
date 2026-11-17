const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const root=path.resolve(__dirname,'..');process.chdir(root);
const {DISPLAY_VERSION}=require('../src/version.cjs');const {outputPath}=require('./package-path.cjs');
const output=outputPath(DISPLAY_VERSION);
if(fs.existsSync(output))throw Error('This version exists. Update src/version.cjs first. Nothing was overwritten.');
const r=cp.spawnSync(process.execPath,[require.resolve('./package.cjs')],{cwd:root,stdio:'inherit',windowsHide:true});
if(r.error)console.error(r.error);if(r.status!==0)process.exit(r.status||1);
console.log('Current portable: '+output);
console.log('Older builds are preserved until portable-data and MCP/shortcut references are reviewed.');
