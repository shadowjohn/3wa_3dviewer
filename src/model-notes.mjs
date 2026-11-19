import {Vector3,Raycaster} from 'three';
function displayed(node,root){
 for(let o=node;o;o=o.parent){if(!o.visible)return false;if(o===root)return Array.isArray(node.material)?node.material.some(m=>m.visible):node.material?.visible!==false;}
 return false;
}
export function pickModelNote(x,y,model,camera){
 const ray=new Raycaster();ray.setFromCamera({x,y},camera);
 const hit=ray.intersectObject(model,true).find(h=>h.object.isMesh&&displayed(h.object,model));
 return hit?model.worldToLocal(hit.point.clone()).toArray():null;
}
export function visibleNote(note,model,camera,radius,occluders=[model]){
 if(!model.visible)return null;
 const position=model.localToWorld(new Vector3(...note.point)),origin=camera.getWorldPosition(new Vector3()),direction=position.clone().sub(origin);
 const dist=direction.length(),projected=position.clone().project(camera);
 if(!(dist>0)||[projected.x,projected.y,projected.z].some(v=>!Number.isFinite(v)||v< -1||v>1))return null;
 const tolerance=Math.max(radius*.001,1e-6),ray=new Raycaster(origin,direction.normalize(),0,Math.max(0,dist-tolerance));
 if(occluders.some(root=>ray.intersectObject(root,true).some(h=>h.object.isMesh&&displayed(h.object,root))))return null;
 return {x:(projected.x+1)/2,y:(1-projected.y)/2,text:note.text};
}
function wrap(ctx,text,limit){
 const lines=[];let line='';
 for(const c of text){if(line&&ctx.measureText(line+c).width>limit){lines.push(line);line='';}line+=c;}
 if(line)lines.push(line);if(lines.length>4)return [...lines.slice(0,3),lines[3].slice(0,-1)+'…'];return lines;
}
export function drawModelNotes(ctx,notes,viewport){
 const {x,y,width:w,height:h}=viewport,used=[];if(w<110||h<70)return;
 const cl=(v,a,b)=>Math.max(a,Math.min(b,v));
 ctx.save();ctx.beginPath();ctx.rect(x,y,w,h);ctx.clip();
 const fs=cl(w/34,12,19),lh=Math.round(fs*1.35),pad=8;
 ctx.font='600 '+fs+'px "Segoe UI", "Microsoft JhengHei", sans-serif';ctx.textBaseline='top';
 for(const n of notes){
  const px=x+w*n.x,py=y+h*n.y,lines=wrap(ctx,n.text,Math.min(w*.55,230)-pad*2);
  const bw=Math.ceil(Math.max(...lines.map(l=>ctx.measureText(l).width))+pad*2),bh=lines.length*lh+pad*2;
  if(bh>h-12)continue;
  const spots=[[px+17,py-bh-19],[px-bw-17,py-bh-19],[px+17,py+19],[px-bw-17,py+19]];
  const boxes=spots.map(([a,b])=>({x:cl(a,x+6,x+w-bw-6),y:cl(b,y+6,y+h-bh-6)}));
  const r=boxes.find(a=>!used.some(b=>a.x<b.x+b.w+6&&a.x+bw+6>b.x&&a.y<b.y+b.h+6&&a.y+bh+6>b.y));
  if(!r)continue;
  used.push({...r,w:bw,h:bh});
  ctx.strokeStyle='#ffd257';ctx.lineWidth=2;ctx.beginPath();ctx.moveTo(px,py);ctx.lineTo(cl(px,r.x,r.x+bw),cl(py,r.y,r.y+bh));ctx.stroke();
  ctx.fillStyle='#ffd257';ctx.beginPath();ctx.arc(px,py,3.5,0,Math.PI*2);ctx.fill();
  ctx.fillStyle='#142036';ctx.beginPath();ctx.roundRect(r.x,r.y,bw,bh,7);ctx.fill();ctx.stroke();
  ctx.fillStyle='#fff4d8';lines.forEach((l,i)=>ctx.fillText(l,r.x+pad,r.y+pad+i*lh));
 }
 ctx.restore();
}
export function drawTimedCaption(ctx,text,width,height){
 if(!text)return;
 ctx.save();const fs=Math.max(14,Math.min(24,width/34)),lh=Math.round(fs*1.3),pad=10;
 ctx.font='650 '+fs+'px "Segoe UI", "Microsoft JhengHei", sans-serif';ctx.textBaseline='top';ctx.textAlign='center';
 const lines=wrap(ctx,text,width*.75),bw=Math.max(...lines.map(l=>ctx.measureText(l).width))+pad*2,bh=lh*lines.length+pad*2;
 const x=(width-bw)/2,y=height-bh-14;
 ctx.fillStyle='#111b2b';ctx.strokeStyle='#60e6ff';ctx.lineWidth=2;
 ctx.beginPath();ctx.roundRect(x,y,bw,bh,8);ctx.fill();ctx.stroke();
 ctx.fillStyle='#f2fbff';lines.forEach((l,i)=>ctx.fillText(l,width/2,y+pad+i*lh));ctx.restore();
}
export function projectedModelNotes(notes,model,camera,radius,pane=0){
 return notes.filter(n=>n.pane===pane).map(n=>visibleNote(n,model,camera,radius)).filter(Boolean);
}
