'use strict';
// Schema-1 sidecar authority; legacy CSVs are read-only inputs, never rewritten.
// read() synthesizes the current project root; copying a catalog needs no root migration.
// Job snapshots must carry projectFolder before a variant can grant planning readiness.
// transact() is synchronous, trusted, owner-locked and preserves optional lifecycle fields.
const S=require('./library-storage');
const {fs,path,crypto,hash,encode,fail,checked,within,overlap,exists,bytes,json,context,external}=S;
const clone=x=>structuredClone(x);
const choices={'Episode/Show':['Crossover','Holiday','Multipart','Special'],Commercial:['Video Game','Toy','Food','Restaurant','Music','Movie','TV','Store'],Branding:['IDENT','PROMO','INTRO','BUMPER_IN','BUMPER_OUT','BUMPER_GENERIC','TRANSITION','NEXT','SIGN_OFF','MUSIC_VIDEO','OTHER'],Other:['Short','Feature','Special','PSA','Misc']};
const health=['READY','UNREVIEWED','EXCLUDED','BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE','MAYBE'];
const recipe=()=>({revision:1,trimStartSeconds:0,trimEndSeconds:0,cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,audioRepair:'NONE'});
const classifications=()=>Object.fromEntries(Object.keys(choices).map(k=>[k,[]]));
function asset(p,id=crypto.randomUUID()) {return {id,name:path.basename(p),category:'Other',subtype:'OTHER',classificationByCategory:classifications(),pools:[],network:'Unassigned',show:'',notes:'',date:{mode:'Unknown',value:''},availableFrom:'',availableTo:'',health:'UNREVIEWED',reason:'',path:p,locationId:'',missing:!fs.existsSync(p),family:id,sourceId:'',variantOf:'',technical:null,recipe:recipe(),recipeHistory:[],variants:[],legacy:{},legacyScalarPool:'',legacySubtype:'',uses:[]};}
function seed(ctx,ext) {
 const locations=ctx.project.paths.libraryFolders.map((p,i)=>({id:'location-'+i,path:p,removed:false}));
 const assets=(ext.files.find(f=>f.kind==='registry')?.value||[]).map(row=>{
  const a=asset(row.SourcePath||'',row.AssetID);a.name=row.Title||path.basename(a.path);a.category=({EPISODE:'Episode/Show',SHOW:'Episode/Show',COMMERCIAL:'Commercial',BRANDING:'Branding'})[row.AssetType]||'Other';
  a.subtype=row.Subtype||'OTHER';a.legacy=clone(row);a.legacyScalarPool=row.Pool||'';a.legacySubtype=row.Subtype||'';a.pools=row.Pool?[row.Pool]:[];a.network=row.Network||'Unassigned';a.notes=row.UserNotes||'';a.health=row.SourceStatus||'UNREVIEWED';
  if(row.Year)a.date={mode:'Year',value:row.Year};a.locationId=locations.find(l=>a.path&&within(l.path,a.path))?.id||'';if(a.category==='Branding'&&choices.Branding.includes(a.subtype))a.classificationByCategory.Branding=[a.subtype];return a;
 });
 const codes=[...new Set(assets.map(a=>a.network).filter(n=>n!=='Unassigned'))];
 return {schemaVersion:1,revision:0,assets,locations,networks:codes.map(code=>({code,name:code,kind:'Network',parentNetwork:'',archived:false})),selectionPools:[...new Set(assets.flatMap(a=>a.pools))].map(value=>({value,label:value})),groups:[],jobs:[],warnings:[]};
}
function fields(value,allowed){if(!value||typeof value!=='object'||Array.isArray(value)||Object.keys(value).some(k=>!allowed.includes(k)))fail('Unknown or invalid proposal fields');}
function text(value,label,max=1000){if(typeof value!=='string'||value.length>max||/[\x00-\x08\x0b\x0c\x0e-\x1f\x7f]/.test(value))fail('Invalid '+label);return value;}
function strings(value,label,max=128){if(!Array.isArray(value)||value.length>max||value.some(x=>typeof x!=='string'||!x.trim()||x.length>120)||new Set(value).size!==value.length)fail('Invalid '+label+' array');return clone(value);}
function getAsset(d,id){const a=d.assets.find(a=>a.id===id);if(!a)fail('Unknown asset '+id,404);return a;}
function validDatePart(s){if(/^\d{4}$/.test(s))return Number(s)>0;return /^\d{4}-\d{2}-\d{2}$/.test(s)&&Number(s.slice(0,4))>0&&!Number.isNaN(Date.parse(s))&&new Date(s).toISOString().slice(0,10)===s;}
function dateBounds(date){
 fields(date,['mode','value']);const {mode,value}=date;text(value,'date',100);
 if(mode==='Unknown'){if(value!=='')fail('Unknown date must have empty value');return null;}
 if(mode==='Year'&&/^\d{4}$/.test(value)&&validDatePart(value))return [Number(value),Number(value)];
 if(['Date','Exact date'].includes(mode)&&value.length===10&&validDatePart(value))return [Number(value.slice(0,4)),Number(value.slice(0,4))];
 const match=mode==='Range'&&value.match(/^(\d{4}(?:-\d{2}-\d{2})?)\s*(?:\.\.|–| - |-)\s*(\d{4}(?:-\d{2}-\d{2})?)$/);
 if(match&&validDatePart(match[1])&&validDatePart(match[2])&&match[1]<=match[2])return [Number(match[1].slice(0,4)),Number(match[2].slice(0,4))];
 fail('Invalid explicit date proposal');
}
// Optional schema-1 role proposals. Old scalars remain provenance once this map exists.
// Without a map, only the saved eligible category may interpret its historical scalars.
const availabilityRoles=['Episode/Show','Commercial'];
function availability(a){return a.availabilityByCategory!==undefined?clone(a.availabilityByCategory):availabilityRoles.includes(a.category)?{[a.category]:{availableFrom:a.availableFrom||'',availableTo:a.availableTo||''}}:{};}
function validateAvailability(bounds){
 fields(bounds,['availableFrom','availableTo']);for(const k of ['availableFrom','availableTo']){text(bounds[k],'availability '+k);if(bounds[k]&&!validDatePart(bounds[k]))fail('Invalid availability date');}
 if(bounds.availableFrom&&bounds.availableTo&&bounds.availableFrom>bounds.availableTo)fail('Availability bounds reversed');
}
function validateAvailabilityMap(value){fields(value,availabilityRoles);for(const bounds of Object.values(value))validateAvailability(bounds);}
function metadata(d,a,values){
 fields(values,['name','category','subtype','classificationByCategory','pools','network','show','notes','date','availableFrom','availableTo','availabilityByCategory','health','reason']);const next=clone(a);next.availabilityByCategory=availability(a);
 for(const k of ['name','show','notes','reason','availableFrom','availableTo'])if(k in values)next[k]=text(values[k],k,k==='notes'?16000:1000);
 if('name' in values&&!next.name.trim())fail('Name required');
 if('category' in values){if(!Object.hasOwn(choices,values.category))fail('Unknown category');next.category=values.category;}
 if('classificationByCategory' in values){fields(values.classificationByCategory,Object.keys(choices));for(const [k,v]of Object.entries(values.classificationByCategory)){strings(v,'classification');if(v.some(x=>!choices[k].includes(x))||(k==='Branding'&&v.length>1))fail('Invalid classification choice');next.classificationByCategory[k]=clone(v);}}
 if('subtype' in values){if(next.category!=='Branding'||!choices.Branding.includes(values.subtype))fail('Subtype is a Branding role; legacy subtype is provenance');next.classificationByCategory.Branding=[values.subtype];}
 if(next.category==='Branding'){if(next.classificationByCategory.Branding.length!==1)fail('Branding requires one primary role');next.subtype=next.classificationByCategory.Branding[0];}
 if('pools' in values){next.pools=strings(values.pools,'pools');if(next.pools.some(p=>p.length>64||!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(p)))fail('Invalid exact pool code');}
 if('network' in values){const n=d.networks.find(n=>n.code===values.network);if(values.network!=='Unassigned'&&(!n||(n.archived&&values.network!==a.network)))fail('Unknown or archived network');next.network=values.network;}
 if('health' in values){if(!health.includes(values.health))fail('Invalid source health');if(values.health!==a.health){if(typeof values.reason!=='string'||!values.reason.trim())fail('Changed source health requires an explicit reason');next.reason=values.reason.trim();}next.health=values.health;}
 if('date' in values){dateBounds(values.date);next.date=clone(values.date);}
 const scalarAvailability=['availableFrom','availableTo'].some(k=>k in values);
 if('availabilityByCategory' in values){if(scalarAvailability)fail('Conflicting availability proposal fields');validateAvailabilityMap(values.availabilityByCategory);Object.assign(next.availabilityByCategory,clone(values.availabilityByCategory));}
 if(scalarAvailability){
  const bounds={...(next.availabilityByCategory[next.category]||{availableFrom:'',availableTo:''}),...Object.fromEntries(['availableFrom','availableTo'].filter(k=>k in values).map(k=>[k,values[k]]))};validateAvailability(bounds);
  if(!availabilityRoles.includes(next.category))fail('Availability belongs only to Episode/Show or Commercial');next.availabilityByCategory[next.category]=bounds;
 }
 validateAvailabilityMap(next.availabilityByCategory);
 Object.assign(a,next);
 for(const pool of a.pools)if(!d.selectionPools.some(p=>p.value===pool))d.selectionPools.push({value:pool,label:pool});
}
function saveRecipe(a,values){
 const allowed=['trimStartSeconds','trimEndSeconds','cropLeft','cropRight','cropTop','cropBottom','audioRepair'];fields(values,allowed);const next={...a.recipe,...values};
 for(const k of allowed.filter(k=>k!=='audioRepair'))if(!Number.isFinite(next[k])||next[k]<0||(k.startsWith('crop')&&!Number.isInteger(next[k])))fail('Invalid crop/trim recipe');
 if(!['NONE','RESTORE','STRONG','AGGRESSIVE','MAX'].includes(next.audioRepair))fail('Invalid audio repair');
 if(a.technical){if(next.cropLeft+next.cropRight>=a.technical.width||next.cropTop+next.cropBottom>=a.technical.height)fail('Crop exceeds original coded pixels');if(next.trimStartSeconds+next.trimEndSeconds>=a.technical.duration)fail('Trim removes full duration');}
 else if(allowed.some(k=>k!=='audioRepair'&&next[k]>0))fail('Probe source before saving crop/trim');
 if(allowed.every(k=>next[k]===a.recipe[k]))return;
 a.recipeHistory.push(clone(a.recipe));next.revision=a.recipe.revision+1;a.recipe=next;
}
function sourceFingerprint(p){checked(p,{required:true});const s=fs.statSync(p,{bigint:true});if(!s.isFile())fail('Source must be a regular file');return {path:path.resolve(p),size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),dev:String(s.dev),ino:String(s.ino)};}
function walk(value,visit,key='',where='$',depth=0){if(depth>40)fail('Metadata object depth exceeds limit');if(typeof value==='string')visit(value,key,where);else if(Array.isArray(value))value.forEach((v,i)=>walk(v,visit,key,where+'['+i+']',depth+1));else if(value&&typeof value==='object')for(const [k,v]of Object.entries(value))walk(v,visit,k,where+'.'+k,depth+1);}
const pathKey=p=>p.replaceAll('\\','/').toLowerCase();
function buildDependencyIndex(d,ext){
 const assetById=new Map(d.assets.map(a=>[a.id,a])),idsByPath=new Map(),byAssetId=new Map(),unresolved=[];
 for(const a of d.assets){byAssetId.set(a.id,new Map());for(const p of [a.path,a.legacy?.SourcePath,...(a.sourceHistory||[]).map(x=>x.path)].filter(Boolean)){const key=pathKey(p);if(!idsByPath.has(key))idsByPath.set(key,new Set());idsByPath.get(key).add(a.id);}}
 function add(id,kind,reference,extra={}){const edges=byAssetId.get(id);if(!edges)return;const key=JSON.stringify([kind,reference]);if(!edges.has(key))edges.set(key,{kind,reference,...extra});}
 for(const f of ext.files.filter(f=>['assignment','manifest','draft','config'].includes(f.kind))){
  if(f.missing){unresolved.push({kind:f.kind,reference:f.path,reason:'Missing historical metadata'});continue;}
  walk(f.value,(value,key,where)=>{
   const isId=/^(?:base|replacement|source|variantOf)?assetid$|^sourceId$|^variantOf$/i.test(key),isPath=/^(?:original)?sourcepath$|^parts$/i.test(key);
   if(isId&&value){if(assetById.has(value))add(value,f.kind,f.path,{field:where});else unresolved.push({kind:f.kind,reference:f.path,field:where,value,reason:'Unresolved asset identity'});}
   if(isPath&&value){const ids=idsByPath.get(pathKey(value));if(ids)for(const id of ids)add(id,f.kind,f.path,{field:where});else unresolved.push({kind:f.kind,reference:f.path,field:where,value,reason:'Unresolved source reference'});}
  });
 }
 for(const g of d.groups)for(const p of [...(g.parts||[]),...(g.history||[]).flatMap(h=>h.parts||[])]){add(p.assetId,'group',g.id,{groupId:g.id});if(!assetById.has(p.assetId))unresolved.push({kind:'group',reference:g.id,value:p.assetId,reason:'Unresolved historical group identity'});}
 for(const a of d.assets){for(const id of new Set([a.sourceId,a.variantOf].filter(id=>id&&id!==a.id)))add(id,'relationship',a.id,{assetId:a.id});if(a.variants?.length)add(a.id,'variant',a.id,{count:a.variants.length});}
 // All job states and foreign pins are historical dependencies, not readiness authority.
 for(const j of d.jobs)walk(j,value=>{if(assetById.has(value))add(value,'job',j.id,{jobId:j.id,state:j.state});for(const id of idsByPath.get(pathKey(value))||[])add(id,'job',j.id,{jobId:j.id,state:j.state});});
 return {assetById,idsByPath,byAssetId,unresolved};
}
function impactFromIndex(index,id){
 if(!index.assetById.has(id))fail('Unknown asset '+id,404);
 const dependencies=[...index.byAssetId.get(id).values()],unresolved=index.unresolved;
 return {assetId:id,dependencies,unresolved,referenced:dependencies.length>0,blocked:dependencies.length>0||unresolved.length>0};
}
function impact(d,ext,id){return impactFromIndex(buildDependencyIndex(d,ext),id);}
function matchesFingerprint(expected,p){
 if(!expected||typeof expected!=='object')return false;
 if('mtimeNs' in expected){const current=sourceFingerprint(p);if(!['path','size','mtimeNs','ctimeNs','dev','ino'].every(k=>expected[k]===current[k]))return false;}
 else {const st=fs.statSync(checked(p),{bigint:false});if(String(expected.size)!==String(st.size)||Number(expected.mtimeMs)!==st.mtimeMs)return false;}
 if(expected.path&&pathKey(expected.path)!==pathKey(p))return false;
 if(expected.sha256){if(!/^[a-f0-9]{64}$/.test(expected.sha256))return false;const h=crypto.createHash('sha256'),fd=fs.openSync(p,'r'),buffer=Buffer.alloc(1024*1024);try{let n;while((n=fs.readSync(fd,buffer,0,buffer.length,null))>0)h.update(buffer.subarray(0,n));}finally{fs.closeSync(fd);}if(h.digest('hex')!==expected.sha256)return false;}
 return true;
}
function mediaState(d){
 const observations=new Map();const observe=p=>{if(observations.has(p))return observations.get(p);let value;if(!p||!path.isAbsolute(p))value=[p,'unresolved'];else{checked(p);if(!exists(p))value=[p,'missing'];else{const s=fs.statSync(p,{bigint:true});value=[p,String(s.size),String(s.mtimeNs),String(s.ctimeNs),String(s.dev),String(s.ino)];}}observations.set(p,value);return value;};
 return [...d.assets.map(a=>[a.id,...[a.path,...a.variants.map(v=>v.path)].map(observe)]),...d.jobs.map(j=>['job:'+j.id,...(Array.isArray(j.outputs)?j.outputs:Object.values(j.outputs||{})).filter(o=>o?.path).map(o=>observe(o.path))])];
}
function documentPaths(ctx,d,installRoot){
 if(ctx.project.readOnly)return;
 const owned=[ctx.root,installRoot,ctx.project.paths.buildsFolder,ctx.project.paths.compositeFolder,ctx.project.paths.cacheFolder];
 for(const p of [...d.locations.map(l=>l.path),...d.assets.map(a=>a.path)].filter(p=>p&&path.isAbsolute(p))){checked(p);if(owned.some(o=>overlap(o,p)))fail('Source path overlaps project/install/output metadata');}
}
function validateCatalog(d){
 try{
  if(d.schemaVersion!==1)fail('Unsupported catalog schema version; do not reset',409);
  if(!Number.isInteger(d.revision)||d.revision<0||!['assets','locations','networks','groups','jobs','selectionPools','warnings'].every(k=>Array.isArray(d[k])))fail('Invalid catalog arrays/revision');
  for(const [key,idKey]of [['assets','id'],['locations','id'],['networks','code'],['groups','id'],['jobs','id']]){if(d[key].length>20000)fail('Catalog record limit');const ids=d[key].map(x=>{text(x[idKey],key+' ID',200);if(!x[idKey])fail('Empty catalog identifier');return x[idKey];});if(new Set(ids).size!==ids.length)fail('Duplicate catalog identifier');}
  for(const a of d.assets){
   for(const k of ['name','subtype','network','show','notes','reason','path','locationId','family','sourceId','variantOf'])text(a[k],k,k==='notes'?16000:4000);
   if(!Object.hasOwn(choices,a.category)||!Array.isArray(a.recipeHistory)||!Array.isArray(a.variants)||!a.legacy||typeof a.legacy!=='object')fail('Invalid asset catalog record');strings(a.pools,'asset pools');fields(a.classificationByCategory,Object.keys(choices));for(const k of Object.keys(choices)){const flags=a.classificationByCategory[k];strings(flags,'classification');if(flags.some(f=>!choices[k].includes(f))||(k==='Branding'&&flags.length>1))fail('Invalid catalog classification');}
   if(typeof a.missing!=='boolean'||typeof a.health!=='string')fail('Invalid source observation');
   for(const v of a.variants){text(v.id,'variant ID',200);text(v.jobId,'variant job ID',200);checked(v.path);if(!Number.isInteger(v.recipeRevision)||v.recipeRevision<1||!v.sourceFingerprint||typeof v.sourceFingerprint!=='object'||v.ready!==undefined&&typeof v.ready!=='boolean')fail('Invalid variant record');}
   dateBounds(a.date);if(a.availabilityByCategory!==undefined)validateAvailabilityMap(a.availabilityByCategory);
   const revisions=new Set();for(const r of [...a.recipeHistory,a.recipe]){if(!r||!Number.isInteger(r.revision)||r.revision<1||revisions.has(r.revision))fail('Invalid recipe revision history');revisions.add(r.revision);for(const k of ['trimStartSeconds','trimEndSeconds','cropLeft','cropRight','cropTop','cropBottom'])if(!Number.isFinite(r[k])||r[k]<0||k.startsWith('crop')&&!Number.isInteger(r[k]))fail('Invalid crop/trim recipe');if(!['NONE','RESTORE','STRONG','AGGRESSIVE','MAX'].includes(r.audioRepair))fail('Invalid audio recipe');}
   if(a.technical!==null&&(!a.technical||!Number.isFinite(a.technical.duration)||a.technical.duration<=0||!Number.isInteger(a.technical.width)||a.technical.width<1||!Number.isInteger(a.technical.height)||a.technical.height<1||typeof a.technical.hasAudio!=='boolean'))fail('Invalid technical observation');
   if(a.path&&path.isAbsolute(a.path))checked(a.path);else if(a.path!==a.legacy.SourcePath)fail('Unsafe nonabsolute asset path');
  }
  if(d.removedReferences!==undefined){if(!Array.isArray(d.removedReferences)||d.removedReferences.length>20000)fail('Invalid removed reference tombstones');const seen=new Set();for(const r of d.removedReferences){fields(r,['id','path','removedAt']);text(r.id,'removed ID',200);text(r.removedAt,'removed time',100);if(!r.id||seen.has(r.id)||Number.isNaN(Date.parse(r.removedAt)))fail('Invalid removed reference');seen.add(r.id);checked(r.path);}}
  if(d.warnings.some(w=>typeof w!=='string'))fail('Invalid warnings');
  const poolIds=[];for(const pool of d.selectionPools){text(pool.value,'pool value',120);text(pool.label,'pool label',120);if(!pool.value.trim()||!pool.label.trim())fail('Invalid pool definition');poolIds.push(pool.value);}if(new Set(poolIds).size!==poolIds.length)fail('Duplicate pool definition');
  for(const l of d.locations){checked(l.path,{directory:true});if(typeof l.removed!=='boolean')fail('Invalid location catalog record');}
  for(const n of d.networks){text(n.name,'network name',1000);if(!['Network','Block'].includes(n.kind)||typeof n.archived!=='boolean'||typeof n.parentNetwork!=='string')fail('Invalid network catalog record');}
  for(const g of d.groups){text(g.name,'group name',120);if(!Number.isInteger(g.revision)||g.revision<1||!Array.isArray(g.parts)||!Array.isArray(g.history))fail('Invalid group catalog record');for(const p of g.parts){if(!d.assets.some(a=>a.id===p.assetId)||!Number.isInteger(p.recipeRevision)||p.recipeRevision<1)fail('Invalid group pin');}}
  for(const j of d.jobs){text(j.kind,'job kind',120);if(!['queued','running','cancel-requested','succeeded','failed','cancelled','stale','interrupted'].includes(j.state))fail('Invalid job lifecycle');}
  if(Buffer.byteLength(encode(d))>64*1024*1024)fail('Catalog exceeds 64 MiB');
 }catch(e){if(/Unsupported/.test(e.message))throw e;fail('Corrupt or invalid catalog: '+e.message,409);}
}
class LibraryStore {
 constructor({installRoot}){this.installRoot=checked(installRoot,{directory:true,required:true});this.jobSnapshot=null;}
 _load(project){const observations=new Map();return S.observe(()=>{const ctx=context(project,this.installRoot),ext=external(ctx),file=path.join(ctx.root,'STATE/library-catalog.json');const before=exists(file)?bytes(file):null;let doc;try{doc=before?JSON.parse(before.toString('utf8').replace(/^\uFEFF/,'')):seed(ctx,ext);}catch(e){fail('Cannot read catalog JSON: '+e.message,409);}validateCatalog(doc);documentPaths(ctx,doc,this.installRoot);return {ctx,ext,file,doc,beforeHash:before?hash(before):null,observations};},observations);}
 readJobState(project){return S.observe(()=>{
  const ctx=context(project,this.installRoot),file=path.join(ctx.root,'STATE/library-catalog.json');
  if(!exists(file))return {schemaVersion:1,projectFolder:ctx.root,readOnly:ctx.project.readOnly,jobs:[]};
  // Read and digest actual bytes on EVERY call: neither stat tuples, TTLs nor a
  // sidecar revision grant authority. Only parsing is reused for identical bytes.
  const data=bytes(file),fingerprint=hash(data);let jobs;
  if(this.jobSnapshot?.file===file&&this.jobSnapshot.fingerprint===fingerprint)jobs=this.jobSnapshot.jobs;
  else {let d;try{d=JSON.parse(data.toString('utf8').replace(/^\uFEFF/,''));}catch(e){fail('Invalid catalog JSON',409);}if(d.schemaVersion!==1)fail('Unsupported catalog schema version',409);
   if(!Number.isSafeInteger(d.revision)||d.revision<0||!Array.isArray(d.jobs)||d.jobs.length>20000)fail('Invalid catalog jobs/revision',409);
   const ids=new Set();for(const j of d.jobs){if(!j||typeof j!=='object')fail('Invalid job record',409);text(j.id,'job ID',200);text(j.kind,'job kind',120);if(!j.id||ids.has(j.id)||!['queued','running','cancel-requested','succeeded','failed','cancelled','stale','interrupted'].includes(j.state))fail('Invalid or duplicate job lifecycle/identity',409);ids.add(j.id);walk(j,()=>{});}
   jobs=clone(d.jobs);this.jobSnapshot={file,fingerprint,jobs};
  }
  return {schemaVersion:1,projectFolder:ctx.root,readOnly:ctx.project.readOnly,jobs:clone(jobs)};
 });}
 _snapshotLoaded(loaded,media){return S.observe(()=>{const {ctx,ext,doc}=loaded,index=buildDependencyIndex(doc,ext);media||=mediaState(doc);for(const [i,a]of doc.assets.entries()){const observation=media[i][1];a.missing=observation[1]==='missing'||observation[1]==='unresolved';a.uses=impactFromIndex(index,a.id).dependencies;}return {...clone(doc),etag:hash(encode([doc,ext.fingerprint,media])),projectFolder:ctx.root,readOnly:ctx.project.readOnly,warnings:[...doc.warnings,...ctx.project.warnings]};},loaded.observations);}

