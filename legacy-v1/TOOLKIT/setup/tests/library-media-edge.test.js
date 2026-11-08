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
function native(command,args,{binary=false}={}) {
  const result=spawnSync(command,args,{encoding:binary?undefined:'utf8',windowsHide:true,timeout:120000,maxBuffer:16*1024*1024});
  if(result.status!==0)throw Object.assign(new Error(`Native process failed (${result.status}): ${result.error?.message||result.stderr?.toString()||''}`),{nativeExit:result.status});
  return {stdout:result.stdout,stderr:result.stderr,exitCode:result.status};
}
const sha=file=>crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
function contextFor(folder,calls=[]) {
  const allocated=new Set();
  return {output(name){const output=path.join(folder,name);assert.ok(!allocated.has(output));assert.ok(!fs.existsSync(output));allocated.add(output);fs.mkdirSync(path.dirname(output),{recursive:true});return output;},stage(){},async run(command,args){calls.push({command,args});return native(command,args);}};
}

test('renderer exposes genuine status diagnostic and native exit when its PowerShell process rejects',async()=>{
  const folder=fs.mkdtempSync(path.join(root,'diagnostic-')),media=new LibraryMedia({installRoot});
  media.probe=async()=>({width:160,height:120,duration:1.6,hasAudio:true});
  const original=new Error('Native process failed (1): '),status={success:false,ffmpegExit:-1073740940,diagnostic:'native report: heap corruption',audioRepair:'STRONG'};
  const context=contextFor(folder);
  context.run=async()=>{fs.writeFileSync(path.join(folder,'status.json'),'\uFEFF'+JSON.stringify(status));throw original;};
  await assert.rejects(media.render(path.join(folder,'source.mp4'),recipe({audioRepair:'STRONG'}),context),error=>{
    assert.match(error.message,/heap corruption/);assert.match(error.message,/-1073740940/);
    assert.equal(error.cause,original);assert.equal(error.ffmpegExit,status.ffmpegExit);return true;
  });
});

test('renderer preserves transport failure when status is absent, malformed or reports success',async()=>{
  for(const report of [null,'not JSON','null','42','[]','{}',JSON.stringify({success:true,ffmpegExit:0})]) {
    const folder=fs.mkdtempSync(path.join(root,'transport-')),media=new LibraryMedia({installRoot}),original=new Error('Cancelled');
    media.probe=async()=>({width:160,height:120,duration:1.6,hasAudio:true});
    const context=contextFor(folder);context.run=async()=>{if(report!==null)fs.writeFileSync(path.join(folder,'status.json'),report);throw original;};
    await assert.rejects(media.render(path.join(folder,'source.mp4'),recipe(),context),error=>error===original);
  }
});

