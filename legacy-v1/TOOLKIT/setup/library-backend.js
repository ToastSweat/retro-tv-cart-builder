'use strict';
// App-local selection only. This resolver never downloads or changes process/global PATH.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
function fail(message){throw Object.assign(new Error('Library media backend: '+message),{status:503});}
function checked(file,{fileOnly=false,directory=false}={}){
 if(!path.isAbsolute(file)||/[\x00-\x1f\x7f]/.test(file)||/^[\\/]{2}/.test(file))fail('unsafe local path');
 for(let p=file;;p=path.dirname(p)){let st;try{st=fs.lstatSync(p);}catch(e){if(e.code!=='ENOENT')throw e;if(p===file&&fileOnly)fail('pinned executable is missing: '+file);}
  if(st&&(st.isSymbolicLink()||st.isFile()&&st.nlink!==1))fail('reparse/hardlink paths are not supported');if(st&&(p!==file||directory)&&!st.isDirectory())fail('expected runtime directory');if(p===file&&fileOnly&&st&&!st.isFile())fail('pinned executable must be a regular file');if(path.dirname(p)===p)break;
 }
 return file;
}
function sha256(file){const h=crypto.createHash('sha256'),fd=fs.openSync(file,'r'),buffer=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)h.update(buffer.subarray(0,n));}finally{fs.closeSync(fd);}return h.digest('hex');}
function resolveBackend(installRoot){
 const base=checked(path.resolve(installRoot,'TOOLKIT','runtime'),{directory:true}),manifest=checked(path.join(base,'media-backend.json'));
 if(!fs.existsSync(manifest))return{mode:'path',ffmpeg:'ffmpeg',ffprobe:'ffprobe',binDirectory:'',description:'Unpinned PATH compatibility backend'};
 const stat=fs.statSync(manifest);if(!stat.isFile()||stat.size>65536)fail('invalid pin manifest size/type');let pin;try{pin=JSON.parse(fs.readFileSync(manifest,'utf8').replace(/^\uFEFF/,''));}catch(_){fail('invalid pin manifest JSON');}
 if(pin?.schemaVersion!==1||typeof pin.version!=='string'||!pin.version||pin.version.length>128||!pin.package||!/^https:\/\//.test(pin.package.url||'')||!/^[a-f0-9]{64}$/.test(pin.package.sha256||''))fail('unsupported or incomplete pin manifest');
 const pair={};
 for(const name of ['ffmpeg','ffprobe']){
  const entry=pin[name];if(!entry||typeof entry.path!=='string'||entry.path.includes('\\')||entry.path.split('/').some(p=>!p||p==='.'||p==='..'||/[<>:"|?*\x00-\x1f\x7f]|[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))||path.posix.basename(entry.path)!==name+'.exe'||!/^[a-f0-9]{64}$/.test(entry.sha256||''))fail('invalid relative executable pin');
  const file=checked(path.join(base,...entry.path.split('/')),{fileOnly:true});const relative=path.relative(base,file);if(relative.startsWith('..')||path.isAbsolute(relative))fail('executable escapes app runtime');
  if(sha256(file)!==entry.sha256)fail('pinned executable checksum changed: '+name);pair[name]=file;
 }
 if(path.dirname(pair.ffmpeg)!==path.dirname(pair.ffprobe))fail('pinned executable pair must share its verified bin directory');
 return{mode:'pinned',...pair,binDirectory:path.dirname(pair.ffmpeg),version:pin.version,manifestPath:manifest,package:{...pin.package},description:'Pinned app-local FFmpeg '+pin.version};
}
function backendEnvironment(backend,{scratchDir,env=process.env}={}){
 if(typeof scratchDir!=='string'||!path.isAbsolute(scratchDir))fail('explicit native scratch directory required');checked(scratchDir);
 const result={};for(const key of ['SystemRoot','WINDIR','COMSPEC','PATHEXT','SystemDrive','NUMBER_OF_PROCESSORS','PROCESSOR_ARCHITECTURE','OS'])if(typeof env[key]==='string')result[key]=env[key];
 const windows=env.SystemRoot||env.WINDIR||'C:\\Windows';
 result.PATH=backend.mode==='pinned'?[backend.binDirectory,path.join(windows,'System32'),path.join(windows,'System32','WindowsPowerShell','v1.0')].join(path.delimiter):(env.PATH||'');
 result.PATHEXT||='.COM;.EXE;.BAT;.CMD';result.TEMP=result.TMP=result.TMPDIR=scratchDir;return result;
}
module.exports={resolveBackend,backendEnvironment};
