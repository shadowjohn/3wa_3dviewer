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
 assert.deepEqual(visibleNote({point:[0,0,1],text:'anchor',labelOffsetY:-.2},model,camera,1),
  {x:.5,y:.5,text:'anchor',labelOffsetY:-.2});
 assert.equal(visibleNote({point:[0,0,-1],labelOffsetY:.2},model,camera,1),null);
 assert.equal(visibleNote({point:[500,500,1]},model,camera,1),null);
 camera.position.z=-4;camera.lookAt(0,0,0);camera.updateMatrixWorld();assert.ok(visibleNote({point:[0,0,-1]},model,camera,1));
});
test('offset annotation boxes scale with the viewport and leave the leader at the surface',async()=>{
 const {drawModelNotes}=await import('../src/model-notes.mjs');
 const calls=[];
 const ctx={
  save(){},restore(){},beginPath(){},rect(){},clip(){},stroke(){},arc(){},fill(){},fillText(){},
  measureText(text){return {width:text.length*8};},
  moveTo(x,y){calls.push(['start',x,y]);},lineTo(x,y){calls.push(['end',x,y]);},
  roundRect(x,y,w,h){calls.push(['box',x,y,w,h]);},
 };
 const note={x:.5,y:.5,text:'valve'};
 for(const [width,height] of [[640,480],[320,240]]){
  const viewport={x:20,y:10,width,height},px=20+width/2,py=10+height/2;
  for(const labelOffsetY of [-.2,.2]){
   calls.length=0;
   drawModelNotes(ctx,[{...note,labelOffsetY}],viewport);
   const [start,end,box]=calls;
   assert.deepEqual(start,['start',px,py]);
   assert.deepEqual(end,['end',px,py+height*labelOffsetY]);
   const [,x,y,w,h]=box;
   assert.equal(x+w/2,px);
   assert.equal(labelOffsetY<0?y+h:y,end[2]);
  }
 }
 const viewport={x:0,y:0,width:640,height:480};
 calls.length=0;
 drawModelNotes(ctx,[note],viewport);
 const legacy=calls.slice();
 calls.length=0;
 drawModelNotes(ctx,[{...note,labelOffsetY:0}],viewport);
 assert.deepEqual(calls,legacy);
 calls.length=0;
 drawModelNotes(ctx,[{...note,y:.03,labelOffsetY:-.2}],viewport);
 assert.deepEqual(calls[0],['start',320,480*.03]);
 assert.notDeepEqual(calls[0].slice(1),calls[1].slice(1),'viewport edge must leave a nonzero leader');
 assert.ok(calls[2][2]>=6,'label remains within the viewport');
});
