'use strict';
// Fixed file-backed actor: no catalog/native services are constructed on this thread.
const path=require('node:path');
const {Worker}=require('node:worker_threads');
function unavailable(message){return Object.assign(new Error(message),{status:503,statusCode:503});}
class LibraryService {
  #pending=new Map();
  #nextId=0;
  #state='open';
  #closePromise=null;
  #exitPromise;
  #closeAcknowledged=false;
  #failure=null;
  #active=false;
  constructor({installRoot,appDataDir}){
    Object.defineProperty(this,'ownsTransitionLock',{value:true,enumerable:true});
    this._worker=new Worker(path.join(__dirname,'library-service-worker.js'),{workerData:structuredClone({installRoot,appDataDir})});
    this.#exitPromise=new Promise(resolve=>this._worker.once('exit',code=>{
      if(this.#state!=='closing'||!this.#closeAcknowledged||code!==0)this.#fail('Library worker exited unexpectedly ('+code+'). Restart the application; do not replay uncertain commands.');
      resolve(code);
    }));
    this._worker.on('error',error=>this.#fail('Library worker failed: '+error.message+'. Restart the application; do not replay uncertain commands.'));
    this._worker.on('message',message=>{
      if(message?.type==='activity'&&typeof message.active==='boolean'){this.#active=message.active;this.#updateRef();return;}
      if(message?.type!=='result'||!Number.isSafeInteger(message.id))return;
      const pending=this.#pending.get(message.id);if(!pending)return;
      this.#pending.delete(message.id);
      if(pending.method==='close')this.#closeAcknowledged=true;
      if(message.ok)pending.resolve(message.value);
      else pending.reject(Object.assign(new Error(message.error.message),message.error));
      this.#updateRef();
    });
    this._worker.unref();
  }
  #updateRef(){
    if(this.#pending.size||this.#active||this.#state==='closing')this._worker.ref();
    else this._worker.unref();
  }
  #fail(message){
    this.#state='failed';this.#failure||=message;
    for(const pending of this.#pending.values())pending.reject(unavailable(this.#failure));
    this.#pending.clear();
  }
  #request(method,project,input){
    if(this.#state!=='open')return Promise.reject(unavailable(this.#state==='failed'?'Library worker unavailable. Restart the application; do not replay uncertain commands.':'Library service is closing or closed.'));
    return this.#send(method,project,input);
  }
  #send(method,project,input){
    const id=++this.#nextId;
    return new Promise((resolve,reject)=>{
      this.#pending.set(id,{resolve,reject,method});this._worker.ref();
      try{this._worker.postMessage(structuredClone({type:'command',id,method,project,input}));}
      catch(error){this.#pending.delete(id);this.#updateRef();reject(error);}
    });
  }
  read(project){return this.#request('read',project);}
  apply(project,input){return this.#request('apply',project,input);}
  dependencies(project,assetId){return this.#request('dependencies',project,assetId);}
  planningCandidates(project,filter){return this.#request('planningCandidates',project,filter);}
  start(project,input){return this.#request('start',project,input);}
  retry(project,input){return this.#request('retry',project,input);}
  recover(project,input){return this.#request('recover',project,input);}
  cancel(project,jobId){return this.#request('cancel',project,jobId);}
  status(project){return this.#request('status',project);}
  hasBlockingJobs(project){return this.#request('hasBlockingJobs',project);}
  resolveMedia(project,selection){return this.#request('resolveMedia',project,selection);}
  close(){
    if(this.#closePromise)return this.#closePromise;
    if(this.#state==='failed')return this.#closePromise=this.#exitPromise.then(()=>{});
    this.#state='closing';
    this.#closePromise=(async()=>{
      let error;try{await this.#send('close');}catch(e){error=e;}
      await this.#exitPromise;
      if(this.#state==='failed')throw unavailable(this.#failure);
      this.#state='closed';if(error)throw error;
    })();
    return this.#closePromise;
  }
}
module.exports={LibraryService};
