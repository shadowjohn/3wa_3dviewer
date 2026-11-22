import * as THREE from 'three';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
import directorPolicy from './director-policy.cjs';
import {createDirectorContent} from './director-content.mjs';
import {drawModelNotes,drawTimedCaption} from './model-notes.mjs';

export function directorEnvironment(renderer,scene){
 const previous=scene.environment,pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();
 let target;
 try{target=pmrem.fromScene(room,.04);}
 finally{room.dispose();pmrem.dispose();}
 const light=new THREE.HemisphereLight(0xddeeff,0x444455,.6);
 scene.environment=target.texture;scene.add(light);
 return ()=>{
  if(!target)return;
  if(scene.environment===target.texture)scene.environment=previous;
  light.removeFromParent();target.dispose();target=null;
 };
}

function directorLighting(plan,groups,scene,renderer){
 if(!plan)return null;
 const bounds=new THREE.Box3(),v=new THREE.Vector3(),c=new THREE.Vector3(),d=new THREE.Vector3();
 for(const g of groups){
  const extent=Math.max(.5,g.envelope);
  for(const p of (g.o.movement?.map(k=>k.position)??[g.o.position])){
   c.fromArray(p).add(g.pivot);
   bounds.expandByPoint(v.copy(c).addScalar(extent));
   bounds.expandByPoint(v.copy(c).addScalar(-extent));
  }
 }
 const sphere=bounds.getBoundingSphere(new THREE.Sphere()),r=Math.max(1,sphere.radius*1.08),distance=2.25*r;
 const sun=new THREE.DirectionalLight(0xffffff,1);sun.castShadow=plan.shadows;
 sun.target.position.copy(sphere.center);scene.add(sun,sun.target);
 const {enabled,type}=renderer.shadowMap;
 if(plan.shadows){
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=r/3200;sun.shadow.bias=-.0001;
  Object.assign(sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:.01,far:distance+r*1.2});
  sun.shadow.camera.updateProjectionMatrix();
  for(const g of groups)g.mesh.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 }
 return {
  update(t){
   const l=directorPolicy.sampleLight(plan,t);
   d.fromArray(l.direction).normalize();
   sun.position.copy(sphere.center).addScaledVector(d,distance);
   sun.shadow.camera.up.set(0,Math.abs(d.y)>.999999?0:1,Math.abs(d.y)>.999999?1:0);
   sun.intensity=l.intensity;sun.color.setRGB(...l.rgb.map(v=>v/255),THREE.SRGBColorSpace);
  },
  dispose(){
   scene.remove(sun,sun.target);sun.dispose();
   if(plan.shadows){renderer.shadowMap.enabled=enabled;renderer.shadowMap.type=type;}
  },
 };
}

function frameCanvas(width,height){
 const canvas=document.createElement('canvas');
 canvas.width=width;canvas.height=height;return canvas;
}

export async function createDirectorStage({job,renderer,scene,loader,readModel}){
 let content,lighting,board,blendA,blendB,disposed=false;
 function dispose(){
  if(disposed)return;
  disposed=true;
  lighting?.dispose();content?.dispose();
  content=lighting=board=blendA=blendB=null;
 }

 try{
  content=await createDirectorContent({job,scene,async loadModel(index){
   const bytes=await readModel(index);
   return loader.parseAsync(bytes.buffer.slice(bytes.byteOffset,bytes.byteOffset+bytes.byteLength),'');
  }});
  lighting=directorLighting(job.lighting,content.groups,scene,renderer);
 }catch(error){dispose();throw error;}

 const view=new THREE.PerspectiveCamera(45,1,.001,1000),aim=new THREE.Vector3(),upTest=new THREE.Vector3();
 const annotated=job.notes.length||job.captions.length;
 let width=0,height=0,styleSize=false;
 function resize(w,h,updateStyle){
  if(w===width&&h===height&&updateStyle===styleSize)return;
  renderer.setSize(w,h,updateStyle);width=w;height=h;styleSize=updateStyle;
 }
 function sample(index,w,h,cameraOverride){
  const {time,camera,caption}=content.applyFrame(index),pose=cameraOverride??camera;
  lighting?.update(time);view.position.fromArray(pose.position);aim.fromArray(pose.lookAt);
  view.up.set(0,Math.abs(upTest.subVectors(view.position,aim).normalize().y)>.999999?0:1,1e-9);
  view.lookAt(aim);view.aspect=w/h;view.fov=pose.fov;view.updateProjectionMatrix();view.updateMatrixWorld(true);
  renderer.render(scene,view);
  return {active:content.projectNotes(index,view),caption};
 }
 function annotate(ctx,{active,caption},w,h){
  drawModelNotes(ctx,active,{x:0,y:0,width:w,height:h});drawTimedCaption(ctx,caption,w,h);
 }
 function composite(canvas,data,w,h){
  const ctx=canvas.getContext('2d');
  ctx.drawImage(renderer.domElement,0,0,w,h);annotate(ctx,data,w,h);return canvas;
 }
 function blendFrame(index,w,h,blend){
  if(!blendA||blendA.width!==w||blendA.height!==h){blendA=frameCanvas(w,h);blendB=frameCanvas(w,h);}
  composite(blendA,sample(index,w,h,blend.previous),w,h);
  composite(blendB,sample(index,w,h),w,h);
  const ctx=blendA.getContext('2d');ctx.save();ctx.globalAlpha=blend.mix;ctx.drawImage(blendB,0,0);ctx.restore();
  return blendA;
 }
 function draw(index,w,h,overlay,cameraOverride){
  if(disposed||w<=0||h<=0)return;
  resize(w,h,true);
  if(!overlay){sample(index,w,h,cameraOverride);return;}
  if(overlay.width!==w)overlay.width=w;
  if(overlay.height!==h)overlay.height=h;
  if(overlay.style.height!==h+'px')overlay.style.height=h+'px';
  const blend=cameraOverride?null:directorPolicy.directorBlend(job,index);
  const ctx=overlay.getContext('2d');
  overlay.hidden=!annotated&&!blend;
  if(blend){const image=blendFrame(index,w,h,blend);ctx.clearRect(0,0,w,h);ctx.drawImage(image,0,0);return;}
  const data=sample(index,w,h,cameraOverride);
  if(annotated){ctx.clearRect(0,0,w,h);annotate(ctx,data,w,h);}
 }
 function capture(index,w,h){
  if(disposed)throw Error('Director stage is closed.');
  resize(w,h,false);
  const blend=directorPolicy.directorBlend(job,index);
  if(blend)return blendFrame(index,w,h,blend);
  const data=sample(index,w,h);
  if(!annotated)return renderer.domElement;
  if(!board||board.width!==w||board.height!==h)board=frameCanvas(w,h);
  return composite(board,data,w,h);
 }
 return {draw,capture,dispose};
}
