import {AnimationMixer} from 'three';
import directorPolicy from './director-policy.cjs';

// Each parsed GLB is a different scene root with its own mixer, even when the file is shared.
export function bindDirectorClip(root,clips,track,id){
 if(!track)return null;
 const matches=clips.filter(c=>c.name===track.clip);
 if(matches.length===0&&track.missing==='static')return null;
 if(matches.length!==1||!Number.isFinite(matches[0].duration)||matches[0].duration<=0||!matches[0].tracks.length)throw Error('Missing, ambiguous or empty GLB clip "'+track.clip+'" on object "'+id+'".');
 const clip=matches[0],mixer=new AnimationMixer(root),action=mixer.clipAction(clip);
 let active=false;
 return t=>{
  const time=directorPolicy.clipTime(track,t,clip.duration);
  if(time===null){
   if(active){action.stop();active=false;} // deactivate and restore the authored bind pose
   return;
  }
  if(!active){action.play();action.paused=true;active=true;}
  action.time=time;
  mixer.update(0); // evaluate an absolute sample without advancing mixer time
 };
}
