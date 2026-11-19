const MAX_NOTES=4,MAX_NOTE_TEXT=80;
function modelNotes(input=[],panes=1){
 if(!Array.isArray(input)||input.length>MAX_NOTES)throw Error('Use up to 4 model notes.');
 return input.map(n=>{
  if(!n||typeof n!=='object'||Array.isArray(n)||Object.keys(n).some(k=>!['text','point','pane'].includes(k)))throw Error('Invalid model note');
  const pane=n.pane??0,t=typeof n.text==='string'?n.text.trim():'';
  if(!t||[...t].length>MAX_NOTE_TEXT||/[\u0000-\u001f\u007f-\u009f]/.test(t))throw Error('A note needs 1 to 80 plain-text characters.');
  if(!Number.isInteger(pane)||pane<0||pane>=panes||!Array.isArray(n.point)||n.point.length!==3||n.point.some(x=>!Number.isFinite(x)||Math.abs(x)>1e7))throw Error('Invalid local model anchor or pane');
  return {text:t,point:[...n.point],pane};
 });
}
const MODEL_NOTES_SCHEMA={type:'array',maxItems:MAX_NOTES,items:{type:'object',required:['text','point'],additionalProperties:false,properties:{text:{type:'string',minLength:1,maxLength:MAX_NOTE_TEXT},point:{type:'array',minItems:3,maxItems:3,items:{type:'number',minimum:-1e7,maximum:1e7}},pane:{type:'integer',enum:[0,1],default:0}}}};
module.exports={modelNotes,MAX_NOTES,MAX_NOTE_TEXT,MODEL_NOTES_SCHEMA};
