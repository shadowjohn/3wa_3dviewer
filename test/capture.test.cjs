const {test}=require('node:test'); const assert=require('node:assert/strict');
const fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
test('capture validates explicit roots, local GLB and bounded named views',async()=>{
 const {validateRequest}=require('../src/capture-policy.cjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-test-')); const file=path.join(root,'a.glb');await fs.writeFile(file,'test');
 assert.deepEqual((await validateRequest({modelPath:file},[root])).views,['front','back','left','right','top','iso']);
 await assert.rejects(validateRequest({modelPath:file,views:['evil']},[root]),/view/i);
 await assert.rejects(validateRequest({modelPath:file},[]),/root/i);
 await assert.rejects(validateRequest({modelPath:file},[path.join(root,'other')]),/root/i);
 await assert.rejects(validateRequest({modelPath:'https://example.org/a.glb'},[root]),/local/i);
 await assert.rejects(validateRequest({modelPath:file,width:9999},[root]),/size/i);
 await fs.rm(root,{recursive:true});
});
test('rejects junction escapes and unknown arguments',async()=>{
 const {validateRequest}=require('../src/capture-policy.cjs');
 const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-root-')),outside=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-outside-'));
 await fs.writeFile(path.join(outside,'a.glb'),'test');await fs.symlink(outside,path.join(root,'link'),process.platform==='win32'?'junction':'dir');
 await assert.rejects(validateRequest({modelPath:path.join(root,'link','a.glb')},[root]),/root/i);
 await assert.rejects(validateRequest({modelPath:path.join(outside,'a.glb'),command:'anything'},[outside]),/Unknown/);
 await assert.rejects(validateRequest({modelPath:path.join(outside,'a.glb'),views:['front','front']},[outside]),/view/i);
 await fs.unlink(path.join(root,'link'));await fs.rm(root,{recursive:true});await fs.rm(outside,{recursive:true});
});
test('forward axis is explicit and restricted',async()=>{
 const {validateRequest}=require('../src/capture-policy.cjs');const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-axis-'));const modelPath=path.join(root,'a.glb');await fs.writeFile(modelPath,'test');
 assert.equal((await validateRequest({modelPath,forwardAxis:'-Z'},[root])).forwardAxis,'-Z');
 await assert.rejects(validateRequest({modelPath,forwardAxis:'anything'},[root]),/axis/i);
 await fs.rm(root,{recursive:true});
});
test('custom camera, crop, grid and comparison options are bounded',async()=>{
 const {validateRequest}=require('../src/capture-policy.cjs');const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-options-'));const modelPath=path.join(root,'a.glb');await fs.writeFile(modelPath,'test');
 const r=await validateRequest({modelPath,views:['custom'],camera:{azimuth:25,elevation:10,distanceScale:1.2,fov:40},grid:3,crop:{x:.1,y:.2,width:.3,height:.4}},[root]);
 assert.equal(r.camera.azimuth,25);assert.equal(r.grid,3);
 await assert.rejects(validateRequest({modelPath,camera:{azimuth:NaN}},[root]),/camera/i);
 await assert.rejects(validateRequest({modelPath,crop:{x:.9,y:0,width:.5,height:1}},[root]),/crop/i);
 await assert.rejects(validateRequest({modelPath,grid:999},[root]),/grid/i);
 await fs.rm(root,{recursive:true});
});
test('inspection reports source nodes, materials, animation names and hashes without rendering',()=>{
 const {inspectBytes}=require('../src/model-inspection.cjs');
 const json={asset:{version:'2.0'},nodes:[{name:'front-wheel',mesh:0}],meshes:[{name:'wheel',primitives:[{attributes:{POSITION:0},indices:1}]}],accessors:[{count:4,min:[0,0,0],max:[1,2,3]},{count:6}],materials:[{name:'paint'}],animations:[{name:'spin'}]};
 let b=Buffer.from(JSON.stringify(json));b=Buffer.concat([b,Buffer.alloc((4-b.length%4)%4,32)]);const out=Buffer.alloc(20+b.length);out.writeUInt32LE(0x46546c67,0);out.writeUInt32LE(2,4);out.writeUInt32LE(out.length,8);out.writeUInt32LE(b.length,12);out.writeUInt32LE(0x4e4f534a,16);b.copy(out,20);
 const r=inspectBytes(out);assert.equal(r.nodes[0].name,'front-wheel');assert.equal(r.sourceTriangles,2);assert.equal(r.animations[0].name,'spin');assert.equal(r.sha256.length,64);assert.equal(r.license,'not provided');
});
test('reference image dimensions rejected before decoding large images',()=>{
 const {imageDimensions}=require('../src/image-dimensions.cjs');const b=Buffer.alloc(24);Buffer.from([137,80,78,71,13,10,26,10]).copy(b);b.write('IHDR',12);b.writeUInt32BE(960,16);b.writeUInt32BE(720,20);assert.deepEqual(imageDimensions(b),{width:960,height:720});b.writeUInt32BE(200000,16);assert.throws(()=>imageDimensions(b),/pixel/);assert.throws(()=>imageDimensions(Buffer.from('not an image')),/PNG|JPEG/);
});
test('reference root must be independently allowed',async()=>{
 const {validateRequest}=require('../src/capture-policy.cjs');const root=await fs.mkdtemp(path.join(os.tmpdir(),'viewer-ref-'));const modelPath=path.join(root,'a.glb'),referencePath=path.join(root,'a.png');await fs.writeFile(modelPath,'test');await fs.writeFile(referencePath,'test');
 await assert.rejects(validateRequest({modelPath,referencePath},[root]),/root/i);
 assert.equal((await validateRequest({modelPath,referencePath},[root],[root])).referencePath,referencePath);
 await fs.rm(root,{recursive:true});
});
test('request queue is bounded and disconnect stops queued work',async()=>{
 const {createQueue}=require('../src/rpc-queue.cjs');let release;const started=[],rejected=[];const q=createQueue(async m=>{started.push(m.id);await new Promise(r=>release=r);},{limit:2,onRejected:(m,why)=>rejected.push([m.id,why])});
 q.enqueue({id:1});q.enqueue({id:2});assert.equal(q.enqueue({id:3}),false);await new Promise(r=>setImmediate(r));q.close();release();await q.settled();assert.deepEqual(started,[1]);assert.equal(rejected[0][0],3);
});
test('queued cancellation does not start work',async()=>{
 const {createQueue}=require('../src/rpc-queue.cjs');let release;const started=[];const q=createQueue(async m=>{started.push(m.id);if(m.id===1)await new Promise(r=>release=r);});q.enqueue({id:1});q.enqueue({id:2});await new Promise(r=>setImmediate(r));q.cancel(2);release();await q.settled();assert.deepEqual(started,[1]);
});
