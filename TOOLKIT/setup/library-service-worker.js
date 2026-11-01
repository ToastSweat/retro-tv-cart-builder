'use strict';
const {parentPort,workerData}=require('node:worker_threads');
const {ProjectStore}=require('./project-store');
const {LibraryStore}=require('./library-store');
const {LibraryJobs}=require('./library-jobs');
const projects=new ProjectStore(workerData);
const store=new LibraryStore({installRoot:workerData.installRoot});
const jobs=new LibraryJobs({store,installRoot:workerData.installRoot});
const methods=new Set(['read','apply','dependencies','planningCandidates','status','start','cancel','retry','recover','hasBlockingJobs','resolveMedia','close']);
const lightOptions=Object.freeze({includeSummary:false,includeCatalog:false,includeDrafts:false});
const {isDeepStrictEqual}=require('node:util');
function fault(message,status=409){return Object.assign(new Error(message),{status,statusCode:status});}
function boundProject(requested){
  const current=projects.status(lightOptions).activeProject;
  if(!requested||typeof requested.projectFolder!=='string'||!current||current.projectFolder!==requested.projectFolder)throw fault('This request belongs to another or unavailable project. Refresh the active workspace.');
  if(requested.readOnly!==undefined&&requested.readOnly!==current.readOnly||requested.paths!==undefined&&!isDeepStrictEqual(requested.paths,current.paths))throw fault('Project settings changed. Refresh the active workspace.');
  return current;
}
function errorValue(error){
  const value={message:String(error?.message||error)};
  for(const key of ['status','statusCode','impact'])if(error?.[key]!==undefined)value[key]=structuredClone(error[key]);
  return value;
}
let lastId=0,lastActive=false;
function activity(){
  const active=jobs.running.size>0;
  if(active!==lastActive){lastActive=active;parentPort.postMessage({type:'activity',active});}
}
// Only the in-memory ownership count is observed here, never catalog polling.
const activityTimer=setInterval(activity,25);activityTimer.unref();
const inflight=new Set();
let closing=false;
async function command(message){
  // Invalid IDs are not correlation tokens and can never authorize work.
  if(!Number.isSafeInteger(message?.id)||message.id<1)return;
  try{
    if(message.id<=lastId)throw fault('RPC ID was already used or is out of order; never replay commands.',400);
    lastId=message.id;
    if(message.type!=='command'||Object.keys(message).some(key=>!['type','id','method','project','input'].includes(key))||!methods.has(message.method))throw fault('Unsupported Library RPC command.',400);
    if(closing)throw fault('Library service is closing; new commands are rejected.',503);
    let value;
    if(message.method==='close'){
      closing=true;
      try{
        let cleanupError;try{await jobs.close();}catch(error){cleanupError=error;}
        // A remote cancellation can still be awaiting its owner even though this
        // worker has no native children. Publish every accepted RPC before exit.
        await Promise.allSettled([...inflight]);
        if(cleanupError)throw cleanupError;
        parentPort.postMessage({type:'result',id:message.id,ok:true});
      }
      catch(error){parentPort.postMessage({type:'result',id:message.id,ok:false,error:errorValue(error)});}
      finally{clearInterval(activityTimer);parentPort.close();}
      return;
    }
    // withAppLock is deliberately synchronous: start/retry synchronously reserve
    // queued state before returning their Promise. Never await inside this lock.
    if(['start','retry','recover'].includes(message.method)){
      try{
        value=projects.withAppLock(()=>{
          const current=boundProject(message.project);
          if(current.readOnly)throw fault('Import a managed project copy before preparing media.',403);
          switch(message.method){
            case 'start':return jobs.start(current,message.input);
            case 'retry':return jobs.retry(current,message.input);
            case 'recover':return jobs.recover(current,message.input);
          }
        });
      }catch(error){if(/Setup lock is held/.test(error.message)&&error.status===undefined)error.status=error.statusCode=409;throw error;}
    }else{
      const project=boundProject(message.project);
      switch(message.method){
        case 'read':value=store.read(project);break;
        case 'apply':value=store.apply(project,message.input);break;
        case 'dependencies':value=store.dependencies(project,message.input);break;
        case 'planningCandidates':value=store.planningCandidates(project,message.input);break;
        case 'status':value=jobs.status(project);break;
        case 'hasBlockingJobs':value=jobs.hasBlockingJobs(project);break;
        case 'resolveMedia':value=jobs.resolveMedia(project,message.input);break;
        case 'cancel':value=jobs.cancel(project,message.input);break;
      }
    }
    value=await value;
    activity();
    parentPort.postMessage({type:'result',id:message.id,ok:true,value:structuredClone(value)});
  }catch(error){activity();parentPort.postMessage({type:'result',id:message.id,ok:false,error:errorValue(error)});}
}
parentPort.on('message',message=>{
  const task=command(message);
  // The close task drains this set; it must never wait on itself.
  if(message?.method!=='close'){
    inflight.add(task);
    task.then(()=>inflight.delete(task),()=>inflight.delete(task));
  }
});
