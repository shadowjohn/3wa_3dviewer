const fs=require('node:fs/promises'),path=require('node:path');
const NS='http://www.collada.org/2005/11/COLLADASchema',MAX=1024**3;
const MIME={'.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.avif':'image/avif','.gif':'image/gif','.bmp':'image/bmp'};
function entities(s){
 return s.replace(/&([^;\s]+);|&/g,(all,x)=>{if(!x)throw Error('Malformed XML entity');const predefined={amp:'&',lt:'<',gt:'>',quot:'"',apos:"'"};if(Object.hasOwn(predefined,x))return predefined[x];if(!/^#(?:[0-9]+|x[0-9a-fA-F]+)$/.test(x))throw Error('Unsupported XML entity');const n=x[1]==='x'?parseInt(x.slice(2),16):Number(x.slice(1));if(!Number.isInteger(n)||n>0x10ffff||n===0||(n<32&&![9,10,13].includes(n))||(n>=0xd800&&n<=0xdfff)||n===0xfffe||n===0xffff)throw Error('Invalid XML character');return String.fromCodePoint(n);});
}
function numericAttributes(attrs){
 for(const key of ['count','stride','offset'])if(Object.hasOwn(attrs,key)){
  const value=attrs[key],max=key==='count'?2000000:64;
  if(!/^\d+$/.test(value)||!Number.isSafeInteger(Number(value))||Number(value)>max||(key==='stride'&&Number(value)===0))throw Error('Invalid '+key+' or resource limit exceeded');
 }
}
function floatArray(attrs,value){
 if(!Object.hasOwn(attrs,'count'))throw Error('float_array requires count');
 const tokens=value.trim()?value.trim().split(/\s+/):[];
 if(tokens.length!==Number(attrs.count))throw Error('float_array count mismatch');
 for(const v of tokens)if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(v)||!Number.isFinite(Math.fround(Number(v))))throw Error('float_array contains invalid or nonfinite value');
}
function parseSubset(text){
 if(/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(text))throw Error('Invalid XML control character');
 if(/<!DOCTYPE|<!ENTITY/i.test(text))throw Error('DOCTYPE and entities are forbidden');
 const stack=[],images=[];let root=false,closed=false,prefix='',pos=0,nodes=0;
 while(pos<text.length){
  if(text[pos]!=='<'){const end=text.indexOf('<',pos),stop=end<0?text.length:end,part=text.slice(pos,stop);entities(part);if(!stack.length&&part.trim())throw Error('Text outside XML root');pos=stop;continue;}
  if(text.startsWith('<!--',pos)){const end=text.indexOf('-->',pos+4);if(end<0||text.slice(pos+4,end).includes('--'))throw Error('Malformed XML comment');if(stack.at(-1)?.local==='init_from')throw Error('Unsupported markup inside init_from');pos=end+3;continue;}
  if(text.startsWith('<?xml ',pos)&&!root&&text.slice(0,pos).trim()===''){const end=text.indexOf('?>',pos);if(end<0)throw Error('Malformed XML declaration');const declaration=text.slice(pos,end);if(/encoding\s*=\s*['"](?!UTF-8['"])/i.test(declaration))throw Error('Only UTF-8 DAE is supported');pos=end+2;continue;}
  const m=/^<\/?[A-Za-z_][\w.:-]*(?:\s+[A-Za-z_][\w.:-]*\s*=\s*(?:"[^"<]*"|'[^'<]*'))*\s*\/?>/.exec(text.slice(pos));
  if(!m)throw Error('Unsupported or malformed XML markup');const tag=m[0],end=pos+tag.length,closing=tag.startsWith('</'),self=/\/>$/.test(tag),name=/^<\/?([^\s/>]+)/.exec(tag)[1],local=name.split(':').at(-1);
  if(closing){if(self||!/^[<][/][\w.:-]+\s*>$/.test(tag)||stack.at(-1)?.name!==name)throw Error('Mismatched XML element');const node=stack.pop();if(local==='float_array')floatArray(node.attrs,entities(text.slice(node.content,pos)));if(local==='init_from'){const value=entities(text.slice(node.content,pos)).trim();if(node.image)images.push({start:node.content,end:pos,value});else if(!/^[A-Za-z_][\w.:-]*$/.test(value))throw Error('Unsupported non-image init_from reference');}if(!stack.length)closed=true;pos=end;continue;}
  if(closed)throw Error('Multiple XML roots');if(++nodes>100000)throw Error('XML node limit exceeded');if(stack.length>=128)throw Error('XML depth limit exceeded');if(stack.at(-1)?.local==='float_array')throw Error('Nested float_array content unsupported');if(stack.at(-1)?.local==='init_from')throw Error('Nested init_from structures are unsupported');
  const attrs={};for(const a of tag.matchAll(/([A-Za-z_][\w.:-]*)\s*=\s*("[^"]*"|'[^']*')/g)){if(Object.hasOwn(attrs,a[1]))throw Error('Duplicate XML attribute');attrs[a[1]]=entities(a[2].slice(1,-1));}
  numericAttributes(attrs);if(local==='float_array'&&self)floatArray(attrs,'');
  if(!root){if(local!=='COLLADA'||!['1.4.0','1.4.1'].includes(attrs.version))throw Error('Supported DAE subset is COLLADA 1.4.0/1.4.1');prefix=name.includes(':')?name.split(':')[0]:'';if(attrs[prefix?'xmlns:'+prefix:'xmlns']!==NS)throw Error('Unsupported COLLADA namespace');root=true;}
  else if(Object.keys(attrs).some(k=>k==='xmlns'||k.startsWith('xmlns:')))throw Error('Nested namespace declarations unsupported');
  if(name!==(prefix?prefix+':':'')+local)throw Error('Mixed XML namespaces unsupported');
  for(const [key,value] of Object.entries(attrs)){if(['url','source','href'].includes(key.split(':').at(-1))&&value&&!value.startsWith('#'))throw Error('External COLLADA references forbidden');if(key==='xml:base')throw Error('External XML base forbidden');}
  if(!self)stack.push({name,local,attrs,content:end,image:local==='init_from'&&stack.at(-1)?.local==='image'});else if(!stack.length)closed=true;
  pos=end;
 }
 if(!root||stack.length||!closed)throw Error('Incomplete COLLADA XML');return {images,prefix};
}
function inside(root,file){const r=path.relative(root,file);return r!=='..'&&!r.startsWith('..'+path.sep)&&!path.isAbsolute(r);}
async function prepareDae(file,bytes){
 let expanded=bytes.length;const expandedLimit=256*1024*1024;if(expanded>expandedLimit)throw Error('DAE expanded output exceeds 256 MB');
 let total=bytes.length;if(total>MAX)throw Error('DAE resources exceed 1 GB');
 const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes).replace(/^\uFEFF/,''),parsed=parseSubset(text),refs=parsed.images,root=await fs.realpath(path.dirname(file)),cache=new Map(),changes=[];
 for(const ref of refs){let name;try{name=decodeURIComponent(ref.value).replace(/\\/g,'/');}catch{throw Error('Unsafe image URI encoding');}if(!name||name.startsWith('/')||/[:?#\0\r\n]/.test(name)||name.split('/').includes('..'))throw Error('Unsafe local DAE image: '+ref.value);const target=path.resolve(root,name);if(!inside(root,target))throw Error('Unsafe image path');let real,stat;try{real=await fs.realpath(target);stat=await fs.stat(real);}catch{throw Error('Missing local DAE image: '+ref.value);}if(!inside(root,real))throw Error('Unsafe linked DAE image');if(!stat.isFile())throw Error('DAE image is not a file');const mime=MIME[path.extname(real).toLowerCase()];if(!mime)throw Error('Unsupported DAE image type');let uri=cache.get(real);if(!uri){total+=stat.size;if(total>MAX)throw Error('DAE resources exceed 1 GB');uri='data:'+mime+';base64,'+(await fs.readFile(real)).toString('base64');cache.set(real,uri);}expanded+=uri.length-Buffer.byteLength(text.slice(ref.start,ref.end),'utf8');if(expanded>expandedLimit)throw Error('DAE expanded output exceeds 256 MB');changes.push({...ref,uri});}
 let output=text;for(const c of changes.reverse())output=output.slice(0,c.start)+c.uri+output.slice(c.end);
 if(parsed.prefix){output=output.split('<'+parsed.prefix+':').join('<').split('</'+parsed.prefix+':').join('</').replace('xmlns:'+parsed.prefix,'xmlns');}
 return {text:output,note:'COLLADA 1.4.x subset; local embedded raster images only. No external references or mixed namespaces.',total};
}
module.exports={prepareDae};
