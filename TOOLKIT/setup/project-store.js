'use strict';
// Setup-only storage adapter. No engine initialization, media scanning or relinking.
const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');
const crypto = require('node:crypto');
const HEADERS = {
  'asset-registry.csv': 'AssetID,AssetType,Subtype,Title,Pool,Network,SourcePath,DurationSeconds,CuratedStatus,SourceStatus,ReusePolicy,SourceCollection,Notes,UserNotes,InferredTags,OriginalID,Year',
  'assignments.csv': 'AssignmentID,CartID,Revision,SlotID,AssetID,AssignmentStatus,AssignedUtc,ReleasedUtc,ReleaseReason',
  'cart-registry.csv': 'CartID,CurrentRevision,Status,Network,DisplayName,CreatedUtc,UpdatedUtc,ManifestPath',
  'handpicked-episodes.csv': 'AssetID,Network,Series,Title,SourcePath,DurationSeconds,Status,BrandingKeywords,Notes,Year',
  'handpicked-branding.csv': 'AssetID,Network,Type,Title,SourcePath,DurationSeconds,Status,Notes,Year'
};
const copy = x => structuredClone(x);
const encode = x => JSON.stringify(x, null, 2) + '\n';
const readJson = p => { try { return JSON.parse(metadataBytes(p).toString('utf8').replace(/^\uFEFF/,'')); } catch(e) { throw new Error('Cannot read JSON '+p+': '+e.message); } };
const descriptorPath = root => path.join(root, 'retro-project.json');
const settingsPath = root => path.join(root, 'STATE', 'settings.json');
function put(p, data) { fs.mkdirSync(path.dirname(p), {recursive:true}); fs.writeFileSync(p, data); }
function atomic(p, data) {
  const temp=p+'.tmp-'+crypto.randomUUID();
  try { fs.writeFileSync(temp,data,{flag:'wx'}); fs.renameSync(temp,p); }
  finally { fs.rmSync(temp,{force:true}); }
}
// Local absolute paths only: UNC/device paths are deliberately unsupported in Phase 1.1.
function checkedPath(value, {directory=false,required=false}={}) {
  if(typeof value!=='string' || !value || /[\x00-\x1f\x7f]/.test(value) || !path.isAbsolute(value)) throw new Error('Path must be absolute and contain no control characters.');
  if(/^[\\/]{2}/.test(value)) throw new Error('UNC and device paths are not supported; choose a local absolute path.');
  const parts=value.slice(path.parse(value).root.length).split(/[\\/]/);
  if(parts.some(p=>p && (/[<>:"|?*]/.test(p) || /[. ]$/.test(p) || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p)))) throw new Error('Path contains an unsafe Windows path component.');
  const p=path.resolve(value);
  for(let cur=p;;cur=path.dirname(cur)) {
    let st;
    try { st=fs.lstatSync(cur); } catch(e) { if(e.code!=='ENOENT') throw e; }
    if(st) {
      if(st.isSymbolicLink()) throw new Error('Symlink/junction paths are not supported: '+cur);
      if((cur!==p || directory) && !st.isDirectory()) throw new Error('Expected directory path: '+cur);
      fs.accessSync(cur,fs.constants.R_OK);
    } else if(cur===p && required) throw new Error('Required library/directory path is missing: '+p);
    if(path.dirname(cur)===cur) break;
  }
  return p;
}
const within=(a,b)=>{ const r=path.relative(a,b); return r==='' || (!r.startsWith('..'+path.sep) && r!=='..' && !path.isAbsolute(r)); };
const overlap=(a,b)=>within(a,b)||within(b,a);
function writeAccess(p) {
  let ancestor=p;
  while(!fs.existsSync(ancestor)) ancestor=path.dirname(ancestor);
  fs.accessSync(ancestor,fs.constants.W_OK);
}
function validateInput(input, installRoot) {
  if(!['create','import','settings'].includes(input.operation)) throw new Error('Unknown operation.');
  if(typeof input.name!=='string' || !input.name.trim() || input.name.length>120 || /[\x00-\x1f\x7f]/.test(input.name)) throw new Error('Project name must be 1-120 characters without controls.');
  const root=checkedPath(input.projectFolder,{directory:true});
  if(overlap(root,checkedPath(installRoot,{directory:true}))) throw new Error('Project data must be separate from the application install path.');
  const p=input.paths;
  if(!p || !Array.isArray(p.libraryFolders) || p.libraryFolders.length>32) throw new Error('Library paths must be an array of at most 32 directories.');
  const paths={};
  for(const k of ['buildsFolder','compositeFolder','cacheFolder']) paths[k]=checkedPath(p[k],{directory:true});
  paths.libraryFolders=p.libraryFolders.map(x=>checkedPath(x,{directory:true,required:true}));
  const outputs=[paths.buildsFolder,paths.compositeFolder,paths.cacheFolder];
  for(let i=0;i<outputs.length;i++) {
    if(overlap(outputs[i],installRoot)) throw new Error('Output data must be separate from the application install path.');
    for(let j=0;j<i;j++) if(overlap(outputs[i],outputs[j])) throw new Error('Output paths overlap.');
    if(overlap(root,outputs[i]) && !(i===2 && within(path.join(root,'CACHE'),outputs[i]))) throw new Error('Data/output overlap: only designated CACHE under project data is allowed.');
  }
  for(const lib of paths.libraryFolders) for(const owned of [root,...outputs]) if(overlap(lib,owned)) throw new Error('Project/output path overlaps a source library.');
  if(input.operation!=='settings' && fs.existsSync(root) && fs.readdirSync(root).length) throw new Error('New/import project directory must be empty; select a new directory.');
  for(const owned of [root,...outputs]) writeAccess(owned);
  if(input.operation==='settings') { writeAccess(descriptorPath(root)); writeAccess(settingsPath(root)); }
  return {...input,projectFolder:root,paths};
}
function csv(text, source) {
  text=text.replace(/^\uFEFF/,'');
  const records=[]; let row=[], field='', quoted=false, closed=false;
  for(let i=0;i<text.length;i++) {
    const c=text[i];
    if(quoted) { if(c==='"') { if(text[i+1]==='"') {field+='"';i++;} else {quoted=false;closed=true;} } else field+=c; }
    else if(c==='"' && !field && !closed) quoted=true;
    else if(c===',' || c==='\n' || c==='\r') {
      row.push(field); field='';closed=false;
      if(c!==',') { if(c==='\r' && text[i+1]==='\n')i++; if(row.some(x=>x!=='')) records.push(row);row=[]; }
    } else { if(closed || c==='"') throw new Error('Malformed CSV: '+source); field+=c; }
  }
  if(quoted) throw new Error('Unterminated quoted CSV: '+source);
  if(field || row.length || closed) {row.push(field);records.push(row);}
  if(!records.length) return {columns:[],rows:[]};
  const columns=records.shift();
  if(new Set(columns).size!==columns.length || columns.some(x=>!x)) throw new Error('Malformed CSV header: '+source);
  return {columns,rows:records.map(r=>{ if(r.length!==columns.length) throw new Error('Malformed CSV row: '+source); return Object.fromEntries(columns.map((k,i)=>[k,r[i]])); })};
}
function readCsv(p, id) {
  const parsed=csv(metadataBytes(p).toString('utf8'),p);
  if(id && parsed.columns.length && !parsed.columns.includes(id)) throw new Error('CSV schema header is missing '+id+': '+p);
  return parsed;
}
const MAX_BYTES=64*1024*1024, MAX_FILES=1000;
const digest=data=>crypto.createHash('sha256').update(data).digest('hex');
function metadataBytes(p) {
  checkedPath(p,{required:true}); const st=fs.statSync(p);
  if(!st.isFile() || st.size>MAX_BYTES) throw new Error('Metadata must be a regular file within 64 MiB: '+p);
  return fs.readFileSync(p);
}
function collectSource(root) {
  const files=[], seen=new Set(); let bytes=0, visited=0;
  function add(sourcePath,target) {
    sourcePath=checkedPath(sourcePath,{required:true});
    if(seen.has(sourcePath.toLowerCase())) return;
    const data=metadataBytes(sourcePath);
    if(++visited>MAX_FILES || (bytes+=data.length)>MAX_BYTES) throw new Error('Metadata exceeds 1000 files / 64 MiB limit.');
    if(/\.json$/i.test(sourcePath)) { try { JSON.parse(data.toString('utf8').replace(/^\uFEFF/,'')); } catch(e) {throw new Error('Malformed metadata JSON '+sourcePath+': '+e.message);} }
    if(/\.csv$/i.test(sourcePath)) csv(data.toString('utf8'),sourcePath);
    seen.add(sourcePath.toLowerCase()); files.push({sourcePath,target,data,sha256:digest(data)});
  }
  const settings=readJson(settingsPath(root));
  add(settingsPath(root),null);
  if(fs.existsSync(descriptorPath(root))) add(descriptorPath(root),null);
  for(const [key,name] of [['RegistryPath','asset-registry.csv'],['AssignmentPath','assignments.csv'],['CartRegistryPath','cart-registry.csv']]) add(settings[key],path.join('STATE',name));
  function scan(dir,prefix,mode,depth=0) {
    checkedPath(dir,{directory:true,required:true});
    if(depth>8) throw new Error('Metadata directory exceeds depth limit.');
    const names=fs.readdirSync(dir,{withFileTypes:true});
    if(names.length>MAX_FILES) throw new Error('Metadata directory exceeds 1000 entries.');
    for(const e of names.sort((a,b)=>a.name.localeCompare(b.name))) {
      if((e.isDirectory() && /^(backups?|cache)$/i.test(e.name)) || /\.backup(?:-|\.|$)|\.tmp-/i.test(e.name)) continue;
      const p=path.join(dir,e.name), dest=path.join(prefix,e.name);
      if(e.isSymbolicLink()) throw new Error('Symlink/junction metadata entry is not supported: '+p);
      if(e.isDirectory() && ((mode==='state' && e.name==='studio-drafts') || (mode==='config' && e.name==='composites') || mode==='nested')) scan(p,dest,'nested',depth+1);
      else if(/\.(json|csv)$/i.test(e.name) && (mode!=='config' || /\.json$/i.test(e.name))) {
        if(mode==='state' && ['settings.json','asset-registry.csv','assignments.csv','cart-registry.csv'].includes(e.name.toLowerCase())) continue;
        add(p,dest);
      }
    }
  }
  scan(path.join(root,'STATE'),'STATE','state');
  scan(settings.ConfigDir,'config','config');
  const curation=checkedPath(settings.CurationDir,{directory:true,required:true});
  const candidates=fs.readdirSync(curation).filter(n=>/^branding-curation.*\.csv$|^commercial-curation.*\.csv$/i.test(n));
  if(candidates.length>MAX_FILES) throw new Error('Curation exceeds 1000 candidates.');
  let candidateBytes=0;
  const choices=candidates.map(n=>{ const p=checkedPath(path.join(curation,n),{required:true}), data=metadataBytes(p); candidateBytes+=data.length;
    if(candidateBytes>MAX_BYTES) throw new Error('Curation candidate metadata exceeds 64 MiB.');
    return {p,n,time:fs.statSync(p).mtimeMs,parsed:csv(data.toString('utf8'),p)}; }).sort((a,b)=>b.time-a.time || a.n.localeCompare(b.n));
  const selected=[choices.find(x=>/^branding-curation/i.test(x.n)),choices.find(x=>/^commercial-curation/i.test(x.n) && !/2000-2002/i.test(x.n) && x.parsed.rows.length && x.parsed.columns.includes('SourcePack')),choices.find(x=>/^commercial-curation-2000-2002/i.test(x.n))];
  const d=fs.existsSync(descriptorPath(root))?readJson(descriptorPath(root)):null;
  const emptyManaged=!!d && Array.isArray(d.curationFiles) && d.curationFiles.length===0 && choices.length===0;
  if(!emptyManaged && (!selected[0] || !selected[1])) throw new Error('Missing required curation: branding-curation and 1990s commercial-curation with a SourcePack row are required.');
  const warnings=!emptyManaged && !selected[2]?['Optional 2000-2002 commercial curation is absent.']:[];
  for(const item of selected.filter(Boolean)) add(item.p,path.join('curation',item.n));
  const manifests=new Set(readCsv(settings.CartRegistryPath).rows.map(c=>c.ManifestPath));
  for(const file of files.filter(x=>x.target && x.target.startsWith('STATE'+path.sep+'studio-drafts'+path.sep))) {
    const d=JSON.parse(file.data.toString('utf8').replace(/^\uFEFF/,''));
    if(!d.baseManifestPath) throw new Error('Draft has no pinned baseManifestPath: '+file.sourcePath);
    manifests.add(d.baseManifestPath);
  }
  for(const p of manifests) { if(!p || !/\.csv$/i.test(p)) throw new Error('Missing/invalid current cart manifest metadata path.'); add(p,null); }
  return {files,settings,warnings};
}
function writeBackup(stage, relative, sourceFolder, files) {
  checkedPath(stage,{directory:true,required:true});
  const operation=checkedPath(path.join(stage,relative),{directory:true});
  const backupRoot=checkedPath(path.dirname(operation),{directory:true});
  try { fs.mkdirSync(backupRoot); } catch(e) { if(e.code!=='EEXIST') throw e; }
  checkedPath(backupRoot,{directory:true,required:true});
  // These directories must be newly owned, even if an existing token directory is empty.
  fs.mkdirSync(operation);
  const inputs=checkedPath(path.join(operation,'inputs'),{directory:true});
  fs.mkdirSync(inputs);
  function publish(target,data,sha256) {
    checkedPath(path.dirname(target),{directory:true,required:true});
    checkedPath(target);
    fs.writeFileSync(target,data,{flag:'wx'});
    if(digest(metadataBytes(target))!==sha256) throw new Error('Backup verification failed: '+target);
  }
  const receipt={schemaVersion:1,sourceFolder,createdAt:new Date().toISOString(),limitation:'Metadata only: not entire build history or FINAL media. Existing manifests and media references remain pinned to original locations.',files:[]};
  for(const [index,file] of files.entries()) {
    const backupPath=path.join('inputs',String(index).padStart(4,'0')+'-'+path.basename(file.sourcePath));
    publish(path.join(operation,backupPath),file.data,file.sha256);
    receipt.files.push({sourcePath:file.sourcePath,destinationPath:file.target || null,backupPath,sha256:file.sha256,bytes:file.data.length});
  }
  const data=encode(receipt);
  publish(path.join(operation,'receipt.json'),data,digest(data));
  return receipt;
}
function withLock(lockPath, action) {
  const owner=crypto.randomUUID(); let fd;
  try { fd=fs.openSync(lockPath,'wx'); }
  catch(e) { if(e.code==='EEXIST') throw new Error('Setup lock is held by another process: '+lockPath+'. Restart the other app or manually inspect this lock; stale locks are never auto-deleted.'); throw e; }
  try { fs.writeFileSync(fd,encode({owner,pid:process.pid,createdAt:new Date().toISOString()})); }
  catch(e) { fs.closeSync(fd); fs.unlinkSync(lockPath); throw e; }
  fs.closeSync(fd);
  try { return action(); }
  finally {
    // Never delete a replacement lock owned by another process.
    let current; try { current=readJson(lockPath); } catch(e) { throw new Error('Setup lock ownership changed; manually inspect '+lockPath+'. '+e.message); }
    if(current.owner!==owner) throw new Error('Setup lock ownership changed; manually inspect '+lockPath);
    fs.unlinkSync(lockPath);
  }
}
function mkdirOwned(p, created) {
  if(fs.existsSync(p)) { checkedPath(p,{directory:true}); return; }
  mkdirOwned(path.dirname(p),created);
  fs.mkdirSync(p); created.push(p);
}
function removeEmptyCreated(created) {
  for(const p of [...created].reverse()) { try { fs.rmdirSync(p); } catch(e) { if(!['ENOENT','ENOTEMPTY','EEXIST'].includes(e.code)) throw e; } }
}
function declaredLibraries(settings) {
  if(settings.LibraryRoots!==undefined && (!Array.isArray(settings.LibraryRoots) || settings.LibraryRoots.length>32)) throw new Error('Invalid LibraryRoots array in engine settings.');
  return [...new Set([...(settings.LibraryRoots || []),...(settings.CommercialRoot?[settings.CommercialRoot]:[])].map(p=>checkedPath(p,{directory:true})))];
}
function appDataSeparation(appDataDir, roots) {
  const p=checkedPath(appDataDir,{directory:true});
  for(const root of roots.filter(Boolean)) if(overlap(p,root)) throw new Error('App-data must be separate from project, source metadata, output and library roots: '+root);
}
function protectSource(value,source,appDataDir) {
  const s=source.settings, libraries=declaredLibraries(s), outputs=[value.paths.buildsFolder,value.paths.compositeFolder,value.paths.cacheFolder];
  const metadataRoots=[s.ConfigDir,s.CurationDir,...source.files.map(f=>path.dirname(f.sourcePath))];
  appDataSeparation(appDataDir,[value.sourceFolder,...metadataRoots,...libraries]);
  if(value.operation==='import') for(const root of [value.sourceFolder,...metadataRoots]) if(overlap(value.projectFolder,root)) throw new Error('Import destination overlaps source metadata: '+root);
  for(const lib of libraries) for(const owned of [value.projectFolder,...outputs]) if(overlap(owned,lib)) throw new Error('Project/output overlaps original source library: '+lib);
  for(const output of outputs) for(const p of [s.ConfigDir,s.CurationDir,...source.files.filter(f=>f.target || /\.json$/i.test(f.sourcePath)).map(f=>f.sourcePath)]) if(overlap(output,p)) throw new Error('Output overlaps authoritative source metadata: '+p);
}
function verifySource(plan,appDataDir) {
  if(!plan.source) return;
  try {
    const fresh=collectSource(plan.input.operation==='import'?plan.input.sourceFolder:plan.d.projectFolder);
    const fingerprints=x=>x.files.map(f=>[f.sourcePath,f.target,f.sha256]).sort((a,b)=>a[0].localeCompare(b[0]));
    if(JSON.stringify(fingerprints(fresh))!==JSON.stringify(fingerprints(plan.source))) throw new Error('Source files changed.');
    protectSource(plan.input,fresh,appDataDir);
  } catch(e) {throw new Error('Stale preview: underlying metadata changed or cannot be verified. Preview again. '+e.message);}
}
function descriptor(name, root, paths) {
  return { schemaVersion:1, name, projectFolder:root, curationFiles:[], paths:{dataFolder:root,...paths}, cachePolicy:'disposable, manual cleanup only, no auto wipe' };
}
function engineSettings(d) {
  const root=d.projectFolder, p=d.paths;
  return { ProjectSchemaVersion:1, SystemRoot:root, ConfigDir:path.join(root,'config'), CurationDir:path.join(root,'curation'),
    BuildRoot:p.buildsFolder, CompositeRoot:p.compositeFolder, CacheRoot:p.cacheFolder, LibraryRoots:p.libraryFolders,
    CommercialRoot:'', RegistryPath:path.join(root,'STATE','asset-registry.csv'),
    AssignmentPath:path.join(root,'STATE','assignments.csv'), CartRegistryPath:path.join(root,'STATE','cart-registry.csv') };
}
class ProjectStore {
  constructor({appDataDir,installRoot}) { this.appDataDir=appDataDir; this.installRoot=installRoot; this.plans=new Map(); }
  defaults() {
    const root=path.join(os.homedir(),'Documents','Retro TV Projects','New Project');
    return {projectFolder:root,buildsFolder:path.join(os.homedir(),'Videos','Retro TV Builds'),
      compositeFolder:path.join(os.homedir(),'Videos','Retro TV Composites'),cacheFolder:path.join(root,'CACHE'),libraryFolders:[]};
  }
  status() {
    const result={activeProject:null,recentProjects:[],defaults:this.defaults()};
    const p=path.join(this.appDataDir,'projects.json');
    if(fs.existsSync(p)) {
      try { const state=readJson(p); result.recentProjects=state.recentProjects; if(state.activeProject) result.activeProject=this.inspect(state.activeProject); }
      catch(e) { result.loadError='Cannot reload selected project: '+e.message; }
    }
    return result;
  }
  inspect(root) {
    root=checkedPath(root,{directory:true,required:true});
    const d=fs.existsSync(descriptorPath(root))?readJson(descriptorPath(root)):null, s=readJson(settingsPath(root));
    if(d && d.schemaVersion!==1) throw new Error('Unsupported project schema version: '+d.schemaVersion+'. Use a compatible app; do not initialize/reset this project.');
    if(!d && s.ProjectSchemaVersion) throw new Error('Managed project descriptor retro-project.json is missing. Restore its backup; do not initialize/reset.');
    if(d) {
      if(typeof d.name!=='string' || !d.name.trim() || !d.paths || d.projectFolder!==root || d.paths.dataFolder!==root || !Array.isArray(d.paths.libraryFolders) || !Array.isArray(d.curationFiles)) throw new Error('Invalid managed project descriptor paths/name. Restore a valid retro-project.json backup.');
      for(const key of ['buildsFolder','compositeFolder','cacheFolder']) checkedPath(d.paths[key],{directory:true});
      try {
        const libraryKeys=values=>{
          if(!Array.isArray(values) || values.length>32) throw new Error('Expected an array of at most 32 library directories.');
          return values.map(lib=>{ const p=checkedPath(lib,{directory:true}); return process.platform==='win32'?p.toLowerCase():p; });
        };
        // Preserve declared order; CommercialRoot is independently pinned, not a LibraryRoots alias.
        if(JSON.stringify(libraryKeys(s.LibraryRoots))!==JSON.stringify(libraryKeys(d.paths.libraryFolders))) throw new Error('Ordered library paths differ.');
      } catch(e) { throw new Error('Managed metadata settings mismatch for LibraryRoots. Restore compatible descriptor/settings backups. '+e.message); }
      const expected=engineSettings(d);
      for(const key of ['SystemRoot','ConfigDir','CurationDir','RegistryPath','AssignmentPath','CartRegistryPath','BuildRoot','CompositeRoot','CacheRoot']) {
        if(checkedPath(s[key])!==expected[key]) throw new Error('Managed metadata settings mismatch for '+key+'. Restore compatible descriptor/settings backups.');
      }
    }
    for(const key of ['ConfigDir','CurationDir']) checkedPath(s[key],{directory:true,required:true});
    const libraryFolders=declaredLibraries(s);
    const paths=d?copy(d.paths):{dataFolder:root,buildsFolder:s.BuildRoot,compositeFolder:s.CompositeRoot || '',cacheFolder:s.CacheRoot || path.join(root,'CACHE'),libraryFolders};
    const registry=readCsv(s.RegistryPath,'AssetID').rows, assets=registry.length, carts=readCsv(s.CartRegistryPath,'CartID').rows.length;
    const warnings=d?copy(d.warnings || []):['Legacy project is read-only. Import a metadata copy to change settings. Composite outputs remain defined by existing recipes; no composite root was inferred.'];
    if(registry.some(row=>row.SourcePath && (!path.isAbsolute(row.SourcePath) || !paths.libraryFolders.some(lib=>within(lib,row.SourcePath))))) warnings.push('Existing source references outside registered library roots remain preserved. Add a TV/library root explicitly if desired; none was inferred and no media was scanned.');
    readCsv(s.AssignmentPath,'AssignmentID');
    const drafts=path.join(root,'STATE','studio-drafts');
    if(fs.existsSync(drafts)) checkedPath(drafts,{directory:true,required:true});
    const draftNames=fs.existsSync(drafts)?fs.readdirSync(drafts).filter(n=>n.endsWith('.json')):[];
    if(draftNames.length>MAX_FILES) throw new Error('Draft metadata exceeds 1000 file limit.');
    for(const name of draftNames) readJson(path.join(drafts,name));
    return {kind:d?'managed':'legacy',name:d?d.name:path.basename(root),projectFolder:root,readOnly:!d,paths,
      warnings:[...new Set(warnings)],
      summary:{assets,carts,drafts:draftNames.length}};
  }
  remember(project) {
    fs.mkdirSync(this.appDataDir,{recursive:true});
    const p=path.join(this.appDataDir,'projects.json');
    const old=fs.existsSync(p)?readJson(p):{recentProjects:[]};
    const recentProjects=[{name:project.name,projectFolder:project.projectFolder,kind:project.kind},...old.recentProjects.filter(x=>x.projectFolder!==project.projectFolder)].slice(0,20);
    atomic(p,encode({activeProject:project.projectFolder,recentProjects}));
  }
  rememberCommitted(root) {
    let project;
    try { project=this.inspect(root); }
    catch(e) { throw new Error('Project saved at '+root+' but readback failed. Do not replay; manually inspect the saved metadata. '+e.message); }
    try {this.remember(project);}
    catch(e) { throw new Error('Project saved at '+root+' but last/recent selection persistence failed or is uncertain. Do not replay the token; reopen this project explicitly. '+e.message); }
    return project;
  }
  withAppLock(action) {
    checkedPath(this.appDataDir,{directory:true}); fs.mkdirSync(this.appDataDir,{recursive:true});
    return withLock(path.join(this.appDataDir,'setup.lock'),action);
  }
  open(root) {
    const project=this.inspect(root), s=readJson(settingsPath(project.projectFolder));
    appDataSeparation(this.appDataDir,[project.projectFolder,...Object.values(project.paths).filter(x=>typeof x==='string'),...declaredLibraries(s),s.ConfigDir,s.CurationDir,...['RegistryPath','AssignmentPath','CartRegistryPath'].map(k=>path.dirname(s[k]))]);
    return this.withAppLock(()=>{const p=this.inspect(root); this.remember(p); return p;});
  }
  preview(input) {
    for(const [token,plan] of this.plans) if(Date.parse(plan.expiresAt)<=Date.now()) this.plans.delete(token);
    if(this.plans.size>=8) throw new Error('Pending review limit reached. Finish a review or wait up to five minutes for unused reviews to expire.');
    if(input.operation==='settings' && this.inspect(input.projectFolder).readOnly) throw new Error('Legacy project is read-only; import a copy before changing settings.');
    const value=validateInput(copy(input),this.installRoot), d=descriptor(value.name,value.projectFolder,value.paths);
    let source=null, summary={assets:0,carts:0,drafts:0}, warnings=[], changes=['Create empty metadata and chosen output directories.'];
    if(value.operation==='settings') {
      const previous=this.inspect(value.projectFolder); summary=previous.summary;
      source=collectSource(value.projectFolder);
      source.backupFiles=source.files.filter(file=>[descriptorPath(value.projectFolder),settingsPath(value.projectFolder)].includes(file.sourcePath));
      changes=['Update project name: '+previous.name+' -> '+value.name];
      for(const key of ['buildsFolder','compositeFolder','cacheFolder','libraryFolders']) changes.push(key+': '+String(previous.paths[key])+' -> '+String(value.paths[key]));
      warnings=['Roots are defaults for future writes only. Existing cart, source, draft and manifest references stay pinned and unchanged. No files are moved or relinked.',
        'Existing composite recipe output paths remain original; a new composite folder does not relocate old recipe outputs.'];
    }
    if(value.operation==='import') {
      value.sourceFolder=checkedPath(value.sourceFolder,{directory:true,required:true});
      summary=this.inspect(value.sourceFolder).summary;
      source=collectSource(value.sourceFolder);
      for(const lib of declaredLibraries(source.settings)) checkedPath(lib,{directory:true,required:true});
      warnings=[`Current manifests, source paths and drafts stay pinned to original locations including ${source.settings.BuildRoot}. Keep the original builds accessible.`,
        'Backup is metadata only, not entire build history or FINAL media. History is not copied in full.',
        'Existing composite recipe output paths remain original. The selected composite folder is a future default and does not relocate old recipe outputs.',
        'Chosen roots apply to future writes only. Existing registry/cart/source references are copied byte-for-byte, never relinked or migrated.'];
    }
    if(source) warnings.push(...source.warnings);
    warnings.push('Permission checks are preliminary only, not a writable guarantee. Confirm performs actual writes and surfaces filesystem/ACL errors.');
    appDataSeparation(this.appDataDir,[value.projectFolder,...Object.values(value.paths).filter(x=>typeof x==='string'),...value.paths.libraryFolders]);
    writeAccess(this.appDataDir);
    if(source) protectSource(value,source,this.appDataDir);
    const token=crypto.randomUUID(), expiresAt=new Date(Date.now()+5*60*1000).toISOString(), backupRelative=path.join('backups',token);
    if(source) d.curationFiles=source.files.filter(f=>f.target && f.target.startsWith('curation'+path.sep)).map(f=>path.basename(f.target));
    d.warnings=copy(warnings);
    this.plans.set(token,{input:value,d,expiresAt,source,backupRelative});
    return {token,expiresAt,operation:value.operation,project:{kind:'managed',name:d.name,projectFolder:d.projectFolder,readOnly:false,paths:copy(d.paths),warnings:copy(warnings),summary},
      changes:value.operation==='import'?['Copy selected metadata; preserve original references.']:changes,warnings,
      ...(source?{backup:path.join(d.projectFolder,backupRelative)}:{})};
  }
  confirm(token) {
    const plan=this.plans.get(token); this.plans.delete(token);
    if(!plan || Date.parse(plan.expiresAt)<=Date.now()) throw new Error('Preview token expired, unknown or already used; preview again.');
    validateInput(plan.input,this.installRoot);
    return this.withAppLock(()=>{
      fs.mkdirSync(path.dirname(plan.d.projectFolder),{recursive:true});
      return withLock(plan.d.projectFolder+'.setup.lock',()=>this.applyPlan(plan));
    });
  }
  applyPlan(plan) {
    const {d,source}=plan, root=d.projectFolder;
    validateInput(plan.input,this.installRoot);
    verifySource(plan,this.appDataDir);
    if(plan.input.operation==='settings') {
      writeBackup(root,plan.backupRelative,root,source.backupFiles);
      verifySource(plan,this.appDataDir);
      const settings={...source.settings,...engineSettings(d),CommercialRoot:source.settings.CommercialRoot || ''}, created=[]; let touched=false;
      try {
        for(const p of [d.paths.buildsFolder,d.paths.compositeFolder,d.paths.cacheFolder]) mkdirOwned(p,created);
        atomic(descriptorPath(root),encode(d)); touched=true;
        atomic(settingsPath(root),encode(settings));
      } catch(e) {
        try { if(touched) for(const file of source.backupFiles) atomic(file.sourcePath,file.data); removeEmptyCreated(created); }
        catch(rollback) { throw new Error('Settings failed; rollback needs manual inspection: '+rollback.message+'; original error: '+e.message); }
        throw e;
      }
      return this.rememberCommitted(root);
    }
    const stage=fs.mkdtempSync(path.join(path.dirname(root),'.retro-project-stage-'));
    const created=[], existed=fs.existsSync(root); let removedEmpty=false, published=false;
    try {
      for(const folder of ['STATE','config','curation']) fs.mkdirSync(path.join(stage,folder));
      if(source) {
        const receipt=writeBackup(stage,plan.backupRelative,plan.input.sourceFolder,source.files);
        for(const file of source.files) if(file.target) put(path.join(stage,file.target),file.data);
        put(path.join(stage,'import-receipt.json'),encode(receipt));
      } else for(const [file,header] of Object.entries(HEADERS)) put(path.join(stage,'STATE',file),header+'\r\n');
      put(path.join(stage,'retro-project.json'),encode(d));
      const settings={...(source?source.settings:{}),...engineSettings(d)};
      if(source) settings.CommercialRoot=source.settings.CommercialRoot;
      put(path.join(stage,'STATE','settings.json'),encode(settings));
      for(const p of [d.paths.buildsFolder,d.paths.compositeFolder,d.paths.cacheFolder]) {
        if(within(root,p)) fs.mkdirSync(path.join(stage,path.relative(root,p)),{recursive:true});
        else mkdirOwned(p,created);
      }
      // The sibling exclusive lock is the setup reservation; never replace nonempty data.
      verifySource(plan,this.appDataDir);
      validateInput(plan.input,this.installRoot);
      if(existed) { fs.rmdirSync(root); removedEmpty=true; }
      fs.renameSync(stage,root); published=true;
    } catch(e) {
      if(!published) {
        try {
          fs.rmSync(stage,{recursive:true,force:true}); removeEmptyCreated(created);
          if(removedEmpty && !fs.existsSync(root)) fs.mkdirSync(root);
        } catch(rollback) {throw new Error('Publication failed; rollback needs manual inspection: '+rollback.message+'; original: '+e.message);}
      }
      throw e;
    }
    return this.rememberCommitted(root);
  }
}
module.exports={ProjectStore};
