import * as THREE from 'three';
import {VRMLoaderPlugin,VRMUtils} from '@pixiv/three-vrm';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import {DRACOLoader} from 'three/addons/loaders/DRACOLoader.js';
import {KTX2Loader} from 'three/addons/loaders/KTX2Loader.js';
import {MeshoptDecoder} from 'three/addons/libs/meshopt_decoder.module.js';
import {RoomEnvironment} from 'three/addons/environments/RoomEnvironment.js';
const $=id=>document.getElementById(id),viewport=$('viewport');
let vrm=null;
let renderer,controls,model,grid,mixer,seq=0,radius=1,meta,frames=0,animationCount=0,draco,ktx;
const scene=new THREE.Scene();scene.background=new THREE.Color('#19212c');
const avatarLight=new THREE.DirectionalLight(0xffffff,1.2);avatarLight.position.set(1,2,3);avatarLight.visible=false;scene.add(avatarLight);
const camera=new THREE.PerspectiveCamera(45,1,.01,1000);camera.position.set(4,3,5);
const container=new THREE.Group();scene.add(container);
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
 const json=payload.kind==='gltf'?JSON.parse(new TextDecoder().decode(data)):JSON.parse(new TextDecoder().decode(new Uint8Array(data,20,view.getUint32(12,true))).trim());
 const unsupported=(json.extensionsRequired||[]).filter(e=>!supported.has(e));if(unsupported.length)throw Error('尚未支援必要擴充：'+unsupported.join(', '));
 const gltf=await loader.parseAsync(payload.kind==='gltf'?new TextDecoder().decode(data):data,'');if(ticket!==seq){dispose(gltf.scene);return;}
 const nextVrm=gltf.userData.vrm;
 if(payload.avatar&&!nextVrm){dispose(gltf.scene);throw Error('Unable to construct VRM avatar. Check humanoid and metadata.');}
 if(nextVrm){VRMUtils.rotateVRM0(nextVrm);nextVrm.update(0);}
 let meshes=0,triangles=0;gltf.scene.traverse(o=>{if(o.isMesh){meshes++;triangles+=(o.geometry.index?.count||o.geometry.attributes.position?.count||0)/3;}});
 if(!meshes){dispose(gltf.scene);throw Error('模型沒有可顯示的網格。');}
 const box=new THREE.Box3().setFromObject(gltf.scene);if(box.isEmpty()||![...box.min.toArray(),...box.max.toArray()].every(Number.isFinite)){dispose(gltf.scene);throw Error('模型座標無效。');}
 if(mixer){mixer.stopAllAction();mixer.uncacheRoot(model);}if(model)container.remove(model);dispose(model);materials.clear();vrm=nextVrm||null;avatarLight.visible=!!vrm;model=gltf.scene;container.rotation.set(0,0,0);container.add(model);model.traverse(o=>{if(o.isMesh)materials.set(o,o.material);});
 animationCount=gltf.animations.length;mixer=animationCount?new THREE.AnimationMixer(model):null;gltf.animations.forEach(a=>mixer.clipAction(a).play());
 meta={name:payload.name,bytes:payload.size,meshes,triangles:Math.round(triangles),extensions:payload.extensions,animations:animationCount,note:payload.note,vrm:payload.avatar?{...payload.avatar,mtoonMaterials:vrm.materials.filter(m=>m.isMToonMaterial).length}:null};
 info([['檔案',payload.name],...(payload.avatar?[['VRM',payload.avatar.version],['角色',payload.avatar.name],['作者',payload.avatar.authors]]:[]),['檔案大小',(payload.size/1048576).toFixed(2)+' MB'],['三角面',Math.round(triangles).toLocaleString()],['網格 / 動畫',meshes+' / '+animationCount],['擴充',payload.extensions.join(', ')||'標準 glTF 2.0'],['座標 / 資源',payload.note||'glTF 本地座標']]);
 setMaterial();frame();$('welcome').hidden=true;$('loading').hidden=true;$('status').textContent='已載入 · '+payload.name;
 }catch(e){if(ticket===seq)error(e);throw e;}
}
try{
 renderer=new THREE.WebGLRenderer({antialias:true,alpha:false});renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;viewport.prepend(renderer.domElement);
 renderer.domElement.addEventListener('webglcontextlost',e=>{e.preventDefault();error('GPU 顯示環境中斷，請重開 viewer。');});
 controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.08;
 const pmrem=new THREE.PMREMGenerator(renderer),room=new RoomEnvironment();scene.environment=pmrem.fromScene(room,.04).texture;room.dispose();pmrem.dispose();scene.add(new THREE.HemisphereLight(0xddeeff,0x444455,.6));
 draco=new DRACOLoader().setDecoderPath('decoders/draco/');draco.setWorkerLimit(2);ktx=new KTX2Loader().setTranscoderPath('decoders/basis/').detectSupport(renderer);ktx.setWorkerLimit(2);
 new ResizeObserver(()=>{camera.aspect=viewport.clientWidth/viewport.clientHeight;camera.updateProjectionMatrix();renderer.setSize(viewport.clientWidth,viewport.clientHeight);}).observe(viewport);
 renderer.setAnimationLoop(()=>{timer.update();const dt=Math.min(timer.getDelta(),.1);if($('animation').checked){if(mixer)mixer.update(dt);vrm?.update(dt);}controls.autoRotate=$('rotate').checked;controls.update(dt);renderer.render(scene,camera);frames++;});
}catch(e){error(e);}
async function action(fn){try{await fn();}catch(e){error(e);}}
$('open').onclick=()=>action(async()=>load(await window.viewer.open()));$('save').onclick=()=>action(async()=>{if(await window.viewer.snapshot())$('status').textContent='截圖已儲存';});$('dismiss').onclick=()=>{$('error').hidden=true;};$('frame').onclick=()=>frame();
const dirs={front:[0,0,1],back:[0,0,-1],left:[-1,0,0],right:[1,0,0],top:[0,1,.00001],iso:[1,.65,1]};document.querySelectorAll('[data-view]').forEach(b=>b.onclick=()=>frame(new THREE.Vector3(...dirs[b.dataset.view])));
$('background').onchange=()=>scene.background.set($('background').value);$('material').onchange=setMaterial;$('grid').onchange=()=>{if(grid)grid.visible=$('grid').checked;};$('exposure').oninput=()=>{renderer.toneMappingExposure=Number($('exposure').value);$('exposureValue').textContent=Number($('exposure').value).toFixed(1);};$('rotateX').onclick=()=>{container.rotation.x+=Math.PI/2;frame();};$('reset').onclick=()=>{container.rotation.set(0,0,0);frame();};
window.addEventListener('keydown',e=>{if(e.ctrlKey&&e.key.toLowerCase()==='o'){e.preventDefault();$('open').click();}if(e.key.toLowerCase()==='f'&&!e.ctrlKey)frame();});
window.addEventListener('dragover',e=>{e.preventDefault();document.body.classList.add('drag');});window.addEventListener('dragleave',e=>{if(!e.relatedTarget)document.body.classList.remove('drag');});window.addEventListener('drop',e=>{e.preventDefault();document.body.classList.remove('drag');const f=e.dataTransfer.files[0];if(f)action(async()=>load(await window.viewer.drop(f)));});window.viewer.onOpen(p=>action(()=>load(p)));
$('updates').onclick=async()=>{const b=$('updates');b.disabled=true;b.textContent='檢查中…';$('release').hidden=true;try{const r=await window.viewer.checkUpdates();$('status').textContent=r.error||(r.version?(r.available?'有新版本 '+r.version+'，可開啟版本頁自行下載。':'目前已是最新穩定版 '+r.current):'目前尚無已發布的穩定版本。');$('release').hidden=!r.url;}catch(e){$('status').textContent='更新查詢失敗；離線瀏覽不受影響。';}finally{b.disabled=false;b.textContent='檢查更新';}};
$('release').onclick=()=>action(()=>window.viewer.releasePage());
async function boot(){const cfg=await window.viewer.config();$('version').textContent='3wa_3dviewer · '+cfg.version+' · VRM preview';try{
 await load(await window.viewer.initial());if(cfg.smoke){const memorySamples=[];for(let i=0;i<3;i++){await load(await window.viewer.initial());renderer.render(scene,camera);memorySamples.push({...renderer.info.memory});}const stableMemory=memorySamples.slice(1).every(m=>m.textures===memorySamples[0].textures&&m.geometries===memorySamples[0].geometries);await new Promise(r=>setTimeout(r,800));const before=camera.position.clone();frame(new THREE.Vector3(-1,.2,1));const orbitMoved=camera.position.distanceTo(before)>0;camera.position.lerp(controls.target,.15);controls.update();const zoomChanged=camera.position.distanceTo(before)>0;$('material').value='clay';setMaterial();renderer.render(scene,camera);$('material').value='original';setMaterial();frame();await new Promise(r=>setTimeout(r,500));await window.viewer.smokeFinish({ok:!!model&&frames>2&&orbitMoved&&zoomChanged&&stableMemory,stableMemory,memorySamples,version:cfg.version,meta,frames,orbitMoved,zoomChanged,renderer:renderer.info.render,memory:renderer.info.memory});}
 }catch(e){error(e);if(cfg.smoke)await window.viewer.smokeFinish({ok:false,error:e.message});}}
boot();
