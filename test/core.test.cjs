const {test}=require('node:test'),assert=require('node:assert/strict');const {validateGlb,glbArgument}=require('../src/core.cjs');
function sample(json){const s=JSON.stringify({asset:{version:'2.0'},...json}),n=Math.ceil(Buffer.byteLength(s)/4)*4,b=Buffer.alloc(20+n,32);b.writeUInt32LE(0x46546c67,0);b.writeUInt32LE(2,4);b.writeUInt32LE(b.length,8);b.writeUInt32LE(n,12);b.writeUInt32LE(0x4e4f534a,16);b.write(s,20);return b;}
test('GLB version2 accepts embedded image and returns JSON',()=>assert.equal(validateGlb(sample({asset:{version:'2.0'},images:[{bufferView:0}]})).asset.version,'2.0'));
test('reject short or incorrect magic',()=>{assert.throws(()=>validateGlb(Buffer.alloc(5)));assert.throws(()=>validateGlb(Buffer.alloc(32)));});
test('reject truncated declared size',()=>{const b=sample({asset:{version:'2.0'}});b.writeUInt32LE(b.length+4,8);assert.throws(()=>validateGlb(b));});
test('reject external resource and traversal',()=>{for(const uri of ['https://evil/image.png','../../secret.png','file:///C:/secret.png'])assert.throws(()=>validateGlb(sample({images:[{uri}]})));});
test('accept data URI',()=>assert.doesNotThrow(()=>validateGlb(sample({images:[{uri:'data:image/png;base64,AA=='}]}))));
test('CLI handles spaces and case',()=>assert.equal(glbArgument(['.','--test','D:\\my model.GLB']),'D:\\my model.GLB'));
test('reject malformed chunks',()=>{const b=sample({asset:{version:'2.0'}});b.writeUInt32LE(999,12);assert.throws(()=>validateGlb(b));});
