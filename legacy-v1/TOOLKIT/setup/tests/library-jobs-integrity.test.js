'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync,spawn}=require('node:child_process');
const {once}=require('node:events');
const {LibraryJobs}=require('../library-jobs');
const {LibraryStore}=require('../library-store');
const {ProjectStore}=require('../project-store');
const {fingerprint}=require('../library-media');
const root=process.env.RETRO_TV_TEST_ROOT;
assert.ok(root&&path.isAbsolute(root),'Set RETRO_TV_TEST_ROOT to an explicit disposable scratch directory');
const installRoot=path.resolve(__dirname,'../../..');
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function native(command,args) {
 const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,timeout:120000,env:{...process.env,TEMP:root,TMP:root,TMPDIR:root}});
 assert.equal(r.status,0,r.error?.message||r.stderr);return r.stdout;
}
function fixture() {
 fs.mkdirSync(root,{recursive:true});const folder=fs.mkdtempSync(path.join(root,'real-jobs-'));
 const library=path.join(folder,'sources');fs.mkdirSync(library);
 const projects=new ProjectStore({installRoot,appDataDir:path.join(folder,'appdata')});
 const projectFolder=path.join(folder,'project');
 const paths={libraryFolders:[library],cacheFolder:path.join(projectFolder,'CACHE'),compositeFolder:path.join(folder,'composites'),buildsFolder:path.join(folder,'builds')};
 const project=projects.confirm(projects.preview({operation:'create',name:'Job integrity fixture',projectFolder,paths}).token);
 const store=new LibraryStore({installRoot});
 const source=path.join(library,'original.mp4');
 native('ffmpeg',['-v','error','-nostdin','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1.2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',source]);
 const act=(operation,payload)=>store.apply(project,{expectedEtag:store.read(project).etag,operation,payload});
 const id=act('register-asset',{path:source}).result.assetId;
 const jobs=new LibraryJobs({store,installRoot});
 return {folder,library,projects,project,store,source,id,act,jobs};
}
async function wait(f,id) {
 const deadline=Date.now()+120000;
 while(Date.now()<deadline) {const j=f.jobs.status(f.project).jobs.find(j=>j.id===id);if(!['queued','running','cancel-requested'].includes(j.state))return j;await new Promise(r=>setTimeout(r,20));}
 throw new Error('Job did not settle');
}
const start=(f,input)=>f.jobs.start(f.project,{expectedEtag:f.store.read(f.project).etag,...input});
test('failed scans persist the last genuine runtime counts at their terminal boundary',async()=>{
 const f=fixture();
 try {
  fs.copyFileSync(f.source,path.join(f.library,'another.mp4'));
  const probe=f.jobs.media.probe.bind(f.jobs.media);let first=true;
  f.jobs.media.probe=async(source,...args)=>{const profile=await probe(source,...args);if(first){first=false;fs.utimesSync(source,new Date(),new Date(Date.now()+10000));}return profile;};
  const location=f.store.read(f.project).locations[0],r=await start(f,{kind:'scan',locationId:location.id}),done=await wait(f,r.result.jobId);
  assert.equal(done.state,'failed');assert.match(done.error,/changed during scan/);
  assert.equal(done.count,2,'terminal catalog must fold in real runtime discovery count');assert.equal(done.item,0);
 }finally {await f.jobs.close();}
});
test('scan progress publication has lifecycle-bounded catalog backups and cross-instance owned runtime state',async t=>{
 const f=fixture(),other=new LibraryJobs({store:new LibraryStore({installRoot}),installRoot});
 try {
  for(let i=0;i<12;i++)fs.copyFileSync(f.source,path.join(f.library,'small-'+i+'.mp4'));
  const backups=()=>fs.readdirSync(path.join(f.project.projectFolder,'backups')).filter(n=>n.startsWith('library-')).length;
  const before=backups(),location=f.store.read(f.project).locations[0],probe=f.jobs.media.probe.bind(f.jobs.media);let observations=0;
  f.jobs.media.probe=async(...args)=>{
   const profile=await probe(...args),status=other.status(f.project).jobs.at(-1);
   assert.equal(status.stage,'probe discovered files');assert.equal(status.count,13);observations++;return profile;
  };
  const r=await start(f,{kind:'scan',locationId:location.id}),done=await wait(f,r.result.jobId);
  assert.equal(done.state,'succeeded',done.error);assert.equal(observations,13);assert.equal(done.item,13);
  assert.ok(backups()-before<=4,'scan must publish O(lifecycle), not O(files), full-catalog before-images: '+(backups()-before));
  t.diagnostic('13 scanned files: '+(backups()-before)+' full-catalog backups');
  const runtime=JSON.parse(fs.readFileSync(done.snapshot.runtimeStateFile,'utf8'));
  assert.equal(runtime.jobId,done.id);assert.equal(runtime.ownerToken,done.snapshot.ownerToken);assert.equal(runtime.projectFolder,f.project.projectFolder);
  assert.equal(runtime.count,13);assert.equal(runtime.item,13);assert.equal(runtime.childPid,null);
 }finally {await f.jobs.close();await other.close();}
});
test('real-store frame and durable composite outputs retain exact fingerprints and original source pins',async()=>{
 const f=fixture(),before=sha(f.source);
 try {
  const groupId=f.act('save-group',{name:'Pinned original twice',parts:[{assetId:f.id,recipeRevision:1},{assetId:f.id,recipeRevision:1}]}).result.groupId;
  for(const input of [{kind:'source-frame',assetId:f.id,sampleTime:0.2},{kind:'composite',groupId}]) {
   const r=await start(f,input),done=await wait(f,r.result.jobId);
   assert.equal(done.state,'succeeded',done.error);assert.equal(done.outputs.length,1);
   const entry=done.outputs[0];assert.deepEqual(entry.fingerprint,{...fingerprint(entry.path),sha256:sha(entry.path)});
   assert.equal(f.jobs.resolveMedia(f.project,{jobId:done.id,kind:entry.kind}).path,entry.path);
   if(input.kind==='composite') {
    assert.ok(entry.path.startsWith(f.project.paths.compositeFolder));
    native('ffmpeg',['-v','error','-xerror','-i',entry.path,'-f','null','-']);
    assert.deepEqual(done.snapshot.parts.map(p=>p.source.path),[f.source,f.source]);
   }
   const tampered=fs.readFileSync(entry.path);tampered[tampered.length-1]^=1;fs.writeFileSync(entry.path,tampered);
   assert.throws(()=>f.jobs.resolveMedia(f.project,{jobId:done.id,kind:entry.kind}),e=>e.statusCode===409);
  }
  assert.equal(sha(f.source),before);
 }finally {await f.jobs.close();}
});
test('real-store scan cancellation is observed cross-instance during unsupported-entry discovery with no partial import',async()=>{
 const f=fixture(),other=new LibraryJobs({store:new LibraryStore({installRoot}),installRoot});
 try {
  for(let i=0;i<150;i++)fs.writeFileSync(path.join(f.library,'unsupported-'+i+'.txt'),'scan cancellation fixture');
  const location=f.store.read(f.project).locations[0];
  const response=await start(f,{kind:'scan',locationId:location.id}),id=response.result.jobId;
  assert.equal(f.store.readJobState(f.project).jobs.find(j=>j.id===id).state,'running');
  const begin=Date.now();await other.cancel(f.project,id);
  const done=await wait(f,id);
  assert.equal(done.state,'cancelled');assert.equal(done.outputs,undefined);
  assert.ok(Date.now()-begin<3000,'cancellation must yield promptly, not wait for an entire scan');
  assert.equal(f.store.read(f.project).assets.length,1);assert.equal(f.jobs.running.size,0);
 }finally {await f.jobs.close();await other.close();}
});
test('a scan cannot publish after its registered location is revoked',async()=>{
 const f=fixture();
 try {
  const location=f.store.read(f.project).locations[0],candidate=path.join(f.library,'new-candidate.mp4');fs.copyFileSync(f.source,candidate);
  const pending=start(f,{kind:'scan',locationId:location.id}),id=f.store.readJobState(f.project).jobs.at(-1).id;
  f.store.transact(f.project,d=>{d.locations.find(l=>l.id===location.id).removed=true;});
  await pending;const done=await wait(f,id);
  assert.equal(done.state,'stale',done.error);assert.equal(done.outputs,undefined);
  assert.equal(f.store.read(f.project).assets.length,1);
 }finally {await f.jobs.close();}
});
test('registered video aliases have explicit streamable MIME types',async()=>{
 const f=fixture();
 try {
  for(const [extension,mime] of [['m4v','video/mp4'],['ts','video/mp2t'],['m2ts','video/mp2t'],['wmv','video/x-ms-wmv']]) {
   const source=path.join(f.library,'alias.'+extension);fs.copyFileSync(f.source,source);
   const id=f.act('register-asset',{path:source}).result.assetId;
   assert.deepEqual(f.jobs.resolveMedia(f.project,{assetId:id,kind:'source'}),{path:source,mime});
  }
 }finally {await f.jobs.close();}
});
test('scan associates historical registrations and respects removed-reference tombstones without editorial reset',async()=>{
 const f=fixture(),removed=path.join(f.library,'removed.mp4');fs.copyFileSync(f.source,removed);
 try {
  const removedId=f.act('register-asset',{path:removed}).result.assetId;
  f.act('remove-asset',{assetId:removedId});
  assert.equal(f.store.read(f.project).removedReferences[0].id,removedId);
  f.store.transact(f.project,d=>{
   const a=d.assets.find(a=>a.id===f.id);a.locationId='';a.notes='human retains this';a.health='BAD_AUDIO';a.reason='human decision';
  });
  const before=f.store.read(f.project).assets.find(a=>a.id===f.id),location=f.store.read(f.project).locations[0];
  const r=await start(f,{kind:'scan',locationId:location.id}),done=await wait(f,r.result.jobId);
  assert.equal(done.state,'succeeded',done.error);
  const doc=f.store.read(f.project),asset=doc.assets.find(a=>a.id===f.id);
  assert.equal(asset.locationId,location.id,'existing path must join the scanned location');
  assert.equal(doc.assets.some(a=>a.path===removed),false,'removed reference must not be re-registered with a new identity');
  for(const key of ['id','notes','health','reason','recipe','recipeHistory','variants','legacy'])assert.deepEqual(asset[key],before[key]);
  assert.equal(done.result.registered,0);assert.equal(done.result.refreshed,1);assert.equal(done.result.skippedRemoved,1);
 }finally {await f.jobs.close();}
});
test('blocking guard is synchronous read-only and polling/hash/scan use fresh narrow real-store views',async()=>{
 const f=fixture();let fullReads=0,narrowReads=0,writes=0;
 const read=f.store.read.bind(f.store),narrow=f.store.readJobState.bind(f.store),transact=f.store.transact.bind(f.store);
 try {
  transact(f.project,d=>d.jobs.push({id:'lost-reservation',kind:'scan',state:'running',ownerPid:2147483000,snapshot:{projectFolder:f.project.projectFolder}}));
  f.store.read=(...args)=>{fullReads++;return read(...args);};
  f.store.readJobState=(...args)=>{narrowReads++;return narrow(...args);};
  f.store.transact=(...args)=>{writes++;return transact(...args);};
  assert.equal(f.jobs.hasBlockingJobs(f.project),true);
  assert.equal(writes,0,'blocking guard must be legal under the existing project lock');
  assert.equal(fullReads,0,'blocking guard must not derive whole-catalog dependencies');
  f.jobs.status(f.project);assert.equal(writes,1,'explicit status may reconcile an orphan');
  const baseline=fullReads;
  for(let i=0;i<5;i++)f.jobs.status(f.project);
  assert.equal(fullReads,baseline,'normal polling uses narrow state');
  assert.ok(narrowReads>=7);
  const location=read(f.project).locations[0];
  for(let i=0;i<75;i++)fs.writeFileSync(path.join(f.library,i+'.txt'),'unsupported scan entry');
  const pending=start(f,{kind:'scan',locationId:location.id});
  assert.equal(narrow(f.project).jobs.at(-1).state,'queued','reservation is persisted before first await');
  const response=await pending,handle=f.jobs.running.get(response.result.jobId);
  fullReads=0;f.jobs.check(handle);assert.equal(fullReads,0,'hash callbacks/checks use narrow state');
  const done=await wait(f,response.result.jobId);
  assert.equal(done.state,'succeeded',done.error);
  assert.ok(fullReads<8,'scan entries, observers and status must not derive the catalog: '+fullReads);
  assert.ok(narrowReads>80,'each scan check freshly validates reservations without a TTL');
 }finally {await f.jobs.close();}
});
test('explicit recovery keeps a live child fenced and releases only after confirmed exit without adopting output',async()=>{
 const f=fixture(),child=spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{windowsHide:true,stdio:'ignore'});
 const id='lost-native-owner',retained=path.join(f.folder,'quarantined.mp4');fs.writeFileSync(retained,'retained untrusted output');
 try {
  await once(child,'spawn');
  const directory=path.join(f.project.paths.cacheFolder,'library-jobs',id+'-fixture');fs.mkdirSync(directory,{recursive:true});
  const runtimeStateFile=path.join(directory,'runtime-state.json'),runtime={schemaVersion:1,jobId:id,projectFolder:f.project.projectFolder,ownerToken:'lost-owner-token',ownerPid:2147483000,stage:'native child running',item:0,count:1,childPid:child.pid,updatedAt:new Date().toISOString()};
  fs.writeFileSync(runtimeStateFile,JSON.stringify(runtime),{flag:'wx'});
  f.store.transact(f.project,d=>d.jobs.push({id,kind:'variant',assetId:f.id,state:'running',ownerPid:2147483000,childPid:null,snapshot:{projectFolder:f.project.projectFolder,cacheFolder:f.project.paths.cacheFolder,outputDirectory:directory,runtimeStateFile,ownerToken:runtime.ownerToken,source:{path:f.source},sampleTime:0},outputs:[{kind:'media',path:retained,mime:'video/mp4'}]}));
  const interrupted=f.jobs.status(f.project).jobs.find(j=>j.id===id);
  assert.equal(interrupted.state,'interrupted');assert.equal(interrupted.recoveryRequired,true);assert.equal(interrupted.childPid,child.pid,'lost-child inspection must use owned runtime, not stale catalog childPid');
  assert.equal(typeof f.jobs.recover,'function','explicit safe recovery API required');
  assert.throws(()=>f.jobs.recover(f.project,{jobId:id,expectedEtag:f.store.read(f.project).etag}),e=>e.statusCode===409&&/child|pid|alive|inspection/i.test(e.message));
  process.kill(child.pid,0);assert.equal(f.jobs.hasBlockingJobs(f.project),true);
  for(const bad of [{ownerToken:'foreign-token'},{jobId:'foreign-job'},{projectFolder:path.join(f.folder,'foreign-project')},{state:'succeeded'}]) {
   fs.writeFileSync(runtimeStateFile,JSON.stringify({...runtime,...bad}));
   assert.throws(()=>f.jobs.recover(f.project,{jobId:id,expectedEtag:f.store.read(f.project).etag}),e=>e.statusCode===409&&/runtime|binding|inspection/i.test(e.message));
   assert.equal(f.jobs.status(f.project).jobs.find(j=>j.id===id).state,'interrupted');
  }
  fs.unlinkSync(runtimeStateFile);
  assert.throws(()=>f.jobs.recover(f.project,{jobId:id,expectedEtag:f.store.read(f.project).etag}),/runtime|inspection/i);
  fs.writeFileSync(runtimeStateFile,JSON.stringify(runtime));
  const exited=once(child,'exit');child.kill();await exited;
  assert.equal(f.jobs.status(f.project).jobs.find(j=>j.id===id).recoveryRequired,true,'status must not silently adopt recovery');
  assert.throws(()=>f.jobs.recover(f.project,{jobId:id}),/etag/i);
  assert.throws(()=>f.jobs.recover(f.project,{jobId:id,expectedEtag:'obsolete'}),/etag|stale/i);
  const recovered=await f.jobs.recover(f.project,{jobId:id,expectedEtag:f.store.read(f.project).etag});
  const record=recovered.catalog.jobs.find(j=>j.id===id);
  assert.equal(recovered.result.jobId,id);assert.equal(record.state,'interrupted');assert.equal(record.recoveryRequired,false);
  assert.equal(record.outputs,undefined);assert.equal(fs.readFileSync(retained,'utf8'),'retained untrusted output');
  assert.equal(f.jobs.hasBlockingJobs(f.project),false);
  assert.throws(()=>f.jobs.resolveMedia(f.project,{jobId:id,kind:'media'}),/unavailable/);
  const retry=await f.jobs.retry(f.project,{jobId:id,expectedEtag:f.store.read(f.project).etag});
  assert.notEqual(retry.result.jobId,id);assert.equal((await wait(f,retry.result.jobId)).state,'succeeded');
  f.store.transact(f.project,d=>{const j=d.jobs.find(j=>j.id===id);j.snapshot.projectFolder=path.join(f.folder,'foreign-project');j.recoveryRequired=true;});
  assert.throws(()=>f.jobs.recover(f.project,{jobId:id,expectedEtag:f.store.read(f.project).etag}),/foreign|ownership|another project/i);
 }finally {if(child.exitCode===null&&child.signalCode===null){const exited=once(child,'exit');child.kill();await exited;}await f.jobs.close();}
});
test('real-store variant pins its validated output identity and rejects same-size and truncated tampering',async()=>{
 const f=fixture(),before=sha(f.source);
 try {
  const r=await start(f,{kind:'variant',assetId:f.id}),done=await wait(f,r.result.jobId);
  assert.equal(done.state,'succeeded',done.error);
  const entry=done.outputs.find(o=>o.kind==='media'),pin=entry.fingerprint;
  assert.deepEqual(pin,{...fingerprint(entry.path),sha256:sha(entry.path)});
  const variant=f.store.read(f.project).assets.find(a=>a.id===f.id).variants[0];
  assert.deepEqual(variant.outputFingerprint,pin);
  assert.equal(f.jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'}).path,entry.path);
  const original=fs.readFileSync(entry.path),changed=Buffer.from(original);changed[changed.length-1]^=1;
  fs.writeFileSync(entry.path,changed);
  assert.throws(()=>f.jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'}),e=>e.statusCode===409&&/changed|integrity|fingerprint/i.test(e.message));
  fs.writeFileSync(entry.path,Buffer.alloc(25));
  assert.throws(()=>f.jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'}),e=>e.statusCode===409);
  assert.equal(sha(f.source),before);
  assert.equal(f.store.read(f.project).assets.find(a=>a.id===f.id).sourceFingerprint.sha256,before);
 }finally {await f.jobs.close();}
});
