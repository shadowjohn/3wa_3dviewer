import * as T from 'three';
function scaleBound(matrix){const e=matrix.elements;return Math.hypot(e[0],e[1],e[2],e[4],e[5],e[6],e[8],e[9],e[10]);}
function sphereOf(volume,matrix){
 let s;if(volume.sphere)s=new T.Sphere(new T.Vector3(...volume.sphere.slice(0,3)),volume.sphere[3]);
 else {const b=volume.box;const axes=[3,6,9].map(i=>new T.Vector3(...b.slice(i,i+3)));let radius=0;for(const x of [-1,1])for(const y of [-1,1])for(const z of [-1,1])radius=Math.max(radius,axes[0].clone().multiplyScalar(x).addScaledVector(axes[1],y).addScaledVector(axes[2],z).length());s=new T.Sphere(new T.Vector3(...b.slice(0,3)),radius);}
 // Frobenius bound remains conservative under shear, unlike max column length.
 s.center.applyMatrix4(matrix);const e=matrix.elements;s.radius*=scaleBound(matrix);if(![...s.center.toArray(),s.radius].every(Number.isFinite))throw Error('Nonfinite tileset bounds / overflow');return s;
}
export async function buildTileset(payload,parse,dispose){
 const scene=new T.Group(),tiles=[],animations=[];const rootMatrix=new T.Matrix4().fromArray(payload.root.transform||new T.Matrix4().toArray());
 const origin=sphereOf(payload.root.boundingVolume,rootMatrix).center;
 const recenter=new T.Matrix4().makeTranslation(-origin.x,-origin.y,-origin.z);
 // Tile coordinates are Z-up. Viewer convention is Y-up; convert after world recenter.
 const worldToViewer=new T.Matrix4().makeRotationX(-Math.PI/2).multiply(recenter);
 async function visit(node,parent){
 const world=parent.clone().multiply(new T.Matrix4().fromArray(node.transform||new T.Matrix4().toArray()));
 if(!world.elements.every(Number.isFinite))throw Error('Nonfinite cumulative transform / overflow');
 const matrix=worldToViewer.clone().multiply(world);const sphere=sphereOf(node.boundingVolume,matrix);
 const tile={sphere,error:node.geometricError*scaleBound(world),refine:node.refine,content:null,children:[]};if(!Number.isFinite(tile.error))throw Error('Nonfinite geometric error / overflow');tiles.push(tile);
 if(node.contentId!==null){const c=payload.contents[node.contentId];const arr=c.data;const gltf=await parse(arr.buffer.slice(arr.byteOffset,arr.byteOffset+arr.byteLength));const group=new T.Group();group.matrixAutoUpdate=false;
 group.matrix.copy(matrix);if(c.rtc)group.matrix.multiply(new T.Matrix4().makeTranslation(...c.rtc));group.matrix.multiply(new T.Matrix4().makeRotationX(Math.PI/2));group.add(gltf.scene);scene.add(group);tile.content=group;animations.push(...(gltf.animations||[]));}
 for(const child of node.children)tile.children.push(await visit(child,world));return tile;
 }
 try{const root=await visit(payload.root,new T.Matrix4());return {scene,animations,userData:{},root,tiles};}catch(e){dispose(scene);throw e;}
}
export function updateTileset(root,camera,height,threshold=16,outer=new T.Matrix4()){
 const position=camera.getWorldPosition(new T.Vector3()),factor=height/(2*Math.tan(T.MathUtils.degToRad(camera.fov)/2));
 function hide(node){if(node.content)node.content.visible=false;node.children.forEach(hide);}
 function visit(node){const s=node.sphere.clone().applyMatrix4(outer);const distance=Math.max(.001,position.distanceTo(s.center)-s.radius);const refine=node.children.length&&(!node.content||node.error*outer.getMaxScaleOnAxis()*factor/distance>threshold);
 if(node.content)node.content.visible=!refine||node.refine==='ADD';if(refine)node.children.forEach(visit);else node.children.forEach(hide);}
 visit(root);
}
