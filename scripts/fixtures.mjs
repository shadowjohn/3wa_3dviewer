import fs from 'node:fs/promises';
import { Document,NodeIO } from '@gltf-transform/core';
import { ALL_EXTENSIONS } from '@gltf-transform/extensions';
import { draco,meshopt } from '@gltf-transform/functions';
import draco3d from 'draco3dgltf';
import { MeshoptEncoder } from 'meshoptimizer';
const dir=process.argv[2]||'qa/fixtures';await fs.mkdir(dir,{recursive:true});
const doc=new Document(),buffer=doc.createBuffer();
const pos=doc.createAccessor().setType('VEC3').setArray(new Float32Array([-1,-1,1,1,-1,1,0,1,1,0,0,-1])).setBuffer(buffer);
const idx=doc.createAccessor().setType('SCALAR').setArray(new Uint16Array([0,1,2,1,0,3,2,1,3,0,2,3])).setBuffer(buffer);
const mat=doc.createMaterial().setBaseColorFactor([.15,.8,.6,1]).setRoughnessFactor(.6);
const primitive=doc.createPrimitive().setAttribute('POSITION',pos).setIndices(idx).setMaterial(mat);
const mesh=doc.createMesh().addPrimitive(primitive),node=doc.createNode().setMesh(mesh);doc.createScene().addChild(node);
const io=new NodeIO().registerExtensions(ALL_EXTENSIONS).registerDependencies({'meshopt.encoder':MeshoptEncoder,'draco3d.encoder':await draco3d.createEncoderModule(),'draco3d.decoder':await draco3d.createDecoderModule()});
await io.write(dir+'/plain.glb',doc);await io.write(dir+'/external.gltf',doc);
let d=await io.read(dir+'/plain.glb');await d.transform(draco());await io.write(dir+'/draco.glb',d);
await MeshoptEncoder.ready;d=await io.read(dir+'/plain.glb');await d.transform(meshopt({encoder:MeshoptEncoder}));await io.write(dir+'/meshopt.glb',d);
const bytes=await fs.readFile(dir+'/plain.glb');let feature=Buffer.from(JSON.stringify({BATCH_LENGTH:0,RTC_CENTER:[100,200,300]}));feature=Buffer.concat([feature,Buffer.alloc((8-(28+feature.length)%8)%8,32)]);const head=Buffer.alloc(28);head.write('b3dm');head.writeUInt32LE(1,4);head.writeUInt32LE(28+feature.length+bytes.length,8);head.writeUInt32LE(feature.length,12);await fs.writeFile(dir+'/sample.b3dm',Buffer.concat([head,feature,bytes]));await fs.writeFile(dir+'/broken.glb','not a valid GLB');
console.log('Generated plain, external glTF, Draco, Meshopt, b3dm and malformed fixtures in '+dir);

try{const lamp=await io.read(dir+'/ktx/AnisotropyBarnLamp.gltf');await io.write(dir+'/ktx-lamp.glb',lamp);}catch(e){if(e.code!=='ENOENT')throw e;}

const unsupported=JSON.parse(await fs.readFile(dir+'/external.gltf','utf8'));unsupported.extensionsRequired=['UNSUPPORTED_test'];await fs.writeFile(dir+'/unsupported.gltf',JSON.stringify(unsupported));
await fs.copyFile(dir+'/plain.glb',dir+'/model 空白.GLB');
