function imageDimensions(b){
 let width,height;
 if(b.length>=24&&b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))&&b.toString('ascii',12,16)==='IHDR'){width=b.readUInt32BE(16);height=b.readUInt32BE(20);}
 else if(b.length>4&&b[0]===255&&b[1]===216){let i=2;while(i+4<=b.length){if(b[i++]!==255)break;while(b[i]===255)i++;const marker=b[i++];if(marker===217||marker===218)break;if(marker===1||(marker>=208&&marker<=215))continue;if(i+2>b.length)break;const length=b.readUInt16BE(i);if(length<2||i+length>b.length)break;if([192,193,194,195,197,198,199,201,202,203,205,206,207].includes(marker)&&length>=8){height=b.readUInt16BE(i+3);width=b.readUInt16BE(i+5);break;}i+=length;}}
 if(!width||!height)throw Error('Invalid PNG/JPEG dimensions');if(width>12000||height>12000||width*height>24000000)throw Error('Reference pixel limit exceeded');return {width,height};
}
module.exports={imageDimensions};
