'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const {spawnSync} = require('node:child_process');
const root = process.env.RETRO_TV_TEST_ROOT;
assert.ok(root && path.isAbsolute(root), 'Set RETRO_TV_TEST_ROOT to an explicit disposable scratch directory.');
const installRoot = path.resolve(__dirname, '../../..');
let counter=0;
test('preview uses original trim/coded crop recipe through real PowerShell and frame geometry matches',async()=>{
  const f=fixture(),jobs=api(f);
  f.store.transact(f.project,d=>{d.assets[0].recipe=recipe({trimStartSeconds:0.2,trimEndSeconds:0.2,cropLeft:9,cropRight:7,cropTop:3,cropBottom:5});});
  try {
    const preview=await start(jobs,f,{kind:'preview',assetId:'asset-a'});
    const done=await wait(jobs,f.project,preview.result.jobId);
    assert.equal(done.state,'succeeded',done.error);
    const output=jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'});
    const measured=JSON.parse(native('ffprobe',['-v','error','-show_streams','-show_format','-of','json',output.path]));
    const video=measured.streams.find(s=>s.codec_type==='video'),audio=measured.streams.find(s=>s.codec_type==='audio');
    assert.equal(video.width,618);assert.equal(video.height,480);assert.equal(video.sample_aspect_ratio,'1:1');assert.equal(video.r_frame_rate,'30/1');assert.equal(video.pix_fmt,'yuv420p');
    assert.equal(audio.codec_name,'aac');assert.equal(audio.channels,2);assert.equal(audio.sample_rate,'44100');
    assert.ok(Math.abs(Number(measured.format.duration)-1.2)<0.12);
    native('ffmpeg',['-v','error','-i',output.path,'-f','null','-']);
    for(const kind of ['source-frame','final-frame']) {
      const response=await start(jobs,f,{kind,assetId:'asset-a',sampleTime:0.4});
      const frame=await wait(jobs,f.project,response.result.jobId);
      assert.equal(frame.state,'succeeded',frame.error);
      const resolved=jobs.resolveMedia(f.project,{jobId:frame.id,kind:'frame'});
      assert.equal(resolved.mime,'image/jpeg');
      assert.deepEqual(frame.outputs[0].fingerprint,{...require('../library-media').fingerprint(resolved.path),sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(resolved.path)).digest('hex')});
      const p=JSON.parse(native('ffprobe',['-v','error','-show_streams','-of','json',resolved.path]));
      assert.equal(p.streams[0].width,kind==='source-frame'?320:618);
      assert.equal(p.streams[0].height,kind==='source-frame'?120:480);
      assert.equal(frame.snapshot.sampleTime,0.4);
      if(kind==='final-frame') {
        const decoded=mediaPath=>{const r=spawnSync('ffmpeg',['-v','error',...(mediaPath===output.path?['-ss','0.4']:[]),'-i',mediaPath,'-frames:v','1','-pix_fmt','gray','-f','rawvideo','-'],{windowsHide:true,maxBuffer:4*1024*1024});assert.equal(r.status,0,r.stderr.toString());return r.stdout;};
        const jpeg=decoded(resolved.path),videoFrame=decoded(output.path);assert.equal(jpeg.length,618*480);assert.equal(videoFrame.length,jpeg.length);
        let error=0;for(let i=0;i<jpeg.length;i++)error+=Math.abs(jpeg[i]-videoFrame[i]);
        assert.ok(error/jpeg.length<8,'final JPEG must match actual video crop/SAR/chroma geometry');
        const bounds=bytes=>{const rows=[];for(let y=0;y<480;y++){let sum=0;for(let x=0;x<618;x++)sum+=bytes[y*618+x];if(sum/618>12)rows.push(y);}return [rows[0],rows.at(-1)];};
        assert.deepEqual(bounds(jpeg),bounds(videoFrame));assert.ok(bounds(jpeg)[0]>100,'2:1 SAR must fit wide picture, not stretch both dimensions');
      }
    }
    assert.equal(jobs.resolveMedia(f.project,{assetId:'asset-a',kind:'source'}).path,path.resolve(f.source));
    assert.throws(()=>jobs.resolveMedia(f.project,{jobId:done.id,kind:'../../source'}));
  }finally {await jobs.close();}
});
const recipe = (values={}) => ({revision:1,trimStartSeconds:0,trimEndSeconds:0,cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,audioRepair:'NONE',...values});
function native(command,args) {
  const r=spawnSync(command,args,{encoding:'utf8',windowsHide:true,env:{...process.env,TEMP:root,TMP:root,TMPDIR:root}});
  assert.equal(r.status,0,r.error?.message || r.stderr); return r.stdout;
}
function fixture() {
  fs.mkdirSync(root,{recursive:true});
  const folder=fs.mkdtempSync(path.join(root,'case-'));
  const project={projectFolder:folder,readOnly:false,kind:'managed',paths:{cacheFolder:path.join(folder,'CACHE'),compositeFolder:path.join(folder,'composites'),libraryFolders:[]}};
  fs.mkdirSync(project.paths.cacheFolder); fs.mkdirSync(project.paths.compositeFolder);
  const source=path.join(folder,'source [literal].mp4');
  native('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1.6','-vf','setsar=2/1','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',source]);
  const asset={id:'asset-a',name:'Human name',category:'Other',subtype:'',classificationByCategory:{},pools:[],network:'Unassigned',show:'',notes:'human notes remain',date:{mode:'Unknown',value:''},health:'UNREVIEWED',reason:'',path:source,locationId:'',missing:false,family:'asset-a',sourceId:'',variantOf:'',technical:null,recipe:recipe(),recipeHistory:[],variants:[],legacy:{Notes:'provenance'},uses:[]};
  let doc={schemaVersion:1,revision:0,assets:[asset],locations:[],networks:[],selectionPools:[],groups:[],jobs:[],warnings:[]};
  const snapshot=()=>({...structuredClone(doc),etag:String(doc.revision),projectFolder:folder,readOnly:false});
  const store={read:()=>snapshot(),transact(p,callback,{expectedEtag}={}) {
    assert.equal(p.projectFolder,folder);
    if(expectedEtag!==undefined && expectedEtag!==String(doc.revision)) throw Object.assign(new Error('Stale etag'),{statusCode:409});
    const next=structuredClone(doc); const result=callback(next); next.revision++; doc=next;
    return {catalog:snapshot(),result};
  }};
  return {project,store,source,folder,asset};
}
function api(f,options={}) {
  const modulePath=path.join(__dirname,'../library-jobs.js');
  assert.ok(fs.existsSync(modulePath),'asset-level LibraryJobs implementation is missing');
  const {LibraryJobs}=require(modulePath);
  return new LibraryJobs({store:f.store,installRoot,...options});
}
async function wait(jobs,project,id) {
  const deadline=Date.now()+120000;
  while(Date.now()<deadline) {
    const job=jobs.status(project).jobs.find(j=>j.id===id);
    if(!['queued','running','cancel-requested'].includes(job.state)) return job;
    await new Promise(r=>setTimeout(r,25));
  }
  throw new Error('Job did not settle');
}
async function start(jobs,f,input) { return jobs.start(f.project,{expectedEtag:f.store.read(f.project).etag,...input}); }
test('durable reservations reject duplicates across instances, cancel reaps owned native tree, retry is a new job',async()=>{
  const f=fixture(),jobs=api(f),other=api(f);
  try {
    const response=await start(jobs,f,{kind:'preview',assetId:'asset-a'});
    await assert.rejects(()=>start(other,f,{kind:'preview',assetId:'asset-a'}),/Duplicate/);
    const cancelled=await other.cancel(f.project,response.result.jobId);
    assert.equal(cancelled.catalog.jobs.find(j=>j.id===response.result.jobId).state,'cancelled');
    assert.equal(jobs.running.size,0);
    const retry=await other.retry(f.project,{jobId:response.result.jobId,expectedEtag:f.store.read(f.project).etag});
    assert.notEqual(retry.result.jobId,response.result.jobId);
    assert.equal((await wait(other,f.project,retry.result.jobId)).state,'succeeded');
    await assert.rejects(()=>start(jobs,f,{kind:'probe',assetId:'asset-a',unexpected:'bad'}),/Unknown/);
    await assert.rejects(()=>jobs.start(f.project,{kind:'probe',assetId:'asset-a'}),/etag/i);
  }finally {await jobs.close();await other.close();}
});
test('recipe edits during render are allowed and stale completion cannot publish output',async()=>{
  const f=fixture(),jobs=api(f);
  try {
    const response=await start(jobs,f,{kind:'preview',assetId:'asset-a'});
    assert.equal(jobs.hasBlockingJobs(f.project),false);
    f.store.transact(f.project,d=>{d.assets[0].recipe=recipe({revision:2,cropLeft:4});d.assets[0].notes='edited during preview';});
    const done=await wait(jobs,f.project,response.result.jobId);
    assert.equal(done.state,'stale');assert.equal(done.outputs,undefined);
    assert.throws(()=>jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'}),/unavailable/);
    assert.equal(f.store.read(f.project).assets[0].notes,'edited during preview');
  }finally {await jobs.close();}
});
test('all five repair variants process the same original, normalize NONE, and retain immutable history',async()=>{
  const f=fixture(),jobs=api(f),hash=()=>require('node:crypto').createHash('sha256').update(fs.readFileSync(f.source)).digest('hex');
  const before=hash(),paths=[];
  try {
    for(const [index,audioRepair] of ['NONE','RESTORE','STRONG','AGGRESSIVE','MAX'].entries()) {
      f.store.transact(f.project,d=>{d.assets[0].recipe=recipe({revision:index+1,audioRepair});});
      const r=await start(jobs,f,{kind:'variant',assetId:'asset-a'}),done=await wait(jobs,f.project,r.result.jobId);
      assert.equal(done.state,'succeeded',done.error);assert.equal(done.snapshot.source.path,path.resolve(f.source));
      const output=jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'});paths.push(output.path);
      native('ffmpeg',['-v','error','-i',output.path,'-f','null','-']);
    }
    assert.equal(new Set(paths).size,5);assert.equal(hash(),before);
    const variants=f.store.read(f.project).assets[0].variants;
    assert.equal(variants.length,5);assert.deepEqual(variants.map(v=>v.recipe.audioRepair),['NONE','RESTORE','STRONG','AGGRESSIVE','MAX']);
    for(const p of paths)assert.ok(fs.statSync(p).size>1000);
  }finally {await jobs.close();}
});
test('missing original audio permits normalized silence only with NONE; invalid coded crop/trim fails',async()=>{
  const f=fixture(),jobs=api(f);
  const silent=path.join(f.folder,'silent.mp4');
  native('ffmpeg',['-v','error','-i',f.source,'-an','-c:v','copy','-y',silent]);
  f.store.transact(f.project,d=>{d.assets[0].path=silent;});
  try {
    let r=await start(jobs,f,{kind:'preview',assetId:'asset-a'});assert.equal((await wait(jobs,f.project,r.result.jobId)).state,'succeeded');
    for(const values of [{audioRepair:'RESTORE'},{cropLeft:0.25},{trimStartSeconds:2}]) {
      f.store.transact(f.project,d=>{d.assets[0].recipe=recipe(values);});
      r=await start(jobs,f,{kind:'preview',assetId:'asset-a'});const done=await wait(jobs,f.project,r.result.jobId);
      assert.equal(done.state,'failed');assert.equal(done.outputs,undefined);
    }
  }finally {await jobs.close();}
});
test('crop detection returns a measured advisory without saving recipe or notes',async()=>{
  const f=fixture(),jobs=api(f),before=f.store.read(f.project).assets[0];
  try {
    const r=await start(jobs,f,{kind:'crop-detect',assetId:'asset-a',sampleTime:0.1});const done=await wait(jobs,f.project,r.result.jobId);
    assert.equal(done.state,'succeeded',done.error);assert.ok(Array.isArray(done.result.cropProposals));
    assert.deepEqual(f.store.read(f.project).assets[0],before);
  }finally {await jobs.close();}
});
test('composite prepares pinned recipes then invokes real unchanged composer in saved order with unique output',async()=>{
  const f=fixture(),jobs=api(f),second=path.join(f.folder,'blue.mp4');
  native('ffmpeg',['-v','error','-f','lavfi','-i','color=c=blue:s=160x120:r=30','-f','lavfi','-i','sine=frequency=880:sample_rate=44100','-t','1.6','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',second]);
  f.store.transact(f.project,d=>{d.assets.push({...structuredClone(d.assets[0]),id:'asset-b',path:second,recipe:recipe({trimStartSeconds:0.2,trimEndSeconds:0.2})});d.groups.push({id:'group-a',name:'Ordered group',revision:1,parts:[{assetId:'asset-b',recipeRevision:1},{assetId:'asset-a',recipeRevision:1}],history:[]});});
  try {
    const paths=[];
    for(let i=0;i<2;i++) {
      const r=await start(jobs,f,{kind:'composite',groupId:'group-a'}),done=await wait(jobs,f.project,r.result.jobId);
      assert.equal(done.state,'succeeded',done.error);assert.equal(done.count,2);
      assert.deepEqual(done.snapshot.parts.map(p=>p.assetId),['asset-b','asset-a']);
      const output=jobs.resolveMedia(f.project,{jobId:done.id,kind:'media'});paths.push(output.path);
      assert.ok(output.path.startsWith(f.project.paths.compositeFolder),'durable composites must honor the configured composite folder');
      assert.deepEqual(done.outputs[0].fingerprint,{...require('../library-media').fingerprint(output.path),sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(output.path)).digest('hex')});
      assert.ok(Math.abs(done.result.technical.duration-2.8)<0.15);
      native('ffmpeg',['-v','error','-i',output.path,'-f','null','-']);
      const frame=spawnSync('ffmpeg',['-v','error','-ss','0.2','-i',output.path,'-vf','crop=2:2:308:238,format=rgb24','-frames:v','1','-f','rawvideo','-'],{windowsHide:true});
      assert.equal(frame.status,0,frame.stderr?.toString());assert.ok(frame.stdout[2]>200&&frame.stdout[0]<30,'blue part must be first');
    }
    assert.notEqual(paths[0],paths[1]);assert.ok(fs.existsSync(paths[0]));
    f.store.transact(f.project,d=>{d.assets[0].recipe.revision=2;});
    await assert.rejects(()=>start(jobs,f,{kind:'composite',groupId:'group-a'}),/pin|revision/i);
  }finally {await jobs.close();}
});
test('bounded asynchronous location scan registers stable paths without inventing editorial fields and retains metadata on rescan',async()=>{
  const f=fixture(),jobs=api(f),location=path.join(f.folder,'library');fs.mkdirSync(location);
  const candidate=path.join(location,'CN_1999_food.mp4');fs.copyFileSync(f.source,candidate);
  f.store.transact(f.project,d=>{d.locations.push({id:'location-a',path:location,removed:false});});
  try {
    let r=await start(jobs,f,{kind:'scan',locationId:'location-a'});
    assert.equal(r.catalog.jobs.find(j=>j.id===r.result.jobId).count,0,'discovery count is indeterminate until enumerated');
    let done=await wait(jobs,f.project,r.result.jobId);
    assert.equal(done.state,'succeeded',done.error);assert.equal(done.count,1);assert.equal(done.item,1);
    let asset=f.store.read(f.project).assets.find(a=>a.path===path.resolve(candidate));
    assert.ok(asset);const id=asset.id;
    assert.equal(asset.category,'Other');assert.equal(asset.network,'Unassigned');assert.deepEqual(asset.pools,[]);assert.equal(asset.notes,'');assert.deepEqual(asset.legacy,{});assert.equal(asset.date.mode,'Unknown');assert.equal(asset.health,'UNREVIEWED');
    assert.equal(asset.technical.width,160);
    f.store.transact(f.project,d=>{const a=d.assets.find(a=>a.id===id);a.notes='explicit human';a.category='Commercial';a.pools=['MANUAL'];});
    r=await start(jobs,f,{kind:'scan',locationId:'location-a'});done=await wait(jobs,f.project,r.result.jobId);assert.equal(done.state,'succeeded',done.error);
    assert.equal(f.store.read(f.project).assets.length,2);asset=f.store.read(f.project).assets.find(a=>a.id===id);
    assert.equal(asset.notes,'explicit human');assert.equal(asset.category,'Commercial');assert.deepEqual(asset.pools,['MANUAL']);
    fs.unlinkSync(candidate);
    r=await start(jobs,f,{kind:'scan',locationId:'location-a'});done=await wait(jobs,f.project,r.result.jobId);assert.equal(done.state,'succeeded',done.error);
    assert.equal(f.store.read(f.project).assets.find(a=>a.id===id).missing,true);
  }finally {await jobs.close();}
});
test('lost owner recovery is interrupted rather than success and never serves quarantined output',async()=>{
  const f=fixture(),jobs=api(f);
  f.store.transact(f.project,d=>{d.jobs.push({id:'lost-job',kind:'variant',assetId:'asset-a',state:'running',stage:'rendering',item:0,count:1,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),ownerPid:2147483000,snapshot:{projectFolder:f.project.projectFolder,source:{path:f.source},recipe:recipe()},outputs:{media:{path:f.source,mime:'video/mp4'}}});});
  try {
    const job=jobs.status(f.project).jobs.find(j=>j.id==='lost-job');
    assert.equal(job.state,'interrupted');assert.equal(job.outputs,undefined);assert.match(job.error,/owner|interrupt/i);
    assert.throws(()=>jobs.resolveMedia(f.project,{jobId:job.id,kind:'media'}),/unavailable/);
    const retry=await jobs.retry(f.project,{jobId:job.id,expectedEtag:f.store.read(f.project).etag});
    assert.equal((await wait(jobs,f.project,retry.result.jobId)).state,'succeeded');
  }finally {await jobs.close();}
});
test('scan bounds and junction rejection publish no partial registrations; cancellation yields promptly',async()=>{
  for(const mode of ['count','depth','junction','cancel']) {
    const f=fixture(),location=path.join(f.folder,'library');fs.mkdirSync(location);
    f.store.transact(f.project,d=>{d.locations.push({id:'location-a',path:location,removed:false});});
    if(mode==='count')for(let i=0;i<2;i++)fs.copyFileSync(f.source,path.join(location,i+'.mp4'));
    if(mode==='depth')fs.mkdirSync(path.join(location,'one','two'),{recursive:true});
    if(mode==='junction')fs.symlinkSync(f.folder,path.join(location,'unsafe'),'junction');
    if(mode==='cancel')for(let i=0;i<100;i++)fs.writeFileSync(path.join(location,i+'.txt'),'non-media');
    const jobs=api(f,{scanMaxFiles:1,scanMaxDepth:1});
    try {
      const r=await start(jobs,f,{kind:'scan',locationId:'location-a'});
      if(mode==='cancel')await jobs.cancel(f.project,r.result.jobId);
      const done=await wait(jobs,f.project,r.result.jobId);
      assert.equal(done.state,mode==='cancel'?'cancelled':'failed',done.error);
      assert.equal(f.store.read(f.project).assets.length,1);
    }finally {await jobs.close();}
  }
});
test('close cancels/reaps native work and missing executables remain genuine failed jobs',async()=>{
  const f=fixture(),jobs=api(f);
  const r=await start(jobs,f,{kind:'preview',assetId:'asset-a'});await jobs.close();
  assert.equal(jobs.status(f.project).jobs.find(j=>j.id===r.result.jobId).state,'cancelled');assert.equal(jobs.running.size,0);
  await assert.rejects(()=>start(jobs,f,{kind:'probe',assetId:'asset-a'}),/closed/);
  const broken=api(f,{ffprobe:'C:/does-not-exist/ffprobe.exe'});
  try {const bad=await start(broken,f,{kind:'probe',assetId:'asset-a'});const done=await wait(broken,f.project,bad.result.jobId);assert.equal(done.state,'failed');assert.match(done.error,/ENOENT/);}finally{await broken.close();}
});
test('shared DOC18 seam reserves synchronously, captures caller context, returns array outputs and exact content fingerprints',async()=>{
  const f=fixture(),jobs=api(f),context=structuredClone(f.project);
  const input={expectedEtag:f.store.read(f.project).etag,kind:'variant',assetId:'asset-a'};
  try {
    const pending=jobs.start(context,input);
    const queued=f.store.read(f.project).jobs[0];assert.equal(queued.state,'queued');
    context.paths.cacheFolder=path.join(f.folder,'mutated');input.assetId='not-registered';
    const r=await pending,done=await wait(jobs,f.project,r.result.jobId);
    assert.equal(done.state,'succeeded',done.error);
    assert.ok(Array.isArray(done.outputs));assert.equal(done.outputs[0].kind,'media');assert.equal(done.outputs[0].mime,'video/mp4');
    assert.ok(done.outputs[0].path.startsWith(f.project.paths.cacheFolder));
    assert.equal(done.result.technical.width,618);
    const expected={size:fs.statSync(f.source).size,mtimeMs:fs.statSync(f.source).mtimeMs,sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(f.source)).digest('hex')};
    const asset=f.store.read(f.project).assets[0];assert.deepEqual(asset.sourceFingerprint,expected);
    const variant=asset.variants[0];assert.deepEqual(variant.sourceFingerprint,expected);assert.equal(variant.ready,true);assert.equal(variant.mime,'video/mp4');assert.equal(variant.duration,done.result.technical.duration);
  }finally{await jobs.close();}
});
test('real running PowerShell/FFmpeg child tree is stopped before cancellation is terminal',async()=>{
  const f=fixture(),jobs=api(f),long=path.join(f.folder,'long.mp4');
  native('ffmpeg',['-v','error','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','90','-c:v','libx264','-preset','ultrafast','-c:a','aac','-y',long]);
  f.store.transact(f.project,d=>{d.assets[0].path=long;});
  try {
    const r=await start(jobs,f,{kind:'preview',assetId:'asset-a'}),deadline=Date.now()+20000;
    let childPid;
    while(Date.now()<deadline) {
      const handle=jobs.running.get(r.result.jobId),progress=handle?.dir&&path.join(handle.dir,'progress.txt');
      if(handle?.child&&progress&&fs.existsSync(progress)&&fs.statSync(progress).size>0){childPid=handle.child.pid;break;}
      await new Promise(resolve=>setTimeout(resolve,10));
    }
    assert.ok(childPid,'real renderer must reach FFmpeg progress before cancellation');
    assert.equal(jobs.status(f.project).jobs.find(j=>j.id===r.result.jobId).childPid,childPid,'status must merge the owned runtime PID while native work is live');
    const childInfo=JSON.parse(native('powershell.exe',['-NoProfile','-NonInteractive','-Command',`@(Get-CimInstance Win32_Process -Filter 'ParentProcessId=${childPid}' | Select-Object ProcessId,Name) | ConvertTo-Json -Compress`]));
    const children=Array.isArray(childInfo)?childInfo:[childInfo];assert.ok(children.some(p=>/ffmpeg/i.test(p.Name)));
    const result=await jobs.cancel(f.project,r.result.jobId);assert.equal(result.catalog.jobs.find(j=>j.id===r.result.jobId).state,'cancelled');
    for(const pid of [childPid,...children.map(p=>p.ProcessId)])assert.throws(()=>process.kill(pid,0),/ESRCH/);
  }finally{await jobs.close();}
});
test('composite definition changes make old completion stale and missing-audio constituents fail',async()=>{
  const f=fixture(),jobs=api(f);
  f.store.transact(f.project,d=>{d.groups.push({id:'group-a',name:'Group',revision:1,parts:[{assetId:'asset-a',recipeRevision:1},{assetId:'asset-a',recipeRevision:1}],history:[]});});
  try {
    const r=await start(jobs,f,{kind:'composite',groupId:'group-a'});
    f.store.transact(f.project,d=>{d.groups[0].revision=2;d.groups[0].name='Changed definition';});
    const done=await wait(jobs,f.project,r.result.jobId);assert.equal(done.state,'stale');assert.equal(done.outputs,undefined);
    const silent=path.join(f.folder,'silent.mp4');native('ffmpeg',['-v','error','-i',f.source,'-an','-c:v','copy','-y',silent]);
    f.store.transact(f.project,d=>{d.assets[0].path=silent;});
    const bad=await start(jobs,f,{kind:'composite',groupId:'group-a'}),failed=await wait(jobs,f.project,bad.result.jobId);assert.equal(failed.state,'failed');assert.match(failed.error,/original video and audio/);
  }finally{await jobs.close();}
});
test('settings/source changes during jobs fail stale and owned output guards reject registered-path collision',async()=>{
  for(const change of ['settings','source','collision']) {
    const f=fixture(),jobs=api(f);
    try {
      if(change==='collision') {
        const transact=f.store.transact;
        f.store.transact=(p,fn,options)=>transact(p,d=>{const result=fn(d),job=d.jobs.find(j=>j.state==='running'&&j.snapshot.outputDirectory);if(job&&!d.assets.some(a=>a.id==='collision'))d.assets.push({...structuredClone(d.assets[0]),id:'collision',path:path.join(job.snapshot.outputDirectory,'media.mp4')});return result;},options);
      }
      const r=await start(jobs,f,{kind:'preview',assetId:'asset-a'});
      if(change==='settings')fs.writeFileSync(path.join(f.folder,'retro-project.json'),'changed settings');
      if(change==='source')fs.utimesSync(f.source,new Date(),new Date(Date.now()+10000));
      const done=await wait(jobs,f.project,r.result.jobId);
      assert.equal(done.state,change==='collision'?'failed':'stale',done.error);assert.equal(done.outputs,undefined);
      if(change==='collision')assert.match(done.error,/collision/i);
    }finally{await jobs.close();}
  }
});
test('shutdown still kills owned native children if lifecycle persistence becomes unavailable',async()=>{
  const f=fixture(),jobs=api(f),original=f.store.transact;let childPid;
  try {
    const r=await start(jobs,f,{kind:'preview',assetId:'asset-a'}),deadline=Date.now()+10000;
    while(Date.now()<deadline) {
      const child=jobs.running.get(r.result.jobId)?.child;
      if(child&&/powershell/i.test(child.spawnfile)){childPid=child.pid;break;}
      await new Promise(resolve=>setTimeout(resolve,5));
    }
    assert.ok(childPid);
    f.store.transact=()=>{throw new Error('Synthetic catalog publication failure');};
    await assert.rejects(()=>jobs.close(),/publication failure|persist/i);
    assert.throws(()=>process.kill(childPid,0),/ESRCH/);
    assert.equal(jobs.running.size,0);
  }finally{f.store.transact=original;await jobs.close().catch(()=>{});}
});
test('copied job history cannot block, cancel, retry or adopt the original worker, but completed references remain pinned',async()=>{
  const f=fixture(),copy=fixture(),multi={read:p=>(p.projectFolder===f.project.projectFolder?f.store:copy.store).read(p),transact:(p,...args)=>(p.projectFolder===f.project.projectFolder?f.store:copy.store).transact(p,...args)},jobs=api(f,{store:multi});
  try {
    const pending=start(jobs,f,{kind:'variant',assetId:'asset-a'});
    const original=f.store.read(f.project);
    copy.store.transact(copy.project,d=>{d.assets=structuredClone(original.assets);d.jobs=structuredClone(original.jobs);});
    assert.equal(jobs.hasBlockingJobs(copy.project),false);
    const r=await pending;
    await assert.rejects(()=>jobs.cancel(copy.project,r.result.jobId),/foreign|ownership|another project/i);
    await assert.rejects(()=>jobs.retry(copy.project,{jobId:r.result.jobId,expectedEtag:copy.store.read(copy.project).etag}),/foreign|ownership|another project/i);
    assert.equal((await wait(jobs,f.project,r.result.jobId)).state,'succeeded');
    copy.store.transact(copy.project,d=>{d.jobs=structuredClone(f.store.read(f.project).jobs);});
    const pinned=jobs.resolveMedia(copy.project,{jobId:r.result.jobId,kind:'media'});assert.ok(fs.existsSync(pinned.path));
  }finally{await jobs.close();}
});
test('real probe persists measured observations and leaves human metadata intact',async()=>{
  const f=fixture(), jobs=api(f);
  try {
    const response=await start(jobs,f,{kind:'probe',assetId:'asset-a'});
    assert.equal(typeof response.result.jobId,'string');
    const done=await wait(jobs,f.project,response.result.jobId);
    assert.equal(done.state,'succeeded',done.error);
    const saved=f.store.read(f.project).assets[0];
    assert.equal(saved.technical.width,160); assert.equal(saved.technical.sar,'2:1');
    assert.equal(saved.technical.hasAudio,true); assert.ok(saved.technical.duration>1.5);
    assert.equal(saved.notes,'human notes remain'); assert.deepEqual(saved.legacy,{Notes:'provenance'});
    assert.equal(jobs.hasBlockingJobs(f.project),false);
    assert.ok(done.createdAt && done.updatedAt && done.snapshot);
  } finally {await jobs.close();}
});
