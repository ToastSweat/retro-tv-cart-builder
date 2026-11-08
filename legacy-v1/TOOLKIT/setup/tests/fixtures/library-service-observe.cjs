'use strict';
// Test-only instrumentation, inherited by the real file-backed Worker. It wraps
// the real synchronous lock, never substitutes a store/jobs/media implementation.
const {isMainThread}=require('node:worker_threads');
if(!isMainThread){
  const fs=require('node:fs'),path=require('node:path');
  const {ProjectStore}=require('../../project-store');
  const original=ProjectStore.prototype.withAppLock;
  ProjectStore.prototype.withAppLock=function(callback){
    return original.call(this,()=>{
      const prefs=JSON.parse(fs.readFileSync(path.join(this.appDataDir,'projects.json'),'utf8'));
      const file=path.join(prefs.activeProject,'STATE/library-catalog.json');
      const before=fs.existsSync(file)?JSON.parse(fs.readFileSync(file)).jobs:[];
      const result=callback();
      const after=JSON.parse(fs.readFileSync(file)).jobs;
      fs.appendFileSync(path.join(this.appDataDir,'actor-lock-proof.jsonl'),JSON.stringify({locked:fs.existsSync(path.join(this.appDataDir,'setup.lock')),projectFolder:prefs.activeProject,thenable:!!result?.then,newJobs:after.filter(j=>!before.some(b=>b.id===j.id)).map(j=>({id:j.id,state:j.state})),recovered:after.filter(j=>j.recoveredAt&&!before.find(b=>b.id===j.id)?.recoveredAt).map(j=>({id:j.id,recoveryRequired:j.recoveryRequired}))})+'\n');
      return result;
    });
  };
}