 apply(project,input={}) {
  fields(input,['expectedEtag','operation','payload']);const {expectedEtag,operation,payload}=input;
  if(Buffer.byteLength(encode(input))>1024*1024)fail('Action exceeds 1 MiB');
  if(typeof expectedEtag!=='string'||!expectedEtag)fail('Expected etag required',409);
  return this.transact(project,(d,transaction)=>{
   if(operation==='add-pool'){fields(payload,['value','label']);text(payload.value,'pool code',64);text(payload.label,'pool label',120);if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(payload.value)||!payload.label.trim())fail('Invalid exact pool code/label');if(d.selectionPools.some(p=>p.value===payload.value))fail('Pool already defined',409);d.selectionPools.push({value:payload.value,label:payload.label});return {value:payload.value};}
   if(operation==='register-location'){
    fields(payload,['path']);const p=this._source(project,payload.path,true,true);if(d.locations.some(l=>!l.removed&&overlap(l.path,p)))fail('Location already registered or overlaps another location',409);
    const l={id:crypto.randomUUID(),path:p,removed:false};d.locations.push(l);for(const a of d.assets)if(!a.locationId&&a.path&&within(p,a.path))a.locationId=l.id;return {locationId:l.id,settingsDefaultsUnchanged:true};
   }
   if(operation==='relink-asset'){
    fields(payload,['assetId','path']);const a=getAsset(d,payload.assetId),p=this._source(project,payload.path,true);if(d.assets.some(x=>x.id!==a.id&&pathKey(x.path)===pathKey(p)))fail('Duplicate source reference',409);
    const result=transaction.impact(a.id);a.sourceHistory||=[];a.sourceHistory.push({path:a.path,recipeRevision:a.recipe.revision});a.path=p;a.locationId=d.locations.find(l=>!l.removed&&within(l.path,p))?.id||'';a.missing=false;a.technical=null;return {assetId:a.id,impact:result};
   }
   if(['relink-location','remove-location'].includes(operation)){
    fields(payload,operation==='relink-location'?['locationId','path']:['locationId']);const l=d.locations.find(l=>l.id===payload.locationId&&!l.removed);if(!l)fail('Unknown active location',404);
    if(d.jobs.some(j=>['queued','running','cancel-requested'].includes(j.state)&&(j.snapshot?.locationId===l.id||j.locationId===l.id)))fail('Location referenced by active job',409);
    const affected=d.assets.filter(a=>a.locationId===l.id),impacts=affected.map(a=>transaction.impact(a.id));
    if(operation==='remove-location'){l.removed=true;return {locationId:l.id,impact:impacts};}
    const p=this._source(project,payload.path,true,true);if(d.locations.some(other=>other.id!==l.id&&!other.removed&&overlap(other.path,p)))fail('Duplicate/overlapping location',409);
    const proposals=affected.map(a=>{const old=pathKey(l.path).replace(/\/$/,'');const source=pathKey(a.path);if(!source.startsWith(old+'/'))fail('Asset path does not match location boundary');const suffix=a.path.replaceAll('\\','/').slice(old.length+1);if(!suffix||suffix.split('/').some(s=>!s||s==='.'||s==='..'))fail('Unsafe relative relink suffix');return {a,p:this._source(project,path.join(p,...suffix.split('/')))};});
    const newPaths=d.assets.map(a=>pathKey(proposals.find(x=>x.a===a)?.p||a.path));if(new Set(newPaths).size!==newPaths.length)fail('Duplicate source after relink',409);
    for(const x of proposals){x.a.sourceHistory||=[];x.a.sourceHistory.push({path:x.a.path,recipeRevision:x.a.recipe.revision});x.a.path=x.p;x.a.missing=!fs.existsSync(x.p);x.a.technical=null;}l.path=p;return {locationId:l.id,impact:impacts,settingsDefaultsUnchanged:true};
   }
   if(operation==='add-network'){
    fields(payload,['code','name','kind','parentNetwork']);text(payload.code,'network code',64);text(payload.name,'network name',120);
    if(!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(payload.code)||payload.code==='Unassigned'||!payload.name.trim()||!['Network','Block'].includes(payload.kind))fail('Invalid network definition');
    if(d.networks.some(n=>n.code===payload.code))fail('Network code already exists',409);
    const parent=payload.parentNetwork||'';if(payload.kind==='Block'&&(!parent||!d.networks.some(n=>n.code===parent&&n.kind==='Network'&&!n.archived)))fail('Block requires active parent network');if(payload.kind==='Network'&&parent)fail('Network cannot have a parent');
    d.networks.push({code:payload.code,name:payload.name,kind:payload.kind,parentNetwork:parent,archived:false});return {code:payload.code};
   }
   if(['rename-network','archive-network','delete-network'].includes(operation)){
    fields(payload,operation==='rename-network'?['code','name']:operation==='archive-network'?['code','archived']:['code']);const n=d.networks.find(n=>n.code===payload.code);if(!n)fail('Unknown network',404);
    if(operation==='rename-network'){text(payload.name,'network name',120);if(!payload.name.trim())fail('Network name required');n.name=payload.name;}
    else if(operation==='archive-network'){if(typeof payload.archived!=='boolean')fail('Explicit archive boolean required');n.archived=payload.archived;}
    else {let referenced=d.assets.some(a=>a.network===n.code)||d.networks.some(other=>other.parentNetwork===n.code);const ext=transaction.ext;for(const f of ext.files)if(['cart','manifest','draft','config'].includes(f.kind))walk(f.value,(v,k)=>{if(/^(?:network|networkCode|parentNetwork)$/i.test(k)&&v===n.code)referenced=true;});if(ext.files.some(f=>f.missing&&f.kind==='manifest'))referenced=true;if(referenced)fail('Network referenced by assets, child blocks or cart dependencies',409);d.networks=d.networks.filter(x=>x.code!==n.code);}
    return {code:n.code};
   }
   if(operation==='remove-asset'){fields(payload,['assetId']);const result=transaction.impact(payload.assetId);if(result.blocked){const e=new Error('Asset referenced by dependencies or unresolved history');e.status=e.statusCode=409;e.impact=result;throw e;}const removed=getAsset(d,payload.assetId);d.removedReferences||=[];d.removedReferences.push({id:removed.id,path:removed.path,removedAt:new Date().toISOString()});d.assets=d.assets.filter(a=>a.id!==payload.assetId);return {assetId:payload.assetId,impact:result};}
   if(operation==='remove-group'){fields(payload,['groupId']);const g=d.groups.find(g=>g.id===payload.groupId);if(!g)fail('Unknown group',404);if(d.jobs.some(j=>j.groupId===g.id||JSON.stringify(j.snapshot||{}).includes(g.id)))fail('Group referenced by job dependencies',409);d.groups=d.groups.filter(x=>x.id!==g.id);return {groupId:g.id};}
   if(operation==='save-recipe'){fields(payload,['assetId','values']);const a=getAsset(d,payload.assetId);saveRecipe(a,payload.values);return {assetId:a.id,recipeRevision:a.recipe.revision};}
   if(operation==='save-group'){
    fields(payload,['id','name','parts']);text(payload.name,'group name',120);if(!payload.name.trim()||!Array.isArray(payload.parts)||!payload.parts.length||payload.parts.length>1000)fail('Group name and ordered parts required');
    const parts=payload.parts.map(p=>{fields(p,['assetId','recipeRevision']);const a=getAsset(d,p.assetId);if(!Number.isInteger(p.recipeRevision)||![a.recipe,...a.recipeHistory].some(r=>r.revision===p.recipeRevision))fail('Unknown recipe pin');return clone(p);});
    const old=payload.id?d.groups.find(g=>g.id===payload.id):null;if(payload.id&&!old)fail('Unknown group',404);
    const g=old||{id:crypto.randomUUID(),revision:0,history:[]};if(old)g.history.push({revision:g.revision,name:g.name,parts:clone(g.parts)});g.name=payload.name;g.parts=parts;g.revision++;if(!old)d.groups.push(g);return {groupId:g.id};
   }
   if(operation==='set-relationships'){
    fields(payload,['assetId','family','sourceId','variantOf']);const a=getAsset(d,payload.assetId);text(payload.family,'source family',120);if(!payload.family.trim())fail('Explicit family required');
    for(const k of ['sourceId','variantOf']){text(payload[k],k,120);if(payload[k]){getAsset(d,payload[k]);if(payload[k]===a.id)fail('Relationship cannot refer to itself');let id=payload[k];const seen=new Set([a.id]);while(id){if(seen.has(id))fail('Relationship cycle');seen.add(id);id=getAsset(d,id)[k];}}}
    Object.assign(a,{family:payload.family,sourceId:payload.sourceId,variantOf:payload.variantOf});return {assetId:a.id};
   }
   if(operation==='save-metadata'){fields(payload,['assetId','values']);const a=getAsset(d,payload.assetId);metadata(d,a,payload.values);return {assetId:a.id};}
   if(operation==='bulk-pools'){fields(payload,['assetIds','mode','pools']);const ids=strings(payload.assetIds,'asset IDs',2000),pools=strings(payload.pools,'pools');if(pools.some(p=>p.length>64||!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(p)))fail('Invalid exact pool code');if(!['Add','Remove','Replace'].includes(payload.mode))fail('Invalid pool mode');const assets=ids.map(id=>getAsset(d,id));for(const a of assets)metadata(d,a,{pools:payload.mode==='Replace'?pools:payload.mode==='Add'?[...new Set([...a.pools,...pools])]:a.pools.filter(p=>!pools.includes(p))});return {assetIds:ids};}
   if(operation!=='register-asset')fail('Unknown operation');
   if(!payload||Object.keys(payload).some(k=>!['path','name'].includes(k)))fail('Unknown payload keys');
   const p=this._source(project,payload.path,true);if(['.mp3','.wav','.flac','.m4a','.aac','.ogg','.opus'].includes(path.extname(p).toLowerCase()))fail('Audio-only filename formats are not supported by this video Library. Choose a video clip; existing imported references are preserved.');if(d.assets.some(a=>a.path.toLowerCase()===p.toLowerCase()))fail('Asset already registered',409);
   const tombstone=d.removedReferences?.find(r=>pathKey(r.path)===pathKey(p));const a=asset(p,tombstone?.id);if(d.assets.some(x=>x.id===a.id))fail('Removed reference identity collision',409);if(payload.name!==undefined){if(typeof payload.name!=='string'||!payload.name.trim())fail('Explicit name required');a.name=payload.name;}
   a.locationId=d.locations.find(l=>!l.removed&&within(l.path,p))?.id||'';if(tombstone)d.removedReferences=d.removedReferences.filter(r=>r!==tombstone);d.assets.push(a);return {assetId:a.id};
  },{expectedEtag});
 }
 _source(project,value,required=false,directory=false){const p=checked(value,{required,directory});const owned=[this.installRoot,project.projectFolder,project.paths.buildsFolder,project.paths.compositeFolder,project.paths.cacheFolder];if(owned.some(o=>overlap(o,p)))fail('Source path overlaps project/install/output');if(required&&!directory&&!fs.statSync(p).isFile())fail('Source must be a regular file');return p;}
 transact(project,callback,{expectedEtag}={}) {
  const initial=S.observe(()=>context(project,this.installRoot));if(initial.project.readOnly)fail('Legacy project is read-only; import a managed copy',403);
  if(overlap(initial.root,this.installRoot))fail('Project data must be separate from install');
  return S.lock(initial.root+'.setup.lock',verify=>{
   const loaded=this._load(project),media=S.observe(()=>mediaState(loaded.doc),loaded.observations),snapshot=this._snapshotLoaded(loaded,media),observations=encode(media);
   if(expectedEtag!==undefined&&expectedEtag!==snapshot.etag)fail('Stale expected etag; reload',409);
   const doc=clone(loaded.doc);let index;const result=callback(doc,{ext:loaded.ext,impact:id=>impactFromIndex(index||=buildDependencyIndex(doc,loaded.ext),id)});if(result&&typeof result.then==='function')fail('Transaction callback must be synchronous');
   const proposedObservations=S.observe(()=>{validateCatalog(doc);documentPaths(loaded.ctx,doc,this.installRoot);return encode(mediaState(doc));});
   doc.revision=loaded.doc.revision+1;
   const fresh=()=>S.observe(()=>{verify();if(external(context(project,this.installRoot)).fingerprint!==loaded.ext.fingerprint||encode(mediaState(loaded.doc))!==observations||encode(mediaState(doc))!==proposedObservations)fail('Stale external/source inputs changed',409);});
   S.publish(loaded.file,doc,fresh,loaded.beforeHash);return {catalog:this.read(project),result:clone(result)};
  });
 }
 planningCandidates(project,filter={}){
  fields(filter,['category','network','pools','yearMin','yearMax','allowUnknownDates','availableAt','pool','year','allowUnknown','health','search','locationId']);
  filter=clone(filter);if('year' in filter){if('yearMin' in filter||'yearMax' in filter)fail('Conflicting year filters');filter.yearMin=filter.yearMax=filter.year;}if('pool' in filter){if('pools' in filter)fail('Conflicting pool filters');text(filter.pool,'pool filter',120);filter.pools=[filter.pool];}if('allowUnknown' in filter){if('allowUnknownDates' in filter)fail('Conflicting unknown-date policies');filter.allowUnknownDates=filter.allowUnknown;}if(filter.health&&!health.includes(filter.health))fail('Invalid health filter');if('search' in filter)text(filter.search,'search',1000);if('locationId' in filter)text(filter.locationId,'location filter',200);
  for(const k of ['yearMin','yearMax'])if(k in filter&&(!Number.isInteger(filter[k])||filter[k]<1||filter[k]>9999))fail('Invalid hard year filter');
  if(filter.yearMin!==undefined&&filter.yearMax!==undefined&&filter.yearMin>filter.yearMax)fail('Reversed year filter');if('allowUnknownDates' in filter&&typeof filter.allowUnknownDates!=='boolean')fail('Unknown-date policy must be explicit boolean');
  if(filter.pools)strings(filter.pools,'filter pools');if(filter.category&&!Object.hasOwn(choices,filter.category))fail('Unknown filter category');if(filter.network)text(filter.network,'filter network',64);if(filter.availableAt&&!/^\d{4}(?:-\d{2}-\d{2})?$/.test(filter.availableAt))fail('Invalid availability filter');
  const catalog=this.read(project),candidates=[],excluded=[],jobsById=new Map(catalog.jobs.map(j=>[j.id,j])),sourcePaths=new Set(catalog.assets.map(a=>pathKey(a.path))),compositeJobs=new Map();
  for(const j of [...catalog.jobs].reverse())if(j.kind==='composite'){if(!compositeJobs.has(j.groupId))compositeJobs.set(j.groupId,[]);compositeJobs.get(j.groupId).push(j);}
  for(const a of catalog.assets){let reason='';if(a.missing)reason='Missing source';else if(filter.category&&a.category!==filter.category||filter.network&&a.network!==filter.network||filter.pools?.length&&!filter.pools.some(p=>a.pools.includes(p)))reason='Metadata filter';
   if(!reason&&(filter.health&&a.health!==filter.health||filter.locationId&&a.locationId!==filter.locationId||filter.search&&![a.name,a.notes,a.show].join(' ').toLowerCase().includes(filter.search.toLowerCase())))reason='Browse filter';
   const years=dateBounds(a.date);if(!reason&&(filter.yearMin!==undefined||filter.yearMax!==undefined)){if(years===null&&!filter.allowUnknownDates)reason='Unknown date fails hard filter';else if(years!==null&&(years[1]<(filter.yearMin??1)||years[0]>(filter.yearMax??9999)))reason='Date outside hard filter';}
   const bounds=availabilityRoles.includes(a.category)?availability(a)[a.category]:null;
   if(!reason&&filter.availableAt&&bounds&&(bounds.availableFrom&&filter.availableAt<bounds.availableFrom||bounds.availableTo&&filter.availableAt>bounds.availableTo))reason='Outside explicit availability';
   let variant=null;
   if(!reason){variant=[...a.variants].reverse().find(v=>{
    const j=jobsById.get(v.jobId),output=Array.isArray(j?.outputs)?j.outputs.find(o=>o.kind==='media'):j?.outputs?.media;if(!j||j.snapshot?.projectFolder!==catalog.projectFolder||j.assetId!==a.id||j.kind!=='variant'||j.state!=='succeeded'||v.ready===false||v.recipeRevision!==a.recipe.revision||v.recipe&&encode(v.recipe)!==encode(a.recipe)||!matchesFingerprint(v.sourceFingerprint,a.path)||encode(j.snapshot?.recipe)!==encode(a.recipe)||!matchesFingerprint(j.snapshot?.source,a.path)||output?.path!==v.path||!v.outputFingerprint||!['path','size','mtimeNs','ctimeNs','dev','ino'].every(k=>typeof v.outputFingerprint[k]==='string')||encode(v.outputFingerprint)!==encode(output.fingerprint))return false;
    try{const out=checked(v.path),dir=checked(j.snapshot.outputDirectory,{directory:true});return path.dirname(dir)===path.join(project.paths.cacheFolder,'library-jobs')&&path.basename(dir).startsWith(j.id+'-')&&within(dir,out)&&exists(out)&&fs.statSync(out).isFile()&&!sourcePaths.has(pathKey(out))&&matchesFingerprint(v.outputFingerprint,out);}catch(e){return false;}
   });
   const changed=Object.keys(recipe()).some(k=>k!=='revision'&&a.recipe[k]!==recipe()[k]);
   const repaired=a.health==='BAD_AUDIO'&&a.recipe.audioRepair!=='NONE'||a.health==='NEEDS_CROP'&&a.recipe.cropLeft+a.recipe.cropRight+a.recipe.cropTop+a.recipe.cropBottom>0||a.health==='NEEDS_CLIPPED'&&a.recipe.trimStartSeconds+a.recipe.trimEndSeconds>0;
   if(a.health!=='READY'&&!(variant&&repaired))reason='Source health requires review or repair';else if(changed&&!variant)reason='Current recipe requires preparation';
   }
   if(reason){excluded.push({assetId:a.id,reason});continue;}
   candidates.push({...clone(a),effectivePath:variant?variant.path:a.path,prepared:!!variant,variantId:variant?.id||null,recipeRevision:a.recipe.revision,sourceFamily:a.family||a.id,sourceId:a.sourceId||a.id,pins:{assetId:a.id,sourceId:a.sourceId||a.id,family:a.family||a.id,recipeRevision:a.recipe.revision,variantId:variant?.id||null,sourceFingerprint:sourceFingerprint(a.path)}});
  }
  const composites=[],assetById=new Map(catalog.assets.map(a=>[a.id,a])),excludedById=new Map(excluded.map(x=>[x.assetId,x.reason]));
  for(const group of catalog.groups){
   const job=(compositeJobs.get(group.id)||[]).find(j=>{
    try{
     if(j.kind!=='composite'||j.groupId!==group.id||j.state!=='succeeded'||j.snapshot?.projectFolder!==catalog.projectFolder||group.parts.length<2)return false;
     if(encode(j.snapshot.group)!==encode({id:group.id,name:group.name,revision:group.revision,parts:group.parts})||!Array.isArray(j.snapshot.parts)||j.snapshot.parts.length!==group.parts.length)return false;
     for(const [i,pin]of group.parts.entries()){
      const a=assetById.get(pin.assetId),reserved=j.snapshot.parts[i];if(!a||a.missing||a.recipe.revision!==pin.recipeRevision||reserved.assetId!==a.id||encode(reserved.recipe)!==encode(a.recipe)||!matchesFingerprint(reserved.source,a.path))return false;
      if(j.snapshot.sourceFingerprints?.[a.id]&&!matchesFingerprint(j.snapshot.sourceFingerprints[a.id],a.path))return false;
      const repair=a.health==='BAD_AUDIO'&&a.recipe.audioRepair!=='NONE'||a.health==='NEEDS_CROP'&&a.recipe.cropLeft+a.recipe.cropRight+a.recipe.cropTop+a.recipe.cropBottom>0||a.health==='NEEDS_CLIPPED'&&a.recipe.trimStartSeconds+a.recipe.trimEndSeconds>0;
      if(a.health!=='READY'&&!repair)return false;const reason=excludedById.get(a.id);if(reason&&!['Current recipe requires preparation','Source health requires review or repair'].includes(reason))return false;
     }
     const output=Array.isArray(j.outputs)?j.outputs.find(o=>o.kind==='media'):j.outputs?.media,fp=output?.fingerprint;if(!fp||!['path','size','mtimeNs','ctimeNs','dev','ino'].every(k=>typeof fp[k]==='string'))return false;
     const out=checked(output.path),dir=checked(j.snapshot.publicationDirectory,{directory:true});return path.dirname(dir)===path.join(project.paths.compositeFolder,'library-jobs')&&path.basename(dir).startsWith(j.id+'-')&&path.dirname(out)===dir&&!sourcePaths.has(pathKey(out))&&matchesFingerprint(fp,out);
    }catch(e){return false;}
   });
   if(!job)continue;const output=Array.isArray(job.outputs)?job.outputs.find(o=>o.kind==='media'):job.outputs.media;
   const parts=group.parts.map(pin=>{const a=assetById.get(pin.assetId);return {assetId:a.id,sourceId:a.sourceId||a.id,family:a.family||a.id,recipeRevision:pin.recipeRevision,recipe:clone(a.recipe),sourceFingerprint:sourceFingerprint(a.path)};});
   composites.push({groupId:group.id,groupRevision:group.revision,name:group.name,jobId:job.id,effectivePath:output.path,prepared:true,sourceFamilies:parts.map(p=>p.family),constituentAssetIds:parts.map(p=>p.assetId),pins:{groupId:group.id,groupRevision:group.revision,group:clone(job.snapshot.group),parts,jobId:job.id,outputFingerprint:clone(output.fingerprint)}});
  }
  return {schemaVersion:1,projectFolder:catalog.projectFolder,etag:catalog.etag,candidates,composites,excluded,unknownDatePolicy:filter.allowUnknownDates?'allow':'exclude-when-filtered'};
 }
 dependencies(project,assetId){const {doc,ext}=this._load(project);return clone(impact(doc,ext,assetId));}
 read(project){return this._snapshotLoaded(this._load(project));}
}
module.exports={LibraryStore};
