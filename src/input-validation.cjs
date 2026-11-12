const LIMIT=256*1024**2;
const DECIMAL=/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i;
function finiteFloat(v){return DECIMAL.test(v)&&Number.isFinite(Math.fround(Number(v)));}
function bounded(b){if(!b.length||b.length>LIMIT)throw Error('Mesh preview file limit: 1 byte to 256 MB.');}
function validateObj(b){bounded(b);const lines=b.toString('utf8').replace(/\\\r?\n/g,'').split(/\r?\n/);let vertices=0,faces=0,normals=0,uvs=0,triangles=0;const all=[];
 for(const line of lines){if(line.length>65536)throw Error('OBJ line too long.');const t=line.replace(/#.*/,'').trim().split(/\s+/);if(!t[0])continue;
 if(['v','vn','vt'].includes(t[0])){const min=t[0]==='vt'?2:3;if(t.length<min+1||!t.slice(1).every(finiteFloat))throw Error('Invalid OBJ coordinates.');if(t[0]==='v')vertices++;if(t[0]==='vn')normals++;if(t[0]==='vt')uvs++;}
 else if(t[0]==='f'){if(t.length<4||t.length>4097)throw Error('Invalid OBJ face.');faces++;triangles+=t.length-3;if(triangles>2000000)throw Error('OBJ triangulated triangle limit: 2 million.');all.push({indices:t.slice(1),counts:[vertices,uvs,normals]});}
 else if(!['o','g','s','mtllib','usemtl'].includes(t[0]))throw Error('Unsupported OBJ directive: '+t[0]);
 if(vertices>2000000||faces>2000000)throw Error('OBJ count limit: 2 million.');}
 if(!vertices||!faces)throw Error('OBJ requires triangle/polygon faces.');const counts=[vertices,uvs,normals];for(const f of all)for(const i of f.indices){const p=i.split('/');if(p.length>3)throw Error('Invalid OBJ index.');p.forEach((v,k)=>{if(!v&&k>0)return;const n=Number(v),max=n<0?f.counts[k]:counts[k];if(!/^-?\d+$/.test(v)||!Number.isSafeInteger(n)||n===0||Math.abs(n)>max)throw Error('OBJ index outside data.');});}return {vertices,faces};}
function validateStl(b){bounded(b);if(b.length>=84&&84+b.readUInt32LE(80)*50===b.length){const faces=b.readUInt32LE(80);if(!faces||faces>2000000)throw Error('STL face limit.');for(let p=84;p<b.length;p+=50)for(let k=0;k<48;k+=4)if(!Number.isFinite(b.readFloatLE(p+k)))throw Error('Invalid STL coordinates.');return;}
 const text=b.toString('utf8');if(!/^\s*solid(?:\s|$)/i.test(text)||!/^\s*endsolid\b/im.test(text))throw Error('Invalid or truncated STL.');const faces=(text.match(/\bfacet\s+normal\b/g)||[]).length;if(!faces||faces>2000000)throw Error('STL face count invalid.');if((text.match(/\bvertex\b/g)||[]).length!==faces*3||(text.match(/\bendfacet\b/g)||[]).length!==faces)throw Error('Truncated STL facets.');let checked=0;for(const m of text.matchAll(/(?:\bfacet\s+normal|\bvertex)\s+(\S+)\s+(\S+)\s+(\S+)/g)){if(!m.slice(1).every(finiteFloat))throw Error('Invalid STL coordinates.');checked++;}if(checked!==faces*4)throw Error('Invalid STL coordinates.');}
module.exports={validateObj,validateStl};
