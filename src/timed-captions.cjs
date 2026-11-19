const MAX_CAPTIONS=6,MAX_TEXT=80,MAX_SECONDS=20;
function captionTime(value=0){
 if(typeof value!=='number'||!Number.isFinite(value)||value<0||value>MAX_SECONDS)throw Error('Caption time must be between 0 and 20 seconds.');
 return value;
}
function captions(input=[],max=MAX_SECONDS){
 if(!Array.isArray(input)||input.length>MAX_CAPTIONS)throw Error('Use up to 6 timed captions.');
 const out=input.map(v=>{
  if(!v||typeof v!=='object'||Array.isArray(v)||Object.keys(v).some(k=>!['text','start','end'].includes(k))||!Object.hasOwn(v,'start')||!Object.hasOwn(v,'end'))throw Error('Invalid timed caption');
  const text=typeof v.text==='string'?v.text.trim():'',start=captionTime(v.start),end=captionTime(v.end);
  if(!text||[...text].length>MAX_TEXT||/[\u0000-\u001f\u007f-\u009f]/.test(text))throw Error('A timed caption needs 1 to 80 plain-text characters.');
  if(start>=end||end>max)throw Error('Caption start must be earlier than its end, within the recording duration.');
  return {text,start,end};
 }).sort((a,b)=>a.start-b.start);
 if(out.some((v,i)=>i&&out[i-1].end>v.start))throw Error('Caption windows cannot overlap.');
 return out;
}
function captionAt(items,time){return items.find(v=>time>=v.start&&time<v.end)?.text??null;}
const CAPTIONS_SCHEMA={type:'array',maxItems:MAX_CAPTIONS,items:{type:'object',required:['text','start','end'],additionalProperties:false,properties:{text:{type:'string',minLength:1,maxLength:MAX_TEXT},start:{type:'number',minimum:0,maximum:MAX_SECONDS},end:{type:'number',minimum:0,maximum:MAX_SECONDS}}}};
const CAPTION_TIME_SCHEMA={type:'number',minimum:0,maximum:MAX_SECONDS,default:0};
module.exports={captions,captionAt,captionTime,CAPTIONS_SCHEMA,CAPTION_TIME_SCHEMA};
