const {test}=require('node:test');
const assert=require('node:assert/strict');
const path=require('node:path');
const {glbArgument,vrmInfo}=require('../src/core.cjs');
test('VRM command line accepts mixed case extension and spaces',()=>{
 assert.equal(glbArgument(['--test','C:\\models\\avatar name.VRM']),'C:\\models\\avatar name.VRM');
});
test('VRM identifies supported 0.x and 1.0 metadata without HTML interpretation',()=>{
 assert.deepEqual(vrmInfo({extensions:{VRM:{specVersion:'0.0',meta:{title:'Avatar',author:'A'}}}}),{version:'0.x',name:'Avatar',authors:'A'});
 assert.deepEqual(vrmInfo({extensions:{VRMC_vrm:{specVersion:'1.0',meta:{name:'One',authors:['A','B']}}}}),{version:'1.0',name:'One',authors:'A, B'});
 assert.equal(vrmInfo({}),null);
 assert.throws(()=>vrmInfo({extensions:{VRMC_vrm:{specVersion:'9.0'}}}),/VRM/);
});
