const test=require('node:test'),assert=require('node:assert/strict');
const {TARGET,permitted,captureOptions}=require('../src/web-preview-policy.cjs');
test('web preview allows only exact public navigation and scoped map dependencies',()=>{
 assert(permitted(TARGET,'mainFrame'));assert(!permitted(TARGET+'?x=1','mainFrame'));assert(!permitted(TARGET,'subFrame'));
 for(const u of ['https://localhost/a','https://127.0.0.1/a','https://192.168.1.1/a','file:///C:/secret','http://3wa.tw/inc/javascript/easymap8/easymap.js','https://3wa.tw@evil.test/a','https://evil.test@3wa.tw/inc/javascript/easymap8/x','https://3wa.tw/myai/scene-tech-tree/','https://3wa.tw/inc/javascript/easymap8/%252e%252e/x'])assert(!permitted(u,'xhr'),u);
 assert(permitted('https://3wa.tw/inc/javascript/easymap8/easymap.js','script'));
 assert(!permitted('https://3wa.tw/inc/javascript/easymap8/easymap.js','xhr','POST'));
 const vector='https://3wa.tw/demo/php/map/vmap/VectorTileServer/api.php?';
 assert(permitted(vector+'mode=getMap&osmData=Taiwan_2026_10_03_gis&z=17&x=21323&y=9545','xhr'));
 assert(!permitted(vector+'mode=getStyle&osmData=private','xhr'));
 assert(!permitted(vector+'mode=delete&osmData=Taiwan_2026_10_03_gis','xhr'));
 assert(permitted('blob:https://3wa.tw/example','other'));
});
test('public preview caps inputs and rejects arbitrary URLs or scripts',()=>{
 assert.deepEqual(captureOptions({}),{seconds:10,snapshots:3,motion:'ride',preset:'icc'});
 for(const a of [{url:TARGET},{preset:TARGET},{preset:'__proto__'},{script:'x'},{seconds:11},{motion:'x'},{seconds:0,snapshots:0},{snapshots:4}])assert.throws(()=>captureOptions(a));
});
