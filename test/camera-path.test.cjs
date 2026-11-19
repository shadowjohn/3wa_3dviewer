const test=require('node:test'),assert=require('node:assert/strict');
const {keyframes,poseAt}=require('../src/camera-path.cjs'),{options,frameTime}=require('../src/turntable-policy.cjs');
const k=(time,position=[0,0,3],lookAt=[0,0,0],fov=40)=>({time,position,lookAt,fov});
test('Camera path interpolates XYZ, target and FOV, and keeps the exact 30fps convention',()=>{
 const path=[k(0),k(1,[1,2,3],[0,1,1],60)],cfg=options({cameraPath:path});
 assert.deepEqual(poseAt(cfg.cameraPath,.5),{position:[.5,1,3],lookAt:[0,.5,.5],fov:50});
 assert.equal(cfg.frameCount,30);assert.equal(frameTime(29,cfg),29/30);
});
test('Camera path rejects duplicate times, an aim crossing position, unknown keys, and bad payloads',()=>{
 for(const path of [[k(0),k(0)],[k(0),k(1/31)],[k(0),k(1,[0,0,-3])],[k(0),k(1,[0,0,0])],[k(0),k(1,[12.1,0,3])],[k(0),k(1,[0,0,3],[0,0,0],101)],[k(0),{...k(1),script:'no'}],[k(.01),k(1)],[k(0),k(21)],[null,k(1)]])assert.throws(()=>options({cameraPath:path}));
 for(const extra of [{seconds:1},{axis:'horizontal'},{format:'gif'}])assert.throws(()=>options({cameraPath:[k(0),k(1)],...extra}));
 assert.throws(()=>options({cameraPath:[k(0),k(1)]},true));
});
