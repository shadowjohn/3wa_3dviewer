import fs from 'node:fs/promises';
const revision='8f492390ddc7a2ae221a1369ef560589cf8c70fb';
const base=`https://raw.githubusercontent.com/KhronosGroup/glTF-Sample-Assets/${revision}/Models/AnisotropyBarnLamp/glTF-KTX-BasisU/`;
const dir='qa/fixtures/ktx';await fs.mkdir(dir,{recursive:true});
for(const name of ['AnisotropyBarnLamp.gltf','AnisotropyBarnLamp.bin','AnisotropyBarnLamp_anisotropy.ktx2','AnisotropyBarnLamp_basecolor.ktx2','AnisotropyBarnLamp_normalbump.ktx2','AnisotropyBarnLamp_occlusionroughnessmetal.ktx2']){const r=await fetch(base+name,{signal:AbortSignal.timeout(30000)});if(!r.ok)throw Error(name+': HTTP '+r.status);const bytes=new Uint8Array(await r.arrayBuffer());if(bytes.length>20*1024*1024)throw Error('Unexpected fixture size');await fs.writeFile(dir+'/'+name,bytes);}
console.log('Downloaded pinned Khronos KTX2 QA fixture (not distributed).');
