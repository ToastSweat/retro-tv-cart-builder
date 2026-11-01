'use strict';
// Live Library boundary only. Immutable design routes are handled separately.
const path=require('node:path');
const fs=require('node:fs');
function failure(status,message){return Object.assign(new Error(message),{status});}
function send(res,status,value){const bytes=Buffer.from(JSON.stringify(value));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':bytes.length,'Cache-Control':'no-store'});res.end(bytes);}
function object(value){return value!==null&&typeof value==='object'&&!Array.isArray(value);}
function fields(input,allowed,required=[]){if(!object(input)||Object.keys(input).some(k=>!allowed.includes(k))||required.some(k=>!Object.hasOwn(input,k)))throw failure(400,'Unexpected or missing request fields.');}
function etag(value){if(typeof value!=='string'||!value||value.length>256)throw failure(400,'An expectedEtag from the current catalog is required.');}
function readBody(req){
 if(!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type']||''))return Promise.reject(failure(415,'Use application/json.'));
 return new Promise((resolve,reject)=>{
  let size=0,failed=false;const chunks=[];
  const timer=setTimeout(()=>{failed=true;reject(failure(408,'Library request body timed out.'));},10000);timer.unref?.();
  req.on('data',chunk=>{size+=chunk.length;if(size>65536){if(!failed){failed=true;reject(failure(413,'Library request exceeds 64 KiB.'));}return;}if(!failed)chunks.push(chunk);});
  req.once('end',()=>{clearTimeout(timer);if(failed)return;try{const text=new TextDecoder('utf-8',{fatal:true}).decode(Buffer.concat(chunks)),input=JSON.parse(text);if(!object(input))throw Error('object');resolve(input);}catch(_){reject(failure(400,'Invalid UTF-8 JSON object.'));}});
  req.once('error',error=>{clearTimeout(timer);reject(error);});req.once('aborted',()=>{clearTimeout(timer);reject(failure(400,'Request was interrupted.'));});
 });
}
const actions=new Set(['register-asset','register-location','remove-location','save-metadata','save-recipe','bulk-pools','add-pool','add-network','rename-network','archive-network','delete-network','relink-asset','relink-location','remove-asset','save-group','remove-group','set-relationships']);
const jobKinds=new Set(['probe','scan','source-frame','final-frame','crop-detect','preview','variant','composite']);
function identity(value,label){if(typeof value!=='string'||!value||value.length>256||/[\x00-\x1f\x7f]/.test(value))throw failure(400,'A valid '+label+' is required.');}
function streamMedia(req,res,target){
 if(!target||!path.isAbsolute(target.path)||/^[\\/]{2}/.test(target.path)||/[\x00-\x1f\x7f]/.test(target.path))throw failure(400,'Invalid registered media reference.');
 if(!/^(?:video\/[a-z0-9.+-]+|audio\/[a-z0-9.+-]+|image\/(?:jpeg|png))$/i.test(target.mime||''))throw failure(415,'Unsupported media content type.');
 for(let p=target.path;;p=path.dirname(p)){if(fs.lstatSync(p).isSymbolicLink())throw failure(409,'Media reparse paths are not supported. Relink a regular file.');if(path.dirname(p)===p)break;}
 const before=fs.lstatSync(target.path);let fd=fs.openSync(target.path,'r');
 try{
  const stat=fs.fstatSync(fd);if(!stat.isFile()||stat.ino!==before.ino||stat.dev!==before.dev)throw failure(409,'Media reference changed while opening. Retry after checking its source.');
  let start=0,end=stat.size-1,status=200;
  if(req.headers.range){
   const match=/^bytes=(\d*)-(\d*)$/.exec(req.headers.range);let valid=!!match&&!!(match[1]||match[2])&&stat.size>0;
   if(valid){
    if(!match[1]){const count=Number(match[2]);valid=Number.isSafeInteger(count)&&count>0;start=Math.max(0,stat.size-count);}
    else {start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),stat.size-1):stat.size-1;valid=Number.isSafeInteger(start)&&Number.isSafeInteger(end)&&start<=end&&start<stat.size;}
   }
   if(!valid){res.writeHead(416,{'Content-Range':'bytes */'+stat.size,'Content-Length':0,'Cache-Control':'no-store'});res.end();return;}
   status=206;
  }
  const headers={'Content-Type':target.mime,'Content-Length':stat.size?end-start+1:0,'Accept-Ranges':'bytes','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'};
  if(status===206)headers['Content-Range']='bytes '+start+'-'+end+'/'+stat.size;
  res.writeHead(status,headers);if(req.method==='HEAD'||!stat.size){res.end();return;}
  const stream=fs.createReadStream(target.path,{fd,autoClose:true,start,end});fd=null;
  stream.on('error',error=>res.destroy(error));res.once('close',()=>stream.destroy());stream.pipe(res);
 }finally{if(fd!==null)fs.closeSync(fd);}
}
function createLibraryRouter({projectStore,libraryStore,libraryJobs,libraryService,installRoot=path.resolve(__dirname,'../..'),pickFolder,pickFile,isChangingProject=()=>false}){
 let catalog=libraryStore,jobs=libraryJobs,service=libraryService,closePromise;
 const contextOnly=Object.freeze({includeSummary:false,includeCatalog:false,includeDrafts:false});
 const useService=!!libraryService||(!libraryStore&&!libraryJobs&&typeof projectStore.appDataDir==='string');
 const getService=()=>service||=(new (require('./library-service').LibraryService)({installRoot:projectStore.installRoot||installRoot,appDataDir:projectStore.appDataDir}));
 const getCatalog=()=>useService?getService():catalog||=(new (require('./library-store').LibraryStore)({installRoot}));
 const getJobs=()=>useService?getService():jobs||=(new (require('./library-jobs').LibraryJobs)({store:getCatalog(),installRoot}));
 function versionedJob(project,input,method){
  if(getJobs().ownsTransitionLock)return getJobs()[method](project,input);
  const reserve=()=>{
   const status=projectStore.status(contextOnly);if(status&&typeof status.then==='function')throw failure(500,'Project transition lock requires synchronous current-state inspection.');
   const current=status?.activeProject;if(isChangingProject()||!current||current.projectFolder!==project.projectFolder)throw failure(409,'Active project changed before this job command. Refresh the workspace.');
   if(current.readOnly)throw failure(403,'Import a managed project copy before preparing media.');
   // start/retry persist a queued reservation synchronously before their first await.
   return getJobs()[method](current,input);
  };
  return typeof projectStore.withAppLock==='function'?projectStore.withAppLock(reserve):getJobs()[method](project,input);
 }
 async function active(projectFolder){
  if(typeof projectFolder!=='string'||!projectFolder||/[\x00-\x1f\x7f]/.test(projectFolder))throw failure(400,'An explicit projectFolder is required.');
  if(isChangingProject())throw failure(409,'A project change is in progress; refresh project status first.');
  const project=(await projectStore.status(contextOnly)).activeProject;
  if(!project||project.projectFolder!==projectFolder)throw failure(409,'This request belongs to another or unavailable project. Return to the active workspace.');
  return project;
 }
 function query(raw,allowed){
  // Reject malformed UTF-8/escapes instead of letting URLSearchParams repair identifiers.
  const encoded=raw.split('?')[1]||'';
  for(const component of encoded.split(/[&=]/))try{decodeURIComponent(component.replace(/\+/g,' '));}catch(_){throw failure(400,'Malformed query encoding.');}
  const values=new URLSearchParams(encoded),out={};
  for(const [key,value] of values){if(!allowed.includes(key)||Object.hasOwn(out,key))throw failure(400,'Unexpected or duplicate query field: '+key);out[key]=value;}
  return out;
 }
 async function handle(req,res){
  if(!req.url.startsWith('/api/library/'))return false;
  try{
   const route=req.url.split('?')[0];
   if(req.method==='GET'&&route==='/api/library/catalog'){
    const input=query(req.url,['projectFolder']),project=await active(input.projectFolder);send(res,200,await getCatalog().read(project));return true;
   }
   if(['GET','HEAD'].includes(req.method)&&route==='/api/library/media'){
    const input=query(req.url,['projectFolder','assetId','jobId','kind']);identity(input.kind,'media kind');
    if(input.assetId!==undefined)identity(input.assetId,'assetId');if(input.jobId!==undefined)identity(input.jobId,'jobId');
    if(!input.assetId&&!input.jobId)throw failure(400,'A registered assetId or owned jobId is required.');
    const project=await active(input.projectFolder),{projectFolder,...selection}=input;streamMedia(req,res,await getJobs().resolveMedia(project,selection));return true;
   }
   if(req.method==='GET'&&route==='/api/library/jobs'){
    const input=query(req.url,['projectFolder']),project=await active(input.projectFolder);send(res,200,await getJobs().status(project));return true;
   }
   if(req.method==='GET'&&route==='/api/library/dependencies'){
    const input=query(req.url,['projectFolder','assetId']);identity(input.assetId,'assetId');const project=await active(input.projectFolder);send(res,200,await getCatalog().dependencies(project,input.assetId));return true;
   }
   if(req.method==='GET'&&route==='/api/library/planning'){
    const input=query(req.url,['projectFolder','category','network','pool','year','allowUnknown','health','search','locationId']),project=await active(input.projectFolder);delete input.projectFolder;
    if(input.year!==undefined){if(!/^\d{4}$/.test(input.year)||Number(input.year)===0)throw failure(400,'year must be an explicit four-digit year.');input.year=Number(input.year);}
    if(input.allowUnknown!==undefined){if(!['true','false'].includes(input.allowUnknown))throw failure(400,'allowUnknown must be true or false.');input.allowUnknown=input.allowUnknown==='true';}
    send(res,200,await getCatalog().planningCandidates(project,input));return true;
   }
   if(req.method==='POST'&&route==='/api/library/action'){
    if(req.url!==route)throw failure(400,'Library command queries are not accepted.');
    const input=await readBody(req);fields(input,['projectFolder','expectedEtag','operation','payload'],['projectFolder','expectedEtag','operation','payload']);etag(input.expectedEtag);
    if(!actions.has(input.operation)||!object(input.payload))throw failure(400,'Choose a supported operation and an object payload.');
    const project=await active(input.projectFolder);if(project.readOnly)throw failure(403,'Legacy project is read-only. Import a managed copy before editing.');
    send(res,200,await getCatalog().apply(project,{expectedEtag:input.expectedEtag,operation:input.operation,payload:input.payload}));return true;
   }
   if(req.method==='POST'&&route==='/api/library/browse'){
    if(req.url!==route)throw failure(400,'Picker command queries are not accepted.');const input=await readBody(req);fields(input,['projectFolder','mode','initialPath'],['projectFolder','mode']);
    if(!['file','folder'].includes(input.mode))throw failure(400,'Choose file or folder mode.');
    const initial=input.initialPath??'';if(typeof initial!=='string'||initial.length>4096||/[\x00-\x1f\x7f]/.test(initial)||(initial&&(!path.isAbsolute(initial)||/^[\\/]{2}/.test(initial))))throw failure(400,'Enter a local absolute starting path.');
    await active(input.projectFolder);const picker=input.mode==='file'?pickFile:pickFolder;if(!picker)throw failure(503,'Native picker is unavailable. Type an absolute path instead.');
    const result=await picker(initial);if(!object(result)||typeof result.cancelled!=='boolean'||(!result.cancelled&&(typeof result.path!=='string'||!path.isAbsolute(result.path))))throw failure(500,'Picker did not return a valid selection. Nothing was registered.');
    send(res,200,result);return true;
   }
   if(req.method==='POST'&&['/api/library/job','/api/library/cancel','/api/library/retry','/api/library/recover'].includes(route)){
    if(req.url!==route)throw failure(400,'Library command queries are not accepted.');const input=await readBody(req);
    if(route==='/api/library/job'){
     fields(input,['projectFolder','expectedEtag','kind','assetId','groupId','locationId','sampleTime'],['projectFolder','expectedEtag','kind']);etag(input.expectedEtag);
     if(!jobKinds.has(input.kind))throw failure(400,'Unsupported job kind.');
     for(const key of ['assetId','groupId','locationId'])if(input[key]!==undefined)identity(input[key],key);
     if(input.sampleTime!==undefined&&(!Number.isFinite(input.sampleTime)||input.sampleTime<0))throw failure(400,'sampleTime must be nonnegative seconds.');
    }else{
     const versioned=route.endsWith('/retry')||route.endsWith('/recover');fields(input,versioned?['projectFolder','jobId','expectedEtag']:['projectFolder','jobId'],['projectFolder','jobId']);identity(input.jobId,'jobId');if(versioned)etag(input.expectedEtag);
    }
    const project=await active(input.projectFolder);if(project.readOnly)throw failure(403,'Legacy project is read-only. Import a managed copy before preparing media.');
    const {projectFolder,...jobInput}=input;let value;
    if(route.endsWith('/job'))value=await versionedJob(project,jobInput,'start');
    else if(route.endsWith('/cancel'))value=await getJobs().cancel(project,input.jobId);
    else if(route.endsWith('/recover'))value=await versionedJob(project,jobInput,'recover');
    else value=await versionedJob(project,jobInput,'retry');
    send(res,200,value);return true;
   }
   send(res,404,{error:'Unknown Library route.'});return true;
  }catch(error){if(res.headersSent)res.destroy(error);else send(res,error.status||error.statusCode||(error.code==='ENOENT'?404:500),{error:error.message||'Library request failed.'});return true;}
 }
 return {handle,async assertProjectChangeAllowed(){const project=(await projectStore.status(contextOnly)).activeProject;if(project&&await getJobs().hasBlockingJobs(project))throw failure(409,'Processing is active for this project. Finish or safely cancel it before switching or changing settings.');},close(){return closePromise||=(async()=>{if(service)await service.close();else if(jobs)await jobs.close();})();}};
}
module.exports={createLibraryRouter};
