const FPS=30,{modelNotes}=require('./model-notes-policy.cjs'),{captions}=require('./timed-captions.cjs');
function options(a={},dual=false){
 if(!a||typeof a!=='object'||Array.isArray(a)||Object.keys(a).some(k=>!['seconds','axis','format','direction','fov','orientation','background','material','exposure','notes','captions','cameraPath'].includes(k)))throw Error('Invalid turntable options');
 const path=a.cameraPath===undefined?null:require('./camera-path.cjs').keyframes(a.cameraPath);
 if(path&&(dual||a.format&&a.format!=='mp4'||a.seconds!==undefined||a.axis!==undefined))throw Error('Camera path is single-model MP4 and defines its own duration.');
 const seconds=path?.at(-1).time??a.seconds??5,axis=a.axis??'horizontal',format=a.format??'mp4',mp4Frames=Math.round(seconds*FPS);
 if(typeof seconds!=='number'||!Number.isFinite(seconds)||seconds<1||seconds>20||Math.abs(mp4Frames-seconds*FPS)>1e-8)throw Error('Choose a duration between 1 and 20 seconds, in whole frames at 30 fps.');
 if(!['horizontal','vertical'].includes(axis))throw Error('Invalid turntable axis');
 if(!['mp4','gif'].includes(format))throw Error('Invalid turntable format');
 const direction=a.direction??[1,.65,1],orientation=a.orientation??[0,0,0,1],fov=a.fov??45,background=a.background??'#19212c',material=a.material??'original',exposure=a.exposure??1;
 function vector(x,len){return Array.isArray(x)&&x.length===len&&x.every(v=>Number.isFinite(v)&&Math.abs(v)<=10000)&&Math.hypot(...x)>1e-8;}
 if(!vector(direction,3)||!vector(orientation,4)||!Number.isFinite(fov)||fov<10||fov>100||!['#19212c','#e5e7eb','#000000'].includes(background)||!['original','clay','wire'].includes(material)||!Number.isFinite(exposure)||exposure<.2||exposure>2.5)throw Error('Invalid capture appearance');
 const gif=format==='gif',durationTicks=gif?Math.round(seconds*100):null,encodedSeconds=gif?durationTicks/100:seconds;
 const frameCount=gif?Math.round(mp4Frames/2):mp4Frames,pane=gif?480:640;
 return {format,seconds,encodedSeconds,durationTicks,axis,...(path?{cameraPath:path}:{}),frameCount,fps:gif?frameCount/encodedSeconds:FPS,width:pane*(dual?2:1),height:gif?360:480,direction,fov,orientation,background,material,exposure,notes:modelNotes(a.notes,dual?2:1),captions:captions(a.captions,seconds)};
}
function angleAt(index,count){if(!Number.isInteger(index)||!Number.isInteger(count)||index<0||index>=count)throw Error('Invalid frame');return 2*Math.PI*index/count;}
function frameTime(index,cfg){
 if(!Number.isInteger(index)||index<0||index>=cfg.frameCount)throw Error('Invalid frame');
 return cfg.format==='gif'?Math.round(cfg.durationTicks*index/cfg.frameCount)/100:index/FPS;
}
function encodeArgs(input,output,count){return ['-hide_banner','-loglevel','error','-nostdin','-n','-framerate',String(FPS),'-start_number','0','-i',input,'-frames:v',String(count),'-an','-c:v','libx264','-pix_fmt','yuv420p','-movflags','+faststart','-f','mp4',output];}
const gifInput=(input,cfg)=>['-hide_banner','-loglevel','error','-nostdin','-n','-framerate',String(100*cfg.frameCount)+'/'+cfg.durationTicks,'-start_number','0','-i',input];
function gifPaletteArgs(input,palette,cfg){return [...gifInput(input,cfg),'-vf','palettegen=max_colors=128:stats_mode=diff','-frames:v','1','-update','1',palette];}
function gifEncodeArgs(input,palette,output,cfg){
 const finalDelay=cfg.durationTicks-Math.round(cfg.durationTicks*(cfg.frameCount-1)/cfg.frameCount);
 return [...gifInput(input,cfg),'-i',palette,'-filter_complex','[0:v][1:v]paletteuse=dither=bayer:bayer_scale=4:diff_mode=rectangle','-filter_complex_threads','1','-frames:v',String(cfg.frameCount),'-an','-loop','0','-final_delay',String(finalDelay),'-f','gif',output];
}
module.exports={options,angleAt,frameTime,encodeArgs,gifPaletteArgs,gifEncodeArgs};
