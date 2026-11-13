const path = require('node:path');
const fs=require('node:fs/promises');
const SUPPORTED=['.glb','.gltf','.b3dm','.vrm','.obj','.stl','.ply','.dae'];
function glbArgument(args) { return args.find(a => !a.startsWith('--') && (SUPPORTED.includes(path.extname(a).toLowerCase())||path.basename(a).toLowerCase()==='tileset.json')); }
function validateGlb(buffer) {
 if(buffer.length<20) throw Error('檔案太短，不是有效的 GLB。');
 if(buffer.readUInt32LE(0)!==0x46546c67) throw Error('檔案標頭不是 GLB。');
 if(buffer.readUInt32LE(4)!==2) throw Error('目前支援 glTF / GLB 2.0。');
 if(buffer.readUInt32LE(8)!==buffer.length) throw Error('GLB 長度不符，檔案可能下載不完整。');
 let offset=12, json;
 while(offset<buffer.length) {
  if(offset+8>buffer.length) throw Error('GLB 區塊標頭不完整。');
  const size=buffer.readUInt32LE(offset), type=buffer.readUInt32LE(offset+4); offset+=8;
  if(size%4 || offset+size>buffer.length) throw Error('GLB 區塊長度無效。');
  if(!json) {if(type!==0x4e4f534a) throw Error('第一個 GLB 區塊必須是 JSON。'); json=JSON.parse(buffer.toString('utf8',offset,offset+size).trim());}
  offset+=size;
 }
 if(!json) throw Error('GLB 缺少 JSON。');
 for(const item of [...(json.buffers||[]),...(json.images||[])]) {
  if(item.uri && !item.uri.startsWith('data:')) throw Error('這個 GLB 依賴外部資源；請用 glTF + 資源資料夾，或匯出完整內嵌 GLB。');
 }
 if(json.asset?.version!=='2.0')throw Error('僅支援 glTF 2.0。');
 return json;
}
function unpackB3dm(bytes){
 if(bytes.length<28||bytes.toString('ascii',0,4)!=='b3dm')throw Error('不是有效 b3dm。');
 if(bytes.readUInt32LE(4)!==1||bytes.readUInt32LE(8)!==bytes.length)throw Error('b3dm 版本或檔案長度無效；支援標準 v1 28-byte header。');
 const [fj,fb,bj,bb]=[12,16,20,24].map(i=>bytes.readUInt32LE(i));const offset=28+fj+fb+bj+bb;
 if(offset>bytes.length-20)throw Error('b3dm table 範圍超出檔案。');
 let feature={};if(fj)feature=JSON.parse(bytes.toString('utf8',28,28+fj).trim().replace(/\0+$/,''));
 let rtc=feature.RTC_CENTER;
 if(rtc && !Array.isArray(rtc)){const o=rtc.byteOffset;if(!Number.isInteger(o)||o<0||o+12>fb)throw Error('RTC_CENTER binary 範圍無效。');rtc=[0,4,8].map(i=>bytes.readFloatLE(28+fj+o+i));}
 if(rtc && (rtc.length!==3||!rtc.every(Number.isFinite)))throw Error('RTC_CENTER 無效。');
 const glb=bytes.subarray(offset);const json=validateGlb(glb);
 return {bytes:glb,json,note:'b3dm 本地模型檢視；未套用 tileset transform 或地理定位。'+(rtc?' RTC_CENTER '+rtc.join(', ')+'（已保留資訊，檢視時以模型中心為原點）':''),rtc};
}
function safeRelative(root,uri){
 let decoded;try{decoded=decodeURIComponent(uri);}catch{throw Error('無效資源 URI。');}
 if(!decoded||/^[a-z][a-z0-9+.-]*:/i.test(decoded)||path.isAbsolute(decoded)||decoded.startsWith('/')||decoded.startsWith('\\')||/[?:#\0]/.test(decoded))throw Error('外部資源必須是模型目錄下的相對檔案。');
 const target=path.resolve(root,decoded),rel=path.relative(root,target);if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('已阻擋跨出模型目錄的資源。');return target;
}
async function embedGltf(file,bytes){
 const json=JSON.parse(bytes.toString('utf8').replace(/^\uFEFF/,''));if(json.asset?.version!=='2.0')throw Error('僅支援 glTF 2.0。');
 const root=await fs.realpath(path.dirname(file));let total=bytes.length;
 for(const item of [...(json.buffers||[]),...(json.images||[])]){if(!item.uri||item.uri.startsWith('data:'))continue;const target=safeRelative(root,item.uri);const real=await fs.realpath(target);const rel=path.relative(root,real);if(rel==='..'||rel.startsWith('..'+path.sep)||path.isAbsolute(rel))throw Error('已阻擋指向模型目錄外的連結。');const stat=await fs.stat(real);if(!stat.isFile())throw Error('外部資源不是一般檔案。');total+=stat.size;if(total>1024**3)throw Error('模型與資源總量超過 1 GB。');const data=await fs.readFile(real);const mime=item.mimeType||({'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.ktx2':'image/ktx2','.avif':'image/avif'}[path.extname(real).toLowerCase()]||'application/octet-stream');item.uri='data:'+mime+';base64,'+data.toString('base64');}
 return {json,bytes:Buffer.from(JSON.stringify(json)),total};
}
module.exports={glbArgument,validateGlb,unpackB3dm,safeRelative,embedGltf,SUPPORTED};

function vrmInfo(json){
 const one=json.extensions?.VRMC_vrm,zero=json.extensions?.VRM;
 if(one){if(one.specVersion!=='1.0')throw Error('Unsupported VRM version: '+one.specVersion);return {version:'1.0',name:String(one.meta?.name||''),authors:(one.meta?.authors||[]).map(String).join(', ')};}
 if(zero){if(zero.specVersion&&!/^0\./.test(zero.specVersion))throw Error('Unsupported VRM version: '+zero.specVersion);return {version:'0.x',name:String(zero.meta?.title||''),authors:String(zero.meta?.author||'')};}
 return null;
}
module.exports.vrmInfo=vrmInfo;
