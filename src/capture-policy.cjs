const fs=require('node:fs/promises'),path=require('node:path');
const VIEWS=['front','back','left','right','top','iso'];
async function allowedFile(file,roots,extensions,maxBytes){
 if(typeof file!=='string'||!path.isAbsolute(file)||/^\\\\|^\/\//.test(file)||!extensions.includes(path.extname(file).toLowerCase()))throw Error('Only absolute local '+extensions.join('/')+' paths are accepted');
 const real=await fs.realpath(file);if(/^\\\\|^\/\//.test(real))throw Error('Only local paths');
 let allowed=false;for(const r of roots){try{const root=await fs.realpath(r),rel=path.relative(root,real);if(rel&&!rel.startsWith('..'+path.sep)&&rel!=='..'&&!path.isAbsolute(rel))allowed=true;}catch{}}
 if(!allowed)throw Error('File is outside configured allowed roots');
 const stat=await fs.stat(real);if(!stat.isFile()||stat.size>maxBytes)throw Error('File exceeds allowed size');return real;
}
function options(a){
 const width=a.width??960,height=a.height??720;if(!Number.isInteger(width)||!Number.isInteger(height)||width<320||height<240||width>1920||height>1440)throw Error('Invalid capture size');
 const forwardAxis=a.forwardAxis??'+Z';if(!['+Z','-Z'].includes(forwardAxis))throw Error('Invalid forward axis');
 let camera=null;if(a.camera!==undefined&&a.camera!==null){const c=a.camera;if(typeof c!=='object'||Array.isArray(c)||Object.keys(c).some(k=>!['azimuth','elevation','distanceScale','fov','targetOffset'].includes(k)))throw Error('Invalid camera');camera={azimuth:c.azimuth??45,elevation:c.elevation??25,distanceScale:c.distanceScale??1,fov:c.fov??45,targetOffset:c.targetOffset??[0,0,0]};for(const [k,min,max] of [['azimuth',-180,180],['elevation',-89,89],['distanceScale',.1,10],['fov',10,100]])if(!Number.isFinite(camera[k])||camera[k]<min||camera[k]>max)throw Error('Invalid camera '+k);if(!Array.isArray(camera.targetOffset)||camera.targetOffset.length!==3||camera.targetOffset.some(x=>!Number.isFinite(x)||Math.abs(x)>2))throw Error('Invalid camera targetOffset');}
 const views=a.views??(camera?['custom']:VIEWS);if(!Array.isArray(views)||!views.length||views.length>6||views.some(v=>![...VIEWS,'custom'].includes(v))||new Set(views).size!==views.length||views.includes('custom')&&!camera)throw Error('Invalid or repeated view');
 const grid=a.grid??0;if(![0,3,4].includes(grid))throw Error('Invalid grid');
 let crop=null;if(a.crop!==undefined&&a.crop!==null){crop=a.crop;if(typeof crop!=='object'||Array.isArray(crop)||Object.keys(crop).sort().join(',')!=='height,width,x,y'||Object.values(crop).some(v=>!Number.isFinite(v))||crop.x<0||crop.y<0||crop.width<=0||crop.height<=0||crop.x+crop.width>1||crop.y+crop.height>1)throw Error('Invalid crop');}
 const background=a.background??'dark';if(!['dark','light'].includes(background))throw Error('Invalid background');const material=a.material??'original';if(!['original','clay','wire'].includes(material))throw Error('Invalid material');
 const returnImages=a.returnImages??'all';if(!['all','original','none'].includes(returnImages))throw Error('Invalid returnImages');
 if(a.expectedModelHash!==undefined&&!/^[a-f0-9]{64}$/i.test(a.expectedModelHash))throw Error('Invalid expectedModelHash');
 if(a.referenceNote!==undefined&&(typeof a.referenceNote!=='string'||a.referenceNote.length>1000))throw Error('Invalid referenceNote');
 return {views,width,height,forwardAxis,camera,grid,crop,background,material,returnImages,...(a.expectedModelHash?{expectedModelHash:a.expectedModelHash}:{}),...(a.referenceNote?{referenceNote:a.referenceNote}:{})};
}
async function validateRequest(a,roots,referenceRoots=[]){
 if(!a||Object.keys(a).some(k=>!['modelPath','views','width','height','forwardAxis','camera','grid','crop','referencePath','referenceNote','expectedModelHash','background','material','returnImages'].includes(k)))throw Error('Unknown capture argument');
 const modelPath=await allowedFile(a.modelPath,roots,['.glb','.vrm'],256*1024**2);const out={modelPath,...options(a)};
 if(a.referencePath!==undefined)out.referencePath=await allowedFile(a.referencePath,referenceRoots,['.png','.jpg','.jpeg'],16*1024**2);return out;
}
module.exports={validateRequest,allowedFile,options,VIEWS};
