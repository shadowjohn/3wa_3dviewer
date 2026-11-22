const test=require('node:test'),a=require('node:assert/strict');
const d=require('../src/director-policy.cjs');
const frame=(time,position=[0,3,7],lookAt=[0,0,0],fov=45)=>({time,position,lookAt,fov});
const scene=()=>({version:1,seconds:2,camera:[frame(0),frame(2)],objects:[{id:'station',file:'station.glb'},{id:'bike',file:'assets/bike.glb',pivot:[1,0,0],spin:{axis:[0,1,0],degreesPerSecond:90},movement:[{time:0,position:[0,0,0],rotation:[0,10,0]},{time:2,position:[4,0,0],rotation:[0,50,0]}]}],notes:[{object:'station',text:'Untimed',point:[0,0,1]},{object:'bike',text:'Timed',point:[0,0,1],start:.5,end:1.5}]});
test('same timeline samples independent stationary, movement, spin and notes',()=>{
 const s=d.director(scene());
 a.equal(s.frameCount,60);
 a.deepEqual(d.placement(s.objects[0],1),{position:[0,0,0],rotation:[0,0,0],spinDegrees:0});
 a.deepEqual(d.placement(s.objects[1],1),{position:[2,0,0],rotation:[0,30,0],spinDegrees:90});
 for(const [t,expected] of [[.49,['Untimed']],[.5,['Untimed','Timed']],[1.5,['Untimed']],[2,[]]])a.deepEqual(d.activeNotes(s.notes,t).map(n=>n.text),expected);
});
test('director notes accept a bounded viewport-height label offset',()=>{
 const s=scene();
 for(const value of [-.45,-.2,0,.2,.45]){
  s.notes[1].labelOffsetY=value;
  const p=d.director(s);
  a.equal(p.notes[1].labelOffsetY,value);
  a.equal('labelOffsetY' in p.notes[0],false);
  a.deepEqual(d.activeNotes(p.notes,1).at(-1).point,[0,0,1]);
 }
 for(const value of [-.451,.451,NaN,Infinity,null,'0.2']){
  s.notes[1].labelOffsetY=value;
  a.throws(()=>d.director(s),/labelOffsetY/);
 }
});
test('director rejects unsupported input, traversal, arbitrary URLs/scripts and mismatched references',()=>{
 for(const file of ['../x.glb','x/../a.glb','C:/a.glb','https://example.test/p.glb','//share/x.glb','a\\x.glb','file%2fpath.glb','x.glb.']){const s=scene();s.objects[0].file=file;a.throws(()=>d.director(s));}
 for(const mutate of [s=>s.version=2,s=>s.script='doWork()',s=>s.objects[1].id='station',s=>s.notes[0].object='missing',s=>s.notes[0].end=3,s=>s.camera[1].time=1,s=>s.objects[1].movement[1].time=0]){const s=scene();mutate(s);a.throws(()=>d.director(s));}
});
test('director rejects a model whose canonical path leaves the scene folder',async()=>{
 const fs=require('node:fs/promises'),os=require('node:os'),p=require('node:path');
 const tmp=await fs.mkdtemp(p.join(os.tmpdir(),'3wa-director-policy-')),base=p.join(tmp,'scene'),out=p.join(tmp,'outside');
 try{
  await fs.mkdir(base);await fs.mkdir(out);await fs.writeFile(p.join(out,'bike.glb'),'fixture');
  await fs.symlink(out,p.join(base,'assets'),process.platform==='win32'?'junction':'dir');
  const s=scene();s.objects.shift();s.notes=[];const file=p.join(base,'a.json');await fs.writeFile(file,JSON.stringify(s));
  await a.rejects(require('../src/director-job.cjs').readScene(file,[tmp]),/outside configured allowed roots/i);
 }finally{await fs.rm(tmp,{recursive:true});}
});
test('anchor follows its own model yet another object can occlude it',async()=>{
 const {PerspectiveCamera,Mesh,BoxGeometry,MeshBasicMaterial}=await import('three');
 const {visibleNote}=await import('../src/model-notes.mjs'),c=new PerspectiveCamera(45,4/3,.01,50);
 c.position.set(0,0,5);c.lookAt(0,0,0);c.updateMatrixWorld();
 const object=new Mesh(new BoxGeometry(1,1,1),new MeshBasicMaterial()),blocker=object.clone(),note={text:'Anchor',point:[0,0,.5]};
 blocker.position.z=2;blocker.updateMatrixWorld();object.updateMatrixWorld();
 a.equal(visibleNote(note,object,c,1,[object,blocker]),null);
 blocker.position.x=3;blocker.updateMatrixWorld();
 const before=visibleNote(note,object,c,1,[object,blocker]);a.equal(before.x,.5);
 object.position.x=1;object.updateMatrixWorld();
 a.ok(visibleNote(note,object,c,1,[object,blocker]).x>before.x);
});
test('director content samples world anchors in a host scene and disposes only its resources',async()=>{
 const {Group,Mesh,BoxGeometry,MeshBasicMaterial}=await import('three');
 const {createDirectorContent}=await import('../src/director-content.mjs');
 const job=d.director({
  version:1,seconds:2,camera:[frame(0),frame(2)],
  objects:[{id:'valve',file:'valve.glb',movement:[
   {time:0,position:[0,0,0],rotation:[0,0,0]},{time:2,position:[4,0,0],rotation:[0,0,0]},
  ]}],
  notes:[{object:'valve',text:'Valve',point:[0,0,.5]}],
  captions:[{text:'Open',start:.5,end:1.5}],
 });
 const map=new Group(),mount=new Group(),unrelated=new Group();
 map.position.set(5,6,7);mount.position.set(1,2,3);map.add(mount);mount.add(unrelated);
 const geometry=new BoxGeometry(),mesh=new Mesh(geometry,new MeshBasicMaterial());
 let disposals=0;
 geometry.addEventListener('dispose',()=>disposals++);
 const content=await createDirectorContent({job,scene:mount,loadModel:()=>({scene:mesh})});
 const forward=content.applyFrame(15);
 a.deepEqual(forward.notes[0].point,[7,8,10.5]);
 a.deepEqual(forward.camera,d.directorCamera(job,15));
 a.equal(forward.caption,'Open');
 a.equal(content.applyFrame(45).caption,null);
 a.deepEqual(content.applyFrame(0).notes[0].point,[6,8,10.5]);
 a.deepEqual(content.applyFrame(15),forward);
 map.position.x+=.5;
 a.deepEqual(content.worldNotes(15)[0].point,[7.5,8,10.5]);
 content.dispose();content.dispose();
 a.deepEqual(mount.children,[unrelated]);
 a.equal(disposals,1);
});
test('named clip controls reject invalid input and normalize defaults',()=>{
 const track={clip:'Flap'};
 const s=scene();s.objects[1].animation=track;
 a.deepEqual(d.director(s).objects[1].animation,{clip:'Flap',start:0,rate:1,loop:'repeat',missing:'error'});
 for(const bad of [{clip:''},{clip:'Bad\nName'},{clip:'Run',start:2},{clip:'Run',rate:0},{clip:'Run',loop:'anything'},{clip:'Run',missing:true},{clip:'Run',url:'https://example.test'}]){s.objects[1].animation=bad;a.throws(()=>d.director(s));}
});
test('two copies sample the same named clip independently across looping, holding and reverse seek',async()=>{
 const {Group,AnimationClip,NumberKeyframeTrack}=await import('three'),{bindDirectorClip}=await import('../src/director-animation.mjs');
 function root(){const g=new Group(),arm=new Group();arm.name='arm';arm.rotation.x=-.25;g.add(arm);return {g,arm};}
 const clip=new AnimationClip('Flap',1,[new NumberKeyframeTrack('arm.rotation[x]',[0,1],[0,2])]);
 const A=root(),B=root(),at=bindDirectorClip(A.g,[clip],{clip:'Flap',start:.5,rate:2,loop:'repeat'},'a'),
 bt=bindDirectorClip(B.g,[clip],{clip:'Flap',start:1,rate:1,loop:'once'},'b');
 const pair=t=>{at(t);bt(t);return [A.arm.rotation.x,B.arm.rotation.x];};
 a.deepEqual(pair(0),[-.25,-.25]);
 a.deepEqual(pair(.75),[1,-.25]);
 a.deepEqual(pair(1.25),[1,.5]);
 a.deepEqual(pair(2.5),[0,2]);
 a.deepEqual(pair(.25),[-.25,-.25]);
 a.deepEqual(pair(1.25),[1,.5]);
 a.equal(bindDirectorClip(A.g,[clip],{clip:'No',missing:'static'},'a'),null);
 a.throws(()=>bindDirectorClip(A.g,[clip],{clip:'No'},'a'),/object "a"/);
 a.throws(()=>bindDirectorClip(A.g,[clip,clip],{clip:'Flap',missing:'static'},'a'),/ambiguous/);
});
test('lighting omitted remains disabled; direction, strength and sRGB channels sample independently',()=>{
 const s=scene();
 a.equal(d.director(s).lighting,null);
 s.lighting={shadows:true,keyframes:[{time:0,direction:[-3,2,3],intensity:1,color:'#ffaa66'},{time:2,direction:[3,6,3],intensity:3,color:'#11ddff'}]};
 const l=d.director(s).lighting;
 a.equal(l.shadows,true);
 a.deepEqual(d.sampleLight(l,1),{direction:[0,4,3],intensity:2,rgb:[136,195.5,178.5]});
 a.deepEqual(d.sampleLight(d.lightingPlan({direction:[0,1,0]},2),1).direction,[0,1,0]);
});
test('reject unsafe and ambiguous scene light settings',()=>{
 for(const light of [{ambient:1},{intensity:5},{direction:[0,0,0]},{direction:[-1,-1,0]},{shadows:1024},{color:'#abc'},
  {direction:[1,1,1],keyframes:[{time:0},{time:2}]},{keyframes:[{time:.1},{time:2}]},{keyframes:[{time:0},{time:1}]},{keyframes:[{time:0},{time:0},{time:2}]}])a.throws(()=>d.lightingPlan(light,2));
});
test('shot boundaries select the new camera on its first frame without resetting scene time',()=>{
 const s=scene();delete s.camera;
 s.shots=[{end:1,camera:[frame(0,[4,3,7]),frame(1,[1,3,7])]},
 {end:2,camera:[frame(0,[-4,3,7]),frame(1,[-5,3,7])]}];
 const p=d.director(s),at=i=>d.directorCamera(p,i).position[0];
 a.ok(at(29)>1);a.equal(at(30),-4);a.equal(at(45),-4.5);
 a.equal(d.placement(p.objects[1],30/p.fps).spinDegrees,90);
 a.deepEqual(d.activeNotes(p.notes,30/p.fps).map(n=>n.text),['Untimed','Timed']);
 a.equal(d.directorCamera(d.director(scene()),30).position[2],7);
});
test('shot lists reject overlap, fractional-frame cuts, empty/extra tracks or incomplete coverage',()=>{
 const shot=(end,seconds)=>({end,camera:[frame(0),frame(seconds)]});
 for(const mutate of [s=>s.shots=[],s=>s.shots=[shot(1.01,1.01),shot(2,.99)],s=>s.shots=[shot(1,1),shot(1,1)],s=>s.shots=[shot(1,1)],s=>s.shots=[shot(2,1)],s=>s.shots=[{...shot(2,2),script:'x'}],s=>{s.camera=[frame(0),frame(2)];s.shots=[shot(2,2)];}]){
  const s=scene();delete s.camera;mutate(s);a.throws(()=>d.director(s));
 }
});
test('optional dissolve blends only the planned boundary frames, using the outgoing final pose',()=>{
 const s=scene();delete s.camera;s.shots=[
  {end:1,camera:[frame(0,[4,3,7]),frame(1,[1,3,7])]},
  {end:2,dissolveInFrames:6,camera:[frame(0,[-4,3,7]),frame(1,[-5,3,7])]}
 ];
 const p=d.director(s);
 a.equal(d.directorBlend(p,29),null);a.equal(d.directorBlend(p,30).mix,0);
 a.equal(d.directorBlend(p,33).mix,.5);a.equal(d.directorBlend(p,33).previous.position[0],1);
 a.equal(d.directorBlend(p,36),null);
 for(const bad of [1,16,-1,'6']){s.shots[1].dissolveInFrames=bad;a.throws(()=>d.director(s));}
 s.shots[1].dissolveInFrames=0;s.shots[0].dissolveInFrames=6;a.throws(()=>d.director(s));
});

