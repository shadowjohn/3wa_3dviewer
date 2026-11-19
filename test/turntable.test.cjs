const test=require('node:test'),assert=require('node:assert/strict');
const {options,angleAt,encodeArgs,gifPaletteArgs,gifEncodeArgs}=require('../src/turntable-policy.cjs');
const {publish}=require('../src/turntable-job.cjs'),fs=require('node:fs/promises'),os=require('node:os'),path=require('node:path');
test('publishes atomically, preserves an existing destination, and abort removes staging',async()=>{
 const dir=await fs.mkdtemp(path.join(os.tmpdir(),'turntable-publish-test-'));
 try{
  const source=path.join(dir,'source.mp4'),destination=path.join(dir,'destination.mp4'),cancelled=path.join(dir,'cancelled.mp4');
  await fs.writeFile(source,'new');
  await fs.writeFile(destination,'old');
  await assert.rejects(publish(source,destination),/already exists/);
  assert.equal(await fs.readFile(destination,'utf8'),'old');
  const cancel=new AbortController();cancel.abort();await assert.rejects(publish(source,cancelled,cancel.signal),/cancelled/);
  assert.deepEqual((await fs.readdir(dir)).sort(),['destination.mp4','source.mp4']);
  assert.equal(await fs.readFile(await publish(source,cancelled),'utf8'),'new');
  const gif=path.join(dir,'source.gif'),gifOutput=path.join(dir,'destination.gif');
  await fs.writeFile(gif,'GIF');
  await assert.rejects(publish(gif,destination),/\.gif output path/);
  assert.equal(await fs.readFile(await publish(gif,gifOutput),'utf8'),'GIF');
  await assert.rejects(publish(gif,gifOutput),/already exists/);
 }finally{await fs.rm(dir,{recursive:true,force:true});}
});
test('5 seconds at 30 fps has 150 distinct angles and no endpoint duplicate',()=>{const p=options({});assert.equal(p.frameCount,150);assert.equal(p.seconds,5);assert.equal(p.axis,'horizontal');assert.equal(angleAt(0,p.frameCount),0);assert.ok(Math.abs(angleAt(149,150)-Math.PI*2*149/150)<1e-12);assert.throws(()=>angleAt(150,150));});
test('vertical and dual option validation is strict and shared',()=>{const p=options({seconds:2.5,axis:'vertical'},true);assert.equal(p.width,1280);assert.equal(p.height,480);assert.equal(p.frameCount,75);for(const a of [{seconds:2.01},{seconds:0},{seconds:61},{axis:'diagonal'},{extra:true}])assert.throws(()=>options(a));});
test('GIF is explicit, smaller, centisecond-exact and loops forever',()=>{
 const p=options({format:'gif'},true);
 assert.deepEqual([p.format,p.width,p.height,p.frameCount,p.durationTicks],['gif',960,360,75,500]);
 assert.ok(Math.abs(angleAt(74,75)-Math.PI*2*74/75)<1e-12);
 const fraction=options({seconds:35/30,format:'gif'});assert.equal(fraction.durationTicks,117);
 assert.equal(options({}).format,'mp4');assert.throws(()=>options({format:'webm'}));
 const palette=gifPaletteArgs('frames/%04d.png','palette.png',p),encoded=gifEncodeArgs('frames/%04d.png','palette.png','clip.gif',p);
 assert.ok(palette.includes('palettegen=max_colors=128:stats_mode=diff'));
 assert.deepEqual(encoded.slice(encoded.indexOf('-loop'),encoded.indexOf('-loop')+2),['-loop','0']);
 assert.ok(encoded.includes('-final_delay'));assert.ok(encoded.includes('-n'));assert.deepEqual(encoded.slice(-2),['gif','clip.gif']);
});
test('encoder specifies fixed 30 fps, no sound, H264 MP4 and no overwrite',()=>{const a=encodeArgs('frames/%04d.png','clip.mp4',150);assert.deepEqual(a.slice(a.indexOf('-framerate'),a.indexOf('-framerate')+2),['-framerate','30']);assert.ok(a.includes('-an'));assert.ok(a.includes('libx264'));assert.ok(a.includes('mp4'));assert.ok(a.includes('-n'));assert.deepEqual(a.slice(-2),['mp4','clip.mp4']);});
