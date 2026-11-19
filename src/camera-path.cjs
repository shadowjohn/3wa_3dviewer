const LIMIT=12;
const vec={type:'array',items:{type:'number',minimum:-LIMIT,maximum:LIMIT},minItems:3,maxItems:3};
const PATH_SCHEMA={type:'array',minItems:2,maxItems:48,items:{type:'object',additionalProperties:false,required:['time','position','lookAt','fov'],properties:{time:{type:'number',minimum:0,maximum:20},position:vec,lookAt:vec,fov:{type:'number',minimum:10,maximum:100}}}};
const dot=(a,b)=>a.reduce((t,v,i)=>t+v*b[i],0),sub=(a,b)=>a.map((v,i)=>v-b[i]),lerp=(a,b,t)=>a+(b-a)*t,mix=(a,b,t)=>a.map((v,i)=>lerp(v,b[i],t));
const bounded=v=>Array.isArray(v)&&v.length===3&&v.every(n=>Number.isFinite(n)&&Math.abs(n)<=LIMIT);
function keyframes(input){
 if(!Array.isArray(input)||input.length<2||input.length>48)throw Error('Camera path requires 2 to 48 keyframes.');
 let prior,aim;
 return input.map((k,i)=>{
  if(!k||typeof k!=='object'||Array.isArray(k)||Object.keys(k).length!==4||!Number.isFinite(k.time)||k.time>20||(!i?k.time!==0:k.time-prior.time<1/30-1e-9)||!bounded(k.position)||!bounded(k.lookAt)||!Number.isFinite(k.fov)||k.fov<10||k.fov>100)throw Error('Invalid camera keyframe '+i+'.');
  const next=sub(k.lookAt,k.position),delta=aim&&sub(next,aim),closest=delta&&dot(delta,delta)>0?Math.max(0,Math.min(1,-dot(aim,delta)/dot(delta,delta))):0;
  if(Math.hypot(...next)<.0001||(aim&&Math.hypot(...mix(aim,next,closest))<.0001))throw Error('Camera aim intersects its position at keyframe or segment '+i+'.');
  aim=next;prior=k;
  return {time:k.time,position:k.position.slice(),lookAt:k.lookAt.slice(),fov:k.fov};
 });
}
function poseAt(keys,time){
 let i=1;
 while(i<keys.length-1&&keys[i].time<time)i++;
 const a=keys[i-1],b=keys[i],k=Math.max(0,Math.min(1,(time-a.time)/(b.time-a.time)));
 return {position:mix(a.position,b.position,k),lookAt:mix(a.lookAt,b.lookAt,k),fov:lerp(a.fov,b.fov,k)};
}
module.exports={PATH_SCHEMA,keyframes,poseAt};
