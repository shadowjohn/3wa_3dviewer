const {test}=require('node:test');const assert=require('node:assert/strict');
test('reference formats are bounded and separate from 3D',async()=>{
 const {mediaType,checkMedia}=await import('../src/media-policy.mjs');
 for(const ext of ['png','webp','jpg','jpeg','gif'])assert.equal(mediaType('TEST.'+ext.toUpperCase()),'image');
 assert.equal(mediaType('a.webm'),'video');assert.equal(mediaType('a.glb'),null);
 assert.equal(checkMedia({name:'a.png',size:100},[]),'image');
 assert.throws(()=>checkMedia({name:'x.png',size:65*1024**2},[]),/64 MB/);
 assert.throws(()=>checkMedia({name:'x.png',size:1},Array(16).fill({size:1})),/16/);
 assert.throws(()=>checkMedia({name:'x.png',size:1},[{size:256*1024**2}]),/256 MB/);
});
