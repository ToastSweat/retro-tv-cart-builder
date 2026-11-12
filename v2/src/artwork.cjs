// Chromium supports WebP for displayed artwork; nativeImage is for PNG/JPEG.
// Validate in memory and retain original bytes. No source conversion or writes.
function decodeScript(dataUrl){
 if(typeof dataUrl!=='string'||!/^data:image\/webp;base64,[A-Za-z0-9+/=]+$/.test(dataUrl))throw Error('Invalid WebP preview data.');
 return `new Promise((resolve,reject)=>{
  const image=new Image();let settled=false;
  const finish=(error,value)=>{if(settled)return;settled=true;clearTimeout(timer);image.onload=null;image.onerror=null;if(error)reject(new Error(error));else resolve(value);};
  const timer=setTimeout(()=>{finish('WebP decoding timed out. Try another image.');image.src='';},12000);
  image.onload=()=>finish(null,{width:image.naturalWidth,height:image.naturalHeight});
  image.onerror=()=>finish('This WebP image could not be decoded. It may be incomplete or damaged.');
  image.src=${JSON.stringify(dataUrl)};
 })`;
}
async function validateArtwork(info,{nativeDecode,browserDecode}){
 let size;
 if(info.ext==='webp')size=await browserDecode(decodeScript(`data:image/webp;base64,${info.buffer.toString('base64')}`));
 else size=nativeDecode(info.buffer);
 if(!size||!Number.isInteger(size.width)||!Number.isInteger(size.height)||size.width<=0||size.height<=0)throw Error('This image could not be decoded.');
 if(size.width>10000||size.height>10000)throw Error('Artwork dimensions must not exceed 10000 pixels.');
 return size;
}
module.exports={validateArtwork,decodeScript};
