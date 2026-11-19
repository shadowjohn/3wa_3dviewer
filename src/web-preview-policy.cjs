const {presetById,publicPresets}=require('./web-presets.cjs'),{BlockList,isIP}=require('node:net');
const TARGET=presetById().url;
const denied=new BlockList(),ipv6Global=new BlockList();
for(const [ip,n] of [['0.0.0.0',8],['10.0.0.0',8],['100.64.0.0',10],['127.0.0.0',8],['169.254.0.0',16],['172.16.0.0',12],['192.0.0.0',24],['192.0.2.0',24],['192.168.0.0',16],['198.18.0.0',15],['198.51.100.0',24],['203.0.113.0',24],['224.0.0.0',3]])denied.addSubnet(ip,n,'ipv4');
for(const [ip,n] of [['2001::',23],['2001:db8::',32],['2002::',16],['3fff::',20]])denied.addSubnet(ip,n,'ipv6');
ipv6Global.addSubnet('2000::',3,'ipv6');
const FOCUSIT_TILES=new Set(['https://www.focusit.com.tw','https://tile.focusit.tw']);
function focusitTile(u,type){
 if(!FOCUSIT_TILES.has(u.origin)||!['image','xhr','other'].includes(type)||u.username||u.password||/%|\/\//.test(u.pathname))return false;
 if(!u.search&&/^\/(?:[A-Za-z0-9_-]+\/){0,8}\d{1,2}\/\d{1,8}\/\d{1,8}\.(?:png|jpe?g|webp|pbf|mvt)$/i.test(u.pathname))return true;
 if(!/^\/(?:[A-Za-z0-9_-]+\/){0,5}wmts$/i.test(u.pathname))return false;
 const q=new Map([...u.searchParams].map(([k,v])=>[k.toLowerCase(),v]));
 const keys=['service','request','version','layer','style','format','tilematrixset','tilematrix','tilerow','tilecol'];
 return u.searchParams.size===q.size&&[...q].every(([k,v])=>keys.includes(k)&&/^[A-Za-z0-9_.:/-]{1,100}$/.test(v))&&q.get('request')?.toLowerCase()==='gettile'&&q.get('service')?.toLowerCase()==='wmts'&&!!q.get('layer')&&!!q.get('tilematrixset')&&/^[\w.:/-]{1,100}$/.test(q.get('tilematrix'))&&/^\d{1,8}$/.test(q.get('tilerow'))&&/^\d{1,8}$/.test(q.get('tilecol'));
}
function loopbackIP(ip){return ip==='127.0.0.1'||ip==='::1';}
function publicIP(ip){const n=isIP(ip);return n===4?!denied.check(ip,'ipv4'):n===6&&ipv6Global.check(ip,'ipv6')&&!denied.check(ip,'ipv6');}
function blockedCategory(raw,type){
 let host='(non-HTTPS)';
 try{const u=new URL(raw);if(u.protocol==='https:'&&/^[a-z\d.-]{1,80}$/i.test(u.hostname)&&!isIP(u.hostname))host=u.hostname;}catch{}
 const category=/^[a-z]{1,24}$/i.test(type)?type:'other';
 return host+' / '+category;
}
const SDK='/inc/javascript/easymap8/',ASSETS='/demo/php/3wa_ride/assets/simulator/',VECTOR='/demo/php/map/vmap/VectorTileServer/',DEM='/data/ride-simulator/terrain-corridor-2026-v1/';
const WIDTH=1280,HEIGHT=720,FPS=10;
function permitted(raw,type,method='GET',preset=presetById()){
 if(!['GET','HEAD'].includes(method)||typeof raw!=='string')return false;
 if(type==='mainFrame')return raw===preset.url;
 if(type==='subFrame')return false;
 try{
  const u=new URL(raw);
  if(u.protocol==='blob:')return u.origin===preset.origin;
  if(preset.local)return u.origin===preset.origin&&!u.username&&!u.password&&preset.assets.includes(u.pathname+u.search);
  if(focusitTile(u,type))return true;
  if(u.origin!==preset.origin||u.username||u.password||/%2f|%5c|%2e|%25/i.test(u.pathname))return false;
  if(preset.assets.includes(u.pathname+u.search))return true;
  const p=u.pathname;
  if(p===VECTOR+'api.php')return /^\?mode=(?:(?:getStyle|getV3)&osmData=Taiwan_2026_10_03_gis|getMap&osmData=Taiwan_2026_10_03_gis&z=\d{1,2}&x=\d{1,8}&y=\d{1,8})$/.test(u.search);
  if(p.startsWith(VECTOR))return /^(?:sprites\/osm-liberty(?:@2x)?\.(?:json|png)|pbf_fonts\/NotoSansRegular\/\d+-\d+\.pbf)$/.test(p.slice(VECTOR.length));
  if(p.startsWith(DEM))return /^(?:tilejson\.json|\d{1,2}\/\d{1,8}\/\d{1,8}\.png)$/.test(p.slice(DEM.length))&&!u.search;
  if(p.startsWith(ASSETS))return /^(?:icc-pilot-v1\/(?:scene\.json|TC_ICC1_scene_(?:full|simple)\.glb)|traffic-pilot-v1\/car\.glb|scenery-v2\/gltf-loader\.js)$/.test(p.slice(ASSETS.length))&&!u.search;
  return p.startsWith(SDK)&&/\.(?:js|css|json|wasm|glb|png|webp|svg|woff2?)$/i.test(p);
 }catch{return false;}
}
function captureOptions(args={}){
 if(!args||typeof args!=='object'||Array.isArray(args)||Object.keys(args).some(k=>!['seconds','snapshots','motion','preset'].includes(k)))throw Error('Unknown public preview option.');
 const {seconds=10,snapshots=3,motion='ride'}=args,preset=presetById(args.preset).id;
 if(!Number.isInteger(seconds)||seconds<0||seconds>10||!Number.isInteger(snapshots)||snapshots<0||snapshots>3||(!seconds&&!snapshots)||!['still','ride'].includes(motion)||presetById(preset).local&&motion!=='still')throw Error('Use 0–10 seconds, up to 3 snapshots, and still or ride.');
 return {seconds,snapshots,motion,preset};
}
module.exports={TARGET,WIDTH,HEIGHT,FPS,permitted,captureOptions,presetById,publicPresets,publicIP,loopbackIP,blockedCategory};
