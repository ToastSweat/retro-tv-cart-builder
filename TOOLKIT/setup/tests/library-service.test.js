'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {ProjectStore}=require('../project-store');
const scratch=process.env.RETRO_TV_TEST_ROOT;
assert.ok(scratch&&path.isAbsolute(scratch),'Explicit disposable RETRO_TV_TEST_ROOT required');
fs.mkdirSync(scratch,{recursive:true});
const installRoot=path.resolve(__dirname,'../../..');
function fixture(t){
  const root=fs.mkdtempSync(path.join(scratch,'actor-')),actors=[];
  t.after(async()=>{await Promise.allSettled(actors.map(actor=>actor.close()));fs.rmSync(root,{recursive:true,force:true});});
  const appDataDir=path.join(root,'appdata'),library=path.join(root,'sources'),projectFolder=path.join(root,'project [managed]');
  fs.mkdirSync(library);
  const paths={buildsFolder:path.join(root,'builds'),compositeFolder:path.join(root,'composites'),cacheFolder:path.join(projectFolder,'CACHE'),libraryFolders:[library]};
  const projects=new ProjectStore({installRoot,appDataDir});
  const project=projects.confirm(projects.preview({operation:'create',name:'Actor fixture',projectFolder,paths}).token);
  return {root,actors,appDataDir,library,projectFolder,paths,projects,project,file:path.join(projectFolder,'STATE/library-catalog.json')};
}
function service(t,f,{allowCloseError=false}={}){
  const moduleFile=path.join(__dirname,'../library-service.js');
  assert.ok(fs.existsSync(moduleFile),'LibraryService actor implementation is missing');
  const {LibraryService}=require(moduleFile),actor=new LibraryService({installRoot,appDataDir:f.appDataDir});
  f.actors.push(actor);
  t.after(async()=>{try{await actor.close();}catch(error){if(!allowCloseError)throw error;}});return actor;
}
async function action(actor,f,operation,payload){return actor.apply(f.project,{expectedEtag:(await actor.read(f.project)).etag,operation,payload});}
const {spawnSync}=require('node:child_process');
function native(command,args){
  const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,timeout:60000,maxBuffer:4*1024*1024,env:{...process.env,TEMP:scratch,TMP:scratch,TMPDIR:scratch}});
  assert.equal(r.status,0,r.error?.message||r.stderr);return r.stdout;
}
function video(f,seconds='0.6'){
  const source=path.join(f.library,'synthetic [native].mp4');
  native('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t',seconds,'-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source]);return source;
}
async function waitJob(actor,f,id,predicate=job=>!['queued','running','cancel-requested'].includes(job.state)){
  const deadline=Date.now()+120000;
  while(Date.now()<deadline){const job=(await actor.status(f.project)).jobs.find(j=>j.id===id);if(job&&predicate(job))return job;await new Promise(r=>setTimeout(r,15));}
  throw Error('Real job did not reach expected state');
}
async function start(actor,f,input){return actor.start(f.project,{expectedEtag:(await actor.read(f.project)).etag,...input});}
function alive(pid){try{process.kill(pid,0);return true;}catch(error){if(error.code==='ESRCH')return false;throw error;}}
async function bounded(promise,ms=5000){let timer;try{return await Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('Awaited shutdown timed out')),ms);})]);}finally{clearTimeout(timer);}}
function seedScale(f,template,n=6109){
  const doc=JSON.parse(fs.readFileSync(f.file));
  doc.assets=Array.from({length:n},(_,i)=>({...structuredClone(template),id:'ASSET-'+i,family:'ASSET-'+i,path:path.join(f.library,'part-'+i+'.mp4'),name:'Synthetic '+i}));
  for(const a of doc.assets)fs.writeFileSync(a.path,'');
  const settings=JSON.parse(fs.readFileSync(path.join(f.projectFolder,'STATE/settings.json'))),quote=v=>'"'+String(v??'').replaceAll('"','""')+'"';
  function writeRows(file,values){const header=fs.readFileSync(file,'utf8').trim().split(/\r?\n/)[0],keys=header.replace(/^\uFEFF/,'').split(',').map(k=>k.replaceAll('"',''));fs.writeFileSync(file,header+'\r\n'+values.map(v=>keys.map(k=>quote(v[k])).join(',')).join('\r\n')+'\r\n');}
  writeRows(settings.AssignmentPath,Array.from({length:1423},(_,i)=>({AssignmentID:'USE-'+i,CartID:'CART-'+i%11,Revision:1,SlotID:'SLOT-'+i,AssetID:'ASSET-'+i%n,Status:'ASSIGNED'})));
  const manifests=Array.from({length:11},(_,i)=>{const file=path.join(f.paths.buildsFolder,'manifest-'+i+'.csv');fs.writeFileSync(file,'AssetID,SourcePath\r\n'+Array.from({length:130},(_,j)=>{const a=doc.assets[(i*130+j)%n];return a.id+','+quote(a.path);}).join('\r\n'));return file;});
  writeRows(settings.CartRegistryPath,manifests.map((file,i)=>({CartID:'CART-'+i,CurrentRevision:1,Status:'BUILT',Network:'NICK',Name:'Synthetic cart',ManifestPath:file})));
  const drafts=path.join(f.projectFolder,'STATE/studio-drafts');fs.mkdirSync(drafts,{recursive:true});
  for(let i=0;i<24;i++)fs.writeFileSync(path.join(drafts,'draft-'+i+'.json'),JSON.stringify({baseManifestPath:manifests[i%11],slots:Array.from({length:130},(_,j)=>({assetId:'ASSET-'+((j*11+i)%n),sourcePath:doc.assets[(j*11+i)%n].path}))}));
  fs.writeFileSync(path.join(f.projectFolder,'config/parts.json'),JSON.stringify({Parts:[doc.assets[0].path]}));fs.writeFileSync(f.file,JSON.stringify(doc));
}
async function responsiveness(label,operation){
  const {performance}=require('node:perf_hooks'),started=performance.now(),gaps=[];let last=started;
  const interval=setInterval(()=>{const current=performance.now();gaps.push(current-last);last=current;},5);
  const zero=new Promise(resolve=>setTimeout(()=>resolve(performance.now()-started),0));
  try{
    const value=await operation(),elapsedMs=performance.now()-started,zeroTimerMs=await zero;
    await new Promise(resolve=>setTimeout(resolve,5));
    const result={operation:label,elapsedMs,zeroTimerMs,maxTimerGapMs:Math.max(...gaps),ticks:gaps.length};
    console.log('ACTOR_SCALE '+JSON.stringify(result));
    assert.ok(result.zeroTimerMs<100,'zero-delay timer must not wait for real catalog CPU work');
    assert.ok(result.maxTimerGapMs<250,'main-thread response/clone timer gap must remain bounded');
    assert.ok(result.ticks>=10,'actual operation must run while main-thread timers repeatedly fire');
    assert.ok(elapsedMs<15000,'real service response must remain bounded');
    return value;
  }finally{clearInterval(interval);}
}
test('6109 actual records retain dependency semantics while read, planning and mutation leave timers responsive',async t=>{
  const f=fixture(t),actor=service(t,f),p=path.join(f.library,'template.mp4');fs.writeFileSync(p,'');
  const initial=await action(actor,f,'register-asset',{path:p});seedScale(f,initial.catalog.assets[0]);
  const workerId=actor._worker.threadId;
  const catalog=await responsiveness('read',()=>actor.read(f.project));assert.equal(catalog.assets.length,6109);assert.ok(catalog.assets[0].uses.length>=3);
  const plan=await responsiveness('planning',()=>actor.planningCandidates(f.project,{}));assert.deepEqual(plan.candidates,[]);
  const changed=await responsiveness('remove-location',()=>actor.apply(f.project,{expectedEtag:catalog.etag,operation:'remove-location',payload:{locationId:catalog.locations[0].id}}));
  assert.equal(changed.catalog.assets.length,6109);assert.equal(changed.catalog.locations[0].removed,true);assert.equal(changed.catalog.assets[0].locationId,catalog.locations[0].id);
  assert.equal(actor._worker.threadId,workerId,'one persistent actor, no per-request worker or service replay');
});
test('cross-actor cancellation confirms native exit and close drains pending RPCs',async t=>{
  const f=fixture(t),actor=service(t,f),other=service(t,f),source=video(f,'60');
  const id=(await action(actor,f,'register-asset',{path:source})).result.assetId;
  const response=await start(actor,f,{kind:'variant',assetId:id});
  const active=await waitJob(actor,f,response.result.jobId,job=>!!job.childPid&&alive(job.childPid)&&!!job.snapshot.outputDirectory&&fs.existsSync(path.join(job.snapshot.outputDirectory,'media.mp4')));
  assert.equal(await other.hasBlockingJobs(f.project),true);
  await assert.rejects(start(other,f,{kind:'variant',assetId:id}),e=>e.statusCode===409&&/Duplicate|Conflicting/i.test(e.message));
  const cancellation=other.cancel(f.project,active.id),remoteClosing=other.close();
  const [cancelled]=await bounded(Promise.all([cancellation,remoteClosing]));assert.equal(cancelled.catalog.jobs.find(j=>j.id===active.id).state,'cancelled');assert.equal(alive(active.childPid),false);
  const retry=await actor.retry(f.project,{jobId:active.id,expectedEtag:(await actor.read(f.project)).etag});assert.notEqual(retry.result.jobId,active.id);
  const pending=actor.cancel(f.project,retry.result.jobId),closing=actor.close();
  const results=await bounded(Promise.allSettled([pending,closing]));assert.equal(results[0].status,'fulfilled');assert.equal(results[1].status,'fulfilled');
  assert.equal(actor._worker.threadId,-1);assert.equal(JSON.parse(fs.readFileSync(f.file)).jobs.some(j=>['queued','running','cancel-requested'].includes(j.state)),false);
});
test('blocking checks stay pure under guards and explicit lost-owner recovery never adopts output',async t=>{
  const f=fixture(t),actor=service(t,f),{LibraryStore}=require('../library-store'),store=new LibraryStore({installRoot});
  store.transact(f.project,d=>d.jobs.push({id:'lost-owner',kind:'scan',state:'running',ownerPid:2147483000,snapshot:{projectFolder:f.projectFolder,locationId:'location-0'}}));
  const before=fs.readFileSync(f.file),locks=[path.join(f.appDataDir,'setup.lock'),f.projectFolder+'.setup.lock'];
  for(const lock of locks)fs.writeFileSync(lock,'test-owned guard');
  try{assert.equal(await actor.hasBlockingJobs(f.project),true);assert.deepEqual(fs.readFileSync(f.file),before);}
  finally{for(const lock of locks)fs.unlinkSync(lock);}
  assert.equal((await actor.status(f.project)).jobs[0].state,'interrupted');
  const recovered=await actor.recover(f.project,{jobId:'lost-owner',expectedEtag:(await actor.read(f.project)).etag});
  assert.equal(recovered.catalog.jobs[0].recoveryRequired,false);assert.equal(recovered.catalog.jobs[0].outputs,undefined);assert.equal(await actor.hasBlockingJobs(f.project),false);
});
test('start/retry synchronously reserve queued jobs and recover rechecks inside the actual app lock',t=>{
  const f=fixture(t),{LibraryStore}=require('../library-store'),store=new LibraryStore({installRoot});
  store.transact(f.project,d=>d.jobs.push({id:'lost-owner',kind:'scan',state:'interrupted',ownerPid:2147483000,recoveryRequired:true,snapshot:{projectFolder:f.projectFolder,locationId:'location-0'}}));
  const configFile=path.join(f.root,'lock-config.json');fs.writeFileSync(configFile,JSON.stringify({installRoot,appDataDir:f.appDataDir,project:f.project,mode:'reservations'}));
  const child=spawnSync(process.execPath,['--require',path.join(__dirname,'fixtures/library-service-observe.cjs'),path.join(__dirname,'fixtures/library-service-process.cjs'),configFile],{encoding:'utf8',timeout:15000,env:process.env,windowsHide:true});
  assert.equal(child.error,undefined,child.error?.message);assert.equal(child.status,0,child.stderr);assert.equal(JSON.parse(child.stdout).reserved,true);
  const records=fs.readFileSync(path.join(f.appDataDir,'actor-lock-proof.jsonl'),'utf8').trim().split('\n').map(JSON.parse);
  assert.equal(records.length,3);assert.ok(records.every(r=>r.locked&&r.projectFolder===f.projectFolder));
  assert.deepEqual(records[0].recovered,[{id:'lost-owner',recoveryRequired:false}]);
  for(const record of records.slice(1)){assert.equal(record.thenable,true);assert.equal(record.newJobs.length,1);assert.equal(record.newJobs[0].state,'queued');}
  assert.notEqual(records[1].newJobs[0].id,records[2].newJobs[0].id);
});
test('only idle workers unref: an active nonnative scan finishes before natural process exit',async t=>{
  const f=fixture(t),configFile=path.join(f.root,'process-config.json');
  const run=mode=>{
    fs.writeFileSync(configFile,JSON.stringify({installRoot,appDataDir:f.appDataDir,project:f.project,mode}));
    const child=spawnSync(process.execPath,[path.join(__dirname,'fixtures/library-service-process.cjs'),configFile],{encoding:'utf8',timeout:15000,env:process.env,windowsHide:true});
    assert.equal(child.error,undefined,child.error?.message);assert.equal(child.status,0,child.stderr);return JSON.parse(child.stdout.trim());
  };
  const idle=run('idle');assert.equal(idle.idle,true);assert.equal(idle.mainServicesLoaded,false);assert.equal(idle.studioLoaded,false);
  for(let i=0;i<100;i++)fs.writeFileSync(path.join(f.library,'unsupported-'+i+'.txt'),'not media; never spawns a native child');
  const response=run('scan'),job=JSON.parse(fs.readFileSync(f.file)).jobs.find(j=>j.id===response.jobId);
  assert.equal(job.state,'succeeded','the main process must not exit while its worker owns a job');
});
test('unexpected worker exit during shutdown rejects pending and future commands without respawn',async t=>{
  const f=fixture(t),actor=new (require('../library-service').LibraryService)({installRoot,appDataDir:f.appDataDir}),pid=process.pid;
  await actor.read(f.project);
  const pending=actor.read(f.project);const observed=assert.rejects(pending,e=>e.status===503&&e.statusCode===503&&/restart/i.test(e.message));
  // Terminate only an idle/read-only owned thread: never use this hook with children.
  const stopped=actor._worker.terminate(),closing=actor.close();
  const closeObserved=assert.rejects(bounded(closing),e=>e.status===503&&/restart/i.test(e.message));
  await stopped;await observed;
  try{await closeObserved;}finally{await assert.rejects(actor.read(f.project),e=>e.status===503&&/restart/i.test(e.message));}
  assert.equal(actor._worker.threadId,-1);assert.equal(alive(pid),true);
});
test('awaited close reaps native children even when catalog persistence is corrupt',async t=>{
  const f=fixture(t),actor=service(t,f,{allowCloseError:true}),source=video(f,'60');
  const id=(await action(actor,f,'register-asset',{path:source})).result.assetId;
  const response=await start(actor,f,{kind:'preview',assetId:id});
  const active=await waitJob(actor,f,response.result.jobId,job=>!!job.childPid&&alive(job.childPid)&&!!job.snapshot.outputDirectory&&fs.existsSync(path.join(job.snapshot.outputDirectory,'media.mp4')));assert.equal(alive(active.childPid),true);
  fs.writeFileSync(f.file,'{deliberately corrupt catalog');
  const closing=actor.close();assert.equal(actor.close(),closing);
  await assert.rejects(actor.read(f.project),e=>e.status===503);
  try{await assert.rejects(bounded(closing),/Lifecycle persistence|catalog|JSON/i);assert.equal(actor._worker.threadId,-1);}
  finally{
    assert.equal(alive(active.childPid),false,'cleanup must precede any worker termination');
    if(actor._worker.threadId!==-1)await actor._worker.terminate();
  }
});
test('worker RPC accepts only typed ordered IDs and fixed methods, never replaying a command',async t=>{
  const f=fixture(t),{Worker}=require('node:worker_threads');
  const worker=new Worker(path.join(__dirname,'../library-service-worker.js'),{workerData:{installRoot,appDataDir:f.appDataDir}});
  t.after(async()=>{worker.postMessage({type:'command',id:99,method:'close'});await new Promise(resolve=>worker.once('exit',resolve));});
  async function rpc(message){
    return new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>{worker.off('message',receive);reject(Error('RPC did not reject forbidden request'));},1000);
      const receive=value=>{if(value?.id===message.id){clearTimeout(timer);worker.off('message',receive);resolve(value);}};
      worker.on('message',receive);worker.postMessage(message);
    });
  }
  const forbidden=await rpc({type:'command',id:1,method:'constructor',project:f.project});assert.equal(forbidden.ok,false);assert.equal(forbidden.error.status,400);
  const duplicate=await rpc({type:'command',id:1,method:'read',project:f.project});assert.equal(duplicate.ok,false);assert.match(duplicate.error.message,/id|replay/i);
  const extra=await rpc({type:'command',id:2,method:'read',project:f.project,require:'node:fs'});assert.equal(extra.ok,false);
  const valid=await rpc({type:'command',id:3,method:'read',project:f.project});assert.equal(valid.ok,true);assert.deepEqual(valid.value.assets,[]);
});
test('native jobs run once in the worker, persist queued state, and render RESTORE from original',async t=>{
  const f=fixture(t),actor=service(t,f),source=video(f),before=fs.readFileSync(source);
  const id=(await action(actor,f,'register-asset',{path:source})).result.assetId;
  const lock=path.join(f.appDataDir,'setup.lock');fs.writeFileSync(lock,'held by test');
  try{await assert.rejects(start(actor,f,{kind:'probe',assetId:id}),/lock/i);assert.equal((await actor.status(f.project)).jobs.length,0);}
  finally{fs.unlinkSync(lock);}
  const queued=await start(actor,f,{kind:'probe',assetId:id});assert.equal(queued.catalog.jobs.at(-1).state,'queued');
  const probed=await waitJob(actor,f,queued.result.jobId);assert.equal(probed.state,'succeeded',probed.error);
  assert.equal(probed.ownerPid,process.pid);assert.equal(probed.snapshot.projectFolder,f.projectFolder);
  assert.ok((await actor.read(f.project)).assets[0].technical.duration>0);
  await action(actor,f,'save-recipe',{assetId:id,values:{audioRepair:'RESTORE'}});
  const preview=await start(actor,f,{kind:'preview',assetId:id}),done=await waitJob(actor,f,preview.result.jobId);
  assert.equal(done.state,'succeeded',done.error);
  const output=await actor.resolveMedia(f.project,{jobId:done.id,kind:'media'});
  const profile=JSON.parse(native('ffprobe',['-v','error','-show_streams','-of','json',output.path]));
  const v=profile.streams.find(s=>s.codec_type==='video'),a=profile.streams.find(s=>s.codec_type==='audio');
  assert.equal(v.width,618);assert.equal(v.height,480);assert.equal(v.r_frame_rate,'30/1');assert.equal(a.sample_rate,'44100');assert.equal(a.channels,2);
  native('ffmpeg',['-v','error','-i',output.path,'-f','null','-']);assert.deepEqual(fs.readFileSync(source),before);
  const bad=path.join(f.library,'unplayable.mp4');fs.writeFileSync(bad,'deliberately invalid native input');
  const badId=(await action(actor,f,'register-asset',{path:bad})).result.assetId;
  const failure=await start(actor,f,{kind:'probe',assetId:badId}),failed=await waitJob(actor,f,failure.result.jobId);assert.equal(failed.state,'failed');assert.match(failed.error,/Native process failed/);
  const retry=await actor.retry(f.project,{jobId:failed.id,expectedEtag:(await actor.read(f.project)).etag});assert.notEqual(retry.result.jobId,failed.id);
  assert.equal((await waitJob(actor,f,retry.result.jobId)).state,'failed');
  await assert.rejects(actor.recover(f.project,{jobId:failed.id,expectedEtag:(await actor.read(f.project)).etag}),/interrupted/i);
});
test('fresh read-only inspection is authority even when the caller forges editable context',async t=>{
  const f=fixture(t),actor=service(t,f),settingsFile=path.join(f.projectFolder,'STATE/settings.json');
  const settings=JSON.parse(fs.readFileSync(settingsFile));delete settings.ProjectSchemaVersion;
  fs.writeFileSync(settingsFile,JSON.stringify(settings));fs.unlinkSync(path.join(f.projectFolder,'retro-project.json'));
  await assert.rejects(actor.read(f.project),e=>e.status===409);
  const legacy=f.projects.inspect(f.projectFolder,{includeSummary:false,includeCatalog:false,includeDrafts:false});assert.equal(legacy.readOnly,true);
  const catalog=await actor.read(legacy);assert.equal(catalog.readOnly,true);
  await assert.rejects(actor.apply(legacy,{expectedEtag:catalog.etag,operation:'add-pool',payload:{value:'NO',label:'No'}}),e=>e.status===403);
  await assert.rejects(actor.start(legacy,{expectedEtag:catalog.etag,kind:'scan',locationId:catalog.locations[0].id}),e=>e.status===403);
  assert.equal(fs.existsSync(f.file),false);
});
test('fresh worker project binding rejects stale requests and preserves catalog error details',async t=>{
  const f=fixture(t),actor=service(t,f),source=path.join(f.library,'one.mp4');fs.writeFileSync(source,'catalog bytes');
  const saved=await action(actor,f,'register-asset',{path:source});
  await assert.rejects(actor.read({...f.project,projectFolder:path.join(f.root,'foreign')}),e=>e.status===409&&e.statusCode===409);
  await assert.rejects(actor.read({...f.project,paths:{...f.project.paths,cacheFolder:f.root}}),e=>e.status===409);
  await assert.rejects(actor.apply(f.project,{expectedEtag:'stale',operation:'add-pool',payload:{value:'NO',label:'No'}}),e=>e.status===409&&e.statusCode===409&&/etag/i.test(e.message));
  const id=saved.result.assetId;
  await action(actor,f,'save-group',{name:'Pinned reference',parts:[{assetId:id,recipeRevision:1}]});
  await assert.rejects(action(actor,f,'remove-asset',{assetId:id}),e=>e.status===409&&e.statusCode===409&&e.impact.blocked&&e.impact.dependencies.length>0);
  const impact=await actor.dependencies(f.project,id);assert.equal(impact.blocked,true);
  assert.deepEqual((await actor.planningCandidates(f.project,{})).candidates,[]);
  assert.deepEqual(await actor.status(f.project),{jobs:[]});assert.equal(await actor.hasBlockingJobs(f.project),false);
  assert.deepEqual(await actor.resolveMedia(f.project,{assetId:id,kind:'source'}),{path:source,mime:'video/mp4'});
  fs.writeFileSync(path.join(f.appDataDir,'projects.json'),JSON.stringify({activeProject:null,recentProjects:[]}));
  await assert.rejects(actor.read(f.project),e=>e.status===409);
});
test('real persistent worker registers defensive catalog copies and survives a facade relaunch',async t=>{
  const f=fixture(t),actor=service(t,f);
  assert.equal(actor.ownsTransitionLock,true);
  assert.deepEqual((await actor.read(f.project)).assets,[]);
  const source=path.join(f.library,'synthetic [literal].mp4');fs.writeFileSync(source,'not playable; catalog fixture only');
  const input={expectedEtag:(await actor.read(f.project)).etag,operation:'register-asset',payload:{path:source,name:'captured'}};
  const savedPromise=actor.apply(f.project,input);input.payload.name='mutated after send';
  const saved=await savedPromise;assert.equal(saved.catalog.assets[0].name,'captured');
  saved.catalog.assets[0].notes='not authoritative';
  assert.equal((await actor.read(f.project)).assets[0].notes,'');
  assert.equal(JSON.parse(fs.readFileSync(f.file)).assets[0].name,'captured');
  await actor.close();
  const reopened=service(t,f);assert.equal((await reopened.read(f.project)).assets[0].id,saved.result.assetId);
});
