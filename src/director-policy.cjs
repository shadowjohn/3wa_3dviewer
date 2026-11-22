const {keyframes,poseAt}=require('./camera-path.cjs'),{modelNotes}=require('./model-notes-policy.cjs'),{captions}=require('./timed-captions.cjs');
const FPS=30,keys=(v,fields)=>v&&typeof v==='object'&&!Array.isArray(v)&&Object.keys(v).every(k=>fields.includes(k));
const vector=(v,max=100)=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=max);
const vec=(v,d,m)=>{if(v===undefined)return d;if(!vector(v,m))throw Error('Invalid director vector');return v;};
function flowAppearance(raw,medium){
 if(raw===undefined)return null;
 if(!keys(raw,['shape','arrowColor','particleColor','opacity','arrowStyle','trace']))throw Error('Invalid flow appearance.');
 const {shape=medium==='water'?'drop':'bead',arrowColor,particleColor,opacity,arrowStyle,trace}=raw;
 const validColor=value=>value===undefined||(typeof value==='string'&&/^#[\da-f]{6}$/i.test(value));
 if(!['drop','bead','viscous','mist'].includes(shape)||!validColor(arrowColor)||!validColor(particleColor)||
    (opacity!==undefined&&(!Number.isFinite(opacity)||opacity<=0||opacity>1))){
  throw Error('Invalid flow shape, color or particle opacity.');
 }
 if((arrowStyle!==undefined&&arrowStyle!=='schematic')||
    (trace!==undefined&&!['ribbon','streamline'].includes(trace)))throw Error('Invalid flow arrow or trace style.');
 return {shape,arrowColor:arrowColor??null,particleColor:particleColor??null,opacity:opacity??null,arrowStyle:arrowStyle??null,trace:trace??null};
}
function flowPlan(raw,objectIds,seconds){
 if(raw===undefined)return [];
 if(!Array.isArray(raw)||raw.length>4)throw Error('Director supports up to 4 flow tracks.');
 const ids=new Set();
 return raw.map(track=>{
  if(!keys(track,['id','object','points','medium','seed','arrows','particles','arrowCount','particleCount','stages','appearance','traceValues'])||
     typeof track.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(track.id)||ids.has(track.id)){
   throw Error('Invalid or duplicate flow track ID.');
  }
  const {id,object=null,points,medium,seed=1,arrows=true,particles=true,arrowCount=7,particleCount=48,stages,traceValues}=track;
  ids.add(id);
  if((track.object!==undefined&&!objectIds.has(object))||!['air','water'].includes(medium)||
     !Number.isInteger(seed)||seed<0||seed>0xffffffff||typeof arrows!=='boolean'||typeof particles!=='boolean'||
     !Number.isInteger(arrowCount)||arrowCount<1||arrowCount>12||!Number.isInteger(particleCount)||particleCount<1||particleCount>96){
   throw Error('Invalid flow target, medium, seed or count.');
  }
  if(!Array.isArray(points)||points.length<2||points.length>64||!points.every(p=>vector(p))){
   throw Error('Flow path must contain 2 to 64 finite 3D points.');
  }
  const appearance=flowAppearance(track.appearance,medium);
  if(traceValues!==undefined&&(!appearance?.trace||!Array.isArray(traceValues)||traceValues.length!==points.length||
     !Array.from(traceValues).every(n=>Number.isFinite(n)&&n>=0&&n<=1))){
   throw Error('Flow trace values require a trace and one value from 0 to 1 per path point.');
  }
  let length=0;
  for(let i=1;i<points.length;i++){
   const a=points[i-1],b=points[i];
   const segment=Math.hypot(b[0]-a[0],b[1]-a[1],b[2]-a[2]);
   if(segment<.0001)throw Error('Flow path contains a zero-length segment.');
   length+=segment;
  }
  if(!Array.isArray(stages)||stages.length<1||stages.length>8)throw Error('Flow track requires 1 to 8 stages.');
  let previousEnd=0;
  const phases=stages.map(stage=>{
   if(!keys(stage,['start','end','direction','speed','stop'])||!Number.isFinite(stage.start)||
      !Number.isFinite(stage.end)||stage.start<previousEnd||stage.start>=stage.end||stage.end>seconds||
      !['forward','reverse'].includes(stage.direction)||!Number.isFinite(stage.speed)||stage.speed<0||stage.speed>100){
    throw Error('Invalid flow stage, time window, direction or speed.');
   }
   const {start,end,speed}=stage;
   previousEnd=end;
   let stop=null;
   if(stage.stop!==undefined){
    const plane=stage.stop;
    if(!keys(plane,['distance','normal'])||!Number.isFinite(plane.distance)||plane.distance<=0||plane.distance>=length||
       !vector(plane.normal,1)||Math.hypot(...plane.normal)<.0001){
     throw Error('Invalid flow stop plane.');
    }
    const magnitude=Math.hypot(...plane.normal);
    stop={distance:plane.distance,normal:plane.normal.map(n=>n/magnitude)};
   }
   return {start,end,direction:stage.direction==='forward'?1:-1,speed,stop};
  });
  return {id,object,points,medium,seed,arrows,particles,arrowCount,particleCount,stages:phases,appearance,traceValues:traceValues??null};
 });
}
function director(input){
 if(!keys(input,['version','seconds','camera','objects','notes','captions','lighting','shots','flows'])||input.version!==1)throw Error('Unsupported scene script version or fields.');
 const {seconds}=input,frameCount=Math.round(seconds*FPS);
 if(!Number.isFinite(seconds)||seconds<1||seconds>20||Math.abs(seconds*FPS-frameCount)>1e-8)throw Error('Director duration must be 1 to 20 seconds in whole frames.');
 const {camera,shots}=shotPlan(input,frameCount,seconds);
 if(!Array.isArray(input.objects)||input.objects.length<1||input.objects.length>4)throw Error('Director supports 1 to 4 objects.');
 const ids=new Set();
 const objects=input.objects.map(o=>{
  if(!keys(o,['id','file','position','rotation','pivot','spin','movement','animation'])||typeof o.id!=='string'||!/^[a-z][a-z0-9_-]{0,31}$/.test(o.id)||ids.has(o.id)||typeof o.file!=='string'||o.file.length>180||!/^[-\p{L}\p{N}_. ]+(?:\/[-\p{L}\p{N}_. ]+)*\.glb$/iu.test(o.file)||o.file.split('/').some(p=>p==='.'||p==='..'||p.endsWith('.')||p.endsWith(' ')))throw Error('Invalid ID or relative GLB location.');
  ids.add(o.id);
  const position=vec(o.position,[0,0,0],100),rotation=vec(o.rotation,[0,0,0],360),pivot=vec(o.pivot,[0,0,0],100);
  let spin=null;
  if(o.spin!==undefined){
   if(!keys(o.spin,['axis','degreesPerSecond'])||!vector(o.spin.axis,1)||Math.hypot(...o.spin.axis)<.0001||!Number.isFinite(o.spin.degreesPerSecond)||Math.abs(o.spin.degreesPerSecond)>720)throw Error('Invalid independent spin.');
   spin=o.spin;
  }
  let movement=null;
  if(o.movement!==undefined){
   if(!Array.isArray(o.movement)||o.movement.length<2||o.movement.length>32)throw Error('Invalid object movement length.');
   let prior=-1;
   movement=o.movement.map((k,i)=>{
    if(!keys(k,['time','position','rotation'])||!Number.isFinite(k.time)||k.time>seconds||(i===0?k.time!==0:k.time-prior<1/FPS-1e-9)||!vector(k.position)||!vector(k.rotation,360))throw Error('Bad object keyframe.');
    prior=k.time;return k;
   });
   if(movement.at(-1).time!==seconds)throw Error('Object keyframes must cover the duration.');
  }
  let animation=null;
  if(o.animation!==undefined){
   const a=o.animation;
   if(!keys(a,['clip','start','rate','loop','missing'])||typeof a.clip!=='string'||!a.clip.trim()||a.clip.length>120||/[\u0000-\u001f\u007f]/.test(a.clip))throw Error('Invalid named GLB animation.');
   const {clip,start=0,rate=1,loop='repeat',missing='error'}=a;
   if(!Number.isFinite(start)||start<0||start>=seconds||!Number.isFinite(rate)||rate<.1||rate>4||!['repeat','once'].includes(loop)||!['error','static'].includes(missing))throw Error('Invalid GLB animation settings.');
   animation={clip,start,rate,loop,missing};
  }
  return {id:o.id,file:o.file,position,rotation,pivot,spin,movement,animation};
 });
 const flows=flowPlan(input.flows,ids,seconds);
 const n=input.notes??[];
 if(!Array.isArray(n)||n.length>12)throw Error('Up to 12 scene notes.');
 const notes=n.map(a=>{
  if(!keys(a,['object','text','point','start','end'])||!ids.has(a.object))throw Error('Invalid scene note object.');
  const [b]=modelNotes([{text:a.text,point:a.point}],1),start=a.start??0,end=a.end??seconds;
  if(!Number.isFinite(start)||!Number.isFinite(end)||start<0||end<=start||end>seconds)throw Error('Invalid scene note time window.');
  return {...b,object:a.object,start,end};
 });
 return {seconds,frameCount,fps:FPS,width:640,height:480,camera,shots,objects,notes,flows,lighting:lightingPlan(input.lighting,seconds),captions:captions(input.captions,seconds)};
}
function shotPlan(input,frameCount,seconds){
 if(input.shots===undefined){
  const camera=keyframes(input.camera);
  if(camera.at(-1).time!==seconds)throw Error('Camera must cover the complete duration.');
  return {camera,shots:null};
 }
 if(input.camera!==undefined||!Array.isArray(input.shots)||input.shots.length<1||input.shots.length>8)throw Error('Choose a single camera or 1 to 8 camera shots.');
 let start=0;
 const shots=input.shots.map(s=>{
  if(!keys(s,['end','camera','dissolveInFrames'])||!Number.isFinite(s.end)||s.end<=0||s.end>seconds)throw Error('Invalid shot.');
  const end=Math.round(s.end*FPS),duration=(end-start)/FPS;
  if(Math.abs(s.end*FPS-end)>1e-8||end-start<2||end>frameCount)throw Error('Shot ends must align with 30 fps frames and strictly increase.');
  const camera=keyframes(s.camera);
  if(Math.abs(camera.at(-1).time-duration)>1e-8)throw Error('Shot camera must span its full local duration.');
  const dissolve=s.dissolveInFrames??0;
  if(!Number.isInteger(dissolve)||dissolve<0||dissolve>15||dissolve===1||dissolve>=end-start||(!start&&dissolve))throw Error('Dissolve must be 2 to 15 frames at a later shot start and shorter than the shot.');
  const shot={camera,start,end,dissolve};start=end;return shot;
 });
 if(start!==frameCount)throw Error('Last shot must end with the scene.');
 return {camera:null,shots};
}
function directorCamera(plan,index){
 if(!plan.shots)return poseAt(plan.camera,index/FPS);
 const shot=plan.shots.find(s=>index<s.end);
 if(!shot||index<0)throw Error('Frame outside director shots.');
 return poseAt(shot.camera,(index-shot.start)/FPS);
}
function directorBlend(plan,index){
 const shots=plan.shots;
 if(!shots)return null;
 const idx=shots.findIndex(s=>index<s.end);
 if(idx<=0)return null;
 const incoming=shots[idx],step=index-incoming.start;
 if(step>=incoming.dissolve)return null;
 const outgoing=shots[idx-1];
 return {previous:poseAt(outgoing.camera,(outgoing.end-outgoing.start)/FPS),mix:step/incoming.dissolve};
}
function placement(o,t){
 if(!o.movement)return {position:o.position,rotation:o.rotation,spinDegrees:t*(o.spin?.degreesPerSecond??0)};
 let i=1;while(i<o.movement.length-1&&o.movement[i].time<t)i++;
 const a=o.movement[i-1],b=o.movement[i],u=Math.max(0,Math.min(1,(t-a.time)/(b.time-a.time)));
 const mix=k=>a[k].map((v,j)=>v+(b[k][j]-v)*u);
 return {position:mix('position'),rotation:mix('rotation'),spinDegrees:t*(o.spin?.degreesPerSecond??0)};
}
const activeNotes=(notes,t)=>notes.filter(n=>n.start<=t&&t<n.end);
function lightingPlan(input,seconds){
 if(input===undefined)return null;
 if(!keys(input,['direction','intensity','color','shadows','keyframes'])||(input.shadows!==undefined&&typeof input.shadows!=='boolean'))throw Error('Invalid scene lighting.');
 function light(v){
  const {direction=[3,6,3],intensity=1.8,color='#ffffff'}=v;
  if(!vector(direction,100)||direction[1]<.05||!Number.isFinite(intensity)||intensity<0||intensity>4||typeof color!=='string'||!/^#[\da-f]{6}$/i.test(color))throw Error('Invalid light direction, intensity or color.');
  const rgb=color.slice(1).match(/../g).map(c=>parseInt(c,16));
  return {direction,intensity,rgb};
 }
 let frames;
 if(input.keyframes!==undefined){
  if(input.direction!==undefined||input.intensity!==undefined||input.color!==undefined||!Array.isArray(input.keyframes)||input.keyframes.length<2||input.keyframes.length>12)throw Error('Use either fixed lighting or 2 to 12 light keyframes.');
  let prev=-1;
  frames=input.keyframes.map((v,i)=>{
   if(!keys(v,['time','direction','intensity','color'])||!Number.isFinite(v.time)||v.time>seconds||(i===0?v.time!==0:v.time-prev<1/FPS-1e-9))throw Error('Invalid light keyframe time.');
   prev=v.time;return {...light(v),time:v.time};
  });
  if(frames.at(-1).time!==seconds)throw Error('Light keyframes must cover the duration.');
 }else frames=[{...light(input),time:0}];
 return {shadows:input.shadows??false,frames};
}
function sampleLight(plan,time){
 const list=plan.frames;
 if(list.length===1)return list[0];
 let i=1;while(i<list.length-1&&list[i].time<time)i++;
 const a=list[i-1],b=list[i],u=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time))),mix=(x,y)=>x+(y-x)*u;
 return {direction:a.direction.map((x,j)=>mix(x,b.direction[j])),intensity:mix(a.intensity,b.intensity),rgb:a.rgb.map((x,j)=>mix(x,b.rgb[j]))};
}
function clipTime(track,t,duration){
 if(t<track.start)return null;
 const local=(t-track.start)*track.rate;
 if(track.loop==='once')return Math.min(local,duration);
 const wrapped=local%duration;
 return duration-wrapped<1e-9?0:wrapped;
}
module.exports={director,placement,activeNotes,poseAt,directorCamera,directorBlend,clipTime,lightingPlan,sampleLight};
