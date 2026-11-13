const test=require('node:test'),assert=require('node:assert/strict');
test('tileset accumulation, RTC, Y-up and recenter preserve relative positions',async()=>{
 const T=await import('three');const {buildTileset}=await import('../src/tileset-renderer.mjs');
 const node=(x,id,children=[])=>({transform:new T.Matrix4().makeTranslation(x,0,0).toArray(),boundingVolume:{sphere:[0,0,0,1]},geometricError:10,refine:'REPLACE',contentId:id,children});
 const result=await buildTileset({root:node(1000,0,[node(5,1)]),contents:[{id:0,data:new Uint8Array(),rtc:[2,0,0]},{id:1,data:new Uint8Array(),rtc:null}]},async()=>({scene:new T.Group(),animations:[]}),()=>{});
 result.scene.updateMatrixWorld(true);const a=new T.Vector3(),b=new T.Vector3();result.tiles[0].content.getWorldPosition(a);result.tiles[1].content.getWorldPosition(b);assert.equal(b.x-a.x,3);assert.ok(Math.abs(a.x)<10);
});
test('LOD replaces parent close, keeps parent far; ADD keeps both',async()=>{
 const T=await import('three');const {updateTileset}=await import('../src/tileset-renderer.mjs');
 const child={sphere:new T.Sphere(new T.Vector3(),1),error:0,refine:'REPLACE',content:new T.Group(),children:[]};const root={...child,error:100,children:[child],content:new T.Group()};
 const camera=new T.PerspectiveCamera(45,1,.1,100000);camera.position.z=100000;camera.updateMatrixWorld();updateTileset(root,camera,1000);assert.equal(root.content.visible,true);assert.equal(child.content.visible,false);
 camera.position.z=10;camera.updateMatrixWorld();updateTileset(root,camera,1000);assert.equal(root.content.visible,false);assert.equal(child.content.visible,true);
 root.refine='ADD';updateTileset(root,camera,1000);assert.equal(root.content.visible,true);
});
test('tileset rejects overflow in accumulated transform',async()=>{const T=await import('three');const {buildTileset}=await import('../src/tileset-renderer.mjs');const n={transform:new T.Matrix4().makeTranslation(1e308,0,0).toArray(),boundingVolume:{sphere:[0,0,0,1]},geometricError:1,refine:'ADD',contentId:null,children:[]};await assert.rejects(buildTileset({root:{...n,children:[n]},contents:[]},()=>{},()=>{}),/finite|overflow/i);});