const flowTrack=()=>({
 id:'pipe',object:'station',points:[[-2,0,0],[0,0,0],[2,0,0]],medium:'water',
 stages:[{start:0,end:1,direction:'forward',speed:1},
  {start:1,end:2,direction:'reverse',speed:1,stop:{distance:2,normal:[.5,0,0]}}]
});
test('flow tracks are opt-in and compile stages, model anchors and display controls',()=>{
 a.deepEqual(d.director(scene()).flows,[]);
 const s=scene(),track=flowTrack();
 s.flows=[track,{...track,id:'air',object:undefined,medium:'air',arrows:false,particleCount:14}];
 const [water,air]=d.director(s).flows;
 a.equal(water.object,'station');
 a.deepEqual(water.stages,[{start:0,end:1,direction:1,speed:1,stop:null},
  {start:1,end:2,direction:-1,speed:1,stop:{distance:2,normal:[1,0,0]}}]);
 a.deepEqual([air.object,air.medium,air.arrows,air.particles,air.particleCount],[null,'air',false,true,14]);
});
test('flow tracks reject malformed paths, excessive resources and invalid stage windows',()=>{
 for(const mutate of [
  s=>s.flows.push(s.flows[0]), s=>s.flows[0].object='missing', s=>s.flows[0].medium='unknown',
  s=>s.flows[0].particleCount=97, s=>s.flows[0].arrowCount=13, s=>s.flows[0].seed=-1,
  s=>s.flows[0].points[1]=s.flows[0].points[0], s=>s.flows[0].points[1][0]=Infinity,
  s=>s.flows[0].stages[1].start=.9, s=>s.flows[0].stages[1].end=3,
  s=>s.flows[0].stages[0].speed=-1, s=>s.flows[0].stages[1].stop.distance=5,
  s=>s.flows[0].stages[1].stop.normal=[0,0,0], s=>s.flows[0].script='unexpected',
 ]){
  const s=scene();s.flows=[flowTrack()];mutate(s);
  a.throws(()=>d.director(s),/flow/i);
 }
});


