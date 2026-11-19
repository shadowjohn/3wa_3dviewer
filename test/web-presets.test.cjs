const test=require('node:test'),assert=require('node:assert/strict');
const {presetById,makeLocalPreset,publicPresets}=require('../src/web-presets.cjs');
const {permitted,publicIP,loopbackIP,blockedCategory,captureOptions}=require('../src/web-preview-policy.cjs');
test('approved public page routing remains exact with per-preset scripts',()=>{
 const icc=presetById('icc'),ramp=presetById('icc-ramp'),js=icc.origin+'/demo/php/3wa_ride/js/ride_icc_ramp_preview.mjs?v=2';
 assert.deepEqual(publicPresets().map(x=>x.id),['icc','icc-ramp']);
 assert(permitted(ramp.url,'mainFrame','GET',ramp));assert(!permitted(ramp.url,'mainFrame','GET',icc));
 assert(permitted(js,'script','GET',ramp));assert(!permitted(js,'script','GET',icc));assert.equal(captureOptions({preset:'icc-ramp'}).preset,'icc-ramp');
});
test('Focusit sources are tiles only, no alternate pages or arbitrary calls',()=>{
 for(const host of ['www.focusit.com.tw','tile.focusit.tw']){
  const h='https://'+host;
  assert(permitted(h+'/osm/17/1052/302.png','image'));assert(!permitted(h+'/osm/17/1052/302.png','mainFrame'));assert(!permitted(h+'/osm/17/1052/302.png','script'));
  assert(permitted(h+'/wmts?SERVICE=WMTS&REQUEST=GetTile&LAYER=public&TILEMATRIXSET=EPSG:3857&TILEMATRIX=17&TILEROW=5&TILECOL=2','xhr'));
  assert(!permitted(h+'/wmts?SERVICE=WMTS&REQUEST=GetCapabilities','xhr'));assert(!permitted(h+'/admin/report.php?request=gettile','xhr'));assert(!permitted(h+'/osm/17/1052/302.png?proxy=http://localhost','xhr'));
 }
 assert(!permitted('https://evil.tile.focusit.tw/osm/17/1052/302.png','image'));
});
test('loopback preset is isolated, requires exact origin and rejects unapproved path',()=>{
 const local=makeLocalPreset('local-qa','QA','http://127.0.0.1:58321/index.html',['/a.js']);
 assert(permitted(local.url,'mainFrame','GET',local));assert(!permitted(local.url,'mainFrame'));
 assert(permitted(local.origin+'/a.js','script','GET',local));assert(!permitted(local.origin+'/b.js','script','GET',local));
 assert(!permitted('https://tile.focusit.tw/osm/17/1052/302.png','image','GET',local));
 assert(!permitted('http://localhost:58321/a.js','script','GET',local));
 assert.throws(()=>makeLocalPreset('local-x','x','http://localhost/x'));
 for(const url of ['http://[::]:58321/map.html','http://localhost.evil:58321/map.html','http://127.1:58321/map.html','http://192.168.0.1:58321/map.html','http://localhost:58321/a/../b.html','http://localhost:58321/map.html?key=123'])assert.throws(()=>makeLocalPreset('local-x','x',url),url);
 assert.throws(()=>makeLocalPreset('local-x','x',local.url,['/admin.php']));
});
test('public DNS screening rejects private, loopback and mapped addresses; diagnostics omit paths and queries',()=>{
 for(const ip of ['127.0.0.1','10.4.5.6','100.64.0.1','192.168.1.1','169.254.0.5','::1','::ffff:192.168.0.5','fd00::1','fe80::8','2001:db8::1',''])assert(!publicIP(ip),ip);
 assert(publicIP('59.126.75.42'));assert(publicIP('2606:4700:4700::1111'));
 assert(loopbackIP('::1'));assert(loopbackIP('127.0.0.1'));assert(!loopbackIP('127.0.0.2'));
 assert.equal(blockedCategory('https://a.example/secret?k=token','xhr'),'a.example / xhr');
});
