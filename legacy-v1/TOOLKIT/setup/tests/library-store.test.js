'use strict';
const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const scratch=process.env.RETRO_TV_TEST_ROOT;
assert.ok(scratch && path.isAbsolute(scratch),'Explicit disposable RETRO_TV_TEST_ROOT required');
fs.mkdirSync(scratch,{recursive:true});
function fixture(t,rows='') {
 const root=fs.mkdtempSync(path.join(scratch,'catalog-')); t.after(()=>fs.rmSync(root,{recursive:true,force:true}));
 const installRoot=path.join(root,'install'),library=path.join(root,'sources');fs.mkdirSync(installRoot);fs.mkdirSync(library);
 const projectFolder=path.join(root,'project [managed]'),appDataDir=path.join(root,'appdata');
 const paths={buildsFolder:path.join(root,'builds'),compositeFolder:path.join(root,'composites'),cacheFolder:path.join(projectFolder,'CACHE'),libraryFolders:[library]};
 const {ProjectStore}=require('../project-store');const projects=new ProjectStore({installRoot,appDataDir});
 const project=projects.confirm(projects.preview({operation:'create',name:'Catalog fixture',projectFolder,paths}).token);
 const registry=path.join(projectFolder,'STATE/asset-registry.csv');if(rows)fs.appendFileSync(registry,rows);
 const store=()=>new (require('../library-store').LibraryStore)({installRoot});
 const media=(name='source.mp4')=>{const p=path.join(library,name);fs.mkdirSync(path.dirname(p),{recursive:true});fs.writeFileSync(p,'synthetic source bytes, not playable');return p;};
 const fresh=()=>projects.inspect(projectFolder);
 const read=()=>store().read(fresh());
 const act=(operation,payload,etag=read().etag)=>store().apply(fresh(),{expectedEtag:etag,operation,payload});
 return {root,installRoot,library,paths,projectFolder,project,projects,registry,store,media,fresh,read,act,catalogPath:path.join(projectFolder,'STATE/library-catalog.json')};
}
function row(id,p,extra={}) {
 const values={AssetID:id,AssetType:'COMMERCIAL',Subtype:'FOOD',Title:'Explicit title',Pool:'OLD_POOL',Network:'NICK',SourcePath:p,DurationSeconds:'30',CuratedStatus:'OLD_POOL',SourceStatus:'BAD_AUDIO',ReusePolicy:'',SourceCollection:'',Notes:'imported uncertainty',UserNotes:'human, moon',InferredTags:'inference only',OriginalID:'original-token',Year:'1997',...extra};
 return Object.values(values).map(v=>'"'+String(v).replaceAll('"','""')+'"').join(',')+'\r\n';
}
test('persisted accepted range endpoints and separators agree between Browse and planning without rewriting dates',async t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{health:'READY',reason:'Explicit synthetic review'}});
 const {createController}=require('../live-workspace');
 for(const start of ['1990','1990-01-01'])for(const end of ['1999','1999-12-31'])for(const separator of ['-','..','–',' - ']){
  const value=start+separator+end;f.act('save-metadata',{assetId:id,values:{date:{mode:'Range',value}}});
  const saved=f.read();assert.equal(saved.assets[0].date.value,value);
  const c=createController({project:f.fresh(),request:async()=>saved});await c.load();c.setFilter('year','1997');
  const plan=f.store().planningCandidates(f.fresh(),{year:1997});assert.deepEqual(c.page().items.map(a=>a.id),plan.candidates.map(a=>a.id),value);assert.equal(c.page().total,1,value);
  c.setFilter('year','2001');assert.equal(c.page().total,0,value);assert.equal(f.store().planningCandidates(f.fresh(),{year:2001}).candidates.length,0,value);
 }
 f.act('save-metadata',{assetId:id,values:{date:{mode:'Unknown',value:''},notes:'1997 only in notes'}});
 for(const allowUnknown of [false,true]){const c=createController({project:f.fresh(),request:async()=>f.read()});await c.load();c.setFilter('year','1997');c.setFilter('allowUnknown',allowUnknown);assert.equal(c.page().total,Number(allowUnknown));assert.equal(f.store().planningCandidates(f.fresh(),{year:1997,allowUnknown}).candidates.length,Number(allowUnknown));}
 const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.act('save-metadata',{assetId:id,values:{date:{mode:'Unknown',value:'1997'}}}),/unknown/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('Episode availability survives category round trips without restricting Branding Other or independent Commercial bounds',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{category:'Episode/Show',health:'READY',reason:'Synthetic review',availableFrom:'2001-01-01',availableTo:'2005-12-31'}});
 f.act('save-metadata',{assetId:id,values:{category:'Branding',subtype:'IDENT'}});
 let plan=f.store().planningCandidates(f.fresh(),{category:'Branding',availableAt:'1997-01-01'});assert.equal(plan.candidates.length,1,'Episode bounds cannot restrict Branding');
 let a=f.read().assets[0];assert.equal(a.availableFrom,'2001-01-01','original scalar provenance is retained');assert.deepEqual(a.availabilityByCategory['Episode/Show'],{availableFrom:'2001-01-01',availableTo:'2005-12-31'});
 f.act('save-metadata',{assetId:id,values:{date:{mode:'Year',value:'2001'}}});assert.equal(f.store().planningCandidates(f.fresh(),{category:'Branding',availableAt:'1997-01-01',year:1997}).candidates.length,0,'Branding canonical content year is still a hard constraint');
 f.act('save-metadata',{assetId:id,values:{category:'Other',date:{mode:'Year',value:'1997'}}});assert.equal(f.store().planningCandidates(f.fresh(),{category:'Other',availableAt:'1997-01-01',year:1997}).candidates.length,1);
 f.act('save-metadata',{assetId:id,values:{category:'Commercial'}});assert.equal(f.store().planningCandidates(f.fresh(),{category:'Commercial',availableAt:'1997-01-01'}).candidates.length,1,'Commercial cannot borrow Episode bounds');
 f.act('save-metadata',{assetId:id,values:{availabilityByCategory:{Commercial:{availableFrom:'1996-01-01',availableTo:'1998-12-31'}}}});
 assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'1997-01-01'}).candidates.length,1);assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'2002-01-01'}).candidates.length,0);
 f.act('save-metadata',{assetId:id,values:{category:'Episode/Show'}});assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'1997-01-01'}).candidates.length,0);assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'2002-01-01'}).candidates.length,1);
 f.act('save-metadata',{assetId:id,values:{category:'Commercial'}});a=f.read().assets[0];assert.equal(a.availabilityByCategory.Commercial.availableFrom,'1996-01-01');assert.equal(a.availabilityByCategory['Episode/Show'].availableFrom,'2001-01-01');
 const before=fs.readFileSync(f.catalogPath);for(const availabilityByCategory of [{Branding:{availableFrom:'1997',availableTo:''}},{Commercial:{availableFrom:'2001',availableTo:'1997'}},{Commercial:{availableFrom:'1997',availableTo:'',guess:true}},{Commercial:{availableFrom:'1997-02-30',availableTo:''}}])assert.throws(()=>f.act('save-metadata',{assetId:id,values:{availabilityByCategory}}),/availability|field|date/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('schema-1 without optional availability proposals reads without migration and adopts only its saved eligible role',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 f.store().transact(f.fresh(),d=>{const a=d.assets[0];a.category='Episode/Show';a.health='READY';a.availableFrom='2001-01-01';a.availableTo='2005-12-31';delete a.availabilityByCategory;});
 let bytes=fs.readFileSync(f.catalogPath);assert.equal(f.read().assets[0].availabilityByCategory,undefined);assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'1997-01-01'}).candidates.length,0);assert.deepEqual(fs.readFileSync(f.catalogPath),bytes,'reads cannot eagerly migrate');
 f.act('save-metadata',{assetId:id,values:{category:'Commercial'}});assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'1997-01-01'}).candidates.length,1);assert.equal(f.read().assets[0].availabilityByCategory['Episode/Show'].availableFrom,'2001-01-01');
 // Previously leaked scalars on unrelated legacy categories are retained, never guessed into a role.
 f.store().transact(f.fresh(),d=>{d.assets[0].category='Branding';d.assets[0].classificationByCategory.Branding=['IDENT'];delete d.assets[0].availabilityByCategory;});bytes=fs.readFileSync(f.catalogPath);assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'1997-01-01'}).candidates.length,1);assert.deepEqual(fs.readFileSync(f.catalogPath),bytes);
 f.act('save-metadata',{assetId:id,values:{category:'Episode/Show'}});assert.deepEqual(f.read().assets[0].availabilityByCategory,{});assert.equal(f.read().assets[0].availableFrom,'2001-01-01');assert.equal(f.store().planningCandidates(f.fresh(),{availableAt:'1997-01-01'}).candidates.length,1,'do not infer a prior role from unscoped values');
 const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.act('save-metadata',{assetId:id,values:{availableFrom:'1997',availabilityByCategory:{}}}),/conflict/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 for(const map of [null,[],{Other:{availableFrom:'',availableTo:''}},{Commercial:{availableFrom:'1997'}}]){const invalid=JSON.parse(before);invalid.assets[0].availabilityByCategory=map;fs.writeFileSync(f.catalogPath,JSON.stringify(invalid));assert.throws(()=>f.read(),/corrupt|availability|invalid|field/i);}fs.writeFileSync(f.catalogPath,before);
});
test('changed health requires a new trimmed reason while unchanged health preserves editorial reason',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId,before=fs.readFileSync(f.catalogPath);
 for(const reason of [undefined,'','   '])assert.throws(()=>f.act('save-metadata',{assetId:id,values:{health:'READY',...(reason===undefined?{}:{reason})}}),/reason/i);
 assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 f.act('save-metadata',{assetId:id,values:{health:'READY',reason:'  Explicit review  '}});assert.equal(f.read().assets[0].reason,'Explicit review');
 f.act('save-metadata',{assetId:id,values:{health:'READY',notes:'same health'}});assert.equal(f.read().assets[0].reason,'Explicit review');
 assert.throws(()=>f.act('save-metadata',{assetId:id,values:{health:'EXCLUDED'}}),/reason/i);
});
test('new audio-only filename formats are rejected explicitly instead of advertised as video jobs',t=>{
 const f=fixture(t),p=f.media('audio-only.mp3');assert.throws(()=>f.act('register-asset',{path:p}),/audio.only.*video|video.*audio.only/i);assert.equal(f.read().assets.length,0);assert.equal(fs.existsSync(p),true);assert.equal(fs.existsSync(f.catalogPath),false);
});
test('register persists an uninferred asset across instances with verified before-images',t=>{
 const f=fixture(t),p=f.media('NICK-1997-food.mp4'),original=fs.readFileSync(p),etag=f.read().etag;
 const saved=f.act('register-asset',{path:p},etag);assert.equal(saved.catalog.revision,1);assert.equal(saved.result.assetId,saved.catalog.assets[0].id);
 const a=f.read().assets[0];assert.equal(a.name,'NICK-1997-food.mp4');assert.equal(a.category,'Other');assert.equal(a.network,'Unassigned');assert.equal(a.date.mode,'Unknown');assert.equal(a.health,'UNREVIEWED');assert.deepEqual(a.pools,[]);
 assert.ok(fs.existsSync(f.catalogPath));assert.deepEqual(fs.readFileSync(p),original);assert.throws(()=>f.act('register-asset',{path:p}),/already|duplicate/i);
 assert.throws(()=>f.act('register-asset',{path:f.media('second.mp4')},etag),/stale|etag/i);
 const internal=f.store().transact(f.fresh(),d=>{d.jobs.push({id:'internal',kind:'probe',state:'failed',internalLifecycle:{secret:'retained'}});return 'result';});
 assert.equal(internal.result,'result');assert.equal(f.read().jobs[0].internalLifecycle.secret,'retained');
 const backups=fs.readdirSync(path.join(f.projectFolder,'backups')).filter(n=>n.startsWith('library-'));assert.ok(backups.length>=2);
 const before=backups.map(n=>path.join(f.projectFolder,'backups',n,'before.json')).filter(fs.existsSync);assert.ok(before.length);assert.equal(JSON.parse(fs.readFileSync(before[0])).schemaVersion,1);
});
test('metadata and pool proposals preserve independent classifications and reject whole invalid batches',t=>{
 const f=fixture(t),p=f.media();fs.appendFileSync(f.registry,row('KEEP',p));const csv=fs.readFileSync(f.registry);
 f.act('save-metadata',{assetId:'KEEP',values:{category:'Commercial',classificationByCategory:{Commercial:['Restaurant','Food']},pools:['KIDS_00S','GENERAL_00S'],notes:'explicit moon',date:{mode:'Unknown',value:''}}});
 f.act('save-metadata',{assetId:'KEEP',values:{category:'Episode/Show',classificationByCategory:{'Episode/Show':['Holiday','Multipart']}}});
 f.act('save-metadata',{assetId:'KEEP',values:{category:'Commercial'}});const a=f.read().assets[0];
 assert.deepEqual(a.classificationByCategory.Commercial,['Restaurant','Food']);assert.deepEqual(a.classificationByCategory['Episode/Show'],['Holiday','Multipart']);assert.equal(a.legacy.Notes,'imported uncertainty');assert.equal(a.notes,'explicit moon');
 const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.act('save-metadata',{assetId:'KEEP',values:{notes:'must not save',category:'Branding',classificationByCategory:{Branding:[]}}}),/brand|role/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 assert.throws(()=>f.act('save-metadata',{assetId:'KEEP',values:{legacy:{Notes:'rewrite'}}}),/unknown|provenance|field/i);
 assert.throws(()=>f.act('save-metadata',{assetId:'KEEP',values:{classificationByCategory:{Commercial:['food']}}}),/classification/i);
 assert.throws(()=>f.act('bulk-pools',{assetIds:['KEEP','unknown'],mode:'Replace',pools:['LOST']}),/asset/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 f.act('bulk-pools',{assetIds:['KEEP'],mode:'Add',pools:['EXTRA']});assert.deepEqual(f.read().assets[0].pools,['KIDS_00S','GENERAL_00S','EXTRA']);
 f.act('bulk-pools',{assetIds:['KEEP'],mode:'Remove',pools:['KIDS_00S']});assert.deepEqual(f.read().assets[0].pools,['GENERAL_00S','EXTRA']);
 f.act('bulk-pools',{assetIds:['KEEP'],mode:'Replace',pools:[]});assert.deepEqual(f.read().assets[0].pools,[]);assert.deepEqual(fs.readFileSync(f.registry),csv);
});
test('original-pixel recipes retain history and explicit group pins survive later edits',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 f.store().transact(f.fresh(),d=>{d.assets[0].technical={duration:20,width:720,height:480,sar:'8:9',hasAudio:true};});
 f.act('save-recipe',{assetId:id,values:{trimStartSeconds:1.5,trimEndSeconds:2,cropLeft:12,cropRight:10,cropTop:4,cropBottom:2,audioRepair:'STRONG'}});
 let a=f.read().assets[0];assert.equal(a.recipe.revision,2);assert.equal(a.recipe.cropLeft,12);assert.equal(a.recipeHistory[0].revision,1);assert.equal(a.health,'UNREVIEWED');
 const g=f.act('save-group',{name:'Explicit order',parts:[{assetId:id,recipeRevision:2}]}).result.groupId;
 f.act('save-recipe',{assetId:id,values:{audioRepair:'RESTORE'}});a=f.read().assets[0];assert.equal(a.recipe.revision,3);assert.equal(a.recipeHistory[1].audioRepair,'STRONG');assert.equal(f.read().groups[0].parts[0].recipeRevision,2);
 const before=fs.readFileSync(f.catalogPath);for(const values of [{cropLeft:0.2},{cropLeft:720},{trimStartSeconds:19,trimEndSeconds:2},{audioRepair:'MAGIC'},{crop:{left:1}}])assert.throws(()=>f.act('save-recipe',{assetId:id,values}),/crop|trim|audio|field/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 assert.throws(()=>f.act('save-group',{id:g,name:'Changed',parts:[{assetId:id,recipeRevision:99}]}),/recipe|pin/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 f.act('save-group',{id:g,name:'Updated explicitly',parts:[{assetId:id,recipeRevision:3}]});assert.equal(f.read().groups[0].revision,2);assert.equal(f.read().groups[0].history[0].parts[0].recipeRevision,2);
 f.act('set-relationships',{assetId:id,family:'explicit-family',sourceId:'',variantOf:''});assert.equal(f.read().assets[0].family,'explicit-family');
});
test('dependencies include assignments, current manifests, drafts, composites and unresolved history',t=>{
 const f=fixture(t),p=f.media(),id=f.act('register-asset',{path:p}).result.assetId;
 const manifest=path.join(f.paths.buildsFolder,'current.csv');fs.writeFileSync(manifest,`AssetID,SourcePath\r\n${id},"${p}"\r\n`);
 fs.appendFileSync(path.join(f.projectFolder,'STATE/assignments.csv'),`A,CART,1,SLOT,${id},RELEASED,,,\r\n`);
 fs.appendFileSync(path.join(f.projectFolder,'STATE/cart-registry.csv'),`CART,1,BUILT,NICK,Cart,,,"${manifest}"\r\n`);
 fs.mkdirSync(path.join(f.projectFolder,'STATE/studio-drafts'));fs.writeFileSync(path.join(f.projectFolder,'STATE/studio-drafts/draft.json'),JSON.stringify({baseManifestPath:manifest,slots:{one:{assetId:id}}}));
 fs.mkdirSync(path.join(f.projectFolder,'config/composites'));fs.writeFileSync(path.join(f.projectFolder,'config/composites/parts.json'),JSON.stringify({Jobs:[{Parts:[p]}]}));
 let impact=f.store().dependencies(f.fresh(),id);for(const kind of ['assignment','manifest','draft','config'])assert.ok(impact.dependencies.some(d=>d.kind===kind),kind);
 assert.equal(impact.blocked,true);assert.equal(f.read().assets[0].uses.length,impact.dependencies.length);
 const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.act('remove-asset',{assetId:id}),/referenc|depend/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 fs.writeFileSync(manifest,'AssetID,SourcePath\r\nMISSING-HISTORICAL-ID,unknown.mp4\r\n');impact=f.store().dependencies(f.fresh(),id);assert.ok(impact.unresolved.length);assert.equal(impact.blocked,true);
});
test('dependency snapshot retains shared historical paths group history foreign jobs and global unresolved guards',t=>{
 const f=fixture(t),a=f.act('register-asset',{path:f.media('a.mp4')}).result.assetId,b=f.act('register-asset',{path:f.media('b.mp4')}).result.assetId;
 const old=path.join(f.library,'old.mp4'),legacy=path.join(f.library,'legacy.mp4');f.store().transact(f.fresh(),d=>{for(const x of d.assets)x.sourceHistory=[{path:old,recipeRevision:1}];d.assets[0].legacy.SourcePath=legacy;d.assets[1].sourceId=a;d.groups.push({id:'historical-group',name:'History',revision:2,parts:[{assetId:b,recipeRevision:1}],history:[{revision:1,parts:[{assetId:a,recipeRevision:1}]}]});d.jobs.push({id:'foreign',kind:'probe',state:'failed',snapshot:{projectFolder:f.root,source:{path:old}}});});
 fs.writeFileSync(path.join(f.projectFolder,'config/history.json'),JSON.stringify({Parts:[old,legacy],sourceId:'UNKNOWN-ID',OriginalSourcePath:'missing-relative.mp4'}));
 const ia=f.store().dependencies(f.fresh(),a),ib=f.store().dependencies(f.fresh(),b);for(const x of [ia,ib]){for(const kind of ['group','job','config'])assert.ok(x.dependencies.some(d=>d.kind===kind),kind);assert.ok(x.unresolved.some(d=>d.value==='UNKNOWN-ID'));assert.ok(x.unresolved.some(d=>d.value==='missing-relative.mp4'));}assert.ok(ia.dependencies.some(d=>d.kind==='relationship'));assert.deepEqual(f.read().assets[0].uses,ia.dependencies);ia.dependencies.length=0;assert.ok(f.store().dependencies(f.fresh(),a).dependencies.length);
});
test('network identities are stable, archived assignments guarded and child/cart references block delete',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 f.act('add-network',{code:'NICK',name:'Nickelodeon',kind:'Network'});f.act('add-network',{code:'SNICK',name:'Saturday block',kind:'Block',parentNetwork:'NICK'});
 f.act('save-metadata',{assetId:id,values:{network:'SNICK'}});f.act('rename-network',{code:'SNICK',name:'Renamed display'});assert.equal(f.read().assets[0].network,'SNICK');
 f.act('archive-network',{code:'SNICK',archived:true});f.act('save-metadata',{assetId:id,values:{notes:'retained assignment'}});
 const other=f.act('register-asset',{path:f.media('other.mp4')}).result.assetId;assert.throws(()=>f.act('save-metadata',{assetId:other,values:{network:'SNICK'}}),/archived/i);
 assert.throws(()=>f.act('delete-network',{code:'SNICK'}),/referenc|depend/i);assert.throws(()=>f.act('delete-network',{code:'NICK'}),/child|referenc|depend/i);
 f.act('add-network',{code:'Unused',name:'Unused',kind:'Network'});f.act('delete-network',{code:'Unused'});assert.equal(f.read().networks.some(n=>n.code==='Unused'),false);
});
test('location removal stops scans without removing associated assets or history',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId,lid=f.read().locations[0].id;
 f.act('save-group',{name:'Historical dependency',parts:[{assetId:id,recipeRevision:1}]});
 f.store().transact(f.fresh(),d=>{d.jobs.push({id:'probe-history',kind:'probe',state:'succeeded',assetId:id});});
 const before=f.read().assets[0];f.act('remove-location',{locationId:lid});assert.equal(f.read().locations[0].removed,true);assert.deepEqual(f.read().assets[0],before);
});
test('active scan snapshot guards location removal',t=>{
 const f=fixture(t),lid=f.read().locations[0].id;
 f.store().transact(f.fresh(),d=>{d.jobs.push({id:'active-scan',kind:'scan',state:'running',snapshot:{projectFolder:f.projectFolder,locationId:lid}});});
 assert.throws(()=>f.act('remove-location',{locationId:lid}),/active job/i);assert.equal(f.read().locations[0].removed,false);
});
test('registering a location associates existing unassigned references without resetting decisions',t=>{
 const f=fixture(t),dir=path.join(f.root,'individual');fs.mkdirSync(dir);const p=path.join(dir,'clip.mp4');fs.writeFileSync(p,'fixture');const id=f.act('register-asset',{path:p}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{notes:'explicit decisions'}});const before=f.read().assets[0],lid=f.act('register-location',{path:dir}).result.locationId;
 assert.deepEqual(f.read().assets[0],{...before,locationId:lid});
});
test('explicit location registration/relink preserves nested identities and never rewrites future defaults',t=>{
 const f=fixture(t),newRoot=path.join(f.root,'new sources');fs.mkdirSync(newRoot);
 const id=f.act('register-asset',{path:f.media('show/season/part.mp4')}).result.assetId,location=f.read().locations[0];
 f.act('save-metadata',{assetId:id,values:{notes:'survives relink'}});const settings=fs.readFileSync(path.join(f.projectFolder,'STATE/settings.json'));
 const target=path.join(newRoot,'show/season/part.mp4');fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,'replacement source fixture');
 f.act('relink-location',{locationId:location.id,path:newRoot});const a=f.read().assets[0];assert.equal(a.id,id);assert.equal(a.path,target);assert.equal(a.notes,'survives relink');assert.equal(a.missing,false);assert.deepEqual(fs.readFileSync(path.join(f.projectFolder,'STATE/settings.json')),settings);
 assert.equal(f.read().locations.length,1);assert.equal(f.read().locations[0].path,newRoot);
 const other=path.join(f.root,'registered-not-default');fs.mkdirSync(other);const lid=f.act('register-location',{path:other}).result.locationId;assert.equal(f.read().locations.length,2);assert.deepEqual(f.fresh().paths.libraryFolders,[f.library]);
 f.act('remove-location',{locationId:lid});assert.equal(f.read().locations.find(l=>l.id===lid).removed,true);
 const replacement=f.media('relinked.mp4');f.act('relink-asset',{assetId:id,path:replacement});assert.equal(f.read().assets[0].id,id);assert.equal(f.read().assets[0].path,replacement);
 const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.act('relink-asset',{assetId:id,path:f.catalogPath}),/source|overlap/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
function fingerprint(p){const s=fs.statSync(p,{bigint:true});return {path:p,size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),dev:String(s.dev),ino:String(s.ino),sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex')};}
function prepared(f,id){
 const dir=path.join(f.paths.cacheFolder,'library-jobs','integrity-owned'),out=path.join(dir,'media.mp4');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(out,'synthetic output, not playable');
 f.store().transact(f.fresh(),d=>{const a=d.assets.find(a=>a.id===id),source=fingerprint(a.path),output=fingerprint(out);delete source.sha256;d.jobs.push({id:'integrity',kind:'variant',state:'succeeded',assetId:id,snapshot:{projectFolder:f.projectFolder,source,recipe:structuredClone(a.recipe),outputDirectory:dir},outputs:[{kind:'media',path:out,fingerprint:output}]});a.variants.push({id:'integrity',jobId:'integrity',path:out,recipeRevision:a.recipe.revision,recipe:structuredClone(a.recipe),sourceFingerprint:source,outputFingerprint:output,ready:true});});return out;
}
test('prepared integrity rejects missing fingerprints and changed output identity or digest',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;f.act('save-metadata',{assetId:id,values:{health:'BAD_AUDIO',reason:'Explicit repair fixture'}});f.act('save-recipe',{assetId:id,values:{audioRepair:'RESTORE'}});const out=prepared(f,id),original=fs.readFileSync(f.catalogPath);
 assert.equal(f.store().planningCandidates(f.fresh()).candidates.length,1);
 const d=JSON.parse(original);delete d.assets[0].variants[0].outputFingerprint;fs.writeFileSync(f.catalogPath,JSON.stringify(d));assert.equal(f.store().planningCandidates(f.fresh()).candidates.length,0,'legacy variants cannot grant readiness');fs.writeFileSync(f.catalogPath,original);
 const weak=JSON.parse(original),stat=fs.statSync(out),weakFingerprint={size:stat.size,mtimeMs:stat.mtimeMs};weak.jobs[0].outputs[0].fingerprint=weakFingerprint;weak.assets[0].variants[0].outputFingerprint=weakFingerprint;fs.writeFileSync(f.catalogPath,JSON.stringify(weak));assert.equal(f.store().planningCandidates(f.fresh()).candidates.length,0,'output identity requires the complete stat tuple');fs.writeFileSync(f.catalogPath,original);
 const bad=JSON.parse(original);bad.jobs[0].outputs[0].fingerprint.sha256='0'.repeat(64);bad.assets[0].variants[0].outputFingerprint.sha256='0'.repeat(64);fs.writeFileSync(f.catalogPath,JSON.stringify(bad));assert.equal(f.store().planningCandidates(f.fresh()).candidates.length,0,'digest must agree');fs.writeFileSync(f.catalogPath,original);
 const st=fs.statSync(out);fs.writeFileSync(out,'x'.repeat(st.size));fs.utimesSync(out,st.atime,st.mtime);assert.equal(f.store().planningCandidates(f.fresh()).candidates.length,0,'same size/mtime tampering must not grant repair readiness');assert.equal(f.read().assets[0].health,'BAD_AUDIO');
});
test('planning uses a fresh prepared variant without laundering raw health or unknown dates',t=>{
 const f=fixture(t),p=f.media(),id=f.act('register-asset',{path:p}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{category:'Commercial',health:'BAD_AUDIO',reason:'Explicit repair fixture',pools:['ONE']}});f.act('save-recipe',{assetId:id,values:{audioRepair:'RESTORE'}});
 assert.equal(f.store().planningCandidates(f.fresh(),{}).candidates.length,0);
 const outputDir=path.join(f.paths.cacheFolder,'library-jobs','prepared-owned');fs.mkdirSync(outputDir,{recursive:true});const output=path.join(outputDir,'media.mp4');fs.writeFileSync(output,'synthetic prepared output, not playback evidence');
 const fp=()=>{const s=fs.statSync(p,{bigint:true});return {path:p,size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),dev:String(s.dev),ino:String(s.ino)};};
 f.store().transact(f.fresh(),d=>{const a=d.assets[0];d.jobs.push({id:'prepared',kind:'variant',state:'succeeded',assetId:id,snapshot:{projectFolder:f.projectFolder,source:fp(),recipe:structuredClone(a.recipe),outputDirectory:outputDir},outputs:{media:{path:output,fingerprint:fingerprint(output)}}});a.variants.push({id:'prepared',jobId:'prepared',path:output,outputFingerprint:fingerprint(output),recipeRevision:a.recipe.revision,recipe:structuredClone(a.recipe),sourceFingerprint:fp()});});
 let projection=f.store().planningCandidates(f.fresh(),{pools:['ONE']});assert.equal(projection.candidates.length,1);const a=projection.candidates[0];assert.equal(a.effectivePath,output);assert.equal(a.health,'BAD_AUDIO');assert.equal(a.recipeRevision,2);assert.equal(a.sourceFamily,id);assert.equal(a.sourceId,id);assert.equal(f.read().assets[0].health,'BAD_AUDIO');
 assert.equal(f.store().planningCandidates(f.fresh(),{yearMin:1990,yearMax:2000}).candidates.length,0);assert.equal(f.store().planningCandidates(f.fresh(),{yearMin:1990,allowUnknownDates:true}).candidates.length,1);
 f.act('save-recipe',{assetId:id,values:{audioRepair:'STRONG'}});assert.equal(f.store().planningCandidates(f.fresh(),{}).candidates.length,0);
});
test('composite projection preserves ordered group recipe source and family pins and rejects stale or corrupt work',t=>{
 const f=fixture(t),a=f.act('register-asset',{path:f.media('a.mp4')}).result.assetId,b=f.act('register-asset',{path:f.media('b.mp4')}).result.assetId;
 for(const id of [a,b])f.act('save-metadata',{assetId:id,values:{category:'Episode/Show',health:'READY',reason:'Explicit synthetic review',pools:['COMPOSITE']}});
 f.act('set-relationships',{assetId:a,family:'family-a',sourceId:'',variantOf:''});const gid=f.act('save-group',{name:'Ordered',parts:[{assetId:b,recipeRevision:1},{assetId:a,recipeRevision:1}]}).result.groupId;
 const dir=path.join(f.paths.compositeFolder,'library-jobs','composition-owned'),out=path.join(dir,'composite.mp4');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(out,'synthetic composite output, not playable');
 f.store().transact(f.fresh(),d=>{const g=d.groups[0];d.jobs.push({id:'composition',kind:'composite',groupId:gid,state:'succeeded',snapshot:{projectFolder:f.projectFolder,group:{id:g.id,name:g.name,revision:g.revision,parts:structuredClone(g.parts)},parts:g.parts.map(pin=>{const x=d.assets.find(a=>a.id===pin.assetId);return {assetId:x.id,source:fingerprint(x.path),recipe:structuredClone(x.recipe)};}),publicationDirectory:dir,compositeFolder:f.paths.compositeFolder},outputs:[{kind:'media',path:out,fingerprint:fingerprint(out)}]});});
 const saved=fs.readFileSync(f.catalogPath),plan=()=>f.store().planningCandidates(f.fresh(),{pool:'COMPOSITE'});let p=plan();assert.equal(p.candidates.length,2,'raw references are not duplicated');assert.equal(p.composites.length,1);const c=p.composites[0];assert.equal(c.groupId,gid);assert.equal(c.effectivePath,out);assert.deepEqual(c.pins.parts.map(p=>p.assetId),[b,a]);assert.deepEqual(c.pins.parts.map(p=>p.family),[b,'family-a']);assert.ok(c.pins.parts.every(p=>p.recipe.revision===1&&p.sourceFingerprint.path));
 for(const change of [d=>{d.jobs[0].snapshot.projectFolder=f.root;},d=>{d.groups[0].parts.reverse();},d=>{d.jobs[0].snapshot.parts.reverse();},d=>{delete d.jobs[0].outputs[0].fingerprint;}]){const d=JSON.parse(saved);change(d);fs.writeFileSync(f.catalogPath,JSON.stringify(d));assert.equal(plan().composites.length,0);}
 fs.writeFileSync(f.catalogPath,saved);fs.appendFileSync(f.read().assets[0].path,'source changed');assert.equal(plan().composites.length,0);fs.writeFileSync(f.read().assets[0].path,'synthetic source bytes, not playable');
 // Restoring bytes cannot restore ctime authority; reserve fresh inputs explicitly.
 const d=JSON.parse(saved);for(const part of d.jobs[0].snapshot.parts)part.source=fingerprint(d.assets.find(a=>a.id===part.assetId).path);fs.writeFileSync(f.catalogPath,JSON.stringify(d));assert.equal(plan().composites.length,1);const beforeOutputChange=f.read().etag;fs.writeFileSync(out,'tampered');assert.equal(plan().composites.length,0);assert.notEqual(f.read().etag,beforeOutputChange,'composite output observations participate in freshness');
});
test('invalid catalogs and unsafe paths fail closed without initializing or mutating other state',t=>{
 const f=fixture(t),p=f.media();f.act('register-asset',{path:p});const valid=fs.readFileSync(f.catalogPath);
 fs.writeFileSync(f.catalogPath,'{"schemaVersion":999}');assert.throws(()=>f.read(),/unsupported/i);assert.equal(fs.readFileSync(f.catalogPath,'utf8'),'{"schemaVersion":999}');
 fs.writeFileSync(f.catalogPath,'{broken');assert.throws(()=>f.read(),/JSON/i);fs.writeFileSync(f.catalogPath,valid);
 const doc=JSON.parse(valid);doc.assets[0].pools='NOT-ARRAY';fs.writeFileSync(f.catalogPath,JSON.stringify(doc));assert.throws(()=>f.read(),/corrupt|invalid|catalog/i);fs.writeFileSync(f.catalogPath,valid);
 assert.throws(()=>f.store().apply(f.fresh(),{expectedEtag:f.read().etag,operation:'register-asset',payload:{path:p},unrecognized:true}),/unknown|field/i);
 const hard=path.join(f.library,'hard.mp4');fs.linkSync(p,hard);assert.throws(()=>f.act('register-asset',{path:hard}),/hardlink/i);fs.unlinkSync(hard);
 const junction=path.join(f.root,'junction');fs.symlinkSync(f.library,junction,'junction');assert.throws(()=>f.act('register-location',{path:junction}),/symlink|junction/i);fs.unlinkSync(junction);
 assert.throws(()=>f.act('register-location',{path:f.installRoot}),/overlap|install/i);assert.throws(()=>f.act('register-asset',{path:path.join(f.library,'..','sources','source.mp4')+'/../bad'}),/unsafe|directory/i);
 const descriptorPath=path.join(f.projectFolder,'retro-project.json'),settingsPath=path.join(f.projectFolder,'STATE/settings.json'),d=JSON.parse(fs.readFileSync(descriptorPath)),s=JSON.parse(fs.readFileSync(settingsPath));d.paths.cacheFolder=f.library;s.CacheRoot=f.library;fs.writeFileSync(descriptorPath,JSON.stringify(d));fs.writeFileSync(settingsPath,JSON.stringify(s));assert.throws(()=>f.store().read(f.fresh()),/source|overlap/i);
});
test('transaction compares original sidecar bytes before publishing over a direct-file child writer',t=>{
 const f=fixture(t);f.act('register-asset',{path:f.media()});
 assert.throws(()=>f.store().transact(f.fresh(),d=>{
  d.assets[0].notes='stale local proposal';const r=require('node:child_process').spawnSync(process.execPath,['-e',"const fs=require('node:fs'),p=process.argv[1],d=JSON.parse(fs.readFileSync(p));d.assets[0].notes='external update';d.revision++;fs.writeFileSync(p,JSON.stringify(d));",f.catalogPath],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);
 }),/stale catalog/i);assert.equal(f.read().assets[0].notes,'external update');
});
test('corrupt external JSON is rejected as a typed metadata error without touching catalog bytes',t=>{
 const f=fixture(t);f.act('register-asset',{path:f.media()});const before=fs.readFileSync(f.catalogPath);fs.writeFileSync(path.join(f.projectFolder,'config/broken.json'),'{invalid');let error;try{f.read();}catch(e){error=e;}assert.ok(error);assert.equal(error.statusCode,400);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('single-file publication restores ordinary rename/readback faults and detects external writers',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId,before=fs.readFileSync(f.catalogPath),rename=fs.renameSync,read=fs.readFileSync,write=fs.writeFileSync;
 fs.renameSync=(from,to)=>{if(to===f.catalogPath)throw new Error('Injected rename failure');return rename(from,to);};try{assert.throws(()=>f.act('save-metadata',{assetId:id,values:{notes:'not committed'}}),/Injected rename/);}finally{fs.renameSync=rename;}assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 let published=false,failed=false;fs.renameSync=(from,to)=>{const r=rename(from,to);if(to===f.catalogPath)published=true;return r;};fs.readFileSync=(p,...args)=>{if(p===f.catalogPath&&published&&!failed){failed=true;throw new Error('Injected readback failure');}return read(p,...args);};
 try{assert.throws(()=>f.act('save-metadata',{assetId:id,values:{notes:'rolled back'}}),/readback/);}finally{fs.renameSync=rename;fs.readFileSync=read;}assert.ok(failed);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 let changed=false;fs.writeFileSync=(p,...args)=>{const r=write(p,...args);if(typeof p==='string'&&p.endsWith('staged.json')&&!changed){changed=true;fs.appendFileSync(f.registry,row('EXTERNAL',f.media('external.mp4')));}return r;};
 try{assert.throws(()=>f.act('save-metadata',{assetId:id,values:{notes:'stale'}}),/stale|changed/i);}finally{fs.writeFileSync=write;}assert.ok(changed);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('staged publication revalidates newly proposed source observations as well as old references',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId,next=f.media('new.mp4'),before=fs.readFileSync(f.catalogPath),write=fs.writeFileSync;let changed=false;
 fs.writeFileSync=(p,...args)=>{const r=write(p,...args);if(typeof p==='string'&&p.endsWith('staged.json')&&!changed){changed=true;fs.appendFileSync(next,'changed during staging');}return r;};
 try{assert.throws(()=>f.act('relink-asset',{assetId:id,path:next}),/stale|changed/i);}finally{fs.writeFileSync=write;}assert.ok(changed);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('shared setup lock blocks real child writers and never deletes a replacement owner',t=>{
 const f=fixture(t),s=f.store();f.act('register-asset',{path:f.media()});
 s.transact(f.fresh(),()=>{assert.throws(()=>f.store().transact(f.fresh(),()=>{}),/lock/i);
 const {spawnSync}=require('node:child_process');const code="const {LibraryStore}=require(process.argv[1]);try{new LibraryStore({installRoot:process.argv[2]}).transact(JSON.parse(process.argv[3]),()=>{});process.exit(7)}catch(e){if(!/lock/i.test(e.message)){console.error(e);process.exit(8)}console.log('exclusive child blocked')}";
 const r=spawnSync(process.execPath,['-e',code,path.resolve(__dirname,'../library-store.js'),f.installRoot,JSON.stringify(f.fresh())],{encoding:'utf8'});assert.equal(r.status,0,r.stderr);assert.match(r.stdout,/exclusive child blocked/);
 });
 const before=fs.readFileSync(f.catalogPath),lock=f.projectFolder+'.setup.lock';assert.throws(()=>s.transact(f.fresh(),()=>{fs.writeFileSync(lock,JSON.stringify({owner:'replacement-owner',pid:0}));}),/ownership/i);assert.equal(JSON.parse(fs.readFileSync(lock)).owner,'replacement-owner');assert.deepEqual(fs.readFileSync(f.catalogPath),before);fs.unlinkSync(lock);
 fs.writeFileSync(lock,JSON.stringify({owner:'old-owner',pid:999999,createdAt:'1900-01-01'}));assert.throws(()=>s.transact(f.fresh(),()=>{}),/lock/i);assert.ok(fs.existsSync(lock));
});
test('source and dependency changes invalidate etags while legacy projects stay read-only',t=>{
 const f=fixture(t),p=f.media(),id=f.act('register-asset',{path:p}).result.assetId,etag=f.read().etag;
 fs.appendFileSync(p,'changed observation');assert.throws(()=>f.act('save-metadata',{assetId:id,values:{notes:'stale'}},etag),/stale|etag/i);
 const metadataEtag=f.read().etag;fs.writeFileSync(path.join(f.projectFolder,'config/new.json'),JSON.stringify({Network:'NEW'}));assert.throws(()=>f.act('save-metadata',{assetId:id,values:{notes:'stale'}},metadataEtag),/stale|etag/i);
 const descriptor=path.join(f.projectFolder,'retro-project.json'),settingsPath=path.join(f.projectFolder,'STATE/settings.json');fs.unlinkSync(descriptor);const settings=JSON.parse(fs.readFileSync(settingsPath));delete settings.ProjectSchemaVersion;fs.writeFileSync(settingsPath,JSON.stringify(settings));
 const legacy=f.fresh();assert.equal(f.store().read(legacy).readOnly,true);const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.store().transact(legacy,()=>{}),/read.only/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('metadata memberships and new networks reject malformed exact identifiers without normalization',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId,before=fs.readFileSync(f.catalogPath);
 for(const value of [' BAD ','BAD SPACE','BAD/ID']){assert.throws(()=>f.act('save-metadata',{assetId:id,values:{pools:[value]}}),/pool|code/i);for(const mode of ['Add','Remove','Replace'])assert.throws(()=>f.act('bulk-pools',{assetIds:[id],mode,pools:[value]}),/pool|code/i);assert.throws(()=>f.act('add-network',{code:value,name:'No normalization',kind:'Network'}),/network|code/i);}assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('add-pool creates explicit reusable definitions and rejects malformed exact codes',t=>{
 const f=fixture(t);f.act('add-pool',{value:'MY_POOL-1',label:'My manually curated pool'});assert.deepEqual(f.read().selectionPools,[{value:'MY_POOL-1',label:'My manually curated pool'}]);
 const before=fs.readFileSync(f.catalogPath);assert.throws(()=>f.act('add-pool',{value:'MY_POOL-1',label:'Overwrite'}),/already|duplicate/i);assert.throws(()=>f.act('add-pool',{value:' MY_POOL-2 ',label:'Do not normalize'}),/code|pool/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('shared measured-fingerprint/array-output seam and router planning filters stay compatible',t=>{
 const f=fixture(t),p=f.media(),id=f.act('register-asset',{path:p}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{name:'Find me',notes:'moon',health:'BAD_AUDIO',reason:'Explicit repair fixture',pools:['EXPLICIT']}});f.act('save-recipe',{assetId:id,values:{audioRepair:'RESTORE'}});
 const dir=path.join(f.paths.cacheFolder,'library-jobs/new-job-owned'),out=path.join(dir,'media.mp4');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(out,'synthetic normalized seam fixture');const fingerprintOutput=(()=>{const s=fs.statSync(out,{bigint:true});return {path:out,size:String(s.size),mtimeNs:String(s.mtimeNs),ctimeNs:String(s.ctimeNs),dev:String(s.dev),ino:String(s.ino)};})();const fingerprint={size:fs.statSync(p).size,mtimeMs:fs.statSync(p).mtimeMs,sha256:require('node:crypto').createHash('sha256').update(fs.readFileSync(p)).digest('hex')};
 f.store().transact(f.fresh(),d=>{const a=d.assets[0];a.sourceFingerprint=fingerprint;d.jobs.push({id:'new-job',kind:'variant',state:'succeeded',assetId:id,snapshot:{projectFolder:f.projectFolder,source:fingerprint,recipe:structuredClone(a.recipe),outputDirectory:dir},outputs:[{kind:'media',path:out,mime:'video/mp4',fingerprint:fingerprintOutput}],result:{duration:10,measured:true}});a.variants.push({id:'new-job',jobId:'new-job',path:out,mime:'video/mp4',outputFingerprint:fingerprintOutput,recipeRevision:a.recipe.revision,sourceFingerprint:fingerprint,ready:true,duration:10,technical:{duration:10,width:618,height:480,sar:'1:1',hasAudio:true}});});
 const projection=f.store().planningCandidates(f.fresh(),{pool:'EXPLICIT',year:1997,allowUnknown:true,health:'BAD_AUDIO',search:'moon',locationId:f.read().locations[0].id});assert.equal(projection.candidates.length,1);assert.equal(projection.candidates[0].effectivePath,out);assert.equal(f.read().jobs[0].result.measured,true);assert.equal(f.read().assets[0].sourceFingerprint.sha256,fingerprint.sha256);
 assert.equal(f.store().planningCandidates(f.fresh(),{year:1997}).candidates.length,0);assert.equal(f.store().planningCandidates(f.fresh(),{search:'not-present'}).candidates.length,0);
 f.store().transact(f.fresh(),d=>{d.jobs[0].snapshot.projectFolder=path.join(f.root,'other-project');});assert.equal(f.store().planningCandidates(f.fresh(),{}).candidates.length,0,'copied historical output must not become current readiness');
});
test('date ranges and exact dates obey hard filters without inferring eligibility from notes',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{health:'READY',reason:'Explicit fixture review',notes:'1999 in human notes only',date:{mode:'Range',value:'1995–1999'}}});
 assert.equal(f.store().planningCandidates(f.fresh(),{year:1997}).candidates.length,1);assert.equal(f.store().planningCandidates(f.fresh(),{year:2000}).candidates.length,0);
 f.act('save-metadata',{assetId:id,values:{date:{mode:'Exact date',value:'1997-05-12'}}});assert.equal(f.store().planningCandidates(f.fresh(),{year:1997}).candidates.length,1);
 const before=fs.readFileSync(f.catalogPath);for(const value of ['1997-02-30','1997-13-01'])assert.throws(()=>f.act('save-metadata',{assetId:id,values:{date:{mode:'Exact date',value}}}),/date/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 assert.throws(()=>f.act('save-metadata',{assetId:id,values:{availableFrom:'1997-02-30'}}),/date|availability/i);
 f.act('save-metadata',{assetId:id,values:{category:'Branding',subtype:'IDENT'}});assert.deepEqual(f.read().assets[0].classificationByCategory.Branding,['IDENT']);
});
test('unresolved cart pointers, prototype-shaped categories and composite/job references cannot bypass guards',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId;
 assert.throws(()=>f.act('save-metadata',{assetId:id,values:{category:'toString'}}),/category/i);
 const group=f.act('save-group',{name:'One part',parts:[{assetId:id,recipeRevision:1}]}).result.groupId;assert.throws(()=>f.act('remove-asset',{assetId:id}),/depend|referenc/i);
 f.store().transact(f.fresh(),d=>{d.jobs.push({id:'failed-job',kind:'composite',state:'failed',groupId:group,snapshot:{parts:[{assetId:id}]}});});assert.throws(()=>f.act('remove-group',{groupId:group}),/job|depend|referenc/i);
 f.store().transact(f.fresh(),d=>{d.jobs=[];});f.act('remove-group',{groupId:group});
 fs.appendFileSync(path.join(f.projectFolder,'STATE/cart-registry.csv'),'UNRESOLVED,1,BUILT,UNKNOWN,Historical,,,\r\n');assert.equal(f.store().dependencies(f.fresh(),id).blocked,true);assert.throws(()=>f.act('remove-asset',{assetId:id}),/depend|history|referenc/i);
});
test('real scan/rescan jobs preserve catalog decisions and stable IDs despite probe failures and missing files',async t=>{
 const f=fixture(t),p=f.media('old.mp4'),id=f.act('register-asset',{path:p}).result.assetId;
 f.act('save-metadata',{assetId:id,values:{name:'Explicit human title',notes:'keep notes',pools:['MANUAL'],health:'BAD_AUDIO',reason:'Explicit fixture review'}});f.act('save-recipe',{assetId:id,values:{audioRepair:'RESTORE'}});
 const added=f.media('NICK-1999-toy.mp4'),{LibraryJobs}=require('../library-jobs');
 const scan=async()=>{const jobs=new LibraryJobs({store:f.store(),installRoot:f.installRoot,ffprobe:path.join(f.installRoot,'deliberately-absent-ffprobe.exe')});const r=await jobs.start(f.fresh(),{expectedEtag:f.read().etag,kind:'scan',locationId:f.read().locations[0].id});await jobs.running.get(r.result.jobId).promise;await jobs.close();return f.read().jobs.find(j=>j.id===r.result.jobId);};
 const job=await scan();assert.equal(job.state,'succeeded',job.error);let c=f.read(),a=c.assets.find(a=>a.id===id),newAsset=c.assets.find(a=>a.path===added);assert.equal(a.name,'Explicit human title');assert.equal(a.notes,'keep notes');assert.equal(a.health,'BAD_AUDIO');assert.deepEqual(a.pools,['MANUAL']);assert.equal(a.recipe.revision,2);assert.ok(newAsset);assert.equal(newAsset.network,'Unassigned');assert.equal(newAsset.date.mode,'Unknown');assert.equal(newAsset.category,'Other');assert.equal(newAsset.health,'UNREVIEWED');
 const newID=newAsset.id;fs.unlinkSync(p);assert.equal((await scan()).state,'succeeded');c=f.read();assert.equal(c.assets.find(a=>a.id===id).missing,true);assert.equal(c.assets.find(a=>a.id===id).health,'BAD_AUDIO');assert.equal(c.assets.find(a=>a.path===added).id,newID);
 f.act('relink-asset',{assetId:id,path:f.media('new source.mp4')});assert.equal(f.read().assets.find(a=>a.id===id).recipe.audioRepair,'RESTORE');
});
test('removed references persist identity and path tombstones until explicit registration',t=>{
 const f=fixture(t),p=f.media(),id=f.act('register-asset',{path:p}).result.assetId;f.act('remove-asset',{assetId:id});const c=f.read();assert.equal(c.assets.length,0);assert.equal(c.removedReferences.length,1);assert.equal(c.removedReferences[0].id,id);assert.equal(c.removedReferences[0].path,p);assert.ok(!Number.isNaN(Date.parse(c.removedReferences[0].removedAt)));assert.ok(fs.existsSync(p));
 assert.equal(f.act('register-asset',{path:p}).result.assetId,id);assert.deepEqual(f.read().removedReferences,[]);
});
test('a real rescan cannot resurrect an explicitly removed source reference under another ID',async t=>{
 const f=fixture(t),p=f.media('removed.mp4'),id=f.act('register-asset',{path:p}).result.assetId;f.act('remove-asset',{assetId:id});const {LibraryJobs}=require('../library-jobs'),jobs=new LibraryJobs({store:f.store(),installRoot:f.installRoot,ffprobe:path.join(f.installRoot,'absent-ffprobe.exe')});
 try{const r=await jobs.start(f.fresh(),{expectedEtag:f.read().etag,kind:'scan',locationId:f.read().locations[0].id});await jobs.running.get(r.result.jobId).promise;const c=f.read();assert.equal(c.jobs.find(j=>j.id===r.result.jobId).state,'succeeded');assert.equal(c.assets.some(a=>a.path===p),false);assert.equal(c.removedReferences[0].id,id);assert.ok(fs.existsSync(p));}finally{await jobs.close();}
});
test('trusted transactions validate full proposals and protect source/output boundaries before publication',t=>{
 const f=fixture(t),id=f.act('register-asset',{path:f.media()}).result.assetId,before=fs.readFileSync(f.catalogPath);
 assert.throws(()=>f.store().transact(f.fresh(),d=>{d.assets[0].notes='partial';d.assets[0].path=f.catalogPath;}),/source|overlap|metadata/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 for(const edit of [d=>{d.selectionPools=[{value:[],label:'bad'}];},d=>{d.assets[0].missing='yes';},d=>{d.assets[0].variants=[{id:'bad',path:'relative'}];},d=>{d.assets.push(structuredClone(d.assets[0]));}]){assert.throws(()=>f.store().transact(f.fresh(),edit),/invalid|corrupt|duplicate/i);assert.deepEqual(fs.readFileSync(f.catalogPath),before);}
 f.act('remove-asset',{assetId:id});assert.equal(f.read().assets.length,0);assert.ok(fs.existsSync(path.join(f.library,'source.mp4')),'removal never deletes source bytes');
});
test('managed metadata copy reopens without a persisted-root migration and preserves source provenance',t=>{
 const f=fixture(t),p=f.media();fs.appendFileSync(f.registry,row('IMPORTED-ID',p));f.act('save-metadata',{assetId:'IMPORTED-ID',values:{notes:'saved sidecar decision'}});
 const sidecar=fs.readFileSync(f.catalogPath),copyRoot=path.join(f.root,'copied project'),paths={...f.paths,buildsFolder:path.join(f.root,'copy builds'),compositeFolder:path.join(f.root,'copy composites'),cacheFolder:path.join(copyRoot,'CACHE')};
 const copy=f.projects.confirm(f.projects.preview({operation:'import',sourceFolder:f.projectFolder,name:'Copied catalog',projectFolder:copyRoot,paths}).token);
 const c=f.store().read(copy);assert.equal(c.projectFolder,copyRoot);assert.equal(c.assets[0].id,'IMPORTED-ID');assert.equal(c.assets[0].notes,'saved sidecar decision');assert.equal(c.assets[0].legacy.Notes,'imported uncertainty');assert.deepEqual(fs.readFileSync(path.join(copyRoot,'STATE/library-catalog.json')),sidecar);assert.equal(JSON.parse(sidecar).projectFolder,undefined);
});
test('preexisting transaction directories and catalog hardlinks are never overwritten or adopted',t=>{
 const f=fixture(t);f.act('register-asset',{path:f.media()});const before=fs.readFileSync(f.catalogPath),dir=path.join(f.projectFolder,'backups/library-fixed-token');fs.mkdirSync(dir);const sentinel=path.join(dir,'before.json');fs.writeFileSync(sentinel,'must remain untouched');
 const crypto=require('node:crypto'),uuid=crypto.randomUUID;crypto.randomUUID=()=> 'fixed-token';try{assert.throws(()=>f.store().transact(f.fresh(),d=>{d.assets[0].notes='must not publish';}),/EEXIST|exist/i);}finally{crypto.randomUUID=uuid;}assert.equal(fs.readFileSync(sentinel,'utf8'),'must remain untouched');assert.deepEqual(fs.readFileSync(f.catalogPath),before);
 const link=path.join(f.root,'catalog hardlink.json');fs.linkSync(f.catalogPath,link);assert.throws(()=>f.read(),/hardlink/i);fs.unlinkSync(link);assert.deepEqual(fs.readFileSync(f.catalogPath),before);
});
test('read projects without writes, preserving registry identity and all provenance',t=>{
 const f=fixture(t),p=f.media();fs.appendFileSync(f.registry,row('KEEP-ID',p));
 const csv=fs.readFileSync(f.registry),descriptor=fs.readFileSync(path.join(f.projectFolder,'retro-project.json'));
 const c=f.read();assert.equal(c.schemaVersion,1);assert.equal(c.readOnly,false);assert.equal(c.assets[0].id,'KEEP-ID');
 assert.equal(c.assets[0].notes,'human, moon');assert.equal(c.assets[0].legacy.Notes,'imported uncertainty');
 assert.equal(c.assets[0].legacy.InferredTags,'inference only');assert.equal(c.assets[0].legacy.OriginalID,'original-token');
 assert.equal(c.assets[0].legacyScalarPool,'OLD_POOL');assert.deepEqual(c.assets[0].pools,['OLD_POOL']);assert.equal(c.assets[0].health,'BAD_AUDIO');
 assert.equal(fs.existsSync(f.catalogPath),false);c.assets[0].notes='mutated view';assert.equal(f.read().assets[0].notes,'human, moon');
 assert.deepEqual(fs.readFileSync(f.registry),csv);assert.deepEqual(fs.readFileSync(path.join(f.projectFolder,'retro-project.json')),descriptor);
});
