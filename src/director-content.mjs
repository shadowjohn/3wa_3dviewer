import * as THREE from 'three';
import directorPolicy from './director-policy.cjs';
import captionsPolicy from './timed-captions.cjs';
import {bindDirectorClip} from './director-animation.mjs';
import {createDirectorFlow} from './director-flow.mjs';
import {visibleNote} from './model-notes.mjs';

function disposeModels(groups){
 const resources=new Set();
 for(const {holder,mesh} of groups){
  holder.removeFromParent();
  mesh.traverse(o=>{
   if(o.geometry)resources.add(o.geometry);
   if(o.skeleton)resources.add(o.skeleton);
   for(const material of [].concat(o.material??[])){
    if(!material)continue;
    resources.add(material);
    for(const value of Object.values(material))if(value?.isTexture)resources.add(value);
    for(const entry of Object.values(material.uniforms??{}))if(entry.value?.isTexture)resources.add(entry.value);
   }
  });
 }
 for(const resource of resources)resource.dispose();
}

// Each call to loadModel supplies a fresh GLTF scene whose resources belong to this content.
export async function createDirectorContent({job,scene,loadModel}){
 const groups=[],models=[],byId=new Map(),flows=[];
 let disposed=false;

 function dispose(){
  if(disposed)return;
  disposed=true;
  for(const flow of flows)flow.dispose();
  disposeModels(groups);
  groups.length=0;models.length=0;flows.length=0;byId.clear();
 }

 try{
  for(let i=0;i<job.objects.length;i++){
   const o=job.objects[i],g=await loadModel(i);
   const mesh=g.scene,holder=new THREE.Group(),pivot=new THREE.Group();
   const item={o,mesh,holder,pivot:new THREE.Vector3(...o.pivot)};
   groups.push(item);models.push(mesh);byId.set(o.id,item);
   pivot.position.copy(item.pivot).negate();pivot.add(mesh);holder.add(pivot);scene.add(holder);
   holder.updateWorldMatrix(true,true);
   const bounded=new THREE.Box3().setFromObject(mesh).getBoundingSphere(new THREE.Sphere()),r=bounded.radius;
   if(!Number.isFinite(r)||!(r>0))throw Error('Invalid scene model bounds.');
   item.radius=r;item.envelope=r+bounded.center.length();
   item.axis=o.spin?new THREE.Vector3(...o.spin.axis).normalize():null;
   item.clip=bindDirectorClip(mesh,g.animations??[],o.animation,o.id);
  }
  for(const track of job.flows??[]){
   const effect=createDirectorFlow(track),parent=track.object===null?scene:byId.get(track.object).mesh;
   flows.push(effect);parent.add(effect.root);
  }
 }catch(error){dispose();throw error;}

 const axisRotation=new THREE.Quaternion(),rotation=new THREE.Quaternion(),euler=new THREE.Euler();
 const point=new THREE.Vector3();
 function worldNotes(index){
  return directorPolicy.activeNotes(job.notes,index/job.fps).map(note=>({
   ...note,point:byId.get(note.object).mesh.localToWorld(point.fromArray(note.point)).toArray(),
  }));
 }
 function applyFrame(index){
  if(disposed)throw Error('Director content is closed.');
  const time=index/job.fps;
  for(const group of groups){
   const placement=directorPolicy.placement(group.o,time);
   group.holder.position.fromArray(placement.position).add(group.pivot);
   rotation.setFromEuler(euler.set(...placement.rotation.map(THREE.MathUtils.degToRad)));
   if(group.axis)rotation.multiply(axisRotation.setFromAxisAngle(group.axis,THREE.MathUtils.degToRad(placement.spinDegrees)));
   group.holder.quaternion.copy(rotation);group.clip?.(time);
  }
  for(const flow of flows)flow.update(time);
  scene.updateWorldMatrix(true,true);
  return {
   frame:index,time,camera:directorPolicy.directorCamera(job,index),
   caption:captionsPolicy.captionAt(job.captions,time),notes:worldNotes(index),
  };
 }

 function projectNotes(index,camera){
  return directorPolicy.activeNotes(job.notes,index/job.fps).map(note=>{
   const group=byId.get(note.object);
   return visibleNote(note,group.mesh,camera,group.radius,models);
  }).filter(Boolean);
 }

 return {applyFrame,projectNotes,worldNotes,groups,dispose};
}
