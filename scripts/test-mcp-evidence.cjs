// Real stdio integration QA; no remote requests or uploads.
const assert=require('node:assert/strict'),fs=require('node:fs/promises'),path=require('node:path'),{spawn}=require('node:child_process');
(async()=>{
 const modelPath=process.argv[2],root=process.argv[3];if(!modelPath||!root)throw Error('Usage: node scripts/test-mcp-evidence.cjs MODEL ROOT');
 const qa=path.resolve('qa'),referencePath=path.join(qa,'reference-test.png');await fs.mkdir(qa,{recursive:true});
 const p=spawn(process.execPath,['scripts/mcp-server.cjs',root,'--reference-root='+qa],{stdio:['pipe','pipe','inherit'],windowsHide:true});let next=0,buffer='';const pending=new Map();
 p.stdout.on('data',b=>{buffer+=b;let n;while((n=buffer.indexOf('\n'))>=0){const r=JSON.parse(buffer.slice(0,n));buffer=buffer.slice(n+1);pending.get(r.id)?.(r);pending.delete(r.id);}});
 const rpc=(method,params)=>new Promise(resolve=>{const id=++next;pending.set(id,resolve);p.stdin.write(JSON.stringify({jsonrpc:'2.0',id,method,params})+'\n');});
 const call=async(name,args)=>{const r=await rpc('tools/call',{name,arguments:args});return r.result;};
 try{
 assert.equal((await rpc('initialize',{protocolVersion:'2024-11-05',capabilities:{},clientInfo:{name:'evidence-qa',version:'1'}})).result.serverInfo.version,'0.3.0');
 assert.equal((await rpc('tools/list',{})).result.tools.length,7);
 const info=await call('inspect_model',{modelPath});assert.ok(!info.isError);const inspection=JSON.parse(info.content[0].text);assert.equal(inspection.sha256.length,64);
 const common={modelPath,forwardAxis:'-Z',width:640,height:480,camera:{azimuth:28,elevation:12,distanceScale:.85,fov:42,targetOffset:[0,0,0]},grid:3,crop:{x:.25,y:.2,width:.5,height:.6}};
 const a=await call('capture_model_views',common);assert.ok(!a.isError,JSON.stringify(a));const ar=JSON.parse(a.content[0].text);assert.equal(ar.files.length,3);assert.equal(ar.files.find(f=>f.variant==='original').width,640);assert.equal(ar.files.find(f=>f.variant==='original').height,480);
 await fs.copyFile(path.join(ar.directory,'custom.png'),referencePath);
 const b=await call('capture_model_views',{...common,referencePath,referenceNote:'Synthetic QA reference: screenshot of our model, not a real vehicle photo.',expectedModelHash:inspection.sha256});assert.ok(!b.isError,JSON.stringify(b));const br=JSON.parse(b.content[0].text);assert.equal(br.files.length,4);assert.deepEqual(ar.poses,br.poses);
 const aBytes=await fs.readFile(path.join(ar.directory,'custom.png')),bBytes=await fs.readFile(path.join(br.directory,'custom.png'));const pixelMetrics=JSON.parse(require('node:child_process').execFileSync('python',['-c',"from PIL import Image,ImageChops,ImageStat; import sys,json; d=ImageChops.difference(Image.open(sys.argv[1]).convert('RGB'),Image.open(sys.argv[2]).convert('RGB')); print(json.dumps({'max':max(x[1] for x in d.getextrema()),'mean':sum(ImageStat.Stat(d).mean)/3}))",path.join(ar.directory,'custom.png'),path.join(br.directory,'custom.png')],{encoding:'utf8',windowsHide:true}));assert.ok(pixelMetrics.max<=1&&pixelMetrics.mean<.01,'Camera replay exceeded GPU 1-level rounding tolerance');
 const c=await call('capture_model_views',{...common,camera:{...common.camera,azimuth:-40,elevation:25},grid:4,referencePath,referenceNote:'Synthetic QA reference, not a real vehicle photo.'});assert.ok(!c.isError,JSON.stringify(c));const cr=JSON.parse(c.content[0].text);assert.notDeepEqual(cr.poses,br.poses);
 for(const bad of [{...common,crop:{x:.9,y:0,width:.5,height:1}},{...common,camera:{azimuth:500}},{...common,referencePath:'https://example.com/a.png'},{...common,referencePath:process.env.WINDIR+'\\win.ini'}]){assert.equal((await call('capture_model_views',bad)).isError,true);}
 const extreme=await call('capture_model_views',{modelPath,views:['custom'],width:320,height:1440,camera:{azimuth:0,elevation:0,distanceScale:10,fov:10},returnImages:'none'});assert.ok(!extreme.isError,JSON.stringify(extreme));const er=JSON.parse(extreme.content[0].text),pose=er.poses[0],radius=Math.hypot(...er.worldBounds.size)/2,halfV=10*Math.PI/360,halfH=Math.atan(Math.tan(halfV)*(320/1440)),expected=radius/Math.sin(Math.min(halfV,halfH))*1.15*10,actual=Math.hypot(...pose.position.map((x,i)=>x-pose.target[i]));assert.ok(Math.abs(actual-expected)<1e-8,'Custom distance must not be clamped');
 const summary={ok:true,extremeDistanceVerified:true,inspection:{sha256:inspection.sha256,sourceTriangles:inspection.sourceTriangles},first:ar.directory,repeated:br.directory,otherAngle:cr.directory,pixelIdentical:aBytes.equals(bBytes),pixelMetrics,negativeCases:4};await fs.writeFile(path.join(qa,'mcp-evidence-result.json'),JSON.stringify(summary,null,2));console.log(JSON.stringify(summary));
 }finally{p.kill();}
})().catch(e=>{console.error(e);process.exitCode=1;});
