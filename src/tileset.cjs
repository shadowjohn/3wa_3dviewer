const fs=require('node:fs/promises'),path=require('node:path');
const {validateGlb,unpackB3dm}=require('./core.cjs');
const LIMIT={bytes:256*1024*1024,json:8*1024*1024,depth:32,nodes:512,contents:128};
const GLTF_REQUIRED=new Set(['VRM','VRMC_vrm','VRMC_materials_mtoon','VRMC_springBone','VRMC_node_constraint','VRMC_materials_hdr_emissiveMultiplier','KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu','EXT_texture_webp','KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_emissive_strength','KHR_materials_dispersion','KHR_materials_diffuse_transmission','KHR_texture_transform','KHR_lights_punctual','EXT_mesh_gpu_instancing']);
function gltfExtensions(j){if(j.extensions?.CESIUM_RTC||j.extensionsUsed?.includes('CESIUM_RTC')||j.extensionsRequired?.includes('CESIUM_RTC'))throw Error('GLB CESIUM_RTC unsupported; use b3dm RTC_CENTER');if(j.extensionsRequired!==undefined&&(!Array.isArray(j.extensionsRequired)||j.extensionsRequired.some(x=>!GLTF_REQUIRED.has(x))))throw Error('Required GLB extension unsupported');}
function object(v){return v!==null&&typeof v==='object'&&!Array.isArray(v);}
function number(v){return typeof v==='number'&&Number.isFinite(v);}
function array(v,n){return Array.isArray(v)&&v.length===n&&v.every(number);}
function volume(v){
 if(!object(v))throw Error('Missing or invalid tile boundingVolume');const keys=Object.keys(v);if(keys.length!==1)throw Error('Unsupported boundingVolume fields');
 if(keys[0]==='sphere'&&array(v.sphere,4)&&v.sphere[3]>=0)return {sphere:[...v.sphere]};
 if(keys[0]==='box'&&array(v.box,12))return {box:[...v.box]};
 throw Error('Only finite sphere/box boundingVolume supported; region is not supported');
}
function transform(v){if(v===undefined)return null;if(!array(v,16)||v[3]!==0||v[7]!==0||v[11]!==0||v[15]!==1)throw Error('Invalid affine tile transform');const d=v[0]*(v[5]*v[10]-v[9]*v[6])-v[4]*(v[1]*v[10]-v[9]*v[2])+v[8]*(v[1]*v[6]-v[5]*v[2]);if(!number(d)||d===0)throw Error('Singular or overflowing tile transform unsupported');return [...v];}
function extensions(v){if(v.extensionsRequired!==undefined&&(!Array.isArray(v.extensionsRequired)||v.extensionsRequired.length))throw Error('Required tileset extensions unsupported');if(v.extensions!==undefined&&(!object(v.extensions)||Object.keys(v.extensions).length))throw Error('Tileset extension payload unsupported');}
function inside(root,target){const r=path.relative(root,target);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);}
async function prepareTileset(file,bytes){
 if(bytes.length>LIMIT.json)throw Error('Tileset JSON 8 MB budget exceeded');
 const rootDir=await fs.realpath(path.dirname(file));if(rootDir.startsWith('\\\\')||rootDir.startsWith('//'))throw Error('Network tileset root forbidden');
 const initial=await fs.realpath(file);if(!inside(rootDir,initial))throw Error('Tileset entry escapes root');
 const seen=new Set([initial.toLowerCase()]),contents=[];let total=bytes.length,nodes=0;
 async function read(base,uri){
  if(typeof uri!=='string'||!uri)throw Error('Invalid content URI');let name;try{name=decodeURIComponent(uri).replace(/\\/g,'/');}catch{throw Error('Unsafe content URI encoding');}
  if(name.startsWith('/')||/[:?#\0\r\n]/.test(name))throw Error('Unsafe external content URI');const target=path.resolve(base,name);if(!inside(rootDir,target))throw Error('Unsafe content outside tileset root');
  let real,stat;try{real=await fs.realpath(target);stat=await fs.stat(real);}catch{throw Error('Missing tileset content: '+uri);}if(!inside(rootDir,real))throw Error('Unsafe linked content outside tileset root');if(!stat.isFile())throw Error('Tileset content is not a file');
  const ext=path.extname(real).toLowerCase();if(!['.json','.glb','.b3dm'].includes(ext))throw Error('Unsupported tile content type: '+ext);
  const key=real.toLowerCase();if(seen.has(key))throw Error('Cyclic or repeated tileset content reference');seen.add(key);
  if(ext!=='.json'&&contents.length>=LIMIT.contents)throw Error('Tileset content budget exceeded');
  if(total+stat.size>LIMIT.bytes||(ext==='.json'&&stat.size>LIMIT.json))throw Error('Tileset byte budget exceeded');total+=stat.size;
  const data=await fs.readFile(real);if(data.length!==stat.size)throw Error('Tileset content changed while reading');return {real,data,ext};
 }
 function json(data){if(data.length>LIMIT.json)throw Error('Tileset JSON 8 MB budget exceeded');let j;try{j=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(data).replace(/^\uFEFF/,''));}catch{throw Error('Invalid tileset JSON');}if(!object(j)||!object(j.asset)||!['1.0','1.1'].includes(j.asset.version)||!number(j.geometricError)||j.geometricError<0||!object(j.root))throw Error('Invalid tileset schema/version/geometricError');if(j.asset.gltfUpAxis!==undefined&&j.asset.gltfUpAxis!=='Y')throw Error('Only glTF Y-up axis supported');extensions(j);return j;}
 async function node(t,base,depth,inherited){
  if(depth>LIMIT.depth)throw Error('Tileset depth budget exceeded');if(++nodes>LIMIT.nodes)throw Error('Tileset node budget exceeded');if(!object(t))throw Error('Invalid tile');extensions(t);
  if(Object.hasOwn(t,'implicitTiling')||Object.hasOwn(t,'contents'))throw Error('Implicit tiling and multiple contents are unsupported');
  if(!number(t.geometricError)||t.geometricError<0)throw Error('Invalid tile geometricError');const refine=t.refine===undefined?inherited:t.refine;if(!['ADD','REPLACE'].includes(refine))throw Error('Invalid tile refine');
  const n={boundingVolume:volume(t.boundingVolume),geometricError:t.geometricError,refine,transform:transform(t.transform),contentId:null,children:[]};
  if(t.viewerRequestVolume!==undefined)throw Error('viewerRequestVolume unsupported in local preview');
  if(t.content!==undefined){const c=t.content;if(!object(c)||(!Object.hasOwn(c,'uri')&&!Object.hasOwn(c,'url'))||(Object.hasOwn(c,'uri')&&Object.hasOwn(c,'url')))throw Error('Invalid tile content');extensions(c);if(c.boundingVolume!==undefined)volume(c.boundingVolume);const r=await read(base,c.uri??c.url);
   if(r.ext==='.json'){n.children.push(await node(json(r.data).root,path.dirname(r.real),depth+1,'REPLACE'));}
   else{if(contents.length>=LIMIT.contents)throw Error('Tileset content budget exceeded');let data=r.data,rtc=null,kind='glb';if(r.ext==='.b3dm'){const b=unpackB3dm(data);data=b.bytes;rtc=b.rtc||null;kind='b3dm';}gltfExtensions(validateGlb(data));const id=contents.length;contents.push({id,kind,data:new Uint8Array(data),rtc});n.contentId=id;}
  }
  if(t.children!==undefined){if(!Array.isArray(t.children))throw Error('Tile children must be an array');for(const child of t.children)n.children.push(await node(child,base,depth+1,refine));}
  return n;
 }
 const root=await node(json(bytes).root,path.dirname(initial),0,'REPLACE');
 return {root,contents,total,note:'Local explicit 3D Tiles 1.0/1.1; GLB/b3dm and nested JSON only. Sphere/box bounds, no region/implicit/multiple content.'};
}
module.exports={prepareTileset};
