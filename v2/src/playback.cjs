const fs=require('node:fs'),fsp=require('node:fs/promises'),path=require('node:path'),{Readable}=require('node:stream'),{randomUUID,createHash}=require('node:crypto'),{spawn}=require('node:child_process');
const processing=require('./processing.cjs');
const media=require('./media.cjs'),catalog=require('./catalog.cjs'),{within}=require('./projects.cjs');
async function source(project,id){
 const data=await media.read(project.root),a=data.assets.find(a=>a.id===id);if(!a)throw Error('Media record not found.');
 const lib=project.project.libraries.find(l=>l.id===a.libraryId);if(!lib||a.missing)throw Error('Source unavailable. Locate the library or rescan it.');
 const root=await fsp.realpath(lib.path),file=await fsp.realpath(path.join(root,...a.relativePath.split('/')));
 if(!within(root,file)||file===root||!(await fsp.stat(file)).isFile())throw Error('Source is outside the configured library.');
 return {file,asset:a,stat:await fsp.stat(file)};
}
function cacheKey(s,edit={}){return createHash('sha256').update(JSON.stringify([4,s.asset.id,s.file,s.stat.size,s.stat.mtimeMs,processing.edits(edit)])).digest('hex').slice(0,32);}
async function cacheFile(project,s,edit={}){const cache=await catalog.safeDir(project.root,'cache',true);const dir=path.join(cache,'library-playback');await fsp.mkdir(dir,{recursive:true});if((await fsp.lstat(dir)).isSymbolicLink()||!within(cache,await fsp.realpath(dir)))throw Error('Playback cache must not be a link.');return path.join(dir,cacheKey(s,edit)+'.mp4');}
async function cached(file){try{const st=await fsp.lstat(file);return st.isFile()&&!st.isSymbolicLink()&&st.size>0;}catch(e){if(e.code==='ENOENT')return false;throw e;}}
function args(input,output,edit={}){const f=processing.filters(edit);return ['-hide_banner','-nostdin','-n','-loglevel','warning','-threads','2','-filter_threads','1','-i',input,...(f.e.trimStart?['-ss',String(f.e.trimStart)]:[]),...(f.e.trimEnd!==null?['-t',String(f.e.trimEnd-f.e.trimStart)]:[]),'-map','0:v:0','-map','0:a:0?','-sn','-dn','-vf',f.video,...(f.audio?['-af',f.audio]:[]),...(f.e.tvFit?['-r','30']:[]),'-c:v','libx264','-pix_fmt','yuv420p','-preset','veryfast','-crf','20','-threads','2','-c:a','aac','-b:a','128k','-ac','2','-ar',f.e.tvFit?'44100':'48000','-movflags','+faststart','-progress','pipe:1',output];}
async function encode(input,output,{executable='ffmpeg',edit={},signal,onProgress=()=>{},spawnImpl=spawn}={}){
 const tmp=output+'.'+randomUUID()+'.part.mp4';let child;
 try{
  await new Promise((resolve,reject)=>{
   let log='',buf='',settled=false;const finish=(error)=>{if(settled)return;settled=true;signal?.removeEventListener('abort',abort);error?reject(error):resolve();};
   const abort=()=>{child?.kill();};if(signal?.aborted)return finish(Error('Preview canceled.'));
   child=spawnImpl(executable,args(input,tmp,edit),{windowsHide:true,stdio:['ignore','pipe','pipe'],shell:false});signal?.addEventListener('abort',abort,{once:true});
   child.stdout.on('data',chunk=>{buf+=chunk.toString();const lines=buf.split(/\r?\n/);buf=lines.pop();for(const line of lines){const m=/^out_time=(.+)$/.exec(line);if(m)onProgress(m[1]);}});
   child.stderr.on('data',b=>{log=(log+b.toString()).slice(-5000);});
   child.once('error',e=>finish(Error(e.code==='ENOENT'?'FFmpeg was not found. Choose your working ffmpeg.exe below.':e.message)));
   child.once('close',code=>finish(signal?.aborted?Error('Preview canceled.'):code===0?null:Error('Compatible preview failed (FFmpeg exit '+code+'). '+log)));
  });
  if(signal?.aborted)throw Error('Preview canceled.');if(!await cached(tmp))throw Error('FFmpeg did not create a usable preview.');await fsp.rename(tmp,output);
 }finally{await fsp.rm(tmp,{force:true});}
}
const mime=file=>({'.mp4':'video/mp4','.m4v':'video/mp4','.webm':'video/webm','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.flv':'video/x-flv','.mov':'video/quicktime'}[path.extname(file).toLowerCase()]||'application/octet-stream');
async function fileResponse(request,file){
 if(!['GET','HEAD'].includes(request.method))return new Response(null,{status:405});const st=await fsp.stat(file),size=st.size,range=request.headers.get('range');let start=0,end=size-1,status=200;
 const headers={'Content-Type':mime(file),'Accept-Ranges':'bytes','Cache-Control':'no-store','Access-Control-Allow-Origin':'*'};
 if(range){const m=/^bytes=(\d*)-(\d*)$/.exec(range);if(!m||(!m[1]&&!m[2])||!size)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});
  if(!m[1]){const n=Number(m[2]);if(!Number.isSafeInteger(n)||n<=0)return new Response(null,{status:416});start=Math.max(0,size-n);}else{start=Number(m[1]);if(m[2])end=Math.min(end,Number(m[2]));}
  if(!Number.isSafeInteger(start)||!Number.isSafeInteger(end)||start>=size||start>end)return new Response(null,{status:416,headers:{'Content-Range':'bytes */'+size}});status=206;headers['Content-Range']=`bytes ${start}-${end}/${size}`;
 }
 headers['Content-Length']=String(Math.max(0,end-start+1));if(request.method==='HEAD'||!size)return new Response(null,{status,headers});
 const stream=fs.createReadStream(file,{start,end});return new Response(Readable.toWeb(stream),{status,headers});
}
class Playback{
 constructor(getProject){this.getProject=getProject;this.tokens=new Map();this.job=null;this.executable='ffmpeg';this.generation=0;}
 reset(){this.generation++;this.tokens.clear();this.job?.controller.abort();this.job=null;}
 token(file,sourceId,edit={}){const project=this.getProject();const token=randomUUID();this.tokens.set(token,{file,root:project.root,sourceId,edit:processing.edits(edit)});return 'retro-media://clip/'+token;}
 async open(id,edit={}){edit=processing.edits(edit);this.reset();const generation=this.generation,project=this.getProject(),s=await source(project,id),file=await cacheFile(project,s,edit);if(generation!==this.generation)throw Error('Playback selection changed.');const useCache=await cached(file);return {url:!useCache&&processing.edited(edit)?null:this.token(useCache?file:s.file,id,useCache?edit:{}),compatible:useCache,needsRender:!useCache&&processing.edited(edit)};}
 async start(id,edit={}){edit=processing.edits(edit);if(this.job?.running)this.cancel();const generation=this.generation,project=this.getProject(),s=await source(project,id),output=await cacheFile(project,s,edit);if(generation!==this.generation)throw Error('Playback selection changed.');
  if(processing.edited(edit))processing.bounds(edit,await processing.probe(s.file,this.executable));if(generation!==this.generation)throw Error('Playback selection changed.');const controller=new AbortController(),job=this.job={running:true,id,time:'',error:null,url:null,controller};
  encode(s.file,output,{executable:this.executable,edit,signal:controller.signal,onProgress:t=>job.time=t}).then(async()=>{const now=await source(project,id);if(cacheKey(now,edit)!==cacheKey(s,edit)){await fsp.rm(output,{force:true});throw Error('Source changed while creating preview. Try again.');}if(this.job===job&&generation===this.generation)job.url=this.token(output,id,edit);}).catch(e=>job.error=e.message).finally(()=>job.running=false);return true;
 }
 status(){const j=this.job;return j?{id:j.id,running:j.running,time:j.time,error:j.error,url:j.url}:null;}
 cancel(){this.job?.controller.abort();}
 async respond(request){try{const u=new URL(request.url);if(u.protocol!=='retro-media:'||u.host!=='clip'||u.search||u.hash)return new Response(null,{status:404});const item=this.tokens.get(u.pathname.slice(1));const project=this.getProject();if(!item||!project||project.root!==item.root)return new Response(null,{status:404});
  // Revalidate the registered source boundary on every media request; only opaque issued tokens resolve.
  const s=await source(project,item.sourceId);if(item.file!==s.file){const expected=await cacheFile(project,s,item.edit);if(item.file!==expected||!await cached(expected))return new Response(null,{status:404});}
  return await fileResponse(request,item.file);
 }catch{return new Response(null,{status:404});}}
}
module.exports={Playback,source,cacheKey,args,encode,fileResponse};
