'use strict';
// Standalone checked media adapter. Importing this module never launches Studio.
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {resolveBackend,backendEnvironment}=require('./library-backend');
function fault(message,statusCode=400) { return Object.assign(new Error(message),{statusCode}); }
function checkedPath(value,{directory=false}={}) {
  if(typeof value!=='string'||!path.isAbsolute(value)||/^[\\/]{2}|[\x00-\x1f\x7f]/.test(value)) throw fault('Expected a local absolute native path');
  const components=value.slice(path.parse(value).root.length).split(/[\\/]/);
  if(components.some(c=>c&&(/[<>:"|?*]/.test(c)||/[. ]$/.test(c)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(c)))) throw fault('Unsafe path component');
  const target=path.resolve(value);
  for(let p=target;;p=path.dirname(p)) {
    let stat; try {stat=fs.lstatSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}
    if(stat) {
      if(stat.isSymbolicLink()) throw fault('Reparse/symlink/junction path rejected: '+p);
      if((p!==target||directory)&&!stat.isDirectory())throw fault('Expected directory: '+p);
    }
    if(path.dirname(p)===p)break;
  }
  return target;
}
function fingerprint(source) {
  const p=checkedPath(source),s=fs.statSync(p,{bigint:true});
  if(!s.isFile())throw fault('Source is not a regular file');
  return {path:p,size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),dev:String(s.dev),ino:String(s.ino)};
}
async function contentFingerprint(source,check=()=>{}) {
  const before=fingerprint(source),hash=crypto.createHash('sha256');
  const stream=fs.createReadStream(checkedPath(source),{highWaterMark:1024*1024});
  for await(const chunk of stream){check();hash.update(chunk);await new Promise(resolve=>setImmediate(resolve));}
  check();if(JSON.stringify(fingerprint(source))!==JSON.stringify(before))throw fault('Source changed during fingerprint',409);
  const stat=fs.statSync(source);
  return {size:stat.size,mtimeMs:stat.mtimeMs,sha256:hash.digest('hex')};
}
const digest=value=>crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
class LibraryMedia {
  constructor({installRoot,ffmpeg,ffprobe,powershell='powershell.exe'}={}) {
    this.backend=ffmpeg===undefined&&ffprobe===undefined&&installRoot?resolveBackend(installRoot):{mode:'path',ffmpeg:'ffmpeg',ffprobe:'ffprobe',binDirectory:'',description:'Explicit test/compatibility tool overrides'};
    Object.assign(this,{installRoot,ffmpeg:ffmpeg??this.backend.ffmpeg,ffprobe:ffprobe??this.backend.ffprobe,powershell});
  }
  environment(scratchDir){return backendEnvironment(this.backend,{scratchDir});}
  filter(recipe,{source=false}={}) {
    const correction="scale='max(2,trunc(iw*sar/2)*2)':ih,setsar=1";
    if(source)return correction;
    const w=recipe.cropLeft+recipe.cropRight,h=recipe.cropTop+recipe.cropBottom;
    return (w+h?`crop=iw-${w}:ih-${h}:${recipe.cropLeft}:${recipe.cropTop},`:'')+correction+',scale=618:480:force_original_aspect_ratio=decrease:force_divisible_by=2,pad=618:480:(ow-iw)/2:(oh-ih)/2:black,setsar=1,fps=30';
  }
  validateRecipe(recipe,profile) {
    if(!recipe||!Number.isInteger(recipe.revision)||recipe.revision<1)throw fault('Invalid recipe revision');
    for(const field of ['trimStartSeconds','trimEndSeconds'])if(!Number.isFinite(recipe[field])||recipe[field]<0)throw fault('Invalid trim seconds');
    for(const field of ['cropLeft','cropRight','cropTop','cropBottom'])if(!Number.isInteger(recipe[field])||recipe[field]<0)throw fault('Crop requires integer original coded pixels');
    if(recipe.cropLeft+recipe.cropRight>profile.width-2||recipe.cropTop+recipe.cropBottom>profile.height-2)throw fault('Crop leaves no usable picture');
    if(!['NONE','RESTORE','STRONG','AGGRESSIVE','MAX'].includes(recipe.audioRepair))throw fault('Unknown audio repair');
    if(recipe.audioRepair!=='NONE'&&!profile.hasAudio)throw fault('Audio repair requires original audio');
    const duration=profile.duration-recipe.trimStartSeconds-recipe.trimEndSeconds;
    if(!(duration>0.1))throw fault('Trim must leave more than 0.1 seconds');
    return duration;
  }
  async render(source,recipe,context) {
    const profile=await this.probe(source,context),duration=this.validateRecipe(recipe,profile);
    const output=context.output('media.mp4'),status=context.output('status.json'),progress=context.output('progress.txt');
    let processError;
    try {
      await context.run(this.powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(this.installRoot,'TOOLKIT','studio','Render-StudioPreview.ps1'),'-Source',source,'-Output',output,'-StatusFile',status,'-ProgressFile',progress,'-StartSeconds',String(recipe.trimStartSeconds),'-DurationSeconds',String(duration),'-CropLeft',String(recipe.cropLeft),'-CropRight',String(recipe.cropRight),'-CropTop',String(recipe.cropTop),'-CropBottom',String(recipe.cropBottom),'-AudioRepair',recipe.audioRepair,...(!profile.hasAudio?['-NoAudio']:[])]);
    } catch(error) { processError=error; }
    let report;
    try { report=JSON.parse(fs.readFileSync(checkedPath(status),'utf8').replace(/^\uFEFF/,'')); }
    catch(error) { throw processError||error; }
    if(report?.success===false)throw Object.assign(fault(`Renderer failed (FFmpeg exit ${report.ffmpegExit}): ${report.diagnostic||'No renderer diagnostic'}`),{ffmpegExit:report.ffmpegExit,...(processError?{cause:processError}:{})});
    // A success status cannot override cancellation or another transport failure.
    if(processError)throw processError;
    if(report?.success!==true)throw fault('Renderer returned an invalid success status');
    const result=await this.probe(output,context);this.validateOutput(result,duration);
    return {media:{path:output,mime:'video/mp4'},technical:technical(result)};
  }
  validateOutput(profile,duration) {
    const v=profile._streams.find(s=>s.codec_type==='video'),a=profile._streams.find(s=>s.codec_type==='audio');
    if(profile.width!==618||profile.height!==480||v.codec_name!=='h264'||v.pix_fmt!=='yuv420p'||v.sample_aspect_ratio!=='1:1'||Number(v.r_frame_rate?.split('/')[0])/Number(v.r_frame_rate?.split('/')[1])!==30||!a||a.codec_name!=='aac'||a.channels!==2||Number(a.sample_rate)!==44100)throw fault('Output failed normalized broadcast profile validation');
    if(Math.abs(profile.duration-duration)>Math.max(0.15,duration*0.03))throw fault('Output duration differs from reserved recipe');
  }
  async frame(source,recipe,kind,sampleTime,context) {
    const profile=await this.probe(source,context),sourceFrame=kind==='source-frame';
    const duration=sourceFrame?profile.duration:this.validateRecipe(recipe,profile);
    if(sampleTime>=duration)throw fault('Sample time is outside effective video duration');
    const output=context.output('frame.jpg');
    await context.run(this.ffmpeg,['-v','error','-nostdin','-n','-ss',String(sampleTime+(sourceFrame?0:recipe.trimStartSeconds)),'-i',source,'-an','-vf',this.filter(recipe,{source:sourceFrame}),'-frames:v','1','-q:v','2',output]);
    const st=fs.statSync(checkedPath(output));if(st.size<4)throw fault('Frame output is empty');
    const raw=await context.run(this.ffprobe,['-v','error','-show_streams','-of','json',output]);
    const v=JSON.parse(raw.stdout).streams?.[0];if(v?.codec_name!=='mjpeg'||(!sourceFrame&&(v.width!==618||v.height!==480)))throw fault('Invalid JPEG frame');
    return {frame:{path:output,mime:'image/jpeg'}};
  }
  async composite(snapshot,context) {
    // Preflight every original before rendering any part. Silent constituents are not composites.
    const profiles=[];
    for(const part of snapshot.parts) {
      const profile=await this.probe(part.source.path,context);
      if(!profile.hasAudio)throw fault('Every composite part requires original video and audio');
      this.validateRecipe(part.recipe,profile);profiles.push(profile);
    }
    const prepared=[];let duration=0;
    for(const [index,part] of snapshot.parts.entries()) {
      context.stage('prepare part '+(index+1),index);
      const result=await this.render(part.source.path,part.recipe,{...context,output:name=>context.output('part-'+index+'/'+name)});
      prepared.push(result.media.path);duration+=profiles[index].duration-part.recipe.trimStartSeconds-part.recipe.trimEndSeconds;
    }
    context.stage('combine prepared parts',snapshot.parts.length);
    const output=context.output('composite.mp4'),recipePath=context.output('composite-recipe.json');
    // Windows PowerShell 5.1 Get-Content otherwise interprets UTF-8 as ACP.
    fs.writeFileSync(recipePath,'\uFEFF'+JSON.stringify({Name:snapshot.group.name,Jobs:[{Name:snapshot.group.name,Mode:'Auto',Parts:prepared,Output:output}]}),{flag:'wx'});
    if(/[^\x20-\x7e]/.test(output)) {
      // The legacy CopyOnly composer writes absolute concat paths as ASCII.
      // Reuse exactly its primary-stream MKV remux + stream-copy concat here,
      // changing only list encoding; never alias/copy an original source.
      // All prepared inputs have already passed the same strict output profile.
      const remuxed=[];
      for(const [index,part] of prepared.entries()) {
        const temporary=context.output('concat/part-'+index+'.mkv');
        await context.run(this.ffmpeg,['-hide_banner','-loglevel','warning','-nostdin','-n','-i',part,'-map','0:v:0','-map','0:a:0','-map_metadata','-1','-c','copy',temporary]);
        remuxed.push(temporary);
      }
      const list=context.output('concat/concat.txt');
      const escape=value=>value.replace(/\\/g,'/').replace(/'/g,"'\\''");
      fs.writeFileSync(list,'ffconcat version 1.0\n'+remuxed.map(file=>`file '${escape(file)}'`).join('\n')+'\n',{flag:'wx',encoding:'utf8'});
      await context.run(this.ffmpeg,['-hide_banner','-loglevel','warning','-nostdin','-n','-f','concat','-safe','0','-i',list,'-map','0:v:0','-map','0:a:0','-c','copy',output]);
    } else {
      await context.run(this.powershell,['-NoProfile','-NonInteractive','-ExecutionPolicy','Bypass','-File',path.join(this.installRoot,'TOOLKIT','Build-RetroCartComposite.ps1'),'-RecipePath',recipePath,'-FFmpeg',this.ffmpeg,'-FFprobe',this.ffprobe]);
    }
    // Auto's stream-copy remux can quantize video timestamps via MKV even when
    // every prepared part is 30 fps. Re-establish the broadcast cadence using
    // the unchanged renderer; parts already carry their original crop/repair.
    context.stage('normalize composite',snapshot.parts.length);
    const normalized=await this.render(output,{revision:1,trimStartSeconds:0,trimEndSeconds:0,cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,audioRepair:'NONE'},{...context,output:name=>context.output('normalized/'+name)});
    const result=await this.probe(normalized.media.path,context);this.validateOutput(result,duration);
    return {media:normalized.media,technical:technical(result),groupRevision:snapshot.group.revision};
  }
  async cropDetect(source,sampleTime,context) {
    const profile=await this.probe(source,context);
    if(sampleTime>=profile.duration)throw fault('Sample time is outside original video duration');
    const result=await context.run(this.ffmpeg,['-hide_banner','-loglevel','info','-nostdin','-ss',String(sampleTime),'-i',source,'-t',String(Math.min(8,profile.duration-sampleTime)),'-an','-vf','cropdetect=24:2:0','-f','null','-']);
    const proposals=new Map();
    for(const match of result.stderr.matchAll(/crop=(\d+):(\d+):(\d+):(\d+)/g)) {
      const [width,height,left,top]=match.slice(1).map(Number);
      const right=profile.width-width-left,bottom=profile.height-height-top;
      if(width>=2&&height>=2&&[left,top,right,bottom].every(n=>Number.isInteger(n)&&n>=0)) {
        const value={cropLeft:left,cropRight:right,cropTop:top,cropBottom:bottom};proposals.set(JSON.stringify(value),value);
      }
    }
    return {cropProposals:[...proposals.values()],advisory:true};
  }
  async probe(source,context) {
    checkedPath(source);
    const raw=await context.run(this.ffprobe,['-v','error','-show_streams','-show_format','-of','json',source]);
    const parsed=JSON.parse(raw.stdout),v=parsed.streams?.find(s=>s.codec_type==='video'),a=parsed.streams?.find(s=>s.codec_type==='audio');
    const duration=Number(parsed.format?.duration || v?.duration);
    if(!v || !(duration>0) || !Number.isFinite(duration) || !(v.width>0&&v.height>0))throw fault('No valid measured video/duration');
    return {duration,width:v.width,height:v.height,sar:v.sample_aspect_ratio||'1:1',hasAudio:!!a,videoCodec:v.codec_name,...(a?{audioCodec:a.codec_name}:{}),_streams:parsed.streams};
  }
}
const technical=profile=>Object.fromEntries(Object.entries(profile).filter(([key])=>!key.startsWith('_')));
module.exports={LibraryMedia,checkedPath,fingerprint,contentFingerprint,digest,fault,technical};
