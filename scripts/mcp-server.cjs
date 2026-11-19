// Offline stdio MCP. No shell/eval endpoint and no HTTP listener.
const fs=require('node:fs/promises'),path=require('node:path'),os=require('node:os');
const {spawn}=require('node:child_process');const {validateRequest,allowedFile,VIEWS}=require('../src/capture-policy.cjs');const {inspectBytes}=require('../src/model-inspection.cjs');
const {MODEL_NOTES_SCHEMA}=require('../src/model-notes-policy.cjs'),{CAPTIONS_SCHEMA,CAPTION_TIME_SCHEMA}=require('../src/timed-captions.cjs');
const cli=process.argv.slice(2),roots=cli.filter(x=>!x.startsWith('--reference-root=')),referenceRoots=cli.filter(x=>x.startsWith('--reference-root=')).map(x=>x.slice(17)),active=new Map();
const schema={type:'object',properties:{modelPath:{type:'string'},forwardAxis:{type:'string',enum:['+Z','-Z'],default:'+Z'},views:{type:'array',items:{type:'string',enum:[...VIEWS,'custom']},minItems:1,maxItems:6},width:{type:'integer',minimum:320,maximum:1920},height:{type:'integer',minimum:240,maximum:1440},camera:{type:'object',additionalProperties:false,properties:{azimuth:{type:'number',minimum:-180,maximum:180},elevation:{type:'number',minimum:-89,maximum:89},distanceScale:{type:'number',minimum:.1,maximum:10},fov:{type:'number',minimum:10,maximum:100},targetOffset:{type:'array',items:{type:'number',minimum:-2,maximum:2},minItems:3,maxItems:3}}},grid:{type:'integer',enum:[0,3,4,10]},crop:{type:'object',additionalProperties:false,required:['x','y','width','height'],properties:{x:{type:'number',minimum:0,maximum:1},y:{type:'number',minimum:0,maximum:1},width:{type:'number',exclusiveMinimum:0,maximum:1},height:{type:'number',exclusiveMinimum:0,maximum:1}}},referencePath:{type:'string',description:'Allowed local PNG/JPEG only; never automatically published'},referenceNote:{type:'string',maxLength:1000},expectedModelHash:{type:'string',pattern:'^[a-fA-F0-9]{64}$'},background:{type:'string',enum:['dark','light']},material:{type:'string',enum:['original','clay','wire']},returnImages:{type:'string',enum:['all','original','none']},notes:MODEL_NOTES_SCHEMA,captions:CAPTIONS_SCHEMA,captionTime:CAPTION_TIME_SCHEMA},required:['modelPath'],additionalProperties:false};
async function capture(args,id,isCancelled){
 const req=await validateRequest(args,roots,referenceRoots),inspection=inspectBytes(await fs.readFile(req.modelPath));
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-viewer-capture-')),job=path.join(dir,'job.json');await fs.writeFile(job,JSON.stringify({request:req,allowedRoots:roots,referenceRoots}));
 if(isCancelled())throw Error("Request cancelled before rendering");
 let failure;
 try{await new Promise((resolve,reject)=>{if(isCancelled()){reject(Error('Request cancelled'));return;}const env={...process.env};delete env.ELECTRON_RUN_AS_NODE;const packaged=path.resolve(__dirname,'../../../3wa_3dviewer.exe');const bundled=require('../package.json').main==='src/packaged-entry.cjs'&&require('node:fs').existsSync(packaged);const child=spawn(bundled?packaged:require('electron'),bundled?['--viewer-capture-job',job]:[path.resolve(__dirname,'../src/capture-main.cjs'),job],{windowsHide:true,stdio:['ignore','ignore','pipe'],env});active.set(id,child);let err='';child.stderr.on('data',b=>{err=(err+b).slice(-1000);});const timer=setTimeout(()=>{child.kill();reject(Error('Capture timed out; not retried'));},95000);child.on('error',e=>{clearTimeout(timer);active.delete(id);reject(e);});child.on('exit',code=>{clearTimeout(timer);active.delete(id);code===0?resolve():reject(Error('Capture stopped ('+code+'): '+err));});});}catch(e){failure=e;}
 if(isCancelled())throw Error('Request cancelled');
 let report;try{report=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));}catch{if(failure)throw failure;throw Error('No capture report');}if(!report.ok)throw Error(report.error||failure?.message||'Capture failed');if(report.modelHash!==inspection.sha256)throw Error('Model changed during capture; evidence not certified, retry after saving completes');
 const warnings=['Visual comparison only. No automatic perspective correction or measurement.'];if(req.expectedModelHash&&req.expectedModelHash!==inspection.sha256)warnings.push('Model hash differs from expected; compare bounds before treating this as the same framing.');
 const manifest={schema:'3wa-viewer-evidence/v1',createdAt:new Date().toISOString(),viewerVersion:'0.3.0',model:{name:path.basename(req.modelPath),sha256:inspection.sha256},request:{...req,modelPath:path.basename(req.modelPath),referencePath:req.referencePath?path.basename(req.referencePath):undefined},warnings,...report};
 await fs.writeFile(path.join(dir,'manifest.json'),JSON.stringify(manifest,null,2));await fs.writeFile(path.join(dir,'inspection.json'),JSON.stringify(inspection,null,2));const {modelPath,referencePath,referenceNote,...preset}=req;await fs.writeFile(path.join(dir,'camera-preset.json'),JSON.stringify({...preset,expectedModelHash:inspection.sha256},null,2));
 const content=[{type:'text',text:JSON.stringify({directory:dir,...manifest})}];let total=0;for(const item of report.files){if(req.returnImages==='none'||req.returnImages==='original'&&item.variant!=='original')continue;const data=await fs.readFile(path.join(dir,item.file));total+=data.length;if(total>24*1024**2){content.push({type:'text',text:'Inline image budget reached; remaining images saved in evidence directory.'});break;}content.push({type:'image',mimeType:'image/png',data:data.toString('base64')});}return {content};
}
const turntableTool={name:'record_model_turntable',description:'Record one exact 360-degree orbit of one local GLB, or two side-by-side at shared scale and angle. Local silent MP4 (default) or looping GIF; requires an existing FFmpeg (libx264 for MP4).',inputSchema:{type:'object',properties:{modelPath:{type:'string'},secondModelPath:{type:'string'},format:{type:'string',enum:['mp4','gif'],default:'mp4'},notes:MODEL_NOTES_SCHEMA,captions:CAPTIONS_SCHEMA,seconds:{type:'number',minimum:1,maximum:20,default:5,description:'Complete 30 fps frames only'},axis:{type:'string',enum:['horizontal','vertical'],default:'horizontal'}},required:['modelPath'],additionalProperties:false}};
const cameraPathTool={name:'record_model_camera_path',description:'Render a deterministic 30 fps silent MP4 along an explicit single-GLB camera path. XYZ positions and targets are normalized by bounding-sphere radius relative to model center; no collision, upload, or model edits.',inputSchema:{type:'object',properties:{modelPath:{type:'string'},keyframes:require('../src/camera-path.cjs').PATH_SCHEMA,notes:MODEL_NOTES_SCHEMA,captions:CAPTIONS_SCHEMA},required:['modelPath','keyframes'],additionalProperties:false}};
async function recordModel(args,id,isCancelled,tool=turntableTool){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!Object.hasOwn(tool.inputSchema.properties,k))||typeof args.modelPath!=='string'||(args.secondModelPath!==undefined&&typeof args.secondModelPath!=='string'))throw Error('Invalid recording request');
 const cameraPath=tool===cameraPathTool;
 if(cameraPath&&!Array.isArray(args.keyframes))throw Error('Camera path requires keyframes.');
 const job=new AbortController();
 if(isCancelled())throw Error('Export cancelled');
 active.set(id,{kill:()=>job.abort()});
 try{
  const packaged=path.resolve(__dirname,'../../../3wa_3dviewer.exe'),bundled=require('../package.json').main==='src/packaged-entry.cjs'&&require('node:fs').existsSync(packaged);
  const result=await require('../src/turntable-job.cjs').exportTurntable({
   modelPath:args.modelPath,secondPath:args.secondModelPath,roots,settings:{seconds:args.seconds,axis:args.axis,format:args.format,notes:args.notes,captions:args.captions,cameraPath:args.keyframes},signal:job.signal,
   electronPath:bundled?packaged:require('electron'),packaged:bundled
  });
  return {content:[{type:'text',text:JSON.stringify(result)}]};
 }finally{active.delete(id);}
}
const directorTool={name:'record_director_scene',description:'Render a versioned, local, path-bounded 3D scene JSON to silent H.264 MP4. Models are local GLBs relative to the script.',inputSchema:{type:'object',properties:{scenePath:{type:'string'}},required:['scenePath'],additionalProperties:false}};
async function recordDirector(args,id,isCancelled){
 if(!args||typeof args.scenePath!=='string'||Object.keys(args).join(',')!=='scenePath')throw Error('Director requires only scenePath.');
 const job=new AbortController();
 if(isCancelled())throw Error('Export cancelled');
 active.set(id,{kill:()=>job.abort()});
 try{
  const packaged=path.resolve(__dirname,'../../../3wa_3dviewer.exe'),bundled=require('../package.json').main==='src/packaged-entry.cjs'&&require('node:fs').existsSync(packaged);
  const result=await require('../src/director-job.cjs').directorJob({scenePath:args.scenePath,roots,electronPath:bundled?packaged:require('electron'),packaged:bundled,signal:job.signal});
  return {content:[{type:'text',text:JSON.stringify(result)}]};
 }finally{active.delete(id);}
}
const {publicPresets}=require('../src/web-presets.cjs');
const webListTool={name:'list_approved_e8_presets',description:'List reviewed E8 preview preset IDs.',inputSchema:{type:'object',properties:{},additionalProperties:false}};
const webTool={name:'capture_public_e8_demo',description:'Offline MCP invokes a fresh isolated browser for a reviewed E8 preview preset only. Returns local page-only snapshots and optional silent 10 fps MP4; no URL, scripts, sign-in, private data, or window/desktop capture.',inputSchema:{type:'object',properties:{preset:{type:'string',enum:publicPresets().map(p=>p.id),default:'icc'},seconds:{type:'integer',minimum:0,maximum:10,default:10},snapshots:{type:'integer',minimum:0,maximum:3,default:3},motion:{type:'string',enum:['still','ride'],default:'ride'}},additionalProperties:false}};
async function captureWeb(args,id,isCancelled){
 const cfg=require('../src/web-preview-policy.cjs').captureOptions(args);
 const job=new AbortController();
 if(isCancelled())throw Error('Export cancelled');
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-viewer-web-job-')),file=path.join(dir,'options.json');
 active.set(id,{kill:()=>job.abort()});
 try{
  await fs.writeFile(file,JSON.stringify(cfg),{flag:'wx'});
  const packaged=path.resolve(__dirname,'../../../3wa_3dviewer.exe'),bundled=require('../package.json').main==='src/packaged-entry.cjs'&&require('node:fs').existsSync(packaged);
  try{await require('../src/turntable-job.cjs').run(bundled?packaged:require('electron'),bundled?['--viewer-web-job',file]:[path.resolve(__dirname,'../src/web-preview-entry.cjs'),file],job.signal,90000);}
  catch(e){let report;try{report=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));}catch{}throw Error(report?.error||e.message);}
  const report=JSON.parse(await fs.readFile(path.join(dir,'result.json'),'utf8'));
  if(!report.ok)throw Error(report.error||'No successful capture.');
  job.signal.throwIfAborted();
  const result=report.result,stage=await fs.realpath(path.dirname(result.video??result.shots[0]));
  if(path.dirname(stage)!==await fs.realpath(dir)||!/^3wa-viewer-web-media-[a-z0-9]+$/i.test(path.basename(stage)))throw Error('Invalid capture result.');
  const save=await fs.mkdtemp(path.join(os.tmpdir(),'3wa-viewer-public-e8-')),output=path.join(save,'media');
  try{await fs.rename(stage,output);}catch(e){await fs.rmdir(save).catch(()=>{});throw e;}
  const move=p=>path.join(output,path.basename(p));
  return {content:[{type:'text',text:JSON.stringify({...result,video:result.video?move(result.video):undefined,shots:result.shots.map(move)})}]};
 }finally{active.delete(id);await fs.rm(dir,{recursive:true,force:true,maxRetries:3,retryDelay:100}).catch(()=>{});}
}
const media=require('../src/mcp-media.cjs').mediaTools(referenceRoots,capture,schema);
const send=value=>process.stdout.write(JSON.stringify(value)+'\n');
async function rpc(m,isCancelled=()=>false){if(m.id===undefined)return;let result;
 try{switch(m.method){case 'initialize':result={protocolVersion:'2024-11-05',capabilities:{tools:{}},serverInfo:{name:'3wa-3dviewer',version:'0.3.0'}};break;case 'ping':result={};break;case 'tools/list':result={tools:[{name:'inspect_model',description:'Read allowed local GLB/VRM metadata/hash without GPU. Does not assume licensing or real-world dimensions.',inputSchema:{type:'object',properties:{modelPath:{type:'string'}},required:['modelPath'],additionalProperties:false}},{name:'capture_model_views',description:'Offline model views, reproducible bounded custom camera, original/grid/crop/reference comparison evidence. Local allowed roots only; no automatic alignment, upload or model edits.',inputSchema:schema},turntableTool,cameraPathTool,directorTool,webListTool,webTool,...media.definitions]};break;case 'tools/call':if(media.definitions.some(t=>t.name===m.params?.name))result=await media.call(m.params.name,m.params.arguments,m.id,isCancelled);else if(m.params?.name==='record_model_turntable')result=await recordModel(m.params.arguments,m.id,isCancelled);else if(m.params?.name==='record_model_camera_path')result=await recordModel(m.params.arguments,m.id,isCancelled,cameraPathTool);else if(m.params?.name==='record_director_scene')result=await recordDirector(m.params.arguments,m.id,isCancelled);else if(m.params?.name==='list_approved_e8_presets'){const a=m.params.arguments;if(a!==undefined&&(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).length))throw Error('This tool does not accept arguments.');result={content:[{type:'text',text:JSON.stringify(publicPresets())}]};}else if(m.params?.name==='capture_public_e8_demo')result=await captureWeb(m.params.arguments,m.id,isCancelled);else if(m.params?.name==='capture_model_views')result=await capture(m.params.arguments,m.id,isCancelled);else if(m.params?.name==='inspect_model'){const a=m.params.arguments;if(!a||Object.keys(a).join(',')!=='modelPath')throw Error('inspect_model requires only modelPath');const file=await allowedFile(a.modelPath,roots,['.glb','.vrm'],256*1024**2);result={content:[{type:'text',text:JSON.stringify(inspectBytes(await fs.readFile(file)))}]};}else throw Error('Unknown tool');break;default:send({jsonrpc:'2.0',id:m.id,error:{code:-32601,message:'Method not found'}});return;}send({jsonrpc:'2.0',id:m.id,result});}
 catch(e){send({jsonrpc:'2.0',id:m.id,result:{isError:true,content:[{type:'text',text:String(e.message).slice(0,2500)}]}});}}
const queue=require('../src/rpc-queue.cjs').createQueue(rpc,{limit:8,onCancel:id=>active.get(id)?.kill(),onRejected:(m,message)=>send({jsonrpc:'2.0',id:m.id,result:{isError:true,content:[{type:'text',text:message}]}})});
require('node:readline').createInterface({input:process.stdin}).on('line',line=>{if(line.length>16384){send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Request too large'}});return;}let m;try{m=JSON.parse(line);}catch{send({jsonrpc:'2.0',id:null,error:{code:-32700,message:'Parse error'}});return;}if(!m||typeof m!=='object'||Array.isArray(m)||m.jsonrpc!=='2.0'||typeof m.method!=='string'){send({jsonrpc:'2.0',id:null,error:{code:-32600,message:'Invalid request'}});return;}if(m.method==='notifications/cancelled'){queue.cancel(m.params?.requestId);return;}if(m.id!==undefined)queue.enqueue(m);}).on('close',()=>queue.close());
