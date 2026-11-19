import {referenceLayers} from './reference-layers.mjs';
import {evidenceImages} from './capture-evidence.mjs';
import turntablePolicy from './turntable-policy.cjs';
import modelNotesPolicy from './model-notes-policy.cjs';
import pathPolicy from './camera-path.cjs';
import {bindDirectorClip} from './director-animation.mjs';
import directorPolicy from './director-policy.cjs';
import captionsPolicy from './timed-captions.cjs';
import {pickModelNote,projectedModelNotes,visibleNote,drawModelNotes,drawTimedCaption} from './model-notes.mjs';
import {buildTileset,updateTileset} from './tileset-renderer.mjs';
import {parseMesh} from './mesh-loaders.mjs';
import * as THREE from 'three';
import './settings.js';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const $=id=>document.getElementById(id),viewport=$('viewport');
let vrm=null,tilesRuntime=null,turntableRender=false,notes=[],picking=false,noteTick=0;
let renderer,controls,model,grid,mixer,seq=0,radius=1,meta,frames=0,animationCount=0,draco,ktx;
const scene=new THREE.Scene();scene.background=new THREE.Color('#19212c');
const avatarLight=new THREE.DirectionalLight(0xffffff,1.2);avatarLight.position.set(1,2,3);avatarLight.visible=false;scene.add(avatarLight);
const camera=new THREE.PerspectiveCamera(45,1,.01,1000);camera.position.set(4,3,5);
const container=new THREE.Group();scene.add(container);
const noteOverlay=document.createElement('canvas');noteOverlay.id='modelNoteOverlay';noteOverlay.hidden=true;noteOverlay.setAttribute('aria-hidden','true');viewport.append(noteOverlay);
const timer=new THREE.Timer();timer.connect(document);const materials=new Map();
const clay=new THREE.MeshStandardMaterial({color:0xb5bfc9,roughness:.65});
const wire=new THREE.MeshBasicMaterial({color:0x67dfc3,wireframe:true});
function error(e){$('errorText').textContent=String(e?.message||e);$('error').hidden=false;$('status').textContent='載入失敗，可選擇其他模型';$('loading').hidden=true;}
function info(items){$('info').replaceChildren();for(const [k,v] of items){const dt=document.createElement('dt'),dd=document.createElement('dd');dt.textContent=k;dd.textContent=v;$('info').append(dt,dd);}}
function dispose(root){if(!root)return;const tex=new Set(),mats=new Set(),skeletons=new Set();root.traverse(o=>{o.geometry?.dispose();if(o.skeleton)skeletons.add(o.skeleton);for(const m of [].concat(materials.get(o)||o.material||[])){if(!m)continue;mats.add(m);for(const v of Object.values(m))if(v?.isTexture)tex.add(v);for(const u of Object.values(m.uniforms||{}))if(u.value?.isTexture)tex.add(u.value);}});skeletons.forEach(s=>s.dispose());tex.forEach(t=>t.dispose());mats.forEach(m=>{if(m!==clay&&m!==wire)m.dispose();});}
function bounds(){container.updateMatrixWorld(true);return new THREE.Box3().setFromObject(container);}
function frame(direction=new THREE.Vector3(1,.65,1)){
 if(!model)return;const b=bounds(),sphere=b.getBoundingSphere(new THREE.Sphere());radius=Math.max(sphere.radius,.001);const center=sphere.center;
 const halfV=THREE.MathUtils.degToRad(camera.fov/2),halfH=Math.atan(Math.tan(halfV)*camera.aspect),dist=radius/Math.sin(Math.min(halfV,halfH))*1.15;
 camera.position.copy(center).add(direction.normalize().multiplyScalar(dist));camera.near=Math.max(radius/10000,1e-6);camera.far=radius*1000;camera.updateProjectionMatrix();controls.target.copy(center);controls.minDistance=radius*.01;controls.maxDistance=radius*100;controls.update();
 if(grid){scene.remove(grid);grid.geometry.dispose();[].concat(grid.material).forEach(m=>m.dispose());}
 grid=new THREE.GridHelper(radius*4,20,0x4b6076,0x2e3f52);grid.position.set(center.x,b.min.y-radius*.003,center.z);grid.visible=$('grid').checked;scene.add(grid);
}
function setMaterial(){if(model)model.traverse(o=>{if(o.isMesh)o.material=$('material').value==='clay'?clay:$('material').value==='wire'?wire:materials.get(o);});}
async function load(payload){
 if(!payload)return;if(payload.error){error(payload.error);throw Error(payload.error);}const ticket=++seq;$('error').hidden=true;$('loading').hidden=false;$('progress').textContent='解析幾何與材質…';$('status').textContent=payload.name+' · 載入中';
 try{
 const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;throw Error('已阻擋模型外部資源。請將資源放在模型資料夾，或匯出完整 GLB。');});
 const loader=new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
 loader.register(parser=>new VRMLoaderPlugin(parser,{autoUpdateHumanBones:false}));
 const supported=new Set(['VRM','VRMC_vrm','VRMC_materials_mtoon','VRMC_springBone','VRMC_node_constraint','VRMC_materials_hdr_emissiveMultiplier','KHR_draco_mesh_compression','EXT_meshopt_compression','KHR_meshopt_compression','KHR_mesh_quantization','KHR_texture_basisu','EXT_texture_webp','KHR_materials_unlit','KHR_materials_clearcoat','KHR_materials_transmission','KHR_materials_volume','KHR_materials_ior','KHR_materials_specular','KHR_materials_sheen','KHR_materials_iridescence','KHR_materials_anisotropy','KHR_materials_emissive_strength','KHR_materials_dispersion','KHR_materials_diffuse_transmission','KHR_texture_transform','KHR_lights_punctual','EXT_mesh_gpu_instancing']);
 const arr=payload.data,data=arr.buffer.slice(arr.byteOffset,arr.byteOffset+arr.byteLength),view=new DataView(data);
 const isMesh=['obj','stl','ply','dae'].includes(payload.kind);
 const json=(isMesh||payload.kind==='tileset')?{}:payload.kind==='gltf'?JSON.parse(new TextDecoder().decode(data)):JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,view.getUint32(12,true))).trim());
 const unsupported=(json.extensionsRequired||[]).filter(e=>!supported.has(e));if(unsupported.length)throw Error('尚未支援必要擴充：'+unsupported.join(', '));
 const gltf=payload.kind==='tileset'?await buildTileset(payload.tileset,b=>loader.parseAsync(b,''),dispose):isMesh?await parseMesh(payload,manager):await loader.parseAsync(payload.kind==='gltf'?new TextDecoder().decode(data):data,'');if(ticket!==seq){dispose(gltf.scene);return;}
 const nextVrm=gltf.userData.vrm;
 if(payload.avatar&&!nextVrm){dispose(gltf.scene);throw Error('Unable to construct VRM avatar. Check humanoid and metadata.');}
 if(nextVrm){VRMUtils.rotateVRM0(nextVrm);nextVrm.update(0);}
 let meshes=0,triangles=0,points=0;gltf.scene.traverse(o=>{if(o.isPoints)points+=o.geometry.attributes.position?.count||0;if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}});
 if(!meshes&&!points){dispose(gltf.scene);throw Error('模型沒有可顯示的網格。');}
 const box=new THREE.Box3().setFromObject(gltf.scene);if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)){dispose(gltf.scene);throw Error('模型座標無效。');}
 if(mixer){mixer.stopAllAction();mixer.uncacheRoot(model);}if(model)container.remove(model);dispose(model);materials.clear();notes=[];endNotePick();$('noteText').value='';noteStatus();drawLiveNotes();tilesRuntime=payload.kind==='tileset'?gltf:null;vrm=nextVrm||null;avatarLight.visible=!!vrm;model=gltf.scene;container.rotation.set(0,0,0);container.add(model);model.traverse(o=>{if(o.isMesh)materials.set(o,o.material);});
 animationCount=gltf.animations.length;mixer=animationCount?new THREE.AnimationMixer(model):null;gltf.animations.forEach(a=>mixer.clipAction(a).play());
 meta={name:payload.name,bytes:payload.size,meshes,points,triangles:Math.round(triangles),extensions:payload.extensions,animations:animationCount,note:payload.note,vrm:payload.avatar?{...payload.avatar,mtoonMaterials:vrm.materials.filter(m=>m.isMToonMaterial).length}:null};
 info([['檔案',payload.name],...(payload.avatar?[['VRM',payload.avatar.version],['角色',payload.avatar.name],['作者',payload.avatar.authors]]:[]),['檔案大小',(payload.size/1048576).toFixed(2)+' MB'],['點數',points.toLocaleString()],['三角面',Math.round(triangles).toLocaleString()],['網格 / 動畫',meshes+' / '+animationCount],['擴充',payload.extensions.join(', ')||(payload.kind==='tileset'?'3D Tiles local preview':isMesh?payload.kind.toUpperCase():'標準 glTF 2.0')],['座標 / 資源',payload.note||'glTF 本地座標']]);
 setMaterial();frame();$('welcome').hidden=true;$('loading').hidden=true;$('status').textContent='已載入 · '+payload.name;
 }catch(e){if(ticket===seq)error(e);throw e;}
}
try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;viewport.prepend(renderer.domElement);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();error('GPU 顯示環境中斷，請重開 viewer。');});
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.add(new THREE.HemisphereLight(0xddeeff,0x444455,.6));
 draco=new DRACOLoader().setDecoderPath('decoders/draco/');draco.setWorkerLimit(2);ktx=new KTX2Loader().setTranscoderPath('decoders/basis/').detectSupport(renderer);ktx.setWorkerLimit(2);
 new ResizeObserver(()=>{if(turntableRender)return;camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight);}).observe(viewport);
 renderer.setAnimationLoop(()=>{if(turntableRender)return;timer.update();const dt=Math.min(timer.getDelta(),.1);if($('animation').checked){if(mixer)mixer.update(dt);vrm?.update(dt);}controls.autoRotate=$('rotate').checked;controls.update(dt);if(tilesRuntime){container.updateMatrixWorld(true);updateTileset(tilesRuntime.root,camera,viewport.clientHeight,16,container.matrixWorld);}renderer.render(scene,camera);if(notes.length&&performance.now()-noteTick>65)drawLiveNotes();frames++;});
}catch(e){error(e);}
const references=referenceLayers({viewport,canvas:renderer?.domElement,getCamera:()=>{camera.updateMatrixWorld(true);return {position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect,matrixWorld:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray()};},setCamera:p=>{controls.enableDamping=false;controls.autoRotate=false;$('rotate').checked=false;camera.position.fromArray(p.position);controls.target.fromArray(p.target);camera.fov=p.fov;camera.near=p.near;camera.far=p.far;camera.updateProjectionMatrix();controls.update();camera.updateMatrixWorld(true);controls.enableDamping=true;},onModelVisible:visible=>{container.visible=visible;},status:text=>{$('status').textContent=text;}});
async function action(fn){try{await fn();}catch(e){error(e);}}
$('open').onclick=()=>action(async()=>load(await window.viewer.open()));$('save').onclick=()=>action(async()=>{if(await window.viewer.snapshot())$('status').textContent='截圖已儲存';});$('dismiss').onclick=()=>{$('error').hidden=true;};$('frame').onclick=()=>frame();
const dirs={front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,.00001],iso:[1,.65,1]};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>frame(new THREE.Vector3(...dirs[b.dataset.view])));
$('background').onchange=()=>scene.background.set($('background').value);$('material').onchange=setMaterial;$('grid').onchange=()=>{if(grid)grid.visible=$('grid').checked;};$('exposure').oninput=()=>{renderer.toneMappingExposure=Number($('exposure').value);$('exposureValue').textContent=Number($('exposure').value).toFixed(1);};$('rotateX').onclick=()=>{container.rotation.x+=Math.PI/2;frame();};$('reset').onclick=()=>{container.rotation.set(0,0,0);frame();};
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='o'){e.preventDefault();$('open').click();}if(e.key.toLowerCase()==='f'&&!e.ctrlKey)frame();});
window.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag');});window.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('drag');});window.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drag');const files=Array.from(e.dataTransfer.files);const media=files.filter(f=>references.isMedia(f));if(media.length)references.addFiles(media);const f=files.find(f=>!references.isMedia(f));if(f)action(async()=>load(await window.viewer.drop(f)));});window.viewer.onOpen(p=>action(()=>load(p)));
$('updates').onclick=async()=>{const b=$('updates');b.disabled=true;b.textContent='檢查中…';$('updateProgress').hidden=false;$('updateResult').hidden=true;$('aboutDialog').setAttribute('aria-busy','true');$('release').hidden=true;try{const r=await window.viewer.checkUpdates();$('status').textContent=r.error||(r.version?(r.available?'有新版本 '+r.version+'，可開啟版本頁自行下載。':'目前已是最新穩定版 '+r.current):'目前尚無已發布的穩定版本。');$('release').hidden=!r.url;}catch(e){$('status').textContent='更新查詢失敗；離線瀏覽不受影響。';}finally{$('updateProgress').hidden=true;$('aboutDialog').setAttribute('aria-busy','false');$('updateResult').textContent=$('status').textContent;$('updateResult').hidden=false;b.disabled=false;b.textContent='檢查更新';}};
$('release').onclick=()=>action(()=>window.viewer.releasePage());
function noteStatus(message){
 $('noteStatus').textContent=message||(notes.length?notes.length+'／4 則註記 · 匯出時會保留':'最多 4 則；會跟著模型，並隨遮蔽隱藏。');
 $('noteUndo').disabled=!notes.length;
}
function endNotePick(){if(picking){picking=false;controls.enabled=true;renderer.domElement.classList.remove('note-picking');}}
function drawLiveNotes(){
 noteTick=performance.now();noteOverlay.hidden=!notes.length;
 if(!notes.length||!model)return;
 const width=viewport.clientWidth,height=viewport.clientHeight;
 if(noteOverlay.width!==width)noteOverlay.width=width;if(noteOverlay.height!==height)noteOverlay.height=height;
 const ctx=noteOverlay.getContext('2d');ctx.clearRect(0,0,width,height);
 drawModelNotes(ctx,projectedModelNotes(notes,model,camera,radius),{x:0,y:0,width,height});
}
$('notePick').onclick=()=>{
 if(!model||!meta?.name?.toLowerCase().endsWith('.glb')){noteStatus('請先開啟 GLB。');return;}
 try{modelNotesPolicy.modelNotes([...notes,{text:$('noteText').value,point:[0,0,0]}]);}
 catch(e){noteStatus(e.message);return;}
 picking=true;controls.enabled=false;renderer.domElement.classList.add('note-picking');noteStatus('請點選 GLB 表面；Esc 取消。');
};
$('noteUndo').onclick=()=>{endNotePick();notes=notes.slice(0,-1);noteStatus();drawLiveNotes();};
window.addEventListener('keydown',e=>{if(e.key==='Escape'&&picking){endNotePick();noteStatus();}});
renderer?.domElement.addEventListener('click',e=>{
 if(!picking)return;
 const area=renderer.domElement.getBoundingClientRect(),x=(e.clientX-area.left)/area.width*2-1,y=1-(e.clientY-area.top)/area.height*2;
 const point=pickModelNote(x,y,model,camera);
 if(!point){noteStatus('沒有點到模型表面，請再試一次；Esc 取消。');return;}
 try{notes=modelNotesPolicy.modelNotes([...notes,{text:$('noteText').value,point}]);endNotePick();$('noteText').value='';noteStatus();drawLiveNotes();}
 catch(error){endNotePick();noteStatus(error.message);}
});
function noteCanvas(width,height){
 const c=document.createElement('canvas');c.width=width;c.height=height;return c;
}
function compositeNotes(c,overlays,caption=null){
 const ctx=c.getContext('2d');ctx.drawImage(renderer.domElement,0,0);
 for(const {notes,viewport} of overlays)drawModelNotes(ctx,notes,viewport);
 drawTimedCaption(ctx,caption,c.width,c.height);return c;
}
function directorLayout(preview){
 for(const el of document.querySelectorAll('header,aside,footer'))el.style.visibility='hidden';
 viewport.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:9999';
 $('welcome').hidden=true;$('loading').hidden=true;if(grid)grid.visible=false;
 if(!preview)return null;
 const panel=document.createElement('div'),button=document.createElement('button'),seek=document.createElement('input'),clock=document.createElement('span');
 panel.style.cssText='position:absolute;inset:auto 10px 10px;z-index:10;background:#172132eb;padding:6px;display:flex;gap:10px;align-items:center;border-radius:7px';
 button.textContent='Pause';button.type='button';seek.type='range';seek.min='0';seek.step='1';seek.style.flex='1';seek.setAttribute('aria-label','Scene frame');clock.setAttribute('aria-live','off');
 panel.append(button,seek,clock);viewport.append(panel);
 return {button,seek,clock};
}
function directorLighting(plan,groups){
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
 if(plan.shadows){
  renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
  sun.shadow.mapSize.set(1024,1024);sun.shadow.normalBias=r/3200;sun.shadow.bias=-.0001;
  Object.assign(sun.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:.01,far:distance+r*1.2});
  sun.shadow.camera.updateProjectionMatrix();
  for(const g of groups)g.mesh.traverse(o=>{if(o.isMesh){o.castShadow=true;o.receiveShadow=true;}});
 }
 return t=>{
  const l=directorPolicy.sampleLight(plan,t);
  d.fromArray(l.direction).normalize();
  sun.position.copy(sphere.center).addScaledVector(d,distance);
  sun.shadow.camera.up.set(0,Math.abs(d.y)>.999999?0:1,Math.abs(d.y)>.999999?1:0);
  sun.intensity=l.intensity;sun.color.setRGB(...l.rgb.map(v=>v/255),THREE.SRGBColorSpace);
 };
}
async function renderDirector(cfg){
 const job=cfg.director;turntableRender=true;renderer.setAnimationLoop(null);controls.enabled=false;
 if(!cfg.preview)renderer.setPixelRatio(1);
 const panel=directorLayout(cfg.preview),groups=[],models=[],byId=new Map();
 const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;throw Error('Director GLB must contain its resources.');});
 const loader=new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
 for(let i=0;i<job.objects.length;i++){
  const o=job.objects[i],p=await window.viewer.directorModel(i),a=p.data;
  const g=await loader.parseAsync(a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength),''),mesh=g.scene,holder=new THREE.Group(),pivot=new THREE.Group();
  pivot.position.fromArray(o.pivot).negate();pivot.add(mesh);holder.add(pivot);scene.add(holder);holder.updateMatrixWorld(true);
  const box=new THREE.Box3().setFromObject(mesh),bounded=box.getBoundingSphere(new THREE.Sphere()),r=bounded.radius;
  if(!Number.isFinite(r)||!(r>0))throw Error('Invalid scene model bounds.');
  const item={o,mesh,holder,pivot:new THREE.Vector3(...o.pivot),radius:r,envelope:r+bounded.center.length(),axis:o.spin?new THREE.Vector3(...o.spin.axis).normalize():null};
  item.clip=bindDirectorClip(mesh,g.animations,o.animation,o.id);
  groups.push(item);models.push(mesh);byId.set(o.id,item);
 }
 const light=directorLighting(job.lighting,groups);
 const view=new THREE.PerspectiveCamera(45,1,.001,1000),aim=new THREE.Vector3(),axisRotation=new THREE.Quaternion(),q=new THREE.Quaternion(),e=new THREE.Euler();
 const annotated=job.notes.length||job.captions.length;
 let width=0,height=0;
 function sample(index,w,h,cameraOverride){
  if(w!==width||h!==height){
   renderer.setSize(w,h,!!panel);width=w;height=h;
   if(panel){noteOverlay.width=w;noteOverlay.height=h;noteOverlay.hidden=!annotated;}
  }
  const t=index/job.fps,pose=cameraOverride??directorPolicy.directorCamera(job,index);
  for(const g of groups){
   const x=directorPolicy.placement(g.o,t);
   g.holder.position.fromArray(x.position).add(g.pivot);
   q.setFromEuler(e.set(...x.rotation.map(THREE.MathUtils.degToRad)));
   if(g.axis)q.multiply(axisRotation.setFromAxisAngle(g.axis,THREE.MathUtils.degToRad(x.spinDegrees)));
   g.holder.quaternion.copy(q);g.clip?.(t);
  }
  light?.(t);scene.updateMatrixWorld(true);view.position.fromArray(pose.position);aim.fromArray(pose.lookAt);
  view.up.set(0,Math.abs(view.position.clone().sub(aim).normalize().y)>.999999?0:1,1e-9);
  view.lookAt(aim);view.aspect=w/h;view.fov=pose.fov;view.updateProjectionMatrix();view.updateMatrixWorld(true);
  renderer.render(scene,view);
  const active=directorPolicy.activeNotes(job.notes,t).map(n=>{const g=byId.get(n.object);return visibleNote(n,g.mesh,view,g.radius,models);}).filter(Boolean);
  return {active,caption:captionsPolicy.captionAt(job.captions,t)};
 }
 let blendA,blendB;
 function blendFrame(i,w,h,blend){
  if(!blendA||blendA.width!==w||blendA.height!==h){blendA=noteCanvas(w,h);blendB=noteCanvas(w,h);}
  const viewport={x:0,y:0,width:w,height:h};
  const collect=(canvas,pose)=>{const {active,caption}=sample(i,w,h,pose);return compositeNotes(canvas,[{notes:active,viewport}],caption);};
  collect(blendA,blend.previous);collect(blendB);
  const ctx=blendA.getContext('2d');ctx.save();ctx.globalAlpha=blend.mix;ctx.drawImage(blendB,0,0);ctx.restore();
  return blendA;
 }
 if(panel){
  let base=performance.now(),index=0,playing=true;
  panel.seek.max=String(job.frameCount-1);
  panel.button.onclick=()=>{playing=!playing;base=performance.now()-1000*index/job.fps;panel.button.textContent=playing?'Pause':'Play';};
  panel.seek.oninput=()=>{index=Number(panel.seek.value);base=performance.now()-1000*index/job.fps;};
  renderer.setAnimationLoop(now=>{
   if(playing)index=Math.max(0,Math.floor((now-base)*job.fps/1000))%job.frameCount;
   const w=viewport.clientWidth,h=viewport.clientHeight;if(!w||!h)return;
   const blend=directorPolicy.directorBlend(job,index),c=noteOverlay.getContext('2d');
   if(blend){const img=blendFrame(index,w,h,blend);noteOverlay.hidden=false;c.clearRect(0,0,w,h);c.drawImage(img,0,0);}
   else{
    const {active,caption}=sample(index,w,h);noteOverlay.hidden=!annotated;
    if(annotated){c.clearRect(0,0,w,h);drawModelNotes(c,active,{x:0,y:0,width:w,height:h});drawTimedCaption(c,caption,w,h);}
   }
   panel.seek.value=String(index);panel.clock.textContent=(index/job.fps).toFixed(2)+' s';
  });
  return;
 }
 const board=annotated?noteCanvas(job.width,job.height):null,viewportRect={x:0,y:0,width:job.width,height:job.height};
 for(let i=0;i<job.frameCount;i++){
  const blend=directorPolicy.directorBlend(job,i);let frame;
  if(blend)frame=blendFrame(i,job.width,job.height,blend);
  else{
   const {active,caption}=sample(i,job.width,job.height);
   frame=board?compositeNotes(board,[{notes:active,viewport:viewportRect}],caption):renderer.domElement;
  }
  await window.viewer.turntableFrame(i,frame.toDataURL('image/png'));
 }
 await window.viewer.captureFinish({ok:true});
}
async function renderTurntable(cfg){
 const job=cfg.turntable;turntableRender=true;renderer.setAnimationLoop(null);
 controls.enabled=false;controls.autoRotate=false;controls.enableDamping=false;
 renderer.setPixelRatio(1);renderer.setSize(job.width,job.height,false);
 renderer.toneMappingExposure=job.exposure;scene.background.set(job.background);
 if(grid)grid.visible=false;
 $('material').value=job.material;setMaterial();
 container.quaternion.fromArray(job.orientation).normalize();
 const holders=[container],roots=[model];
 if(cfg.secondModel){
  const p=await window.viewer.turntableSecond(),a=p.data;
  const manager=new THREE.LoadingManager();manager.setURLModifier(url=>{if(/^(data:|blob:)/.test(url))return url;throw Error('External model resources are unavailable in offline recording.');});
  const loader=new GLTFLoader(manager).setDRACOLoader(draco).setKTX2Loader(ktx).setMeshoptDecoder(MeshoptDecoder);
  const gltf=await loader.parseAsync(a.buffer.slice(a.byteOffset,a.byteOffset+a.byteLength),'');
  const holder=new THREE.Group();holder.quaternion.copy(container.quaternion);holder.add(gltf.scene);
  if(job.material!=='original')gltf.scene.traverse(o=>{if(o.isMesh)o.material=job.material==='clay'?clay:wire;});
  scene.add(holder);holders.push(holder);roots.push(gltf.scene);
 }
 const spheres=holders.map(holder=>{
  holder.updateMatrixWorld(true);const box=new THREE.Box3().setFromObject(holder);
  if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite))throw Error('Invalid model bounds for rotation recording.');
  return box.getBoundingSphere(new THREE.Sphere());
 });
 const sharedRadius=Math.max(.001,...spheres.map(s=>s.radius)),pane=job.width/holders.length;
 const v=THREE.MathUtils.degToRad(job.fov/2),h=Math.atan(Math.tan(v)*pane/job.height);
 const distance=sharedRadius/Math.sin(Math.min(v,h))*1.15;
 const view=new THREE.PerspectiveCamera(job.fov,pane/job.height,Math.max(sharedRadius/10000,1e-6),distance+sharedRadius*100);
 const start=new THREE.Vector3(...job.direction).normalize().multiplyScalar(distance);
 view.position.copy(start);view.up.set(0,1,0);view.lookAt(0,0,0);
 const initial=view.quaternion.clone();
 const axis=job.axis==='vertical'?new THREE.Vector3(1,0,0).applyQuaternion(initial):new THREE.Vector3(0,1,0);
 const motion=new THREE.Quaternion(),offset=new THREE.Vector3(),aim=new THREE.Vector3(),up=new THREE.Vector3(0,1,0),forward=new THREE.Vector3();
 const right=new THREE.Vector3(),levelRight=new THREE.Vector3();
 renderer.autoClear=false;renderer.setScissorTest(true);
 const annotated=(job.notes.length||job.captions.length)?noteCanvas(job.width,job.height):null;
 for(let i=0;i<job.frameCount;i++){
  motion.setFromAxisAngle(axis,turntablePolicy.angleAt(i,job.frameCount));
  offset.copy(start).applyQuaternion(motion);
  view.quaternion.copy(motion).multiply(initial);const overlays=[];
  for(let j=0;j<holders.length;j++){
   for(let k=0;k<holders.length;k++)holders[k].visible=k===j;
   if(job.cameraPath){
    const pose=pathPolicy.poseAt(job.cameraPath,turntablePolicy.frameTime(i,job));
    // Center plus radius-scaled XYZ in the unrotated viewer axes.
    view.position.fromArray(pose.position).multiplyScalar(sharedRadius).add(spheres[j].center);
    aim.fromArray(pose.lookAt).multiplyScalar(sharedRadius).add(spheres[j].center);
    forward.copy(aim).sub(view.position).normalize();
    levelRight.crossVectors(forward,up);
    if(levelRight.lengthSq()>=1e-6)right.copy(levelRight);
    else{
     // If looking almost vertically, retain the prior horizontal orientation.
     right.addScaledVector(forward,-right.dot(forward));
     if(right.lengthSq()<1e-10)right.crossVectors(forward,new THREE.Vector3(1,0,0));
    }
    right.normalize();view.up.crossVectors(right,forward).normalize();view.lookAt(aim);
    view.fov=pose.fov;view.updateProjectionMatrix();
   }else view.position.copy(spheres[j].center).add(offset);
   view.updateMatrixWorld(true);
   renderer.setViewport(j*pane,0,pane,job.height);renderer.setScissor(j*pane,0,pane,job.height);
   renderer.setClearColor(scene.background,1);renderer.clear(true,true,true);renderer.render(scene,view);
   if(job.notes.length)overlays.push({notes:projectedModelNotes(job.notes,roots[j],view,spheres[j].radius,j),viewport:{x:j*pane,y:0,width:pane,height:job.height}});
  }
  const caption=captionsPolicy.captionAt(job.captions,turntablePolicy.frameTime(i,job));
  const image=annotated?compositeNotes(annotated,overlays,caption):renderer.domElement;
  await window.viewer.turntableFrame(i,image.toDataURL('image/png'));
 }
 await window.viewer.captureFinish({ok:true});
}
const publicPresetSelect=$('publicE8Preset');
window.viewer.publicE8Presets?.().then(items=>{
 for(const item of items)publicPresetSelect.add(new Option(item.label,item.id));
 $('openPublicICC').disabled=!items.length;
}).catch(e=>{$('status').textContent=e.message;});
$('openPublicICC').onclick=()=>window.viewer.openPublicICC(publicPresetSelect.value).catch(e=>{$('status').textContent=e.message;});
$('openDirector').onclick=()=>window.viewer.openDirector().catch(e=>{$('status').textContent=e.message;});
let uiRecording=false;
$('record').onclick=()=>{const d=$('recordDialog');if(!model||!meta?.name?.toLowerCase().endsWith('.glb')){$('status').textContent='請先開啟要錄影的 GLB 模型。';return;}d.showModal();};
$('recordStart').onclick=async()=>{
 if(uiRecording)return;
 uiRecording=true;$('recordStart').disabled=true;$('recordClose').disabled=true;$('recordCancel').disabled=false;
 const status=$('recordStatus');status.textContent='選擇輸出位置…';
 try{
  const seconds=Number($('recordSeconds').value),captionText=$('captionText').value.trim();
  const captions=captionText?[{text:captionText,start:Number($('captionStart').value),end:$('captionEnd').value===''?seconds:Number($('captionEnd').value)}]:[];
  const result=await window.viewer.recordTurntable({
   compare:$('recordCompare').checked,
   settings:{seconds,captions,axis:$('recordAxis').value,format:$('recordFormat').value,direction:camera.position.clone().sub(controls.target).normalize().toArray(),fov:camera.fov,orientation:container.quaternion.toArray(),background:$('background').value,material:$('material').value,exposure:renderer.toneMappingExposure,notes}
  });
  status.textContent=result?result.format.toUpperCase()+' 已儲存：'+result.file:'未儲存錄影。';
 }catch(e){status.textContent=e.message;}finally{uiRecording=false;$('recordStart').disabled=false;$('recordClose').disabled=false;$('recordCancel').disabled=true;}
};
$('recordDialog').addEventListener('cancel',e=>{if(uiRecording){e.preventDefault();window.viewer.cancelTurntable();}});
$('recordCancel').onclick=()=>{window.viewer.cancelTurntable().catch(e=>{$('recordStatus').textContent=e.message;});};
window.viewer.onTurntableProgress(stage=>{if(uiRecording)$('recordStatus').textContent=stage==='render'?'正在逐幀繪製…':'正在編碼輸出…';});
async function boot(){const cfg=await window.viewer.config();$('version').textContent='3wa_3dviewer · '+cfg.version+' · VRM preview';try{
 if(cfg.director){await renderDirector(cfg);return;}
 await load(await window.viewer.initial());if(cfg.turntable){await renderTurntable(cfg);return;}if(cfg.capture){
 if(cfg.referencesData?.length){const files=cfg.referencesData.map(r=>new File([Uint8Array.from(atob(r.data),c=>c.charCodeAt(0))],r.name));const result=await references.addFiles(files);if(result.errors.length)throw Error(result.errors.join('; '));await references.configure(cfg.referencesData.map(r=>r.settings),cfg.referenceMode,cfg.selectedReference);}
 for(const el of document.querySelectorAll('header,aside'))el.style.visibility='hidden';
 viewport.style.cssText='position:fixed;inset:0;width:100vw;height:100vh;z-index:9999';
 $('animation').checked=false;$('rotate').checked=false;controls.enableDamping=false;controls.autoRotate=false;
 $('material').value=cfg.material;setMaterial();scene.background.set(cfg.background==='light'?'#e8edf2':'#19212c');
 await new Promise(r=>setTimeout(r,200));
 camera.aspect=cfg.width/cfg.height;renderer.setPixelRatio(1);renderer.setSize(cfg.width,cfg.height);
 let reference=null;if(cfg.referenceData){reference=new Image();reference.src=cfg.referenceData;await reference.decode();}
 const box=bounds(),size=box.getSize(new THREE.Vector3()),poses=[],caption=captionsPolicy.captionAt(cfg.captions??[],cfg.captionTime??0),noteImage=(cfg.notes?.length||caption)?noteCanvas(cfg.width,cfg.height):null;
 for(const view of cfg.views){
  camera.fov=45;
  let direction=new THREE.Vector3(...(dirs[view]||dirs.iso));
  if(view==='custom'){const a=THREE.MathUtils.degToRad(cfg.camera.azimuth),e=THREE.MathUtils.degToRad(cfg.camera.elevation);direction.set(Math.sin(a)*Math.cos(e),Math.sin(e),Math.cos(a)*Math.cos(e));camera.fov=cfg.camera.fov;}
  if(cfg.forwardAxis==='-Z'){direction.x*=-1;direction.z*=-1;}frame(direction);
  if(view==='custom'){const displacement=camera.position.clone().sub(controls.target).multiplyScalar(cfg.camera.distanceScale),offset=new THREE.Vector3(...cfg.camera.targetOffset).multiplyScalar(radius);controls.target.add(offset);controls.maxDistance=Math.max(radius*100,displacement.length()*1.1);camera.position.copy(controls.target).add(displacement);controls.update();}
  camera.updateMatrixWorld(true);renderer.render(scene,camera);
  const canvas=noteImage?compositeNotes(noteImage,[{notes:projectedModelNotes(cfg.notes,model,camera,radius),viewport:{x:0,y:0,width:cfg.width,height:cfg.height}}],caption):renderer.domElement;
  const images=evidenceImages(canvas,cfg,reference);if(cfg.referencesData?.length)images.layers=evidenceImages(references.composite(canvas),cfg,null)[cfg.grid?'grid':'original'];
  const pose={view,position:camera.position.toArray(),target:controls.target.toArray(),fov:camera.fov,near:camera.near,far:camera.far,aspect:camera.aspect,matrixWorld:camera.matrixWorld.toArray(),projectionMatrix:camera.projectionMatrix.toArray()};poses.push(pose);
  await window.viewer.captureFrame({view,images});
 }
 await window.viewer.captureFinish({ok:true,meta,frames,forwardAxis:cfg.forwardAxis,worldBounds:{min:box.min.toArray(),max:box.max.toArray(),size:size.toArray(),units:'model units; not verified real-world measurement'},poses});return;
 }if(cfg.smoke){const memorySamples=[];for(let i=0;i<3;i++){await load(await window.viewer.initial());renderer.render(scene,camera);memorySamples.push({...renderer.info.memory});}const stableMemory=memorySamples.slice(1).every(m=>m.textures===memorySamples[0].textures&&m.geometries===memorySamples[0].geometries);await new Promise(r=>setTimeout(r,800));const before=camera.position.clone();frame(new THREE.Vector3(-1,.2,1));const orbitMoved=camera.position.distanceTo(before)>0;camera.position.lerp(controls.target,.15);controls.update();const zoomChanged=camera.position.distanceTo(before)>0;$('material').value='clay';setMaterial();renderer.render(scene,camera);$('material').value='original';setMaterial();frame();await new Promise(r=>setTimeout(r,500));await window.viewer.smokeFinish({ok:!!model&&frames>2&&orbitMoved&&zoomChanged&&stableMemory,stableMemory,memorySamples,version:cfg.version,meta,frames,orbitMoved,zoomChanged,renderer:renderer.info.render,memory:renderer.info.memory});}
 }catch(e){error(e);if(cfg.capture||cfg.turntable||cfg.director)await window.viewer.captureFinish({ok:false,error:e.message});if(cfg.smoke)await window.viewer.smokeFinish({ok:false,error:e.message});}}
boot();
