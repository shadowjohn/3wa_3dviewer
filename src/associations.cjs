const path=require('node:path');
const FORMATS=Object.freeze(['.glb','.gltf','.b3dm','.vrm','.obj','.stl','.ply','.dae']);
function planRegistration(values,exe){
 if(!Array.isArray(values)||!values.length||values.some(x=>!FORMATS.includes(x)))throw Error('請至少勾選一種目前支援的格式。');
 if(typeof exe!=='string'||!path.win32.isAbsolute(exe)||!/^[a-z]:\\/i.test(exe)||/["\r\n\0]/.test(exe)||path.win32.extname(exe).toLowerCase()!=='.exe')throw Error('請從本機 portable 執行檔設定關聯。');
 const selected=[...new Set(values)],commands=[];
 for(const ext of selected){
  const progid='3WA.3DViewer'+ext,root='HKCU\\Software\\Classes\\'+progid;
  commands.push(['add',root,'/ve','/t','REG_SZ','/d','3WA 3D Viewer ('+ext+')','/f']);
  commands.push(['add',root+'\\shell\\open\\command','/ve','/t','REG_SZ','/d','"'+exe+'" "%1"','/f']);
  commands.push(['add',root+'\\DefaultIcon','/ve','/t','REG_SZ','/d','"'+exe+'",0','/f']);
  commands.push(['add','HKCU\\Software\\Classes\\'+ext+'\\OpenWithProgids','/v',progid,'/t','REG_SZ','/d','','/f']);
 }
 return {selected,commands};
}
async function registerSelected(values,exe,run){
 const plan=planRegistration(values,exe),registered=[],failed=[];
 for(const extension of plan.selected){try{for(const cmd of planRegistration([extension],exe).commands)await run(cmd);registered.push(extension);}catch(e){failed.push({extension,error:e.message});}}
 return {registered,failed,defaultChanged:false};
}
module.exports={FORMATS,planRegistration,registerSelected};
