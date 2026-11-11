const fs=require('node:fs'),path=require('node:path'),cp=require('node:child_process');
const exe=process.argv[2]||require('electron');const packaged=process.argv.includes('--packaged');const folder=path.resolve('qa/fixtures'),output=path.resolve('qa');fs.mkdirSync(output,{recursive:true});
const cases=[['plain.glb',true],['draco.glb',true],['meshopt.glb',true],['external.gltf',true],['sample.b3dm',true],['broken.glb',false],['unsupported.gltf',false]];
if(fs.existsSync(path.join(folder,'ktx/AnisotropyBarnLamp.gltf')))cases.push(['ktx/AnisotropyBarnLamp.gltf',true]);
if(fs.existsSync(path.join(folder,'ktx-lamp.glb')))cases.push(['ktx-lamp.glb',true]);
if(fs.existsSync(path.join(folder,'cesium-city.b3dm')))cases.push(['cesium-city.b3dm',true]);
if(fs.existsSync(path.join(folder,'model 空白.GLB')))cases.push(['model 空白.GLB',true]);
let failed=0;for(const [name,expected] of cases){const file=path.join(folder,name),report=path.join(output,(packaged?'packaged-':'')+name.replaceAll(/[\/]/g,'-')+'.json');const args=[...(packaged?[]:['.']),file,'--smoke',report];const run=cp.spawnSync(exe,args,{timeout:150000,encoding:'utf8',windowsHide:false});let data;try{data=JSON.parse(fs.readFileSync(report,'utf8'));}catch{data={ok:false,error:'No report: '+run.error+' '+run.stderr};}const pass=data.ok===expected&&(expected?data.meta?.name===path.basename(file):(name==='unsupported.gltf'?/UNSUPPORTED_test/:/標頭|有效/).test(data.error||''));if(!pass)failed++;console.log(JSON.stringify({name,pass,expected,...data}));}process.exitCode=failed?1:0;
