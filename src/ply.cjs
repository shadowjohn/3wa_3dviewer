// Conservative PLY schema + complete payload validation before Three.js allocation.
const types={char:[1,'Int8',-128,127],uchar:[1,'UInt8',0,255],short:[2,'Int16',-32768,32767],ushort:[2,'UInt16',0,65535],int:[4,'Int32',-2147483648,2147483647],uint:[4,'UInt32',0,4294967295],float:[4,'Float'],double:[8,'Double']};
for(const [a,b] of Object.entries({int8:'char',uint8:'uchar',int16:'short',uint16:'ushort',int32:'int',uint32:'uint',float32:'float',float64:'double'}))types[a]=types[b];
function validatePly(bytes){
 if(bytes.length>256*1024**2)throw Error('PLY preview limit: 256 MB.');
 const head=bytes.subarray(0,65536).toString('ascii'),end=/end_header\r?\n/.exec(head);
 if(!head.startsWith('ply\n')&&!head.startsWith('ply\r\n')||!end)throw Error('Invalid PLY header.');
 const offset=end.index+end[0].length,lines=head.slice(0,end.index).trim().split(/\r?\n/);let format,e;const elements=[];
 for(const line of lines.slice(1)){const t=line.trim().split(/\s+/);if(['comment','obj_info'].includes(t[0]))continue;
  if(t[0]==='format'){if(format||t[2]!=='1.0'||!['ascii','binary_little_endian','binary_big_endian'].includes(t[1]))throw Error('Unsupported PLY format.');format=t[1];}
  else if(t[0]==='element'){const count=Number(t[2]);if(!['vertex','face'].includes(t[1])||elements.some(x=>x.name===t[1])||!/^\d+$/.test(t[2])||!Number.isSafeInteger(count)||count<0||count>2000000)throw Error('Unsupported PLY element/count (max 2 million).');e={name:t[1],count,props:[]};elements.push(e);}
  else if(t[0]==='property'){if(!e)throw Error('PLY property outside element.');const list=t[1]==='list',type=t[list?3:1],name=t[list?4:2];if(/^(f_dc_|f_rest_|scale_|rot_)/.test(name)||name==='opacity')throw Error('Gaussian Splat PLY is not supported by this mesh/point viewer.');if(!types[type]||(list&&(!types[t[2]]||!types[t[2]][1].includes('Int')))||!name||e.props.some(p=>p.name===name))throw Error('Invalid PLY property.');e.props.push({name,type,list,countType:t[2]});}
  else throw Error('Unsupported PLY header directive.');
 }
 const vertex=elements.find(x=>x.name==='vertex');if(!format||!vertex?.count||!['x','y','z'].every(n=>vertex.props.some(p=>p.name===n&&!p.list)))throw Error('PLY requires vertex x y z.');
 let pos=offset,token=0;const text=format==='ascii'?bytes.toString('utf8',offset):null;const re=/\S+/g;
 function value(type){const spec=types[type];let n;if(text!==null){const m=re.exec(text);if(!m||!/^[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?$/i.test(m[0]))throw Error('Invalid PLY ASCII value.');if(spec.length===4&&!/^[+-]?\d+$/.test(m[0]))throw Error('Invalid PLY integer token.');n=Number(m[0]);token++;}else{if(pos+spec[0]>bytes.length)throw Error('Truncated PLY.');n=bytes['read'+spec[1]+(spec[0]===1?'':format==='binary_little_endian'?'LE':'BE')](pos);pos+=spec[0];}if(!Number.isFinite(n)||!Number.isFinite(Math.fround(n))||(spec.length===4&&(!Number.isInteger(n)||n<spec[2]||n>spec[3])))throw Error('PLY value out of range.');return n;}
 let items=0,triangles=0;
 for(const el of elements)for(let i=0;i<el.count;i++)for(const p of el.props){const count=p.list?value(p.countType):1;if(count<0||count>4096||(items+=count)>30000000)throw Error('PLY list/resource limit.');if(el.name==='face'&&p.list&&['vertex_indices','vertex_index'].includes(p.name)){triangles+=Math.max(count-2,0);if(triangles>2000000)throw Error('PLY triangulated triangle limit: 2 million.');}for(let k=0;k<count;k++){const n=value(p.type);if(el.name==='face'&&['vertex_indices','vertex_index'].includes(p.name)&&(!Number.isInteger(n)||n<0||n>=vertex.count))throw Error('PLY face index outside vertices.');}}
 if(text!==null?re.exec(text)!==null:pos!==bytes.length)throw Error('Unexpected trailing PLY payload.');
 return {vertices:vertex.count,faces:elements.find(x=>x.name==='face')?.count||0,format};
}
module.exports={validatePly};
