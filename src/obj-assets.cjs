const fs=require('node:fs/promises'),path=require('node:path');
const MAX_BYTES=1024**3;
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.bmp':'image/bmp'};
function localName(value){
 let s;try{s=decodeURIComponent(value);}catch{throw Error('Unsafe resource encoding');}
 s=s.replace(/\\/g,'/');
 if(!s||s.startsWith('/')||/[:?#\0\r\n]/.test(s)||s.split('/').includes('..'))throw Error('Unsafe local resource: '+value);
 return s;
}
function inside(root,target){const rel=path.relative(root,target);return rel!== '..'&&!rel.startsWith('..'+path.sep)&&!path.isAbsolute(rel);}
function unquote(s){s=s.trim();if(s.startsWith('"')){if(!s.endsWith('"')||s.slice(1,-1).includes('"'))throw Error('Unsupported quoted resource');return s.slice(1,-1);}if(s.includes('"'))throw Error('Unsupported quoted resource');return s;}
function libraries(value){
 if(value.includes('"')){const matches=value.match(/"[^"]+"|\S+/g)||[];return matches.map(unquote);}
 // A lone name with spaces is common; multiple .mtl names use standard whitespace separation.
 const words=value.trim().split(/\s+/);return words.length>1&&words.every(w=>/\.mtl$/i.test(w))?words:[value.trim()];
}
function texture(value){
 const words=value.trim().split(/\s+/),prefix=[];
 while(words[0]?.startsWith('-')){const option=words.shift(),count={'-s':3,'-o':3,'-bm':1,'-mm':2}[option];if(!count)throw Error('Unsupported MTL texture option: '+option);const args=words.splice(0,count);if(args.length!==count||args.some(v=>v===''||!Number.isFinite(Number(v))))throw Error('Invalid MTL texture option: '+option);prefix.push(option,...args);}
 return {prefix:prefix.length?prefix.join(' ')+' ':'',name:unquote(words.join(' '))};
}
async function prepareObj(file,bytes){
 const root=await fs.realpath(path.dirname(file));let total=bytes.length;if(total>MAX_BYTES)throw Error('OBJ resources exceed 1 GB');
 const text=bytes.toString('utf8').replace(/^\uFEFF/,''),cache=new Map();
 async function read(base,name){const target=path.resolve(base,localName(name));if(!inside(root,target))throw Error('Unsafe resource outside OBJ directory');let real,stat;try{real=await fs.realpath(target);stat=await fs.stat(real);}catch{throw Error('Missing local OBJ resource: '+name);}if(!inside(root,real))throw Error('Unsafe linked resource outside OBJ directory');if(!stat.isFile())throw Error('OBJ resource is not a file: '+name);if(cache.has(real))return {data:cache.get(real),real};total+=stat.size;if(total>MAX_BYTES)throw Error('OBJ resources exceed 1 GB');const data=await fs.readFile(real);cache.set(real,data);return {data,real};}
 const names=[];for(const line of text.split(/\r?\n/)){const m=/^\s*mtllib\s+(.+)$/i.exec(line);if(m)names.push(...libraries(m[1]));}
 const mtls=[];for(const name of [...new Set(names)]){const {data,real}=await read(root,name);const lines=[];for(const line of data.toString('utf8').replace(/^\uFEFF/,'').split(/\r?\n/)){
  const m=/^\s*((?:map_\w+)|bump|norm|disp|decal)\s+(.+)$/i.exec(line);
  if(!m){lines.push(line);continue;}
  const ref=texture(m[2]),asset=await read(path.dirname(real),ref.name),mime=MIME[path.extname(asset.real).toLowerCase()];if(!mime)throw Error('Unsupported local texture type: '+ref.name);
  lines.push(m[1]+' '+ref.prefix+'data:'+mime+';base64,'+asset.data.toString('base64'));
 }
 mtls.push({text:lines.join('\n'),base:''});}
 return {text,mtls,assets:{},note:'OBJ local materials/textures only; no external network resources.',total};
}
module.exports={prepareObj};
