const ORIGIN='https://3wa.tw',BASE=ORIGIN+'/demo/php/3wa_ride/',V='/inc/javascript/easymap8_sdk/releases/8.0.0-preview.9-x1.20261118.1/';
const mapReady=p=>p&&p.map.isStyleLoaded()&&p.map.areTilesLoaded()&&p.pilot.inspect().sites.some(s=>s.visible&&s.loaded.length);
const bareReady=(name,extra='true')=>"(() => { const p=window."+name+";return Boolean(("+mapReady.toString()+")(p)&&("+extra+"));})()";
const click=id=>"(() => {const b=document.getElementById('"+id+"');if(!b||b.disabled)return false;b.click();return true;})()";
const make=(id,label,file,assets,ready,begin,step)=>Object.freeze({id,label,url:BASE+file,origin:ORIGIN,assets:Object.freeze(assets),ready,begin,step});
const localPresets=Object.freeze({
 // No real localhost target has been approved. Add exact page and assets here after review.
});
function loopbackURL(raw){
 if(typeof raw!=='string'||!/^https?:\/\/(?:localhost|127\.0\.0\.1|\[::1\]):[1-9]\d{0,4}\/[\w./-]+$/.test(raw))throw Error('An exact loopback URL with explicit port and path is required.');
 const u=new URL(raw);
 if(!u.port||u.href!==raw||u.pathname.includes('//'))throw Error('Use the canonical loopback address, port, and exact path.');
 return u;
}
function makeLocalPreset(id,label,url,assets=[]){
 const page=loopbackURL(url);
 if(!/^local-[a-z0-9-]{1,40}$/.test(id)||typeof label!=='string'||!label||!Array.isArray(assets)||assets.length>40)throw Error('Invalid loopback preset declaration.');
 for(const asset of assets)if(typeof asset!=='string'||loopbackURL(page.origin+asset).origin!==page.origin||!/^\/[\w./-]+\.(?:js|mjs|css|json|png|jpeg|jpg|webp|svg|wasm|glb|pbf|woff2?)$/i.test(asset))throw Error('Invalid loopback resource path.');
 const ready="(() => Array.from(document.querySelectorAll('canvas')).some(c=>c.width>100&&c.height>100))()";
 return Object.freeze({id,label,url,origin:page.origin,assets:Object.freeze([...assets]),ready,local:true});
}
const presets=Object.freeze({
 ...localPresets,
 icc:make('icc','ICC 大樓與停車場','icc-preview.html',
 ['/demo/php/3wa_ride/js/ride_simulator_icc.js?v=20261118.003'],bareReady('iccPreview'),click('ride')),
 'icc-ramp':make('icc-ramp','ICC 地下停車場坡道','icc-ramp-preview.html',
 ['/demo/php/3wa_ride/js/ride_simulator_icc.js?v=ramp3','/demo/php/3wa_ride/js/ride_icc_ramp_preview.mjs?v=2',V+'excavation-dem.mjs',V+'excavation-dem-resample.mjs',V+'excavation-core.mjs'],
 bareReady('iccRamp',"Boolean(p.inspect().cut&&p.map.getSource('icc-cut'))"),click('enter'),
 (frame,total)=>"(() => {const slider=document.getElementById('route');if(!slider)return false;slider.value="+(Math.round((-7+Math.min(1,frame/Math.max(1,total-2))*13.5)*10)/10)+";slider.dispatchEvent(new Event('input'));return Boolean(window.iccRamp?.inspect().walking);})()")
});
function presetById(id='icc'){
 if(typeof id!=='string'||!Object.hasOwn(presets,id))throw Error('Unknown approved E8 preset.');
 return presets[id];
}
const publicPresets=()=>Object.values(presets).map(({id,label,url})=>({id,label,url}));
module.exports={presetById,publicPresets,makeLocalPreset};
