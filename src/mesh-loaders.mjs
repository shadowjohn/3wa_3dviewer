import {ColladaLoader} from 'three/addons/loaders/ColladaLoader.js';
import {PLYLoader} from 'three/addons/loaders/PLYLoader.js';
import * as THREE from 'three';
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js';
import {MTLLoader} from 'three/addons/loaders/MTLLoader.js';
import {STLLoader} from 'three/addons/loaders/STLLoader.js';
export async function parseMesh(payload, manager=new THREE.LoadingManager()) {
 let root,textureError;
 const ready=new Promise(resolve=>{manager.onLoad=resolve;});manager.onError=url=>{textureError=new Error('Unable to decode local texture.');};
 manager.itemStart('mesh-parse');
 try{
 if(payload.kind==='dae'){const result=new ColladaLoader(manager).parse(payload.dae.text,'');root=result.scene;}else if(payload.kind==='obj'){
  const loader=new OBJLoader(manager);const mtls=payload.obj.mtls||[];
  if(mtls.length){const m=new MTLLoader(manager).parse(mtls.map(x=>x.text).join('\n'),'');loader.setMaterials(m);}
  root=loader.parse(payload.obj.text);
 }else if(payload.kind==='stl'){
  const a=payload.data,buffer=a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength),v=new DataView(buffer);
  const binary=buffer.byteLength>=84&&84+v.getUint32(80,true)*50===buffer.byteLength;
  if(!binary&&!/^\s*solid\s/i.test(new TextDecoder().decode(new Uint8Array(buffer,0,Math.min(buffer.byteLength,80)))))throw Error('Invalid or truncated STL.');
  const g=new STLLoader(manager).parse(buffer),p=g.attributes.position;
  if(!p?.count||p.count%3||!p.array.every(Number.isFinite)){g.dispose();throw Error('STL has no valid triangles.');}
  root=new THREE.Group();root.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:g.hasColors?0xffffff:0xb5bfc9,vertexColors:!!g.hasColors,opacity:g.alpha??1,transparent:(g.alpha??1)<1,roughness:.65})));
  }else if(payload.kind==='ply'){
 const a=payload.data,g=new PLYLoader(manager).parse(a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength));
 root=new THREE.Group();if(g.index?.count){if(!g.attributes.normal)g.computeVertexNormals();root.add(new THREE.Mesh(g,new THREE.MeshStandardMaterial({color:g.attributes.color?0xffffff:0xb5bfc9,vertexColors:!!g.attributes.color,roughness:.65})));}else{g.computeBoundingSphere();root.add(new THREE.Points(g,new THREE.PointsMaterial({color:g.attributes.color?0xffffff:0x65dbbe,vertexColors:!!g.attributes.color,size:Math.max((g.boundingSphere?.radius||1)*.008,.001),sizeAttenuation:true})));}
 }else throw Error('Unsupported mesh type');
 }finally{manager.itemEnd('mesh-parse');}
 await ready;if(textureError)throw textureError;
 return {scene:root,animations:root.animations||[],userData:{}};
}