test('native trimmed composite succeeds with Unicode install, source, cache, temp and output paths plus filenames',async t=>{
  const folder=fs.mkdtempSync(path.join(root,'unicode-'));
  const project=path.join(folder,"Projet café 雪 [literal] & apostrophe's"),sourceRoot=path.join(project,'Sources média 雪'),cacheRoot=path.join(project,'CACHE','caché 雪'),compositeRoot=path.join(project,'Composités 雪'),tempRoot=path.join(project,'Temporaire 雪'),unicodeInstall=path.join(project,'Application 雪');
  for(const dir of [sourceRoot,cacheRoot,compositeRoot,tempRoot])fs.mkdirSync(dir,{recursive:true});
  const engines=['TOOLKIT/studio/Render-StudioPreview.ps1','TOOLKIT/Build-RetroCartComposite.ps1'];
  const engineHashes=engines.map(file=>sha(path.join(installRoot,file)));
  for(const file of engines){const destination=path.join(unicodeInstall,file);fs.mkdirSync(path.dirname(destination),{recursive:true});fs.copyFileSync(path.join(installRoot,file),destination,fs.constants.COPYFILE_EXCL);}
  const oldEnv=Object.fromEntries(['TEMP','TMP','TMPDIR'].map(key=>[key,process.env[key]]));
  for(const key of Object.keys(oldEnv))process.env[key]=tempRoot;
  const calls=[];
  try {
    const sources=[path.join(sourceRoot,"Épisode 雪 [1] & l'été.mp4"),path.join(sourceRoot,'Épisode 雪 [2].mp4')];
    for(const [index,source]of sources.entries())native('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i',`sine=frequency=${index?660:440}:sample_rate=44100`,'-t','1.6','-vf','setsar=8/9','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
    const originals=sources.map(sha),snapshot={group:{id:'unicode',name:'Émission 雪',revision:2},parts:sources.map(source=>({source:fingerprint(source),recipe:recipe({trimStartSeconds:0.2,trimEndSeconds:0.1})}))},before=structuredClone(snapshot);
    const context=contextFor(cacheRoot,calls),baseOutput=context.output;
    context.output=name=>{
      const unicodeName=name.replace(/([^/]+)$/,value=>'dérivé 雪 '+value);
      if(name==='composite.mp4'||name.startsWith('normalized/')){
        const target=path.join(compositeRoot,unicodeName);assert.ok(!fs.existsSync(target));fs.mkdirSync(path.dirname(target),{recursive:true});return target;
      }
      return baseOutput(unicodeName);
    };
    let result,error;
    try {result=await new LibraryMedia({installRoot:unicodeInstall}).composite(snapshot,context);}catch(e){error=e;}
    const recipeFile=path.join(cacheRoot,'dérivé 雪 composite-recipe.json');
    const report={folder,calls,error:error?.message,result};
    fs.writeFileSync(path.join(folder,'unicode-evidence.json'),JSON.stringify(report,null,2));t.diagnostic('Unicode evidence: '+path.join(folder,'unicode-evidence.json'));
    assert.deepEqual(sources.map(sha),originals);assert.deepEqual(snapshot,before);
    assert.deepEqual(engines.map(file=>sha(path.join(installRoot,file))),engineHashes);
    assert.deepEqual(engines.map(file=>sha(path.join(unicodeInstall,file))),engineHashes);
    assert.equal(fs.readFileSync(recipeFile).subarray(0,3).toString('hex'),'efbbbf','PowerShell 5.1 must recognize UTF-8 recipe data');
    assert.ifError(error);
    const measured=JSON.parse(native('ffprobe',['-v','error','-show_streams','-show_format','-of','json',result.media.path]).stdout),v=measured.streams.find(s=>s.codec_type==='video'),a=measured.streams.find(s=>s.codec_type==='audio');
    assert.deepEqual([v.width,v.height,v.r_frame_rate,v.avg_frame_rate,v.pix_fmt,v.sample_aspect_ratio],[618,480,'30/1','30/1','yuv420p','1:1']);
    assert.deepEqual([a.codec_name,a.sample_rate,a.channels],['aac','44100',2]);assert.ok(Math.abs(Number(measured.format.duration)-2.6)<0.15);
    const decoded=native('ffmpeg',['-v','error','-xerror','-i',result.media.path,'-map','0:v:0','-map','0:a:0','-f','null','-']);
    assert.equal(v.codec_name,'h264');assert.equal(decoded.stderr,'');
    const toneEvidence=[];
    for(const [index,time]of [0.4,1.8].entries()) {
      const bytes=native('ffmpeg',['-v','error','-ss',String(time),'-i',result.media.path,'-t','0.25','-vn','-ac','1','-ar','8000','-f','f32le','-'],{binary:true}).stdout;
      const energy=frequency=>{let real=0,imaginary=0;for(let i=0;i<bytes.length/4;i++){const phase=2*Math.PI*frequency*i/8000,sample=bytes.readFloatLE(i*4);real+=sample*Math.cos(phase);imaginary+=sample*Math.sin(phase);}return real*real+imaginary*imaginary;};
      assert.ok(bytes.length>=8000);const wanted=energy(index?660:440),other=energy(index?440:660);assert.ok(wanted>other*20,'Unicode pipeline must retain original audio order');toneEvidence.push({time,wanted,other});
    }
    const recipeData=JSON.parse(fs.readFileSync(recipeFile,'utf8').replace(/^\uFEFF/,''));assert.equal(recipeData.Jobs[0].Name,'Émission 雪');
    const remuxCalls=calls.filter(call=>call.args.includes('-map_metadata'));
    assert.deepEqual(remuxCalls.map(call=>call.args[call.args.indexOf('-i')+1]),recipeData.Jobs[0].Parts,'only prepared derived files may be remuxed');
    assert.equal(calls.filter(call=>call.args.includes('-RecipePath')).length,0,'bypass only the legacy ASCII concat boundary');
    const renderCalls=calls.filter(call=>call.args.includes('-AudioRepair'));assert.equal(renderCalls.length,3);assert.deepEqual(renderCalls.slice(0,2).map(call=>call.args[call.args.indexOf('-Source')+1]),sources);
    assert.equal(renderCalls[2].args[renderCalls[2].args.indexOf('-AudioRepair')+1],'NONE');
    Object.assign(report,{measured,fullDecodeExit:decoded.exitCode,toneEvidence,originals,engineHashes});fs.writeFileSync(path.join(folder,'unicode-evidence.json'),JSON.stringify(report,null,2));
  } finally {for(const [key,value]of Object.entries(oldEnv)){if(value===undefined)delete process.env[key];else process.env[key]=value;}}
});

test('native legacy composer reads Unicode prepared paths from BOM-marked recipe with ASCII output staging',async t=>{
  const folder=fs.mkdtempSync(path.join(root,'json-boundary-')),cache=path.join(folder,'CACHE caché 雪'),destination=path.join(folder,'composites'),source=path.join(folder,'Épisode 雪.mp4'),calls=[];
  native('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1.6','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac',source]);
  const original=sha(source),context=contextFor(cache,calls),allocate=context.output;
  context.output=name=>{
    if(name==='composite.mp4'||name.startsWith('normalized/')){const file=path.join(destination,name);assert.ok(!fs.existsSync(file));fs.mkdirSync(path.dirname(file),{recursive:true});return file;}
    return allocate(name);
  };
  const snapshot={group:{id:'json-boundary',name:'Émission 雪',revision:1},parts:[0,1].map(()=>({source:fingerprint(source),recipe:recipe({trimStartSeconds:0.1,trimEndSeconds:0.1})}))};
  const media=new LibraryMedia({installRoot}),result=await media.composite(snapshot,context);
  assert.equal(calls.filter(call=>call.args.includes('-RecipePath')).length,1,'the unchanged composer must actually read the recipe');
  const bytes=fs.readFileSync(path.join(cache,'composite-recipe.json'));assert.equal(bytes.subarray(0,3).toString('hex'),'efbbbf');
  const measured=await media.probe(result.media.path,context);media.validateOutput(measured,2.8);
  const decoded=native('ffmpeg',['-v','error','-xerror','-i',result.media.path,'-map','0:v:0','-map','0:a:0','-f','null','-']);
  assert.equal(sha(source),original);
  fs.writeFileSync(path.join(folder,'json-boundary-evidence.json'),JSON.stringify({calls,result,measured,fullDecodeExit:decoded.exitCode,original},null,2));t.diagnostic('JSON boundary evidence: '+path.join(folder,'json-boundary-evidence.json'));
});

