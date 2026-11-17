// Deterministic visual evidence. No remote inputs, automatic alignment or measurement claims.
export function evidenceImages(source,{grid=0,crop=null},reference){
 const w=source.width,h=source.height;
 const make=(width=w,height=h)=>{const c=document.createElement('canvas');c.width=width;c.height=height;return c;};
 const original=make(),o=original.getContext('2d');o.drawImage(source,0,0);
 const out={original:original.toDataURL('image/png')};
 if(grid){const c=make(),ctx=c.getContext('2d');ctx.drawImage(original,0,0);ctx.strokeStyle='rgba(255,190,30,.9)';ctx.lineWidth=1;for(let i=1;i<grid;i++){ctx.beginPath();ctx.moveTo(w*i/grid,0);ctx.lineTo(w*i/grid,h);ctx.moveTo(0,h*i/grid);ctx.lineTo(w,h*i/grid);ctx.stroke();}ctx.font='14px sans-serif';for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){ctx.fillStyle='rgba(0,0,0,.7)';ctx.fillRect(x*w/grid+3,y*h/grid+3,38,20);ctx.fillStyle='#fff';ctx.fillText(String.fromCharCode(65+y)+(x+1),x*w/grid+6,y*h/grid+18);}out.grid=c.toDataURL('image/png');}
 if(crop){const x=Math.floor(crop.x*w),y=Math.floor(crop.y*h),cw=Math.max(1,Math.min(w-x,Math.round(crop.width*w))),ch=Math.max(1,Math.min(h-y,Math.round(crop.height*h)));const c=make(cw,ch);c.getContext('2d').drawImage(original,x,y,cw,ch,0,0,cw,ch);out.crop=c.toDataURL('image/png');}
 if(reference){const c=make(w*2,h+32),ctx=c.getContext('2d');ctx.fillStyle='#222';ctx.fillRect(0,0,c.width,c.height);const scale=Math.min(w/reference.width,h/reference.height),rw=reference.width*scale,rh=reference.height*scale;ctx.drawImage(reference,(w-rw)/2,32+(h-rh)/2,rw,rh);ctx.drawImage(original,w,32);ctx.fillStyle='#fff';ctx.font='14px sans-serif';ctx.fillText('Reference | manual visual comparison, not measurement',8,21);ctx.fillText('Model | no automatic perspective correction',w+8,21);out.compare=c.toDataURL('image/png');}
 return out;
}
