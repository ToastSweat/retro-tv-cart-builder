'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const scratch = process.env.RETRO_TV_TEST_ROOT;
assert.ok(scratch && path.isAbsolute(scratch), 'Set RETRO_TV_TEST_ROOT to an absolute disposable scratch directory.');
fs.mkdirSync(scratch, { recursive: true });
function fixture(t) {
  const root = fs.mkdtempSync(path.join(scratch, 'project-store-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const appDataDir = path.join(root, 'appdata');
  const installRoot = path.join(root, 'install'); fs.mkdirSync(installRoot);
  const projectFolder = path.join(root, 'project [new]');
  const paths = { buildsFolder: path.join(root, 'builds'), compositeFolder: path.join(root, 'composites'), cacheFolder: path.join(projectFolder, 'CACHE'), libraryFolders: [] };
  const store = () => new (require('../project-store').ProjectStore)({appDataDir, installRoot});
  return { root, appDataDir, installRoot, projectFolder, paths, store, input: { operation: 'create', name: 'Empty project', projectFolder, paths } };
}
function json(p) { return JSON.parse(fs.readFileSync(p, 'utf8')); }
function snapshot(root) {
  const result = {};
  function walk(dir) { for (const e of fs.readdirSync(dir, {withFileTypes:true})) { const p=path.join(dir,e.name); if(e.isSymbolicLink()) result[path.relative(root,p)]='link:'+fs.readlinkSync(p); else if(e.isDirectory()) walk(p); else result[path.relative(root,p)]=crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex'); } }
  walk(root); return result;
}
function legacy(f) {
  const root=path.join(f.root,'legacy'), external=path.join(f.root,'external');
  const state=path.join(root,'STATE'), config=path.join(external,'config'), curation=path.join(external,'curation'), builds=path.join(external,'builds'), library=path.join(external,'library');
  for(const p of [state,config,curation,builds,library,path.join(state,'studio-drafts'),path.join(config,'composites')]) fs.mkdirSync(p,{recursive:true});
  const put=(p,s)=>fs.writeFileSync(p,s);
  const manifest=path.join(builds,'cart-manifest.csv'); put(manifest,'Position,AssetID,SourcePath\r\n1,KEEP-ID,original-source.mp4\r\n');
  const settings={SystemRoot:root,ConfigDir:config,CurationDir:curation,CommercialRoot:library,BuildRoot:builds,RegistryPath:path.join(external,'registry.csv'),AssignmentPath:path.join(external,'assignments.csv'),CartRegistryPath:path.join(external,'carts.csv')};
  put(path.join(state,'settings.json'),JSON.stringify(settings));
  put(settings.RegistryPath,'\uFEFFAssetID,SourcePath,UserNotes\r\nKEEP-ID,"original-source.mp4","notes, with\nnewline"\r\n');
  put(settings.AssignmentPath,'AssignmentID,CartID,AssetID\r\nUSE-ID,CART-ID,KEEP-ID\r\n');
  put(settings.CartRegistryPath,`CartID,CurrentRevision,ManifestPath\r\nCART-ID,3,"${manifest}"\r\n`);
  put(path.join(state,'handpicked-branding.csv'),'AssetID,SourcePath\r\nBR-ID,branding.mp4\r\n');
  put(path.join(state,'studio-drafts','CART-ID-r003.json'),JSON.stringify({cartId:'CART-ID',baseRevision:3,baseManifestPath:manifest,slots:[{assetId:'KEEP-ID'}]}));
  put(path.join(config,'CART-ID.json'),JSON.stringify({CartID:'CART-ID',Episodes:[{SourcePath:'original-source.mp4'}]}));
  put(path.join(config,'composites','recipe.json'),JSON.stringify({Jobs:[{OutputPath:path.join(library,'old-composite.mp4')}]}));
  put(path.join(curation,'branding-curation.csv'),'Id,RootRelativePath\r\nBR-ID,branding.mp4\r\n');
  put(path.join(curation,'commercial-curation.csv'),'ID,SourcePack,RelativePath\r\nAD-ID,Old pack,ad.mp4\r\n');
  put(path.join(curation,'commercial-curation-2000-2002.csv'),'ID,RelativePath\r\nAD-00,ad00.mp4\r\n');
  return {root,external,state,config,curation,builds,library,manifest,settings};
}
test('pending reviews have a bounded lifetime and admission count without writing files', t => {
  const f=fixture(t), s=f.store();const before=snapshot(f.root), plans=[];
  for(let i=0;i<8;i++)plans.push(s.preview(f.input));
  assert.throws(()=>s.preview(f.input),/pending reviews|review limit/i);
  s.plans.get(plans[0].token).expiresAt=new Date(Date.now()-1).toISOString();
  assert.doesNotThrow(()=>s.preview(f.input));
  assert.equal(s.plans.size,8);assert.deepEqual(snapshot(f.root),before);
});

test('a generic library folder is not silently designated as a commercial source root', t => {
  const f=fixture(t), library=path.join(f.root,'TV'), s=f.store(); fs.mkdirSync(library);
  s.confirm(s.preview({...f.input,paths:{...f.paths,libraryFolders:[library]}}).token);
  assert.equal(json(path.join(f.projectFolder,'STATE/settings.json')).CommercialRoot,'');
});

test('changing library order does not reassign an imported commercial source root', t => {
  const f=fixture(t), l=legacy(f), s=f.store();
  s.confirm(s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}}).token);
  const other=path.join(f.root,'other-library'); fs.mkdirSync(other);
  s.confirm(s.preview({...f.input,operation:'settings',paths:{...f.paths,libraryFolders:[other,l.library]}}).token);
  assert.equal(json(path.join(f.projectFolder,'STATE/settings.json')).CommercialRoot,l.library);
});

test('source changes during backup staging invalidate publication rather than publishing a stale copy', t => {
  const f=fixture(t), l=legacy(f), s=f.store(), p=s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}});
  const write=fs.writeFileSync; let changed=false;
  fs.writeFileSync=(file,...args)=>{ const result=write(file,...args); if(!changed && typeof file==='string' && file.endsWith('receipt.json')) {changed=true;fs.appendFileSync(l.settings.RegistryPath,'CHANGED,changed.mp4,note\r\n');} return result; };
  try {assert.throws(()=>s.confirm(p.token),/stale|changed|preview again/i);} finally {fs.writeFileSync=write;}
  assert.ok(changed);assert.equal(fs.existsSync(f.projectFolder),false);assert.equal(fs.existsSync(f.paths.buildsFolder),false);
  assert.ok(!fs.readdirSync(f.root).some(n=>n.startsWith('.retro-project-stage-')));
});
test('import selects initializer-current curation, excludes derivative data and preserves ordinary config names', t => {
  const f=fixture(t), l=legacy(f), s=f.store();
  fs.writeFileSync(path.join(l.config,'CACHE-CART.json'),'{"CartID":"CACHE-CART"}');
  fs.writeFileSync(path.join(l.config,'composites','derived.mp4'),'not metadata');
  fs.mkdirSync(path.join(l.state,'backups'));fs.writeFileSync(path.join(l.state,'backups','old.json'),'{broken old backup');
  fs.mkdirSync(path.join(l.state,'CACHE'));fs.writeFileSync(path.join(l.state,'CACHE','old.json'),'{broken cache');
  fs.writeFileSync(path.join(l.state,'video.mp4'),'source media excluded');
  const newer=path.join(l.curation,'branding-curation-latest.csv'); fs.writeFileSync(newer,'Id,RootRelativePath\r\nLATEST,latest.mp4\r\n');fs.utimesSync(newer,new Date(),new Date(Date.now()+3000));
  const notNineties=path.join(l.curation,'commercial-curation-not-the-schema.csv');fs.writeFileSync(notNineties,'ID,RelativePath\r\nOTHER,other.mp4\r\n');fs.utimesSync(notNineties,new Date(),new Date(Date.now()+4000));
  const p=s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}});s.confirm(p.token);
  assert.ok(fs.existsSync(path.join(f.projectFolder,'config','CACHE-CART.json')));
  assert.deepEqual(fs.readFileSync(path.join(f.projectFolder,'curation','branding-curation-latest.csv')),fs.readFileSync(newer));
  assert.equal(fs.existsSync(path.join(f.projectFolder,'curation','branding-curation.csv')),false);
  assert.ok(fs.existsSync(path.join(f.projectFolder,'curation','commercial-curation.csv')));
  assert.equal(fs.existsSync(path.join(f.projectFolder,'curation','commercial-curation-not-the-schema.csv')),false);
  const names=Object.keys(snapshot(f.projectFolder));
  assert.ok(!names.some(n=>/derived.mp4|video.mp4|old.json/.test(n)));
});
test('import and settings allow absent optional 2000-2002 curation with a visible warning', t => {
  const f=fixture(t), l=legacy(f), s=f.store();
  fs.unlinkSync(path.join(l.curation,'commercial-curation-2000-2002.csv'));
  const before=snapshot(l.root), external=snapshot(l.external);
  const p=s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}});
  assert.match(p.warnings.join(' '),/optional.*2000[-–]2002.*(absent|missing)/i);
  const imported=s.confirm(p.token), curation=path.join(f.projectFolder,'curation');
  assert.deepEqual(fs.readdirSync(curation).sort(),['branding-curation.csv','commercial-curation.csv']);
  assert.deepEqual(json(path.join(f.projectFolder,'retro-project.json')).curationFiles.sort(),fs.readdirSync(curation).sort());
  for(const name of fs.readdirSync(curation)) assert.deepEqual(fs.readFileSync(path.join(curation,name)),fs.readFileSync(path.join(l.curation,name)));
  assert.match(imported.warnings.join(' '),/optional.*2000[-–]2002.*(absent|missing)/i);
  assert.deepEqual(snapshot(l.root),before); assert.deepEqual(snapshot(l.external),external);
  const settings=s.preview({...f.input,operation:'settings',name:'Optional pool still absent',paths:{...f.paths,libraryFolders:[l.library]}});
  assert.match(settings.warnings.join(' '),/optional.*2000[-–]2002.*(absent|missing)/i);
  assert.equal(s.confirm(settings.token).name,'Optional pool still absent');
  assert.deepEqual(fs.readdirSync(curation).sort(),['branding-curation.csv','commercial-curation.csv']);
  assert.deepEqual(snapshot(l.root),before); assert.deepEqual(snapshot(l.external),external);
});
test('write permission preflight is read-only and legacy opening never requests source write access', t => {
  const f=fixture(t), l=legacy(f), s=f.store(), access=fs.accessSync, before=snapshot(f.root);
  let writableChecked=false;
  fs.accessSync=(p,mode)=>{if((mode & fs.constants.W_OK) && path.resolve(p)===f.root){writableChecked=true;const e=new Error('Synthetic write ACL denial');e.code='EACCES';throw e;}return access(p,mode);};
  try {assert.throws(()=>s.preview(f.input),/ACL denial|EACCES/);} finally {fs.accessSync=access;}
  assert.equal(writableChecked,true); assert.deepEqual(snapshot(f.root),before);
  fs.accessSync=(p,mode)=>{if((mode & fs.constants.W_OK) && path.resolve(p).startsWith(l.root)) throw new Error('Legacy is read-only'); return access(p,mode);};
  try {assert.equal(s.open(l.root).readOnly,true);} finally {fs.accessSync=access;}
  const p=s.preview(f.input); assert.match(p.warnings.join(' '),/permission.*(preliminary|guarantee)|preliminary.*permission/i);
});
test('app-data, install files and original declared libraries stay outside every write boundary', t => {
  const f=fixture(t), l=legacy(f), s=f.store(), Store=require('../project-store').ProjectStore;
  const bad=new Store({appDataDir:path.join(l.root,'STATE','appdata'),installRoot:f.installRoot}), before=snapshot(l.root);
  assert.throws(()=>bad.open(l.root),/app.data|overlap|separate/i); assert.deepEqual(snapshot(l.root),before);
  assert.throws(()=>new Store({appDataDir:f.projectFolder,installRoot:f.installRoot}).preview(f.input),/app.data|overlap|separate/i);
  assert.throws(()=>s.preview({...f.input,paths:{...f.paths,buildsFolder:path.join(f.installRoot,'builds')}}),/install|overlap|separate/i);
  const imported={...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}};
  assert.throws(()=>s.preview({...imported,paths:{...imported.paths,buildsFolder:path.join(l.config,'new-output')}}),/source|metadata|overlap/i);
  const target=path.join(l.config,'composites'); fs.rmSync(target,{recursive:true}); fs.symlinkSync(l.library,target,'junction');
  assert.throws(()=>s.preview(imported),/symlink|junction/i); fs.unlinkSync(target);fs.mkdirSync(target);
  s.confirm(s.preview(imported).token);
  assert.throws(()=>s.preview({...f.input,operation:'settings',paths:{...f.paths,libraryFolders:[],buildsFolder:path.join(l.library,'danger')}}),/original.*library|overlap|source/i);
});
test('managed metadata boundaries reject missing descriptor, redirected metadata, invalid schema shape and oversized reads', t => {
  const f=fixture(t), s=f.store(); s.confirm(s.preview(f.input).token);
  const dp=path.join(f.projectFolder,'retro-project.json'), sp=path.join(f.projectFolder,'STATE/settings.json'), savedD=fs.readFileSync(dp), savedS=fs.readFileSync(sp), settings=json(sp);
  fs.unlinkSync(dp); assert.throws(()=>s.inspect(f.projectFolder),/descriptor|retro-project.json|managed/i); fs.writeFileSync(dp,savedD);
  fs.writeFileSync(dp,JSON.stringify({...json(dp),paths:{}})); assert.throws(()=>s.inspect(f.projectFolder),/path|descriptor/i); fs.writeFileSync(dp,savedD);
  const external=path.join(f.root,'redirected.csv'); fs.copyFileSync(settings.RegistryPath,external);
  fs.writeFileSync(sp,JSON.stringify({...settings,RegistryPath:external})); assert.throws(()=>s.inspect(f.projectFolder),/managed|metadata|RegistryPath|mismatch/i); fs.writeFileSync(sp,savedS);
  const oldRegistry=fs.readFileSync(settings.RegistryPath), fd=fs.openSync(settings.RegistryPath,'w'); fs.ftruncateSync(fd,65*1024*1024);fs.closeSync(fd);
  assert.throws(()=>s.inspect(f.projectFolder),/64 MiB|limit|large/i); fs.writeFileSync(settings.RegistryPath,oldRegistry);
  fs.writeFileSync(settings.RegistryPath,'Unrelated,Columns\n'); assert.throws(()=>s.inspect(f.projectFolder),/header|schema|AssetID/i); fs.writeFileSync(settings.RegistryPath,oldRegistry);
  const aliasTarget=path.join(f.root,'draft-target'); fs.mkdirSync(aliasTarget); const drafts=path.join(f.projectFolder,'STATE/studio-drafts'); fs.symlinkSync(aliasTarget,drafts,'junction');
  assert.throws(()=>s.inspect(f.projectFolder),/symlink|junction/i); assert.throws(()=>s.preview({...f.input,operation:'settings'}),/symlink|junction/i);
});
test('managed LibraryRoots must match descriptor paths in order before inspect, open or settings preview', t => {
  const f=fixture(t), s=f.store(), a=path.join(f.root,'library-a'), b=path.join(f.root,'library-b');
  fs.mkdirSync(a); fs.mkdirSync(b);
  const paths={...f.paths,libraryFolders:[a,b]};
  s.confirm(s.preview({...f.input,paths}).token);
  const sp=path.join(f.projectFolder,'STATE/settings.json'), saved=fs.readFileSync(sp), settings=json(sp);
  for(const LibraryRoots of [[b],[b,a],[],[a,b,a],undefined,null,'not-an-array',[a,'relative'],[a,42],Array(33).fill(a)]) {
    fs.writeFileSync(sp,JSON.stringify({...settings,LibraryRoots}));
    const before=snapshot(f.root), pending=s.plans.size;
    for(const action of [()=>s.inspect(f.projectFolder),()=>s.open(f.projectFolder),()=>s.preview({...f.input,operation:'settings',paths})]) {
      assert.throws(action,/LibraryRoots.*(restore|compatible|backup)/i);
      assert.deepEqual(snapshot(f.root),before);
    }
    assert.equal(s.plans.size,pending);
  }
  fs.writeFileSync(sp,saved);
  assert.deepEqual(s.inspect(f.projectFolder).paths.libraryFolders,[a,b]);
  const preview=s.preview({...f.input,operation:'settings',name:'Restored',paths});
  assert.equal(s.confirm(preview.token).name,'Restored');
  assert.deepEqual(json(sp).LibraryRoots,[a,b]);
});
test('managed LibraryRoots comparison normalizes local paths without making CommercialRoot the first library', t => {
  const f=fixture(t), s=f.store(), a=path.join(f.root,'library-a'), b=path.join(f.root,'library-b');
  fs.mkdirSync(a); fs.mkdirSync(b);
  const paths={...f.paths,libraryFolders:[a]}; s.confirm(s.preview({...f.input,paths}).token);
  const sp=path.join(f.projectFolder,'STATE/settings.json'), settings=json(sp);
  const alternate=path.join(a,'..',path.basename(a))+path.sep;
  fs.writeFileSync(sp,JSON.stringify({...settings,LibraryRoots:[process.platform==='win32'?alternate.toUpperCase():alternate],CommercialRoot:b}));
  assert.deepEqual(s.inspect(f.projectFolder).paths.libraryFolders,[a]);
  const p=s.preview({...f.input,operation:'settings',name:'Normalized roots',paths});
  assert.equal(s.confirm(p.token).name,'Normalized roots');
  assert.equal(json(sp).CommercialRoot,b);
  assert.deepEqual(json(sp).LibraryRoots,[a]);
});
test('unregistered existing source references remain preserved with warnings, never inferred into new library roots', t => {
  const f=fixture(t), l=legacy(f), s=f.store();
  const p=s.inspect(l.root); assert.deepEqual(p.paths.libraryFolders,[l.library]);
  assert.match(p.warnings.join(' '),/outside.*(registered|declared).*roots|unregistered.*source/i);
  const imported=s.confirm(s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}}).token);
  assert.match(imported.warnings.join(' '),/outside.*(registered|declared).*roots|unregistered.*source/i);
  assert.deepEqual(imported.paths.libraryFolders,[l.library]);
  assert.deepEqual(f.store().status().activeProject.warnings,imported.warnings);
});
test('committed project survives app-data persistence failure with an explicit no-replay recovery message', t => {
  const f=fixture(t), s=f.store(), p=s.preview(f.input), rename=fs.renameSync;
  fs.renameSync=(a,b)=>{if(path.resolve(b)===path.join(f.appDataDir,'projects.json')) throw new Error('Synthetic app-data save denial'); return rename(a,b);};
  try {assert.throws(()=>s.confirm(p.token),/project.*saved|saved.*project/i);} finally {fs.renameSync=rename;}
  assert.equal(s.inspect(f.projectFolder).kind,'managed'); assert.throws(()=>s.confirm(p.token),/token|used/i);
  assert.equal(s.open(f.projectFolder).projectFolder,f.projectFolder); assert.equal(f.store().status().activeProject.projectFolder,f.projectFolder);
});
test('settings ordinary write and output-directory failures restore the old descriptor and engine settings', t => {
  const f=fixture(t), s=f.store();s.confirm(s.preview(f.input).token);
  const dp=path.join(f.projectFolder,'retro-project.json'), sp=path.join(f.projectFolder,'STATE/settings.json');
  const descriptor=fs.readFileSync(dp), settings=fs.readFileSync(sp), refs=snapshot(path.join(f.projectFolder,'STATE'));
  for(const fault of ['settings-rename','output-mkdir']) {
    const target=path.join(f.root,'future-'+fault), p=s.preview({...f.input,operation:'settings',name:'Must roll back',paths:{...f.paths,buildsFolder:target}});
    const rename=fs.renameSync, mkdir=fs.mkdirSync; let fired=false;
    fs.renameSync=(a,b)=>{ if(!fired && fault==='settings-rename' && path.resolve(b)===sp) {fired=true;throw new Error('Synthetic settings rename denial');} return rename(a,b); };
    fs.mkdirSync=(a,...args)=>{if(!fired && fault==='output-mkdir' && path.resolve(a)===target){fired=true;throw new Error('Synthetic output mkdir denial');}return mkdir(a,...args);};
    try {assert.throws(()=>s.confirm(p.token),/Synthetic.*denial/);} finally {fs.renameSync=rename;fs.mkdirSync=mkdir;}
    assert.ok(fired); assert.deepEqual(fs.readFileSync(dp),descriptor); assert.deepEqual(fs.readFileSync(sp),settings);
    assert.deepEqual(snapshot(path.join(f.projectFolder,'STATE')),refs); assert.equal(fs.existsSync(target),false);
    assert.equal(s.status().activeProject.name,'Empty project');
    assert.ok(fs.existsSync(path.join(p.backup,'receipt.json')));
  }
});
test('settings backup rejects an existing junction parent without external writes', t => {
  const f=fixture(t), s=f.store(); s.confirm(s.preview(f.input).token);
  const external=path.join(f.root,'backup-victim'); fs.mkdirSync(external);
  fs.writeFileSync(path.join(external,'sentinel'),'must stay unchanged');
  fs.symlinkSync(external,path.join(f.projectFolder,'backups'),'junction');
  const p=s.preview({...f.input,operation:'settings',name:'Must not save'}), before=snapshot(f.root);
  assert.throws(()=>s.confirm(p.token),/symlink|junction/i);
  assert.deepEqual(snapshot(f.root),before);
  assert.deepEqual(fs.readdirSync(external),['sentinel']);
});
for(const occupied of ['empty','hardlink','symlink']) test('settings backup rejects a preexisting token directory: '+occupied, t => {
  const f=fixture(t), s=f.store(); s.confirm(s.preview(f.input).token);
  const p=s.preview({...f.input,operation:'settings',name:'Must not save'});
  fs.mkdirSync(p.backup,{recursive:true});
  if(occupied!=='empty') {
    const inputs=path.join(p.backup,'inputs'); fs.mkdirSync(inputs);
    const sentinel=path.join(f.root,'sentinel'); fs.writeFileSync(sentinel,'original victim bytes');
    const target=path.join(inputs,'0000-settings.json');
    if(occupied==='hardlink') fs.linkSync(sentinel,target);
    else {
      try { fs.symlinkSync(sentinel,target,'file'); }
      catch(e) { if(e.code==='EPERM') { t.skip('File symlink privilege unavailable'); return; } throw e; }
    }
  }
  const before=snapshot(f.root);
  assert.throws(()=>s.confirm(p.token),/EEXIST|already exists|existing|occupied/i);
  assert.deepEqual(snapshot(f.root),before);
  assert.ok(fs.statSync(p.backup).isDirectory());
});
test('backup writes and receipt are exclusive, verified and retained on late backup failure', t => {
  const f=fixture(t), s=f.store(); s.confirm(s.preview(f.input).token);
  const dp=path.join(f.projectFolder,'retro-project.json'), sp=path.join(f.projectFolder,'STATE/settings.json');
  const descriptor=fs.readFileSync(dp), settings=fs.readFileSync(sp);
  const p=s.preview({...f.input,operation:'settings',name:'Must not save'}), write=fs.writeFileSync;
  const writes=[];
  fs.writeFileSync=(file,data,options)=>{
    if(typeof file==='string' && file.startsWith(p.backup+path.sep)) {
      writes.push({file,flag:options && options.flag});
      return write(file,file.endsWith('receipt.json')?'corrupt receipt':data,options);
    }
    return write(file,data,options);
  };
  try { assert.throws(()=>s.confirm(p.token),/backup.*verification|verification.*backup/i); }
  finally { fs.writeFileSync=write; }
  assert.deepEqual(writes.map(w=>w.flag),['wx','wx','wx']);
  assert.deepEqual(fs.readFileSync(dp),descriptor); assert.deepEqual(fs.readFileSync(sp),settings);
  assert.ok(fs.existsSync(path.join(p.backup,'inputs','0000-settings.json')));
  assert.equal(fs.readFileSync(path.join(p.backup,'receipt.json'),'utf8'),'corrupt receipt');
});
test('fresh managed projects support settings and managed metadata copy without any private curation', t => {
  const f=fixture(t), s=f.store(); s.confirm(s.preview(f.input).token);
  const p=s.preview({...f.input,operation:'settings',name:'Fresh settings'});
  assert.equal(s.confirm(p.token).name,'Fresh settings');
  const destination=path.join(f.root,'managed-copy');
  const paths={buildsFolder:path.join(f.root,'copy-builds'),compositeFolder:path.join(f.root,'copy-composites'),cacheFolder:path.join(destination,'CACHE'),libraryFolders:[]};
  const before=snapshot(f.projectFolder), imported=s.confirm(s.preview({...f.input,operation:'import',sourceFolder:f.projectFolder,projectFolder:destination,paths}).token);
  assert.deepEqual(imported.summary,{assets:0,carts:0,drafts:0}); assert.deepEqual(snapshot(f.projectFolder),before);
  assert.equal(json(path.join(destination,'STATE/settings.json')).CurationDir,path.join(destination,'curation'));
});
test('import stages a complete verified backup before publication and rolls back ordinary publish failures', t => {
  const f=fixture(t), l=legacy(f), s=f.store(); fs.mkdirSync(f.appDataDir); fs.mkdirSync(f.paths.buildsFolder); fs.writeFileSync(path.join(f.paths.buildsFolder,'keep.mp4'),'existing output');
  for(const existed of [false,true]) {
    if(existed) fs.mkdirSync(f.projectFolder);
    const p=s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}});
    const before=snapshot(f.root), names=fs.readdirSync(f.root).sort(), rename=fs.renameSync; let reached=false;
    fs.renameSync=(a,b)=>{
      if(path.resolve(b)===f.projectFolder) {reached=true; assert.ok(fs.existsSync(path.join(a,'backups',p.token,'receipt.json'))); assert.equal(fs.statSync(a).dev,fs.statSync(f.root).dev); const e=new Error('Synthetic publish ACL denial');e.code='EACCES';throw e;}
      return rename(a,b);
    };
    try { assert.throws(()=>s.confirm(p.token),/publish ACL denial/); } finally {fs.renameSync=rename;}
    assert.equal(reached,true); assert.equal(fs.existsSync(f.projectFolder),existed);
    assert.deepEqual(snapshot(f.root),before); assert.deepEqual(fs.readdirSync(f.root).sort(),names);
    if(existed) assert.deepEqual(fs.readdirSync(f.projectFolder),[]);
  }
});
test('cross-process project and app-data locks block writes and are never auto-cleared', async t => {
  const {spawn}=require('node:child_process'); const {once}=require('node:events');
  const f=fixture(t), s=f.store(); fs.mkdirSync(f.appDataDir);
  for(const lockPath of [path.join(f.appDataDir,'setup.lock'),f.projectFolder+'.setup.lock']) {
    const child=spawn(process.execPath,['-e',`const fs=require('node:fs');fs.writeFileSync(process.argv[1],JSON.stringify({owner:'other-process',pid:process.pid}),{flag:'wx'});process.stdout.write('ready');setInterval(()=>{},1000);`,lockPath],{stdio:['ignore','pipe','pipe']});
    try {
      await once(child.stdout,'data');
      const p=s.preview(f.input), before=snapshot(f.root);
      assert.throws(()=>s.confirm(p.token),/lock.*(manual|inspect|restart)|another.*process/i);
      assert.deepEqual(snapshot(f.root),before); assert.equal(json(lockPath).owner,'other-process');
      assert.throws(()=>s.confirm(p.token),/token|used/i);
    } finally {child.kill(); await once(child,'exit'); fs.unlinkSync(lockPath);}
  }
  s.confirm(s.preview(f.input).token);
  assert.equal(fs.existsSync(f.projectFolder+'.setup.lock'),false);assert.equal(fs.existsSync(path.join(f.appDataDir,'setup.lock')),false);
  fs.writeFileSync(path.join(f.appDataDir,'setup.lock'),'stale unknown owner');
  assert.throws(()=>f.store().open(f.projectFolder),/lock|process/i);
});
test('import refuses incomplete or overlapping source authority and bounded metadata failures', t => {
  const f=fixture(t), l=legacy(f), s=f.store(), input={...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}};
  for(const p of [l.manifest,l.settings.AssignmentPath,path.join(l.curation,'commercial-curation.csv'),path.join(l.curation,'branding-curation.csv')]) {
    fs.renameSync(p,p+'.saved'); assert.throws(()=>s.preview(input),/missing|curation|manifest|directory|ENOENT/i); fs.renameSync(p+'.saved',p);
  }
  assert.throws(()=>s.preview({...input,projectFolder:path.join(l.root,'copy')}),/overlap|source/i);
  assert.throws(()=>s.preview({...input,projectFolder:path.join(l.config,'copy')}),/overlap|source/i);
  assert.throws(()=>s.preview({...input,paths:{...f.paths,libraryFolders:[],buildsFolder:path.join(l.library,'unsafe')}}),/overlap|source|library/i);
  const huge=path.join(l.state,'huge.json'); const fd=fs.openSync(huge,'w'); fs.ftruncateSync(fd,65*1024*1024);fs.closeSync(fd);
  assert.throws(()=>s.preview(input),/64 MiB|limit|large/i); fs.unlinkSync(huge);
  for(let i=0;i<1001;i++) fs.writeFileSync(path.join(l.config,`extra-${i}.json`),'{}');
  assert.throws(()=>s.preview(input),/1000|limit/i);
  assert.equal(fs.existsSync(f.projectFolder),false); assert.equal(fs.existsSync(f.appDataDir),false);
});
test('confirm rejects stale metadata, newer curation selection, occupied destinations and expired previews before writing', t => {
  const f=fixture(t), l=legacy(f), s=f.store(); const input={...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}};
  let p=s.preview(input); fs.appendFileSync(l.settings.RegistryPath,'OTHER-ID,other.mp4,note\r\n');
  let before=snapshot(f.root); assert.throws(()=>s.confirm(p.token),/stale|changed|preview again/i); assert.deepEqual(snapshot(f.root),before); assert.throws(()=>s.confirm(p.token),/token|used/i);
  p=s.preview(input); const newCuration=path.join(l.curation,'branding-curation-new.csv'); fs.copyFileSync(path.join(l.curation,'branding-curation.csv'),newCuration); fs.utimesSync(newCuration,new Date(),new Date(Date.now()+2000));
  before=snapshot(f.root); assert.throws(()=>s.confirm(p.token),/stale|changed|preview again/i); assert.deepEqual(snapshot(f.root),before);
  p=s.preview(input); fs.mkdirSync(f.projectFolder); fs.writeFileSync(path.join(f.projectFolder,'keep.txt'),'keep'); before=snapshot(f.root);
  assert.throws(()=>s.confirm(p.token),/empty|changed|occupied/i); assert.deepEqual(snapshot(f.root),before);
  fs.rmSync(f.projectFolder,{recursive:true});
  p=s.preview(input); const now=Date.now; Date.now=()=>now()+6*60*1000;
  try {assert.throws(()=>s.confirm(p.token),/expired/i);} finally {Date.now=now;}
  assert.equal(fs.existsSync(f.projectFolder),false);
  s.confirm(s.preview(input).token);
  p=s.preview({...f.input,operation:'settings',paths:{...f.paths,libraryFolders:[l.library]}});
  const registry=json(path.join(f.projectFolder,'STATE/settings.json')).RegistryPath; fs.appendFileSync(registry,'NEW-ID,new.mp4,added\r\n');
  before=snapshot(f.root); assert.throws(()=>s.confirm(p.token),/stale|changed|preview again/i); assert.deepEqual(snapshot(f.root),before);
});
test('managed settings back up engine settings and descriptor, change future roots only and leave references pinned', t => {
  const f=fixture(t), l=legacy(f), s=f.store(); s.confirm(s.preview({...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,libraryFolders:[l.library]}}).token);
  const stateBefore=snapshot(path.join(f.projectFolder,'STATE')), configBefore=snapshot(path.join(f.projectFolder,'config'));
  const oldDescriptor=fs.readFileSync(path.join(f.projectFolder,'retro-project.json')), oldSettings=fs.readFileSync(path.join(f.projectFolder,'STATE/settings.json'));
  const paths={buildsFolder:path.join(f.root,'next-builds'),compositeFolder:path.join(f.root,'next-composites'),cacheFolder:path.join(f.root,'next-cache'),libraryFolders:[l.library]};
  const before=snapshot(f.root), p=s.preview({...f.input,operation:'settings',name:'Renamed',paths});
  assert.deepEqual(snapshot(f.root),before);
  for(const v of [f.paths.buildsFolder,paths.buildsFolder,f.paths.compositeFolder,paths.compositeFolder,f.paths.cacheFolder,paths.cacheFolder]) assert.ok(p.changes.join(' ').includes(v),v);
  assert.match(p.warnings.join(' '),/future.*(writes|default)|default.*future/i);
  assert.match(p.warnings.join(' '),/pinned|unchanged/i);
  const result=s.confirm(p.token); assert.equal(result.name,'Renamed'); assert.equal(result.paths.buildsFolder,paths.buildsFolder);
  const newState=snapshot(path.join(f.projectFolder,'STATE')); delete newState['settings.json']; delete stateBefore['settings.json']; assert.deepEqual(newState,stateBefore);
  assert.deepEqual(snapshot(path.join(f.projectFolder,'config')),configBefore);
  const receipt=json(path.join(p.backup,'receipt.json'));
  for(const [name,data] of [['retro-project.json',oldDescriptor],['settings.json',oldSettings]]) assert.deepEqual(fs.readFileSync(path.join(p.backup,receipt.files.find(x=>path.basename(x.sourcePath)===name).backupPath)),data);
  assert.equal(json(path.join(f.projectFolder,'STATE/settings.json')).BuildRoot,paths.buildsFolder);
  assert.equal(f.store().status().activeProject.name,'Renamed');
});
test('import copies distributed authoritative bytes, verified backup and pinned draft/current-manifest references without changing source', t => {
  const f=fixture(t), l=legacy(f), s=f.store(), before=snapshot(l.root), external=snapshot(l.external);
  const input={...f.input,operation:'import',sourceFolder:l.root,paths:{...f.paths,buildsFolder:l.builds,libraryFolders:[l.library]}};
  const allBefore=snapshot(f.root), p=s.preview(input);
  assert.deepEqual(snapshot(f.root),allBefore);
  assert.deepEqual(p.project.summary,{assets:1,carts:1,drafts:1});
  assert.match(p.warnings.join(' '),/manifest.*original|original.*manifest/i);
  assert.match(p.warnings.join(' '),/recipe.*output|output.*recipe/i);
  assert.match(p.warnings.join(' '),/not.*(entire|full).*history|history.*not.*copied/i);
  assert.ok(p.backup.startsWith(path.join(f.projectFolder,'backups')));
  // Preview response and caller input cannot mutate the committed plan.
  input.name='MUTATED'; p.project.paths.buildsFolder=path.join(f.root,'evil');
  const project=s.confirm(p.token), settings=json(path.join(f.projectFolder,'STATE/settings.json'));
  assert.equal(project.name,'Empty project'); assert.equal(settings.BuildRoot,l.builds);
  assert.equal(settings.ConfigDir,path.join(f.projectFolder,'config')); assert.equal(settings.CurationDir,path.join(f.projectFolder,'curation'));
  for(const key of ['RegistryPath','AssignmentPath','CartRegistryPath']) assert.deepEqual(fs.readFileSync(settings[key]),fs.readFileSync(l.settings[key]));
  assert.deepEqual(fs.readFileSync(path.join(f.projectFolder,'STATE/studio-drafts/CART-ID-r003.json')),fs.readFileSync(path.join(l.state,'studio-drafts/CART-ID-r003.json')));
  assert.deepEqual(json(path.join(f.projectFolder,'config/composites/recipe.json')),json(path.join(l.config,'composites/recipe.json')));
  assert.equal(json(path.join(f.projectFolder,'STATE/studio-drafts/CART-ID-r003.json')).baseManifestPath,l.manifest);
  assert.equal(fs.readdirSync(settings.CurationDir).length,3);
  const receipt=json(path.join(p.backup,'receipt.json'));
  assert.equal(receipt.sourceFolder,l.root); assert.ok(receipt.files.length>=10);
  for(const file of receipt.files) {
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(path.join(p.backup,file.backupPath))).digest('hex'),file.sha256);
    assert.equal(crypto.createHash('sha256').update(fs.readFileSync(file.sourcePath)).digest('hex'),file.sha256);
  }
  assert.ok(receipt.files.some(x=>x.sourcePath===l.manifest)); assert.ok(receipt.files.some(x=>x.sourcePath===path.join(l.state,'settings.json')));
  assert.deepEqual(snapshot(l.root),before); assert.deepEqual(snapshot(l.external),external);
  assert.equal(f.store().status().activeProject.projectFolder,f.projectFolder);
});
test('managed inspection fails closed on unsupported schema, malformed or incomplete metadata without resetting', t => {
  const f=fixture(t), s=f.store(); s.confirm(s.preview(f.input).token);
  const dp=path.join(f.projectFolder,'retro-project.json'), sp=path.join(f.projectFolder,'STATE/settings.json'), settings=json(sp);
  const original=fs.readFileSync(dp);
  fs.writeFileSync(dp,JSON.stringify({...json(dp),schemaVersion:99}));
  assert.throws(()=>s.inspect(f.projectFolder),/schema.*99|unsupported.*schema/i); fs.writeFileSync(dp,original);
  const saved=fs.readFileSync(sp); fs.writeFileSync(sp,'{broken');
  assert.throws(()=>s.inspect(f.projectFolder),/settings.json/); fs.writeFileSync(sp,saved);
  fs.writeFileSync(settings.RegistryPath,'AssetID,SourcePath\n"unterminated');
  assert.throws(()=>s.inspect(f.projectFolder),/CSV/);
  fs.writeFileSync(settings.RegistryPath,'AssetID,SourcePath\n');
  fs.unlinkSync(settings.AssignmentPath); assert.throws(()=>s.inspect(f.projectFolder),/missing|assignments.csv|ENOENT/i);
  fs.writeFileSync(settings.AssignmentPath,'AssignmentID,CartID\n');
  fs.rmdirSync(settings.ConfigDir); assert.throws(()=>s.inspect(f.projectFolder),/config|missing/i); fs.mkdirSync(settings.ConfigDir);
  const before=snapshot(f.projectFolder); assert.deepEqual(s.inspect(f.projectFolder).summary,{assets:0,carts:0,drafts:0}); assert.deepEqual(snapshot(f.projectFolder),before);
});
test('legacy distributed state opens read-only, preserves bytes and remembers missing last selection', t => {
  const f=fixture(t), l=legacy(f), s=new (require('../project-store').ProjectStore)({appDataDir:f.appDataDir,installRoot:l.root});
  const before=snapshot(l.root), external=snapshot(l.external);
  const p=s.inspect(l.root); assert.equal(p.kind,'legacy'); assert.equal(p.readOnly,true);
  assert.deepEqual(p.summary,{assets:1,carts:1,drafts:1}); assert.equal(p.paths.buildsFolder,l.builds);
  assert.deepEqual(p.paths.libraryFolders,[l.library]);
  assert.equal(s.open(l.root).kind,'legacy');
  assert.deepEqual(snapshot(l.root),before); assert.deepEqual(snapshot(l.external),external);
  assert.throws(()=>s.preview({...f.input,operation:'settings',projectFolder:l.root}),/legacy|import|read.only/i);
  fs.renameSync(l.root,l.root+'-missing');
  const status=s.status(); assert.equal(status.activeProject,null); assert.match(status.loadError,/selected project|missing|ENOENT/i);
  assert.equal(status.recentProjects[0].projectFolder,l.root);
});
test('unsafe create paths are rejected without writing or scanning media', t => {
  const f=fixture(t), s=f.store(); const library=path.join(f.root,'library'); fs.mkdirSync(library);
  const occupied=path.join(f.root,'occupied'); fs.mkdirSync(occupied); fs.writeFileSync(path.join(occupied,'keep.txt'),'original');
  const file=path.join(f.root,'file'); fs.writeFileSync(file,'not a directory');
  const alias=path.join(f.root,'alias'); fs.symlinkSync(library,alias,'junction');
  const cases=[
    {projectFolder:'relative'}, {projectFolder:'C:relative'}, {projectFolder:'\\\\server\\share\\data'},
    {name:'bad\nname'}, {operation:'erase'}, {projectFolder:occupied}, {projectFolder:path.join(f.installRoot,'data')},
    {paths:{libraryFolders:[path.join(f.root,'missing-library')]}}, {paths:{libraryFolders:[alias]}},
    {paths:{buildsFolder:file}}, {paths:{buildsFolder:path.join(library,'builds'),libraryFolders:[library]}},
    {paths:{buildsFolder:f.root,libraryFolders:[library]}},
    {paths:{buildsFolder:f.paths.compositeFolder}}, {paths:{cacheFolder:path.join(f.paths.buildsFolder,'cache')}},
    {paths:{buildsFolder:path.join(f.projectFolder,'outputs')}}, {paths:{cacheFolder:path.join(f.projectFolder,'STATE','cache')}},
    {paths:{cacheFolder:path.join(f.projectFolder,'config','cache')}}, {paths:{cacheFolder:f.projectFolder}}
  ];
  const before=snapshot(f.root);
  for(const patch of cases) assert.throws(()=>s.preview({...f.input,...patch,paths:{...f.paths,...patch.paths}}),/path|absolute|UNC|overlap|library|symlink|junction|empty|install|name|operation|directory|CACHE/i,JSON.stringify(patch));
  assert.deepEqual(snapshot(f.root),before);
});
test('create preview is read-only and confirm creates empty compatible state remembered after restart', t => {
  const f = fixture(t), s=f.store(), before=snapshot(f.root);
  assert.equal(s.status().activeProject, null);
  const p = s.preview(f.input);
  assert.deepEqual(snapshot(f.root), before);
  assert.equal(fs.existsSync(f.appDataDir), false);
  assert.equal(p.operation,'create'); assert.ok(p.token); assert.ok(Date.parse(p.expiresAt)>Date.now());
  const project=s.confirm(p.token);
  assert.equal(project.kind,'managed'); assert.equal(project.readOnly,false);
  assert.deepEqual(project.summary,{assets:0,carts:0,drafts:0});
  assert.equal(project.paths.dataFolder,f.projectFolder);
  assert.equal(project.paths.compositeFolder,f.paths.compositeFolder);
  const settings=json(path.join(f.projectFolder,'STATE/settings.json'));
  assert.equal(settings.SystemRoot,f.projectFolder); assert.equal(settings.BuildRoot,f.paths.buildsFolder);
  assert.equal(settings.ConfigDir,path.join(f.projectFolder,'config'));
  for(const [key,header] of [['RegistryPath','AssetID'],['AssignmentPath','AssignmentID'],['CartRegistryPath','CartID']]) assert.match(fs.readFileSync(settings[key],'utf8'),new RegExp('^'+header+','));
  assert.deepEqual(fs.readdirSync(settings.ConfigDir),[]);
  assert.match(json(path.join(f.projectFolder,'retro-project.json')).cachePolicy,/disposable.*manual/i);
  assert.equal(f.store().status().activeProject.projectFolder,f.projectFolder);
  assert.equal(f.store().status().recentProjects[0].projectFolder,f.projectFolder);
  assert.throws(()=>s.confirm(p.token),/token|used/i);
});
