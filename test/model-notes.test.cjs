const test=require('node:test'),assert=require('node:assert/strict');
const {modelNotes}=require('../src/model-notes-policy.cjs');
test('plain anchored notes are bounded, retain pane and copy their points',()=>{
 const point=[1,2,3];const out=modelNotes([{text:' FRONT <b> ',point,pane:1}],2);
 assert.deepEqual(out,[{text:'FRONT <b>',point:[1,2,3],pane:1}]);point[0]=20;assert.equal(out[0].point[0],1);
 for(const invalid of [[{text:'<a>',point:[1,2,NaN]}],[{text:'a',point:[1,2,3],html:true}],[{text:'a',point:[0,0,0],pane:2}],[{text:'a'.repeat(81),point:[0,0,0]}],[{text:'\n',point:[0,0,0]}]])assert.throws(()=>modelNotes(invalid,2));
 assert.throws(()=>modelNotes([{text:'x',point:[0,0,0],pane:1}],1));
});
test('projection rejects occluded and off-screen annotations',async()=>{
 const T=await import('three'),{visibleNote}=await import('../src/model-notes.mjs');
 const model=new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial());model.updateMatrixWorld();
 const camera=new T.PerspectiveCamera(45,1,.1,10);camera.position.set(0,0,4);camera.lookAt(0,0,0);camera.updateMatrixWorld();
 assert.ok(visibleNote({point:[0,0,1]},model,camera,1));
 assert.equal(visibleNote({point:[0,0,-1]},model,camera,1),null);
 assert.equal(visibleNote({point:[500,500,1]},model,camera,1),null);
 camera.position.z=-4;camera.lookAt(0,0,0);camera.updateMatrixWorld();assert.ok(visibleNote({point:[0,0,-1]},model,camera,1));
});