test('native repair levels render the original or expose genuine STRONG backend failure without fallback',async t=>{
  const folder=fs.mkdtempSync(path.join(root,'profiles-')),source=path.join(folder,'original.mp4'),calls=[];
  native('ffmpeg',['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','1.6','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source]);
  const original={fingerprint:fingerprint(source),sha256:sha(source)},engine=path.join(installRoot,'TOOLKIT/studio/Render-StudioPreview.ps1'),engineHash=sha(engine),results=[];
  const media=new LibraryMedia({installRoot});
  for(const level of ['NONE','RESTORE','STRONG','AGGRESSIVE','MAX']) {
    const outputRoot=path.join(folder,level),context=contextFor(outputRoot,calls);let result,error;
    try {result=await media.render(source,recipe({audioRepair:level}),context);}catch(e){error=e;}
    const status=JSON.parse(fs.readFileSync(path.join(outputRoot,'status.json'),'utf8').replace(/^\uFEFF/,''));
    results.push({level,result,error:error?.message,status});
    fs.writeFileSync(path.join(folder,'profiles-evidence.json'),JSON.stringify({folder,original,engineHash,results,calls},null,2));
    if(error) {
      assert.equal(level,'STRONG','no other repair level is expected to fail on this installed backend');
      assert.equal(status.success,false);assert.notEqual(status.ffmpegExit,0);
      assert.equal(error.ffmpegExit,status.ffmpegExit);assert.ok(error.message.includes(String(status.ffmpegExit)));assert.ok(status.diagnostic.length>0);assert.ok(error.message.includes(status.diagnostic));
      assert.ok(error.cause.message.includes('Native process failed (1)'));assert.ok(!fs.existsSync(path.join(outputRoot,'media.mp4')));
      t.diagnostic(`STRONG remains blocked on installed FFmpeg: ${status.ffmpegExit}; no weaker filter was substituted`);
    } else {
      assert.equal(status.success,true);assert.equal(status.audioRepair,level);
      const measured=await media.probe(result.media.path,context);media.validateOutput(measured,1.6);
      native('ffmpeg',['-v','error','-xerror','-i',result.media.path,'-map','0:v:0','-map','0:a:0','-f','null','-']);
    }
  }
  const renderCalls=calls.filter(call=>call.args.includes('-AudioRepair'));
  assert.equal(renderCalls.length,5,'each level gets exactly one native renderer invocation, without retries/fallback');
  assert.deepEqual(renderCalls.map(call=>call.args[call.args.indexOf('-AudioRepair')+1]),['NONE','RESTORE','STRONG','AGGRESSIVE','MAX']);
  for(const call of renderCalls)assert.equal(call.args[call.args.indexOf('-Source')+1],source);
  assert.deepEqual({fingerprint:fingerprint(source),sha256:sha(source)},original);assert.equal(sha(engine),engineHash);
  t.diagnostic('Repair evidence: '+path.join(folder,'profiles-evidence.json'));
});

