'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {spawn}=require('node:child_process');
const {LibraryMedia,checkedPath,fingerprint,contentFingerprint,digest,fault,technical}=require('./library-media');
const ACTIVE=new Set(['queued','running','cancel-requested']);
const BLOCKING=new Set(['probe','scan','variant','composite']);
const now=()=>new Date().toISOString();
class LibraryJobs {
  constructor({store,installRoot,scanMaxFiles=10000,scanMaxDepth=32,scanMaxEntries=50000,...tools}) {
    if(!store?.read||!store?.transact)throw fault('LibraryStore read/transact required');
    this.scanLimits={files:scanMaxFiles,depth:scanMaxDepth,entries:scanMaxEntries};
    for(const n of Object.values(this.scanLimits))if(!Number.isSafeInteger(n)||n<1)throw fault('Invalid scan limit');
    this.store=store;this.media=new LibraryMedia({installRoot,...tools});this.running=new Map();this.closed=false;this.persistenceErrors=[];this.closePromise=null;this.ownerToken=crypto.randomUUID();
  }
  owns(project,job) {return typeof job?.snapshot?.projectFolder==='string'&&path.resolve(job.snapshot.projectFolder).toLowerCase()===path.resolve(project.projectFolder).toLowerCase();}
  reserved(project,job) {return this.owns(project,job)&&(ACTIVE.has(job.state)||(job.state==='interrupted'&&job.recoveryRequired));}
  jobState(project) {
    // Compatibility for old injected test stores only; production has a narrow,
    // synchronous fresh read with no derived uses/media/etag work.
    return this.store.readJobState?this.store.readJobState(project):this.store.read(project);
  }
  runtimePath(project,job) {
    if(!this.owns(project,job))throw fault('Foreign runtime ownership',409);
    const s=job.snapshot,directory=checkedPath(s.outputDirectory,{directory:true}),file=checkedPath(s.runtimeStateFile);
    const base=path.join(checkedPath(s.cacheFolder,{directory:true}),'library-jobs');
    if(path.dirname(directory).toLowerCase()!==base.toLowerCase()||!path.basename(directory).startsWith(job.id+'-')||file!==path.join(directory,'runtime-state.json'))throw fault('Unsafe owned runtime state',409);
    return file;
  }
  readRuntime(project,job) {
    if(!job.snapshot?.runtimeStateFile)return null; // Legacy persisted childPid.
    try {
      const file=this.runtimePath(project,job),stat=fs.statSync(file);
      if(!stat.isFile()||stat.size>65536)throw fault('Invalid runtime file');
      const r=JSON.parse(fs.readFileSync(file,'utf8'));
      if(!r||Object.keys(r).some(k=>!['schemaVersion','jobId','projectFolder','ownerToken','ownerPid','stage','item','count','childPid','updatedAt'].includes(k))||r.schemaVersion!==1||r.jobId!==job.id||r.projectFolder!==job.snapshot.projectFolder||!job.snapshot.ownerToken||r.ownerToken!==job.snapshot.ownerToken||r.ownerPid!==job.ownerPid||typeof r.stage!=='string'||r.stage.length>1000||!Number.isSafeInteger(r.item)||!Number.isSafeInteger(r.count)||r.item<0||r.count<r.item||!(r.childPid===null||Number.isSafeInteger(r.childPid)&&r.childPid>0)||typeof r.updatedAt!=='string'||Number.isNaN(Date.parse(r.updatedAt)))throw fault('Invalid runtime binding/progress');
      return r;
    }catch(e){throw fault('Owned runtime inspection unavailable: '+e.message,409);}
  }
  progress(handle,change,{initial=false}={}) {
    const file=this.runtimePath(handle.project,handle.job);
    if(!initial)this.readRuntime(handle.project,handle.job);
    const current=handle.progress||{stage:handle.job.kind,item:0,count:handle.job.count,childPid:null};
    const value={schemaVersion:1,jobId:handle.id,projectFolder:handle.job.snapshot.projectFolder,ownerToken:handle.job.snapshot.ownerToken,ownerPid:handle.job.ownerPid,stage:current.stage,item:current.item,count:current.count,childPid:current.childPid,...change,updatedAt:now()};
    if(initial)fs.writeFileSync(file,JSON.stringify(value),{flag:'wx'});
    else {
      const staged=checkedPath(path.join(path.dirname(file),'runtime-'+crypto.randomUUID()+'.json'));
      try {fs.writeFileSync(staged,JSON.stringify(value),{flag:'wx'});fs.renameSync(staged,file);}
      finally {if(fs.existsSync(staged))fs.unlinkSync(staged);}
    }
    handle.progress=value;
  }
  status(project) {
    let catalog=this.jobState(project);
    const alive=pid=>{if(!Number.isSafeInteger(pid)||pid<1)return false;try{process.kill(pid,0);return true;}catch(e){return e.code!=='ESRCH';}};
    if(!catalog.readOnly&&catalog.jobs.some(j=>this.owns(project,j)&&ACTIVE.has(j.state)&&!alive(j.ownerPid))) {
      catalog=this.store.transact(project,doc=>{
        for(const job of doc.jobs)if(this.owns(project,job)&&ACTIVE.has(job.state)&&!alive(job.ownerPid)) {
          let runtime;try{runtime=this.readRuntime(project,job);}catch(e){job.runtimeInspectionError=e.message;}
          if(runtime)job.childPid=runtime.childPid;
          job.state='interrupted';job.stage='owner lost; outputs quarantined';job.error='Job owner is no longer running; completion was not confirmed. Retry uses new owned outputs.';
          job.recoveryRequired=!!job.runtimeInspectionError||alive(job.childPid);delete job.outputs;delete job.result;job.updatedAt=now();
        }
      }).catalog;
    }
    return {jobs:catalog.jobs.map(job=>{
      const view=structuredClone(job);
      if(this.owns(project,job)&&(ACTIVE.has(job.state)||job.state==='interrupted'&&job.recoveryRequired)) {
        try {const r=this.readRuntime(project,job);if(r){view.childPid=r.childPid;if(ACTIVE.has(job.state))Object.assign(view,{stage:r.stage,item:r.item,count:r.count,updatedAt:r.updatedAt});}}
        catch(e){view.runtimeInspectionError=e.message;}
      }
      return view;
    })};
  }
  hasBlockingJobs(project) {return this.jobState(project).jobs.some(j=>this.reserved(project,j)&&BLOCKING.has(j.kind));}
  async start(project,input) {
    project=structuredClone(project);input=structuredClone(input);
    if(this.closed)throw fault('Jobs service is closed',409);
    if(project.readOnly||this.store.read(project).readOnly)throw fault('Read-only project',403);
    if(!input||Object.keys(input).some(k=>!['expectedEtag','kind','assetId','groupId','locationId','sampleTime'].includes(k)))throw fault('Unknown job input field');
    if(typeof input.expectedEtag!=='string'||!input.expectedEtag)throw fault('Expected etag is required',409);
    if(!['probe','preview','variant','source-frame','final-frame','crop-detect','composite','scan'].includes(input.kind))throw fault('Unsupported job kind');
    if(input.sampleTime!==undefined&&(!Number.isFinite(input.sampleTime)||input.sampleTime<0))throw fault('Invalid sample time');
    const catalog=this.store.read(project),snapshot=this.snapshot(catalog,input);
    const id=crypto.randomUUID(),key=digest({projectFolder:project.projectFolder,kind:input.kind,snapshot});
    const response=this.store.transact(project,doc=>{
      if(doc.jobs.some(j=>this.reserved(project,j)&&j.snapshot?.key===key))throw fault('Duplicate active job',409);
      if(digest(this.snapshot(doc,input))!==digest(snapshot))throw fault('Inputs changed before job reservation',409);
      const mutations=new Set(snapshot.parts?.map(p=>p.assetId)||[snapshot.assetId]);
      if(['variant','composite'].includes(input.kind)&&doc.jobs.some(j=>this.reserved(project,j)&&['variant','composite'].includes(j.kind)&&(j.snapshot.parts?.map(p=>p.assetId)||[j.assetId]).some(id=>mutations.has(id))))throw fault('Conflicting output mutation',409);
      doc.jobs.push({id,kind:input.kind,state:'queued',stage:'queued',...(input.assetId?{assetId:input.assetId}:{}),...(input.groupId?{groupId:input.groupId}:{}),item:0,count:input.kind==='scan'?0:(snapshot.parts?.length||1),createdAt:now(),updatedAt:now(),ownerPid:process.pid,snapshot:{...snapshot,key,projectFolder:project.projectFolder,cacheFolder:project.paths.cacheFolder,compositeFolder:project.paths.compositeFolder,ownerToken:this.ownerToken,projectSettings:this.settingsStamp(project)}});
      return {jobId:id};
    },{expectedEtag:input.expectedEtag});
    const handle={id,project,job:response.catalog.jobs.find(j=>j.id===id),cancelled:false,child:null};
    this.running.set(id,handle);
    handle.promise=Promise.resolve().then(()=>this.execute(handle));
    return response;
  }
  snapshot(catalog,input) {
    if(input.kind==='scan') {
      if(input.assetId||input.groupId||!input.locationId)throw fault('Scan requires only a registered location ID');
      const location=catalog.locations.find(l=>l.id===input.locationId&&!l.removed);if(!location)throw fault('Unknown registered location',404);
      const source=checkedPath(location.path,{directory:true}),stat=fs.statSync(source,{bigint:true});
      if(!stat.isDirectory())throw fault('Location is not a directory');
      return {locationId:location.id,location:{id:location.id,path:source,dev:String(stat.dev),ino:String(stat.ino)},sampleTime:input.sampleTime??0};
    }
    if(input.kind==='composite') {
      if(input.assetId||input.locationId||!input.groupId)throw fault('Composite requires only a group ID');
      const group=catalog.groups.find(g=>g.id===input.groupId);
      if(!group||group.parts.length<2)throw fault('Composite requires at least two registered parts');
      const parts=group.parts.map(pin=>{
        const asset=catalog.assets.find(a=>a.id===pin.assetId);
        if(!asset||asset.recipe.revision!==pin.recipeRevision)throw fault('Group recipe pin is stale; explicitly update definition',409);
        return {assetId:asset.id,source:fingerprint(asset.path),recipe:structuredClone(asset.recipe)};
      });
      return {group:{id:group.id,name:group.name,revision:group.revision,parts:structuredClone(group.parts)},parts,sampleTime:input.sampleTime??0};
    }
    if(input.groupId||input.locationId||!input.assetId)throw fault('Asset job requires only a registered asset ID');
    const asset=catalog.assets.find(a=>a.id===input.assetId);if(!asset)throw fault('Unknown registered asset',404);
    return {assetId:asset.id,source:fingerprint(asset.path),recipe:structuredClone(asset.recipe),sampleTime:input.sampleTime??0};
  }
  matches(doc,job) {
    try {
      const expected={...job.snapshot};delete expected.key;delete expected.outputDirectory;delete expected.runtimeStateFile;delete expected.projectSettings;delete expected.sourceFingerprint;delete expected.sourceFingerprints;delete expected.projectFolder;delete expected.cacheFolder;delete expected.ownerToken;delete expected.compositeFolder;delete expected.publicationDirectory;
      return digest(this.snapshot(doc,{kind:job.kind,assetId:job.assetId,groupId:job.groupId,locationId:job.snapshot.locationId,sampleTime:job.snapshot.sampleTime}))===digest(expected);
    }catch(e){return false;}
  }
  settingsStamp(project) {
    const hash=crypto.createHash('sha256').update(JSON.stringify(project.paths));
    for(const name of ['retro-project.json',path.join('STATE','settings.json')]) {
      const file=checkedPath(path.join(project.projectFolder,name));
      hash.update(fs.existsSync(file)?fs.readFileSync(file):'absent:'+name);
    }
    return hash.digest('hex');
  }
  check(handle) {
    const current=this.jobState(handle.project).jobs.find(j=>j.id===handle.id);
    if(handle.cancelled||current?.state==='cancel-requested'){handle.cancelled=true;throw fault('Cancelled');}
    const snapshot=handle.job.snapshot;
    if(!current||this.settingsStamp(handle.project)!==snapshot.projectSettings){handle.stale=true;throw fault('Project settings changed during job',409);}
    for(const part of snapshot.parts||(snapshot.source?[snapshot]:[])) {
      let match=false;try{match=digest(fingerprint(part.source.path))===digest(part.source);}catch(e){}
      if(!match){handle.stale=true;throw fault('Original source changed during job',409);}
    }
  }
  update(handle,change) {return this.store.transact(handle.project,doc=>{const job=doc.jobs.find(j=>j.id===handle.id);if(!job||!this.owns(handle.project,job)||job.snapshot.ownerToken!==handle.job.snapshot.ownerToken)throw fault('Job reservation ownership changed',409);return change(job,doc);});}
  async run(handle,command,args) {
    this.check(handle);
    return new Promise((resolve,reject)=>{
      const child=spawn(command,args,{shell:false,windowsHide:true,stdio:['ignore','pipe','pipe'],cwd:handle.dir,env:this.media.environment(handle.dir)});
      handle.child=child;let stdout='',stderr='',spawnError;
      const observer=setInterval(()=>{
        try {
          const job=this.jobState(handle.project).jobs.find(j=>j.id===handle.id);
          if(!job||job.state==='cancel-requested'){handle.cancelled=true;this.stopChild(handle).catch(e=>{handle.stopError=e;});}
        }catch(e){handle.cancelled=true;this.stopChild(handle).catch(error=>{handle.stopError=error;});}
      },50);
      try {this.progress(handle,{childPid:child.pid||null});}catch(e){spawnError=e;handle.cancelled=true;this.stopChild(handle).catch(error=>{handle.stopError=error;});}
      const log=data=>{try{fs.appendFileSync(path.join(handle.dir,'native.log'),data);}catch(e){spawnError=e;}};
      child.stdout.on('data',data=>{stdout=(stdout+data).slice(-2*1024*1024);log(data);});
      child.stderr.on('data',data=>{stderr=(stderr+data).slice(-128*1024);log(data);});
      child.on('error',error=>{spawnError=error;});
      child.on('close',code=>{
        clearInterval(observer);handle.child=null;
        try{this.progress(handle,{childPid:null});}catch(e){spawnError||=e;}
        if(spawnError)reject(spawnError);
        else if(code===0&&!handle.cancelled)resolve({stdout,stderr});
        else reject(fault(handle.cancelled?'Cancelled':`Native process failed (${code}): ${stderr}`));
      });
    });
  }
  async execute(handle) {
    try {
      if(handle.cancelled)throw fault('Cancelled');
      const cache=checkedPath(handle.project.paths.cacheFolder,{directory:true});
      const base=checkedPath(path.join(cache,'library-jobs'),{directory:true});
      fs.mkdirSync(base,{recursive:true});
      handle.dir=fs.mkdtempSync(path.join(base,handle.id+'-'));
      handle.job.snapshot.outputDirectory=handle.dir;handle.job.snapshot.runtimeStateFile=path.join(handle.dir,'runtime-state.json');
      this.progress(handle,{},{initial:true});
      this.update(handle,j=>{j.state='running';j.stage=j.kind;j.updatedAt=now();j.snapshot.outputDirectory=handle.dir;j.snapshot.runtimeStateFile=handle.job.snapshot.runtimeStateFile;});
      const context={check:()=>this.check(handle),run:(...args)=>this.run(handle,...args),stage:(stage,item)=>this.progress(handle,{stage,...(Number.isInteger(item)?{item}:{})}),output:name=>{
        const output=checkedPath(path.join(handle.dir,name));
        if(path.relative(handle.dir,output).startsWith('..')||path.isAbsolute(name))throw fault('Unsafe staging output');
        fs.mkdirSync(checkedPath(path.dirname(output),{directory:true}),{recursive:true});
        if(fs.existsSync(output))throw fault('Owned output already exists');
        for(const a of this.store.read(handle.project).assets)if(a.path&&path.resolve(a.path).toLowerCase()===output.toLowerCase())throw fault('Source/output collision');
        return output;
      }};
      const {kind,snapshot}=handle.job;
      handle.sourceFingerprints=new Map();
      for(const part of snapshot.parts||(snapshot.source?[snapshot]:[])) {
        if(!handle.sourceFingerprints.has(part.assetId))handle.sourceFingerprints.set(part.assetId,await contentFingerprint(part.source.path,()=>this.check(handle)));
      }
      let outputs;
      if(kind==='scan')outputs=await this.scan(handle,context);
      else if(kind==='composite')outputs=await this.media.composite(snapshot,context);
      else if(kind==='probe')outputs={technical:technical(await this.media.probe(snapshot.source.path,context))};
      else if(kind==='preview'||kind==='variant')outputs=await this.media.render(snapshot.source.path,snapshot.recipe,context);
      else if(kind==='crop-detect')outputs=await this.media.cropDetect(snapshot.source.path,snapshot.sampleTime,context);
      else outputs=await this.media.frame(snapshot.source.path,snapshot.recipe,kind,snapshot.sampleTime,context);
      if(kind==='composite')outputs=await this.publishComposite(handle,outputs,context);
      const managedOutputs=[];
      for(const [kind,value] of Object.entries(outputs))if(value&&typeof value==='object'&&value.path&&value.mime) {
        const identity=fingerprint(value.path),content=await contentFingerprint(value.path,()=>this.check(handle));
        if(digest(fingerprint(value.path))!==digest(identity))throw fault('Managed output changed during validation',409);
        managedOutputs.push({kind,path:value.path,mime:value.mime,fingerprint:{...identity,sha256:content.sha256}});
      }
      this.update(handle,(job,doc)=>{
        if(handle.cancelled||job.state==='cancel-requested')throw fault('Cancelled');
        job.item=handle.progress.item;job.count=handle.progress.count;
        const asset=doc.assets.find(a=>a.id===job.assetId);
        if(this.settingsStamp(handle.project)!==job.snapshot.projectSettings||!this.matches(doc,job)){job.state='stale';job.stage='source or recipe changed';}
        else {for(const entry of managedOutputs)this.verifyOutput(entry);const scanResult=kind==='scan'?this.applyScan(doc,job,outputs):null;if(kind==='probe'){asset.technical=outputs.technical;asset.missing=false;}job.state='succeeded';job.stage='complete';job.count=handle.progress.count;job.item=job.count;job.outputs=managedOutputs;
          job.result=kind==='scan'?{...scanResult,errors:outputs.errors}:Object.fromEntries(Object.entries(outputs).filter(([,value])=>!value?.path));
          if(['probe','preview','variant','composite'].includes(kind))for(const [id,sourceFingerprint] of handle.sourceFingerprints) {
            const original=doc.assets.find(a=>a.id===id);if(original)original.sourceFingerprint=structuredClone(sourceFingerprint);
          }
          if(handle.sourceFingerprints.size===1){job.snapshot.sourceFingerprint=structuredClone([...handle.sourceFingerprints.values()][0]);job.result.sourceFingerprint=job.snapshot.sourceFingerprint;}
          else if(handle.sourceFingerprints.size)job.snapshot.sourceFingerprints=Object.fromEntries(handle.sourceFingerprints);
          if(kind==='variant')asset.variants.push({id:job.id,jobId:job.id,path:outputs.media.path,mime:outputs.media.mime,outputFingerprint:structuredClone(managedOutputs.find(o=>o.kind==='media').fingerprint),recipeRevision:snapshot.recipe.revision,recipe:structuredClone(snapshot.recipe),sourceFingerprint:structuredClone(handle.sourceFingerprints.get(asset.id)),ready:true,duration:outputs.technical.duration,technical:outputs.technical,createdAt:now()});
        }
        job.childPid=null;job.updatedAt=now();
      });
    }catch(error){
      try {this.update(handle,j=>{if(j.state==='cancel-requested')handle.cancelled=true;if(handle.progress){j.item=handle.progress.item;j.count=handle.progress.count;}j.state=handle.cancelled?'cancelled':handle.stale?'stale':'failed';j.stage=j.state;j.childPid=null;j.error=String(error.message).slice(-16000);j.updatedAt=now();});}
      catch(persistenceError){this.persistenceErrors.push(persistenceError);}
    }finally {this.running.delete(handle.id);}
  }
  async publishComposite(handle,outputs,context) {
    this.check(handle);
    if(!this.matches(this.store.read(handle.project),handle.job)){handle.stale=true;throw fault('Composite definition changed before publication',409);}
    const root=checkedPath(path.join(handle.project.paths.compositeFolder,'library-jobs'),{directory:true});
    fs.mkdirSync(root,{recursive:true});
    const directory=fs.mkdtempSync(path.join(root,handle.id+'-')),output=checkedPath(path.join(directory,'composite.mp4'));
    for(const asset of this.store.read(handle.project).assets)if(asset.path&&path.resolve(asset.path).toLowerCase()===output.toLowerCase())throw fault('Source/output collision');
    this.update(handle,j=>{j.snapshot.publicationDirectory=directory;j.stage='publish validated composite';j.updatedAt=now();});
    await fs.promises.copyFile(checkedPath(outputs.media.path),output,fs.constants.COPYFILE_EXCL);
    const measured=await this.media.probe(output,context);this.media.validateOutput(measured,outputs.technical.duration);
    return {...outputs,media:{path:output,mime:'video/mp4'},technical:technical(measured)};
  }
  async scan(handle,context) {
    const root=handle.job.snapshot.location.path,files=[];let entries=0;
    const allowed=new Set(['.mp4','.m4v','.mkv','.avi','.mov','.webm','.mpeg','.mpg','.ts','.m2ts','.wmv']);
    const check=()=>{const job=this.jobState(handle.project).jobs.find(j=>j.id===handle.id);if(handle.cancelled||!job||job.state==='cancel-requested'){handle.cancelled=true;throw fault('Cancelled');}};
    const visit=async(folder,depth)=>{
      check();checkedPath(folder,{directory:true});
      if(depth>this.scanLimits.depth)throw fault('Scan depth bound exceeded');
      const directory=await fs.promises.opendir(folder);
      for await(const entry of directory) {
        check();if(++entries>this.scanLimits.entries)throw fault('Scan entry count bound exceeded');
        const source=checkedPath(path.join(folder,entry.name));
        const stat=await fs.promises.lstat(source);
        if(stat.isSymbolicLink())throw fault('Reparse paths are not allowed in a scan');
        if(stat.isDirectory())await visit(source,depth+1);
        else if(stat.isFile()&&allowed.has(path.extname(source).toLowerCase())) {
          if(files.length>=this.scanLimits.files)throw fault('Scan file count bound exceeded');
          files.push({path:source,fingerprint:fingerprint(source)});
        }
        // Yield even for directories full of unsupported files; cancellation/status remain responsive.
        await new Promise(resolve=>setImmediate(resolve));
      }
    };
    context.stage('discover registered location',0);
    await visit(root,0);
    files.sort((a,b)=>a.path.localeCompare(b.path));
    this.progress(handle,{count:files.length,stage:'probe discovered files'});
    const observations=[],errors=[];
    for(const [index,file] of files.entries()) {
      check();let profile=null;
      try {profile=technical(await this.media.probe(file.path,context));}
      catch(e){check();errors.push({path:file.path,error:String(e.message).slice(-2000)});}
      if(digest(fingerprint(file.path))!==digest(file.fingerprint))throw fault('Source changed during scan',409);
      const sourceFingerprint=await contentFingerprint(file.path,check);
      observations.push({...file,sourceFingerprint,technical:profile});context.stage('probe discovered files',index+1);
    }
    check();return {observations,errors};
  }
  applyScan(doc,job,result) {
    const key=p=>path.resolve(p).toLowerCase(),present=new Set(result.observations.map(o=>key(o.path)));
    const removed=new Set((doc.removedReferences||[]).map(r=>key(r.path))),counts={registered:0,refreshed:0,skippedRemoved:0};
    for(const observed of result.observations) {
      if(removed.has(key(observed.path))){counts.skippedRemoved++;continue;}
      if(digest(fingerprint(observed.path))!==digest(observed.fingerprint))throw fault('Scanned file changed before publication',409);
      let asset=doc.assets.find(a=>a.path&&key(a.path)===key(observed.path));
      if(!asset) {
        const id='library-'+digest(key(observed.path)).slice(0,24);
        if(doc.assets.some(a=>a.id===id))throw fault('Scanned identity collision',409);
        asset={id,name:path.basename(observed.path),category:'Other',subtype:'',classificationByCategory:{'Episode/Show':[],Commercial:[],Branding:[],Other:[]},pools:[],network:'Unassigned',show:'',notes:'',date:{mode:'Unknown',value:''},availableFrom:'',availableTo:'',health:'UNREVIEWED',reason:'',path:observed.path,locationId:job.snapshot.locationId,missing:false,family:id,sourceId:'',variantOf:'',technical:null,recipe:{revision:1,trimStartSeconds:0,trimEndSeconds:0,cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,audioRepair:'NONE'},recipeHistory:[],variants:[],legacy:{},uses:[]};
        doc.assets.push(asset);
        counts.registered++;
      }else counts.refreshed++;
      asset.locationId=job.snapshot.locationId;
      asset.sourceFingerprint=observed.sourceFingerprint;
      if(observed.technical)asset.technical=observed.technical;
      asset.missing=false;
    }
    for(const asset of doc.assets)if(asset.locationId===job.snapshot.locationId&&!present.has(key(asset.path)))asset.missing=true;
    return counts;
  }
  verifyOutput(entry) {
    // Identity/timestamps reject ordinary replacement and same-size edits without
    // rehashing a full video for every HTTP Range. This is not an OS-level CAS.
    const pin=entry.fingerprint;
    let actual;try {actual=fingerprint(entry.path);}catch(e){throw fault('Managed output integrity changed or unavailable',409);}
    if(!pin||Object.keys(actual).some(key=>actual[key]!==pin[key]))throw fault('Managed output fingerprint changed; prepare a new output',409);
  }
  resolveMedia(project,{assetId,jobId,kind}) {
    const catalog=this.store.read(project);
    if(kind==='source'&&assetId&&!jobId) {
      const asset=catalog.assets.find(a=>a.id===assetId);if(!asset)throw fault('Unknown registered asset',404);
      const source=checkedPath(asset.path);fingerprint(source);
      const mime={'.mp4':'video/mp4','.m4v':'video/mp4','.mkv':'video/x-matroska','.avi':'video/x-msvideo','.mov':'video/quicktime','.webm':'video/webm','.mpeg':'video/mpeg','.mpg':'video/mpeg','.ts':'video/mp2t','.m2ts':'video/mp2t','.wmv':'video/x-ms-wmv'}[path.extname(source).toLowerCase()]||'application/octet-stream';
      return {path:source,mime};
    }
    if(!jobId||assetId||!['media','frame'].includes(kind))throw fault('Expected owned job ID and output kind');
    const job=catalog.jobs.find(j=>j.id===jobId);
    const entry=job?.outputs?.find?.(output=>output.kind===kind);
    if(!job||job.state!=='succeeded'||!entry)throw fault('Job output unavailable',404);
    const published=job.kind==='composite'&&job.snapshot.publicationDirectory;
    const output=checkedPath(entry.path),directory=checkedPath(published||job.snapshot.outputDirectory,{directory:true});
    const base=path.join(checkedPath(published?job.snapshot.compositeFolder:(job.snapshot.cacheFolder||project.paths.cacheFolder),{directory:true}),'library-jobs');
    if(path.dirname(directory).toLowerCase()!==base.toLowerCase()||!path.basename(directory).startsWith(job.id+'-')||path.dirname(output)!==directory||!fs.statSync(output).isFile())throw fault('Unsafe owned output');
    this.verifyOutput(entry);
    return {path:output,mime:entry.mime};
  }
  async stopChild(handle) {
    const child=handle.child;
    if(!child?.pid||child.exitCode!==null||child.signalCode!==null)return;
    if(handle.stopping)return handle.stopping;
    handle.stopping=new Promise((resolve,reject)=>{
      if(process.platform==='win32') {
        const killer=spawn('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{shell:false,windowsHide:true,stdio:'ignore'});
        killer.once('error',reject);killer.once('close',code=>{if(code!==0&&handle.child===child&&child.exitCode===null)reject(fault('Cannot stop owned process tree'));else resolve();});
      } else {try{child.kill('SIGKILL');resolve();}catch(e){reject(e);}}
    }).finally(()=>{handle.stopping=null;});
    return handle.stopping;
  }
  async cancel(project,jobId) {
    const response=this.store.transact(project,doc=>{
      const job=doc.jobs.find(j=>j.id===jobId);if(!job)throw fault('Unknown job',404);
      if(!this.owns(project,job))throw fault('Foreign job ownership belongs to another project',409);
      if(ACTIVE.has(job.state)){job.state='cancel-requested';job.stage='cancel requested';job.updatedAt=now();}
      return {jobId};
    });
    const handle=this.running.get(jobId);
    if(handle) {handle.cancelled=true;await this.stopChild(handle);await handle.promise;}
    else if(ACTIVE.has(response.catalog.jobs.find(j=>j.id===jobId).state)) {
      const deadline=Date.now()+30000;
      while(ACTIVE.has(this.status(project).jobs.find(j=>j.id===jobId)?.state)) {
        if(Date.now()>=deadline)throw fault('Cancellation requested; owner has not confirmed process exit',409);
        await new Promise(r=>setTimeout(r,25));
      }
    }
    return {catalog:this.store.read(project),result:{jobId}};
  }
  recover(project,{jobId,expectedEtag}) {
    if(typeof expectedEtag!=='string'||!expectedEtag)throw fault('Expected etag is required',409);
    return this.store.transact(project,doc=>{
      const job=doc.jobs.find(j=>j.id===jobId);if(!job)throw fault('Unknown job',404);
      if(!this.owns(project,job))throw fault('Foreign job ownership belongs to another project',409);
      if(job.state!=='interrupted')throw fault('Only interrupted jobs can recover',409);
      const runtime=this.readRuntime(project,job);if(runtime)job.childPid=runtime.childPid;
      // A live PID may have been reused. Inspect only; never kill or adopt it.
      const inspection=['ownerPid','childPid'].map(field=>{
        const pid=job[field];if(pid===undefined||pid===null)return {field,pid:null,alive:false};
        if(!Number.isSafeInteger(pid)||pid<1)return {field,pid,alive:true,detail:'invalid recorded PID; inspect manually'};
        try{process.kill(pid,0);return {field,pid,alive:true,detail:'PID exists; identity is not established'};}
        catch(e){return {field,pid,alive:e.code!=='ESRCH',detail:e.code};}
      });
      if(inspection.some(p=>p.alive))throw fault('Recovery blocked: owner/child PID possibly alive; manual inspection required: '+JSON.stringify(inspection),409);
      job.recoveryRequired=false;job.stage='recovered; outputs remain quarantined';
      job.recoveredAt=now();job.updatedAt=now();job.recoveryInspection=inspection;
      delete job.runtimeInspectionError;
      delete job.outputs;delete job.result;
      return {jobId};
    },{expectedEtag});
  }
  async retry(project,{jobId,expectedEtag}) {
    const old=this.jobState(project).jobs.find(j=>j.id===jobId);
    if(old&&!this.owns(project,old))throw fault('Foreign job ownership belongs to another project',409);
    if(old?.recoveryRequired)throw fault('Interrupted native process requires explicit recovery before retry',409);
    if(!old||!['failed','cancelled','stale','interrupted'].includes(old.state))throw fault('Only failed/cancelled/stale/interrupted jobs can retry',409);
    return this.start(project,{expectedEtag,kind:old.kind,...(old.assetId?{assetId:old.assetId}:{}),...(old.groupId?{groupId:old.groupId}:{}),...(old.snapshot.locationId?{locationId:old.snapshot.locationId}:{}),sampleTime:old.snapshot.sampleTime??0});
  }
  close() {
    if(this.closePromise)return this.closePromise;
    this.closed=true;
    this.closePromise=(async()=>{
      const errors=[];
      await Promise.all([...this.running.values()].map(async handle=>{
        handle.cancelled=true;
        try{this.update(handle,j=>{j.state='cancel-requested';j.stage='closing';j.updatedAt=now();});}catch(e){errors.push(e);}
        // A failed catalog write must never skip native cleanup.
        try{await this.stopChild(handle);}catch(e){errors.push(e);}
        try{await handle.promise;}catch(e){errors.push(e);}
      }));
      errors.push(...this.persistenceErrors);
      if(errors.length)throw new AggregateError(errors,'Lifecycle persistence / shutdown failed: '+errors.map(e=>e.message).join('; '));
    })();
    return this.closePromise;
  }
}
module.exports={LibraryJobs};