test('flow appearance is optional and compiles a named profile with explicit colors',()=>{
 const s=scene();
 s.flows=[flowTrack()];
 a.equal(d.director(s).flows[0].appearance,null);
 s.flows[0].appearance={shape:'viscous',particleColor:'#ab7318',arrowColor:'#FFDA92',opacity:.85};
 a.deepEqual(d.director(s).flows[0].appearance,{...s.flows[0].appearance,arrowStyle:null,trace:null,scale:1});
 s.flows[0].appearance={};
 a.deepEqual(d.director(s).flows[0].appearance,{shape:'drop',particleColor:null,arrowColor:null,opacity:null,arrowStyle:null,trace:null,scale:1});
 s.flows[0].appearance={scale:.015};
 a.equal(d.director(s).flows[0].appearance.scale,.015);
 for(const appearance of [{shape:'steam-code'}, {particleColor:'#123'}, {arrowColor:'rgb(1,2,3)'},
  {opacity:1.5},{opacity:0},{opacity:Infinity},{materialUrl:'invalid'},{arrowStyle:'cursive'},{trace:'sheet'},
  {scale:0},{scale:.0009},{scale:10.1},{scale:'1'},{scale:Infinity},null]){
  s.flows[0].appearance=appearance;
  a.throws(()=>d.director(s),/flow/i);
 }
});

test('flow relative colors require a trace and one normalized sample per path point',()=>{
 const s=scene(),track={...flowTrack(),arrows:false,particles:false,traceValues:[0,.5,1]};
 s.flows=[track];
 a.throws(()=>d.director(s),/trace values/i);
 for(const trace of ['ribbon','streamline']){
  track.appearance={arrowStyle:'schematic',trace};
  const compiled=d.director(s).flows[0];
  a.deepEqual(compiled.traceValues,[0,.5,1]);
  a.equal(compiled.appearance.arrowStyle,'schematic');
  a.equal(compiled.appearance.trace,trace);
 }
 for(const values of [null,{},[0,1],[0,-.1,1],[0,1.1,1],[0,NaN,1],[0,'0.5',1],[0,,1]]){
  track.traceValues=values;
  a.throws(()=>d.director(s),/trace values/i);
 }
});
