'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawnSync}=require('node:child_process');
const {LibraryMedia,fingerprint}=require('../library-media');
const root=process.env.RETRO_TV_TEST_ROOT;
assert.ok(root&&path.isAbsolute(root),'Explicit disposable RETRO_TV_TEST_ROOT required');
fs.mkdirSync(root,{recursive:true});
for(const key of ['TEMP','TMP','TMPDIR'])process.env[key]=root;
const installRoot=path.resolve(__dirname,'../../..');
const recipe=values=>({revision:1,trimStartSeconds:0,trimEndSeconds:0,cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,audioRepair:'NONE',...values});
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function native(command,args,{binary=false}={}) {
  const result=spawnSync(command,args,{encoding:binary?undefined:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024,env:{...process.env,TEMP:root,TMP:root,TMPDIR:root}});
  assert.equal(result.status,0,result.error?.message||result.stderr?.toString());
  return {stdout:result.stdout,stderr:result.stderr};
}
const probe=file=>JSON.parse(native('ffprobe',['-v','error','-show_streams','-show_format','-of','json',file]).stdout);
function normalized(measured,duration) {
  const video=measured.streams.find(s=>s.codec_type==='video'),audio=measured.streams.find(s=>s.codec_type==='audio');
  assert.equal(video.codec_name,'h264');assert.equal(video.width,618);assert.equal(video.height,480);
  assert.equal(video.pix_fmt,'yuv420p');assert.equal(video.sample_aspect_ratio,'1:1');assert.equal(video.r_frame_rate,'30/1');assert.equal(video.avg_frame_rate,'30/1');
  assert.equal(audio.codec_name,'aac');assert.equal(audio.sample_rate,'44100');assert.equal(audio.channels,2);
  assert.ok(Math.abs(Number(measured.format.duration)-duration)<=Math.max(0.15,duration*0.03));
}
function gray(file,time) {
  return native('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-frames:v','1','-pix_fmt','gray','-f','rawvideo','-'],{binary:true}).stdout;
}
function pictureBounds(bytes) {
  assert.equal(bytes.length,618*480);
  const columns=[];
  for(let x=0;x<618;x++) {
    let sum=0;for(let y=0;y<480;y++)sum+=bytes[y*618+x];
    if(sum/480>12)columns.push(x);
  }
  return [columns[0],columns.at(-1)];
}
function tone(file,time) {
  const bytes=native('ffmpeg',['-v','error','-ss',String(time),'-i',file,'-t','0.25','-vn','-ac','1','-ar','8000','-f','f32le','-'],{binary:true}).stdout;
  assert.ok(bytes.length>=8000/4*4,'audio segment must be present');
  const samples=Array.from({length:bytes.length/4},(_,i)=>bytes.readFloatLE(i*4));
  return frequency=>{
    let real=0,imaginary=0;
    for(let i=0;i<samples.length;i++){const phase=2*Math.PI*frequency*i/8000;real+=samples[i]*Math.cos(phase);imaginary+=samples[i]*Math.sin(phase);}
    return real*real+imaginary*imaginary;
  };
}
test('native composite keeps trimmed RESTORE + NONE non-square-SAR parts in the strict broadcast profile',async t=>{
  fs.mkdirSync(root,{recursive:true});
  const folder=fs.mkdtempSync(path.join(root,'native-'));
  const engineFiles=['TOOLKIT/studio/Render-StudioPreview.ps1','TOOLKIT/Build-RetroCartComposite.ps1'].map(file=>path.join(installRoot,file));
  const engineHashes=engineFiles.map(sha);
  const sources=[path.join(folder,'Alpha [literal].mp4'),path.join(folder,'Beta.mp4')];
  for(const [index,source] of sources.entries())native('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=320x240:rate=30','-f','lavfi','-i',`sine=frequency=${index?660:440}:sample_rate=44100`,'-t',index?'2':'3','-vf','setsar=8/9','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
  const originals=sources.map(file=>({fingerprint:fingerprint(file),sha256:sha(file)}));
  const snapshot={group:{id:'saved-group',name:'Ordered native fixture',revision:3,parts:[{assetId:'alpha',recipeRevision:2},{assetId:'beta',recipeRevision:1}]},parts:sources.map((source,index)=>({assetId:index?'beta':'alpha',source:fingerprint(source),recipe:recipe(index?{}:{revision:2,trimStartSeconds:0.2,trimEndSeconds:0.1,cropLeft:2,audioRepair:'RESTORE'})}))};
  const before=structuredClone(snapshot),calls=[],stages=[],outputs=new Set();
  const context={
    output(name){const file=path.join(folder,'job',name);assert.ok(!outputs.has(file),'output allocation must be unique');assert.ok(!fs.existsSync(file),'must not overwrite historical output');outputs.add(file);fs.mkdirSync(path.dirname(file),{recursive:true});return file;},
    stage(...stage){stages.push(stage);},
    async run(command,args){calls.push({command,args});return native(command,args);}
  };
  const media=new LibraryMedia({installRoot});
  let result,error;
  try {result=await media.composite(snapshot,context);}catch(e){error=e;}
  const recipeCall=calls.find(call=>call.args.includes('-RecipePath'));
  assert.ok(recipeCall,'unchanged native composer must execute');
  const assembly=JSON.parse(fs.readFileSync(recipeCall.args[recipeCall.args.indexOf('-RecipePath')+1],'utf8').replace(/^\uFEFF/,'')).Jobs[0];
  const prepared=assembly.Parts.map(probe),assembled=probe(assembly.Output);
  const evidence={folder,prepared,assembled,final:result?probe(result.media.path):undefined,stages,calls,error:error?.message};
  fs.writeFileSync(path.join(folder,'evidence.json'),JSON.stringify(evidence,null,2),{flag:'wx'});
  t.diagnostic('native evidence: '+path.join(folder,'evidence.json'));
  assert.deepEqual(snapshot,before,'group/source/recipe pins must remain original');
  assert.deepEqual(sources.map(file=>({fingerprint:fingerprint(file),sha256:sha(file)})),originals);
  assert.deepEqual(engineFiles.map(sha),engineHashes,'standalone native engines must remain byte-identical');
  normalized(prepared[0],2.7);normalized(prepared[1],2);
  assert.ifError(error);
  const measured=probe(result.media.path);normalized(measured,4.7);
  assert.equal(result.groupRevision,3);assert.equal(result.media.mime,'video/mp4');
  const decoded=native('ffmpeg',['-v','error','-xerror','-i',result.media.path,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  assert.equal(decoded.stderr,'','full video/audio decode must be clean');
  for(const [index,time] of [0.5,3.2].entries()) {
    const expected=gray(assembly.Parts[index],0.5),actual=gray(result.media.path,time);
    assert.deepEqual(pictureBounds(actual),pictureBounds(expected),'no second crop, SAR correction or fitting distortion');
    let difference=0;for(let i=0;i<actual.length;i++)difference+=Math.abs(actual[i]-expected[i]);
    assert.ok(difference/actual.length<8,'ordered frame must match prepared coded crop/SAR geometry');
    const energy=tone(result.media.path,time),wanted=index?660:440,other=index?440:660;
    assert.ok(energy(wanted)>energy(other)*20,'saved part order and original audio must survive assembly');
  }
  const rendererCalls=calls.filter(call=>call.args.includes(path.join(installRoot,'TOOLKIT','studio','Render-StudioPreview.ps1')));
  assert.equal(rendererCalls.length,3,'prepare each original once, then normalize the assembled output');
  assert.equal(rendererCalls.filter(call=>call.args[call.args.indexOf('-AudioRepair')+1]==='RESTORE').length,1,'repair only the original once');
  for(const call of rendererCalls.slice(2)) {
    assert.equal(call.args[call.args.indexOf('-Source')+1],assembly.Output);
    for(const field of ['-StartSeconds','-CropLeft','-CropRight','-CropTop','-CropBottom'])assert.equal(call.args[call.args.indexOf(field)+1],'0');
    assert.equal(call.args[call.args.indexOf('-AudioRepair')+1],'NONE');
  }
  // Keep the validator strict: neither the reproduced cadence nor Normalize's 48k audio is admissible.
  const profile=await media.probe(result.media.path,context);
  for(const change of [{r_frame_rate:'120/1'},{sample_rate:'48000'}]) {
    const invalid=structuredClone(profile),type=change.sample_rate?'audio':'video';Object.assign(invalid._streams.find(s=>s.codec_type===type),change);
    assert.throws(()=>media.validateOutput(invalid,4.7),/normalized broadcast profile/);
  }
  assert.throws(()=>media.validateOutput({...profile,duration:5.5},4.7),/duration/);
});

test('real managed composite publishes trimmed ordered media with every configured project root Unicode',async t=>{
  const {ProjectStore}=require('../project-store'),{LibraryStore}=require('../library-store'),{LibraryJobs}=require('../library-jobs');
  fs.mkdirSync(root,{recursive:true});
  const folder=fs.mkdtempSync(path.join(root,'managed-unicode-')),projectFolder=path.join(folder,'Projet 雪'),sourcesFolder=path.join(folder,'Sources café 雪'),cacheFolder=path.join(projectFolder,'CACHE','caché 雪'),compositeFolder=path.join(folder,'Composités 雪'),buildsFolder=path.join(folder,'Builds 雪');
  fs.mkdirSync(sourcesFolder,{recursive:true});
  const projects=new ProjectStore({installRoot,appDataDir:path.join(folder,'Appdata 雪')}),project=projects.confirm(projects.preview({operation:'create',name:'Unicode native composite',projectFolder,paths:{cacheFolder,compositeFolder,buildsFolder,libraryFolders:[sourcesFolder]}}).token);
  const store=new LibraryStore({installRoot}),act=(operation,payload)=>store.apply(project,{expectedEtag:store.read(project).etag,operation,payload});
  const sources=[path.join(sourcesFolder,"Épisode 雪 [1] & l'été.mp4"),path.join(sourcesFolder,'Épisode 雪 [2].mp4')],parts=[];
  for(const [index,source]of sources.entries()) {
    native('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i',`sine=frequency=${index?660:440}:sample_rate=44100`,'-t','1.6','-vf','setsar=8/9','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
    const id=act('register-asset',{path:source}).result.assetId;
    const probeJobs=new LibraryJobs({store,installRoot});
    try {
      const started=await probeJobs.start(project,{expectedEtag:store.read(project).etag,kind:'probe',assetId:id}),end=Date.now()+30000;let done;
      while(Date.now()<end){done=probeJobs.status(project).jobs.find(j=>j.id===started.result.jobId);if(!['queued','running','cancel-requested'].includes(done.state))break;await new Promise(resolve=>setTimeout(resolve,25));}
      assert.equal(done.state,'succeeded',done.error);
    } finally {await probeJobs.close();}
    act('save-recipe',{assetId:id,values:{trimStartSeconds:0.2,trimEndSeconds:0.1,audioRepair:index?'NONE':'RESTORE'}});
    parts.push({assetId:id,recipeRevision:store.read(project).assets.find(a=>a.id===id).recipe.revision});
  }
  const originals=sources.map(file=>({fingerprint:fingerprint(file),sha256:sha(file)})),groupId=act('save-group',{name:'Émission 雪',parts}).result.groupId,jobs=new LibraryJobs({store,installRoot});
  try {
    const started=await jobs.start(project,{expectedEtag:store.read(project).etag,kind:'composite',groupId});
    const end=Date.now()+120000;let done;
    while(Date.now()<end){done=jobs.status(project).jobs.find(j=>j.id===started.result.jobId);if(!['queued','running','cancel-requested'].includes(done.state))break;await new Promise(resolve=>setTimeout(resolve,25));}
    fs.writeFileSync(path.join(folder,'managed-unicode-evidence.json'),JSON.stringify({project,done},null,2));
    assert.equal(done.state,'succeeded',done.error);
    const output=jobs.resolveMedia(project,{jobId:done.id,kind:'media'});assert.ok(output.path.startsWith(compositeFolder));
    assert.ok(done.snapshot.outputDirectory.startsWith(cacheFolder));
    const measured=probe(output.path);normalized(measured,2.6);
    const decoded=native('ffmpeg',['-v','error','-xerror','-i',output.path,'-map','0:v:0','-map','0:a:0','-f','null','-']);assert.equal(decoded.stderr,'');
    for(const [index,time]of [0.4,1.8].entries()){const energy=tone(output.path,time);assert.ok(energy(index?660:440)>energy(index?440:660)*20);}
    assert.deepEqual(sources.map(file=>({fingerprint:fingerprint(file),sha256:sha(file)})),originals);
    fs.writeFileSync(path.join(folder,'managed-unicode-evidence.json'),JSON.stringify({project,done,output,measured,fullDecodeStderr:decoded.stderr,originals},null,2));
    t.diagnostic('Managed Unicode evidence: '+path.join(folder,'managed-unicode-evidence.json'));
  } finally {await jobs.close();}
});
