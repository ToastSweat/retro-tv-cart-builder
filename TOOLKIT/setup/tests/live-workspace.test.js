'use strict';
const test=require('node:test'),assert=require('node:assert/strict');
const live=()=>require('../live-workspace.js');
class Element {
 constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.attributes={};this.style={setProperty:(k,v)=>{this.attributes[k]=String(v);}};this._text='';this.value='';}
 set textContent(v){this._text=String(v);this.children=[];}get textContent(){return this._text+this.children.map(n=>n.textContent).join('');}
 set innerHTML(_){throw Error('Unsafe HTML');}append(...nodes){this.children.push(...nodes);}replaceChildren(...nodes){this._text='';this.children=nodes;}setAttribute(k,v){this.attributes[k]=String(v);}getAttribute(k){return this.attributes[k];}focus(){this.ownerDocument.activeElement=this;}setSelectionRange(){}addEventListener(k,fn){this['on'+k]=fn;}removeEventListener(){}querySelectorAll(){return [];}getBoundingClientRect(){return {width:1000};}
}
function fixtureDOM(){const doc={activeElement:null,createElement:tag=>new Element(tag,doc)};const root=doc.createElement('div');doc.getElementById=id=>{const visit=n=>n.id===id?n:n.children.map(visit).find(Boolean);return visit(root);};return {doc,root,get:doc.getElementById};}
const project={projectFolder:'C:\\Fixture\\A',kind:'managed',name:'Fixture',readOnly:false};
const asset=(id)=>({id:String(id),name:`Asset ${id}`,category:'Other',subtype:'OTHER',classificationByCategory:{},pools:[],network:'',show:'',notes:'',date:{mode:'Unknown',value:''},health:'UNREVIEWED',reason:'',path:'C:\\Source\\clip.mp4',technical:null,recipe:{revision:0,trimStartSeconds:0,trimEndSeconds:0,cropLeft:0,cropRight:0,cropTop:0,cropBottom:0,audioRepair:'NONE'},legacy:{},uses:[],variants:[]});
const catalog=(assets=[])=>({schemaVersion:1,revision:0,etag:'etag-0',projectFolder:project.projectFolder,readOnly:false,assets,locations:[],networks:[],selectionPools:[],groups:[],jobs:[],warnings:[]});
test('confirmed relink clears the acknowledged field and rebinds its visible proposal',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a')]);const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{if(url.includes('/dependencies?'))return{dependencies:[]};if(body){snap.assets[0].path=body.payload.path;snap.etag='relinked';return{catalog:snap,result:{assetId:'a'}};}return snap;}});await session.ready;get('live-asset-a').onclick();get('live-tab-Source').onclick();get('live-relink-path').value='C:\\Source\\new.mp4';get('live-relink-path').oninput();await get('live-relink-asset').onclick();await get('live-confirm-impact').onclick();assert.equal(get('live-relink-path').value,'');session.destroy();
});
test('reading a completed job result stays open while another job reports real progress',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog();snap.jobs=[{id:'finished',kind:'scan',state:'succeeded',result:{registered:36}},{id:'active',kind:'scan',state:'running',item:1,count:36}];let jobs=structuredClone(snap.jobs);const session=live().mount(root,{project,schedule:()=>0,request:async url=>url.includes('/jobs?')?{jobs}:snap});await session.ready;
 const detail=get('live-job-result-finished');assert.ok(detail);detail.open=true;detail.ontoggle();jobs[1].item=2;await session.controller.poll();assert.equal(get('live-job-result-finished').open,true);session.destroy();
});
test('idle and progress polls plus row selection retain catalog controls and open disclosures',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a'),asset('b')]);snap.jobs=[{id:'scan',kind:'scan',state:'running',stage:'probe',item:0,count:2}];let jobs=structuredClone(snap.jobs);const session=live().mount(root,{project,schedule:()=>0,request:async url=>url.includes('/jobs?')?{jobs}:snap});await session.ready;
 const row=get('live-select-a'),path=get('live-registration-path'),locations=get('live-location-controls');locations.open=true;locations.ontoggle();await session.controller.poll();assert.equal(get('live-select-a'),row);assert.equal(get('live-registration-path'),path);assert.equal(get('live-location-controls').open,true);row.checked=true;row.onchange();assert.equal(get('live-select-a'),row);assert.equal(get('live-selection-count').textContent,'1 selected assets');assert.equal(get('live-bulk-apply').disabled,false);assert.equal(get('live-group-add-selected').disabled,false);
 jobs=[{...jobs[0],item:1}];await session.controller.poll();assert.equal(get('live-select-a'),row);assert.equal(get('live-registration-path'),path);session.destroy();
});
test('each pane header toggles Expand and Collapse without discarding sizes or asset drafts',async()=>{
 const {root,get}=fixtureDOM(),session=live().mount(root,{project,schedule:()=>0,request:async()=>catalog([asset('a')])});await session.ready;get('live-asset-a').onclick();get('live-notes').value='Retained while expanded';get('live-notes').oninput();const sizes=[...session.layout.weights];
 for(const key of ['library','cart-builder','tv-studio']){const button=get('live-expand-'+key);assert.equal(button.textContent,'Expand');button.onclick();assert.equal(button.textContent,'Collapse');assert.equal(button.getAttribute('aria-expanded'),'true');button.onclick();assert.equal(button.textContent,'Expand');assert.equal(button.getAttribute('aria-expanded'),'false');for(const id of ['library','cart-builder','tv-studio'])assert.equal(get('live-area-'+id).hidden,false);}
 assert.deepEqual(session.layout.weights,sizes);assert.equal(session.controller.draft().metadata.notes,'Retained while expanded');session.destroy();
});
test('interrupted worker recovery is explicit, etag-bound and never silently retried',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a')]),calls=[],blocking=[];snap.jobs=[{id:'orphan',kind:'variant',state:'interrupted',recoveryRequired:true,stage:'owner lost'}];
 const session=live().mount(root,{project,onBlockingChange:b=>blocking.push(b),schedule:()=>0,request:async(url,body)=>{calls.push({url,body});if(body){assert.equal(url,'/api/library/recover');return{catalog:{...snap,etag:'recovered',jobs:[{...snap.jobs[0],recoveryRequired:false}]},result:{jobId:'orphan'}};}return snap;}});await session.ready;
 assert.equal(blocking.at(-1),true);assert.ok(get('live-recover-orphan'));assert.equal(get('live-retry-orphan'),undefined);await get('live-recover-orphan').onclick();assert.equal(calls.at(-1).body.projectFolder,project.projectFolder);assert.equal(calls.at(-1).body.expectedEtag,'etag-0');assert.equal(calls.at(-1).body.jobId,'orphan');assert.ok(get('live-retry-orphan'));assert.equal(blocking.at(-1),false);session.destroy();
});
test('human note draft remains prominently visible while previewing and inspecting sources without an implicit save',async()=>{
 const {root,get}=fixtureDOM(),a=asset('a');a.notes='Saved baseline note';const snap=catalog([a]),calls=[];const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});return snap;}});await session.ready;get('live-asset-a').onclick();get('live-notes').value='Unsaved moon review note';get('live-notes').oninput();
 for(const tab of ['Recipe','Source']){get('live-tab-'+tab).onclick();assert.ok(get('live-notes-summary'),'human notes must remain visible outside Properties');assert.match(get('live-notes-summary').textContent,/Unsaved moon review note/);assert.match(get('live-notes-summary').textContent,/unsaved/i);}
 assert.equal(calls.some(c=>c.body),false);assert.equal(snap.assets[0].notes,'Saved baseline note');session.destroy();
});
test('same-tab post-save handlers always edit the canonical metadata and recipe draft',async()=>{
 const {root,get}=fixtureDOM();let snap=catalog([asset('a')]);snap.assets[0].classificationByCategory={Other:[],Commercial:[]};const calls=[];
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{if(!body)return snap;calls.push(structuredClone(body));snap=structuredClone(snap);const a=snap.assets[0];if(body.operation==='save-metadata')Object.assign(a,body.payload.values);else {Object.assign(a.recipe,body.payload.values);a.recipe.revision++;}snap.etag='saved-'+calls.length;return {catalog:snap,result:{}};}});await session.ready;get('live-asset-a').onclick();
 const fill=(id,value)=>{get(id).value=value;get(id).oninput();},choose=(id,value)=>{get(id).value=value;get(id).onchange();};
 fill('live-notes','First note');await get('live-save-metadata').onclick();
 choose('live-date-mode','Year');const yearInput=get('live-year');fill('live-year','1997');assert.equal(get('live-year'),yearInput,'typing must not rebuild inputs');fill('live-show','Explicit series');await get('live-save-metadata').onclick();
 assert.deepEqual(calls.at(-1).payload.values.date,{mode:'Year',value:'1997'});assert.equal(session.controller.state.dirty,false);
 choose('live-category','Commercial');choose('live-date-mode','Range');fill('live-year','1990-1999');get('live-flag-Food').checked=true;get('live-flag-Food').onchange();await get('live-save-metadata').onclick();
 choose('live-date-mode','Date');fill('live-year','1997-04-09');get('live-flag-Toy').checked=true;get('live-flag-Toy').onchange();fill('live-notes','Second note');await get('live-save-metadata').onclick();
 assert.deepEqual(calls.at(-1).payload.values.date,{mode:'Date',value:'1997-04-09'});assert.deepEqual(calls.at(-1).payload.values.classificationByCategory.Commercial,['Food','Toy']);assert.equal(calls.at(-1).payload.values.show,'Explicit series');assert.equal(session.controller.state.dirty,false);
 get('live-tab-Recipe').onclick();choose('live-audio-repair','RESTORE');await get('live-save-recipe').onclick();choose('live-audio-repair','STRONG');await get('live-save-recipe').onclick();assert.equal(calls.at(-1).payload.values.audioRepair,'STRONG');assert.equal(session.controller.draft().baseRecipe.audioRepair,'STRONG');assert.equal(session.controller.state.dirty,false);session.destroy();
});
test('availability controls are role-specific and retain independent Episode and Commercial proposals',async()=>{
 const {root,get}=fixtureDOM(),a=asset('a');a.category='Episode/Show';a.availableFrom='2001-01-01';a.availableTo='2005-12-31';a.classificationByCategory={'Episode/Show':[],Commercial:[],Branding:[],Other:[]};let snap=catalog([a]);
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{if(!body)return snap;snap=structuredClone(snap);Object.assign(snap.assets[0],body.payload.values);snap.etag+='x';return {catalog:snap,result:{}};}});await session.ready;get('live-asset-a').onclick();
 const choose=value=>{get('live-category').value=value;get('live-category').onchange();};assert.equal(get('live-available-from').value,'2001-01-01');choose('Branding');assert.equal(get('live-available-from'),undefined);get('live-branding-role').value='IDENT';get('live-branding-role').onchange();await get('live-save-metadata').onclick();choose('Other');assert.equal(get('live-available-from'),undefined);choose('Commercial');assert.equal(get('live-available-from').value,'');get('live-available-from').value='1996-01-01';get('live-available-from').oninput();get('live-available-to').value='1998-12-31';get('live-available-to').oninput();choose('Episode/Show');assert.equal(get('live-available-from').value,'2001-01-01');choose('Commercial');assert.equal(get('live-available-from').value,'1996-01-01');await get('live-save-metadata').onclick();assert.deepEqual(session.controller.draft().metadata.availabilityByCategory,{'Episode/Show':{availableFrom:'2001-01-01',availableTo:'2005-12-31'},Commercial:{availableFrom:'1996-01-01',availableTo:'1998-12-31'}});session.destroy();
});
test('initial catalog loading is explicit and disables duplicate UI refresh until the result arrives',async()=>{
 const {root,get}=fixtureDOM();let release;const pending=new Promise(resolve=>{release=resolve;}),session=live().mount(root,{project,schedule:()=>0,request:()=>pending});
 try{assert.equal(session.controller.state.loading,true);assert.match(root.textContent,/Loading.*catalog/i);assert.equal(get('live-refresh').disabled,true);}finally{release(catalog());await session.ready;}
 assert.equal(session.controller.state.loading,false);assert.equal(get('live-refresh').disabled,false);session.destroy();
});
test('cancelling while a catalog refresh is pending retires its loading indicator',async()=>{
 let pending=false,release;const snap=catalog(),c=live().createController({project,request:async(url,body)=>body?{catalog:snap,result:{jobId:'j'}}:pending?new Promise(r=>{release=r;}):snap});await c.load();pending=true;const read=c.load();assert.equal(c.state.loading,true);await c.cancel('j');assert.equal(c.state.loading,false);release(snap);await read;assert.equal(c.state.loading,false);
});
test('live catalog is project-bound and browse pages contain at most 100 real records',async()=>{
 const calls=[],snapshot=catalog(Array.from({length:6109},(_,i)=>asset(i)));
 const c=live().createController({project,request:async(url,body)=>{calls.push({url,body});return snapshot;}});
 assert.equal(c.state.catalog,null);await c.load();assert.equal(c.page().items.length,100);assert.equal(c.page().total,6109);
 c.setFilter('search','Asset 6108');assert.deepEqual(c.page().items.map(a=>a.id),['6108']);
 assert.equal(calls[0].url,'/api/library/catalog?projectFolder='+encodeURIComponent(project.projectFolder));assert.equal(calls[0].body,undefined);
 snapshot.assets[0].name='Changed outside';assert.equal(c.state.catalog.assets[0].name,'Asset 0');
 const bad=live().createController({project,request:async()=>({...catalog(),projectFolder:'wrong'})});assert.equal(await bad.load(),false);assert.equal(bad.state.catalog,null);assert.match(bad.state.error,/project/i);
});
test('metadata and recipes retain separate drafts and fence unknown writes without replay',async()=>{
 const calls=[],dirty=[];let saved=catalog([asset('a')]),lose=false;
 const c=live().createController({project,onDirtyChange:d=>dirty.push(d),request:async(url,body)=>{calls.push({url,body});if(!body)return saved;if(lose)throw Error('lost acknowledgement');saved=structuredClone(saved);saved.etag='etag-1';Object.assign(saved.assets[0],body.payload.values);return {catalog:saved,result:{}};}});
 await c.load();c.select('a');c.editMetadata('notes','human notes');c.editRecipe('cropLeft',12);
 assert.equal(c.state.dirty,true);assert.equal(await c.saveMetadata(),true);
 assert.equal(calls.at(-1).body.expectedEtag,'etag-0');assert.equal(calls.at(-1).body.projectFolder,project.projectFolder);assert.equal(calls.at(-1).body.operation,'save-metadata');assert.equal(calls.at(-1).body.payload.values.notes,'human notes');assert.equal(Object.hasOwn(calls.at(-1).body.payload.values,'subtype'),false);
 assert.equal(c.draft().recipe.cropLeft,12);assert.equal(c.state.dirty,true);
 lose=true;assert.equal(await c.saveRecipe(),false);assert.equal(c.state.uncertain,true);await c.saveRecipe();assert.equal(calls.filter(x=>x.body?.operation==='save-recipe').length,1);
 assert.equal(await c.readback(),true);assert.equal(c.state.uncertain,true);assert.equal(c.draft().recipe.cropLeft,12);
 c.acknowledgeReadback();assert.equal(c.state.uncertain,false);assert.ok(dirty.includes(true));
});
test('actions and jobs use the exact service contract, poll jobs not catalog until terminal, retain drafts',async()=>{
 const calls=[],blocking=[];let snap=catalog([asset('a')]),jobs=[];
 const c=live().createController({project,onBlockingChange:b=>blocking.push(b),request:async(url,body)=>{calls.push({url,body});if(url.includes('/jobs?'))return {jobs};if(url.includes('/dependencies?'))return {assets:[],carts:[]};if(url.includes('/planning?'))return {candidates:[]};if(!body)return snap;return {catalog:{...snap,jobs:[{id:'j',kind:'variant',state:'queued',stage:'queued'}]},result:{jobId:'j'}};}});
 await c.load();c.select('a');c.editMetadata('notes','keep');assert.equal(await c.startJob('variant',{assetId:'a'}),true);assert.equal(calls.at(-1).url,'/api/library/job');assert.equal(calls.at(-1).body.expectedEtag,'etag-0');
 jobs=[{id:'j',kind:'variant',state:'running',stage:'encoding',item:1,count:1}];await c.poll();assert.equal(calls.filter(x=>x.url.includes('/catalog?')).length,1);assert.ok(blocking.includes(true));
 jobs=[{id:'j',kind:'variant',state:'succeeded',stage:'complete'}];await c.poll();assert.equal(calls.filter(x=>x.url.includes('/catalog?')).length,2);assert.equal(c.draft().metadata.notes,'keep');
 await c.action('bulk-pools',{assetIds:['a'],mode:'Remove',pools:['KIDS']});assert.equal(calls.at(-1).body.operation,'bulk-pools');
 await c.dependencies('a');assert.ok(calls.at(-1).url.includes('assetId=a'));await c.planning();assert.ok(calls.at(-1).url.includes('/planning?'));
 assert.match(c.mediaUrl({assetId:'a',kind:'source'}),/^\/api\/library\/media\?/);assert.throws(()=>c.mediaUrl({path:'C:\\secret'}),/media/i);
});
test('combined workspace mounts Browse, inspects live metadata, resizes and retains drafts on suspend/resume',async()=>{
 const {root,get}=fixtureDOM();let snap=catalog([asset('a')]);const calls=[];
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});if(!body)return snap;Object.assign(snap.assets[0],body.payload.values);snap.etag='next';return {catalog:snap,result:{}};}});await session.ready;
 for(const id of ['library','cart-builder','tv-studio'])assert.ok(get('live-area-'+id));assert.equal(get('live-browse').hidden,false);assert.equal(get('live-inspector').hidden,true);
 get('live-asset-a').onclick();const notes=get('live-notes');notes.value='<script>inert human notes</script>';notes.oninput();
 get('live-expand-cart-builder').onclick();get('live-restore').onclick();assert.equal(get('live-notes').value,'<script>inert human notes</script>');
 const divider=get('live-divider-0');divider.onkeydown({key:'End',preventDefault(){}});assert.equal(session.layout.weights[0],70);assert.ok(session.layout.weights.every(n=>n>=15&&n<=70));
 await get('live-save-metadata').onclick();assert.equal(calls.at(-1).body.payload.values.notes,'<script>inert human notes</script>');
 session.suspend();session.resume({project});assert.equal(get('live-notes').value,'<script>inert human notes</script>');session.destroy();
});
test('properties expose category-specific flags, single branding role, explicit pools, dates and read-only provenance',async()=>{
 const {root,get}=fixtureDOM(),a=asset('a');a.legacy={Notes:'imported notes',Subtype:'OLD'};const snap=catalog([a]);snap.selectionPools=[{value:'KIDS',label:'Kids pool'},{value:'GENERAL',label:'General pool'}];snap.networks=[{code:'NICK',name:'Nickelodeon',kind:'Network',archived:false},{code:'OLD',name:'Archived',kind:'Network',archived:true}];
 const session=live().mount(root,{project,schedule:()=>0,request:async()=>snap});await session.ready;get('live-asset-a').onclick();
 const category=get('live-category');category.value='Episode/Show';category.onchange();get('live-flag-Holiday').checked=true;get('live-flag-Holiday').onchange();get('live-flag-Multipart').checked=true;get('live-flag-Multipart').onchange();
 assert.deepEqual(session.controller.draft().metadata.classificationByCategory['Episode/Show'],['Holiday','Multipart']);
 get('live-category').value='Branding';get('live-category').onchange();get('live-branding-role').value='IDENT';get('live-branding-role').onchange();
 assert.deepEqual(session.controller.draft().metadata.classificationByCategory.Branding,['IDENT']);get('live-category').value='Episode/Show';get('live-category').onchange();assert.equal(get('live-flag-Holiday').checked,true);
 get('live-pool-KIDS').checked=true;get('live-pool-KIDS').onchange();assert.deepEqual(session.controller.draft().metadata.pools,['KIDS']);assert.match(root.textContent,/imported notes/);assert.ok(get('live-year'));assert.ok(get('live-source-health'));assert.ok(get('live-health-reason'));session.destroy();
});
test('registration uses typed/native paths, scan jobs and guarded missing-source relink/removal show dependency impact',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a')]),calls=[];snap.locations=[{id:'loc',path:'C:\\Media',removed:false}];
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});if(url==='/api/library/browse')return {path:'C:\\Picked\\clip.mp4',cancelled:false};if(url.includes('/dependencies?'))return {carts:[{id:'PINNED'}]};if(body)return {catalog:snap,result:{}};return snap;}});await session.ready;
 get('live-registration-path').value='C:\\Typed\\clip.mp4';get('live-registration-path').oninput();await get('live-register-asset').onclick();assert.deepEqual(calls.at(-1).body.payload,{path:'C:\\Typed\\clip.mp4'});
 await get('live-browse-file').onclick();assert.equal(get('live-registration-path').value,'C:\\Picked\\clip.mp4');await get('live-scan-loc').onclick();assert.equal(calls.at(-1).body.kind,'scan');assert.equal(calls.at(-1).body.locationId,'loc');
 get('live-asset-a').onclick();get('live-tab-Source').onclick();get('live-relink-path').value='C:\\New\\clip.mp4';get('live-relink-path').oninput();await get('live-relink-asset').onclick();assert.match(root.textContent,/PINNED/);assert.equal(calls.at(-1).body,undefined);
 await get('live-confirm-impact').onclick();assert.equal(calls.at(-1).body.operation,'relink-asset');assert.equal(calls.at(-1).body.payload.assetId,'a');session.destroy();
});
test('bulk pools and reusable network/group managers submit explicit stable identities and ordered recipe pins',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a'),asset('b')]),calls=[];snap.networks=[{code:'NICK',name:'Nickelodeon',kind:'Network',archived:false}];snap.selectionPools=[{value:'KIDS',label:'Kids'}];
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});return body?{catalog:snap,result:{}}:snap;}});await session.ready;
 get('live-select-a').checked=true;get('live-select-a').onchange();get('live-select-b').checked=true;get('live-select-b').onchange();get('live-bulk-mode').value='Remove';get('live-bulk-mode').onchange();get('live-bulk-pool-KIDS').checked=true;get('live-bulk-pool-KIDS').onchange();await get('live-bulk-apply').onclick();assert.deepEqual(calls.at(-1).body.payload,{assetIds:['a','b'],mode:'Remove',pools:['KIDS']});
 get('live-new-pool').value='LITERAL_CODE';get('live-new-pool').oninput();await get('live-add-pool').onclick();assert.equal(calls.at(-1).body.operation,'add-pool');
 get('live-network-code').value='NEW_BLOCK';get('live-network-code').oninput();get('live-network-name').value='Name <img>';get('live-network-name').oninput();await get('live-network-add').onclick();assert.equal(calls.at(-1).body.payload.code,'NEW_BLOCK');
 get('live-group-name').value='Ordered show';get('live-group-name').oninput();get('live-group-add-selected').onclick();get('live-group-up-1').onclick();await get('live-group-save').onclick();assert.deepEqual(calls.at(-1).body.payload.parts,[{assetId:'b',recipeRevision:0},{assetId:'a',recipeRevision:0}]);session.destroy();
});
test('real job stages, owned output kinds and crop proposals are shown without automatic recipe edits',async()=>{
 const {root,get}=fixtureDOM(),a=asset('a'),snap=catalog([a]),calls=[];a.technical={duration:10,width:720,height:480,sar:'8:9',hasAudio:true};a.sourceFingerprint={size:100,mtimeMs:1,sha256:'measured-hash'};snap.jobs=[{id:'frame',kind:'source-frame',assetId:'a',state:'succeeded',stage:'complete',snapshot:{recipe:a.recipe,sampleTime:1,sourceFingerprint:a.sourceFingerprint},outputs:[{kind:'source-frame',path:'private-path',mime:'image/jpeg'}]},{id:'detect',kind:'crop-detect',assetId:'a',state:'succeeded',stage:'complete',snapshot:{sourceFingerprint:a.sourceFingerprint},result:{cropProposals:[{cropLeft:12,cropRight:14,cropTop:2,cropBottom:4}]}},{id:'active',kind:'variant',assetId:'a',state:'running',stage:'encoding original',item:2,count:3},{id:'failed',kind:'preview',assetId:'a',state:'failed',stage:'failed',error:'decoder error'}];
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});return body?{catalog:snap,result:{}}:snap;}});await session.ready;assert.match(root.textContent,/encoding original/);assert.match(root.textContent,/decoder error/);assert.ok(get('live-cancel-active'));assert.ok(get('live-retry-failed'));
 get('live-asset-a').onclick();get('live-tab-Recipe').onclick();assert.ok(get('live-crop-frame'));assert.equal(session.controller.draft().recipe.cropLeft,0);get('live-apply-crop-detect-0').onclick();assert.equal(session.controller.draft().recipe.cropLeft,12);assert.equal(get('live-prepare-variant').disabled,true);assert.ok(get('live-crop-frame').children[0].src.includes('kind=source-frame'));session.destroy();
});
test('edits made during a save survive its acknowledgement, initial blocking jobs notify setup, and stale confirmations cannot write',async()=>{
 const {root,get}=fixtureDOM(),a=asset('a');a.technical={duration:100,width:720,height:480,sar:'1:1'};let snap=catalog([a]),release;const blocking=[];
 snap.jobs=[{id:'blocking',kind:'variant',state:'running',stage:'encode'}];
 const session=live().mount(root,{project,schedule:()=>0,onBlockingChange:b=>blocking.push(b),request:async(url,body)=>{if(!body)return snap;await new Promise(r=>release=r);snap=structuredClone(snap);Object.assign(snap.assets[0].recipe,body.payload.values);snap.assets[0].recipe.revision++;snap.etag='next';return {catalog:snap,result:{}};}});await session.ready;assert.ok(blocking.includes(true));get('live-asset-a').onclick();get('live-tab-Recipe').onclick();
 get('live-cropLeft').value=10;get('live-cropLeft').oninput();const saving=get('live-save-recipe').onclick();get('live-cropLeft').value=20;get('live-cropLeft').oninput();release();await saving;assert.equal(session.controller.draft().recipe.cropLeft,20);assert.equal(session.controller.draft().baseRecipe.cropLeft,10);assert.equal(session.controller.state.dirty,true);session.destroy();
});
test('source-family selectors are readable and bounded, planning readback is authoritative, cached forms survive reconnect',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a'),asset('b')]),calls=[];
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});if(url.includes('/planning?'))return {candidates:[{assetId:'a',eligible:false,reasons:['not prepared']}]};if(url.includes('/dependencies?'))return {carts:[]};return body?{catalog:snap,result:{}}:snap;}});await session.ready;get('live-asset-a').onclick();get('live-tab-Source').onclick();get('live-relationship-sourceId').value='b';get('live-relationship-sourceId').onchange();await get('live-save-relationships').onclick();await get('live-confirm-impact').onclick();assert.equal(calls.at(-1).body.operation,'set-relationships');assert.equal(calls.at(-1).body.payload.sourceId,'b');
 await get('live-read-planning').onclick();assert.match(root.textContent,/not prepared/);session.suspend();const before=calls.length;session.resume({project});await new Promise(r=>setImmediate(r));assert.ok(calls.slice(before).some(x=>x.url.includes('/catalog?')));session.destroy();
});
test('suspended catalog responses cannot overwrite newer context data and pending save acknowledgement stays bound to its submitted asset',async()=>{
 let snapshot=catalog([asset('a'),asset('b')]),release;const c=live().createController({project,request:async(url,body)=>{if(!body)return snapshot;await new Promise(r=>release=r);snapshot=structuredClone(snapshot);Object.assign(snapshot.assets[0],body.payload.values);snapshot.etag='next';return {catalog:snapshot,result:{}};}});await c.load();c.select('a');c.editMetadata('notes','A saved');const saving=c.saveMetadata();c.select('b');c.editMetadata('notes','B unsaved');release();await saving;c.select('a');assert.equal(c.draft().metadata.notes,'A saved');c.select('b');assert.equal(c.draft().metadata.notes,'B unsaved');
});
test('navigation and reload fences include unsaved registration/group drafts and stale asset drafts have explicit discard recovery',async()=>{
 const {root,get}=fixtureDOM(),dirty=[];const session=live().mount(root,{project,schedule:()=>0,onDirtyChange:v=>dirty.push(v),confirmDiscard:()=>true,request:async()=>catalog([asset('a')])});await session.ready;
 get('live-registration-path').value='C:\\Unsaved source.mp4';get('live-registration-path').oninput();assert.equal(dirty.at(-1),true);session.suspend();session.resume({project});assert.equal(get('live-registration-path').value,'C:\\Unsaved source.mp4');get('live-asset-a').onclick();get('live-notes').value='temporary';get('live-notes').oninput();get('live-discard-asset-drafts').onclick();assert.equal(get('live-notes').value,'');session.destroy();
});
test('late reads from a suspended context are ignored, and a read begun before a mutation cannot overwrite its snapshot',async()=>{
 let resolveRead,hold=false,snap=catalog([asset('a')]);const c=live().createController({project,request:async(url,body)=>{if(body)return {catalog:{...snap,etag:'saved'},result:{}};if(hold)return new Promise(r=>resolveRead=r);return snap;}});await c.load();hold=true;const old=c.load();c.setActive(false);resolveRead({...snap,etag:'obsolete'});await old;assert.equal(c.state.catalog.etag,'etag-0');c.setActive(true);const earlier=c.load();await c.action('add-pool',{value:'X',label:'X'});resolveRead({...snap,etag:'older'});await earlier;assert.equal(c.state.catalog.etag,'saved');
});
test('source playback has a new lifetime after relink and cancellation immediately blocks navigation',async()=>{
 const {root,get}=fixtureDOM();let snap=catalog([asset('a')]),release;const blocking=[];snap.assets[0].technical={width:160,height:120,duration:10,sar:'1:1'};snap.jobs=[{id:'old-frame',kind:'source-frame',assetId:'a',state:'succeeded',snapshot:{source:{path:snap.assets[0].path}},outputs:[{kind:'frame',path:'C:\\frame.jpg',mime:'image/jpeg'}]}];const session=live().mount(root,{project,schedule:()=>0,onBlockingChange:v=>blocking.push(v),request:async(url,body)=>{if(url==='/api/library/cancel'){await new Promise(r=>release=r);return {catalog:snap,result:{}};}return snap;}});await session.ready;get('live-asset-a').onclick();get('live-tab-Recipe').onclick();const player=get('live-source-player');snap=structuredClone(snap);snap.assets[0].path='C:\\Relinked.mp4';snap.etag='relinked';await session.controller.load();assert.notEqual(get('live-source-player'),player);assert.equal(get('live-crop-frame'),undefined,'relinked sources cannot show the old source frame as current');
 const cancel=session.controller.cancel('job');assert.equal(blocking.at(-1),true);release();await cancel;session.destroy();
});
test('guarded impact expires when the catalog changes and readonly sessions cannot submit writes',async()=>{
 const {root,get}=fixtureDOM(),calls=[];let snap=catalog([asset('a')]);const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});if(url.includes('/dependencies?'))return {blocked:true,carts:['PIN']};return body?{catalog:snap,result:{}}:snap;}});await session.ready;get('live-asset-a').onclick();get('live-tab-Source').onclick();await get('live-remove-asset').onclick();snap={...snap,etag:'changed'};await session.controller.load();await get('live-confirm-impact').onclick();assert.equal(calls.filter(x=>x.body?.operation==='remove-asset').length,0);assert.match(root.textContent,/stale|changed/i);session.destroy();
 const c=live().createController({project:{...project,readOnly:true},request:async()=>({...catalog([asset('a')]),readOnly:true})});await c.load();assert.equal(await c.action('register-asset',{path:'C:\\x'}),false);
});
test('registration acknowledgement clears only the submitted proposal and keeps new typing made in flight',async()=>{
 const {root,get}=fixtureDOM();let release;const snap=catalog([]);const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{if(!body)return snap;await new Promise(r=>release=r);return {catalog:snap,result:{}};}});await session.ready;get('live-registration-path').value='C:\\First.mp4';get('live-registration-path').oninput();const saved=get('live-register-asset').onclick();get('live-registration-path').value='C:\\Second.mp4';get('live-registration-path').oninput();release();await saved;assert.equal(get('live-registration-path').value,'C:\\Second.mp4');session.destroy();
});
test('job output links use exact owned kinds and readiness is distinguished from source health and cart approval',async()=>{
 const {root,get}=fixtureDOM(),snap=catalog([asset('a')]);snap.jobs=[{id:'composite-output',kind:'composite',state:'succeeded',stage:'complete',outputs:[{kind:'media',path:'C:\\private-output.mp4',mime:'video/mp4'}]}];const session=live().mount(root,{project,schedule:()=>0,request:async()=>snap});await session.ready;const link=get('live-output-composite-output-media');assert.ok(link);assert.ok(link.attributes.href.startsWith('/api/library/media?'));assert.equal(link.attributes.target,'_blank');assert.match(link.attributes.rel,/noopener/);get('live-asset-a').onclick();assert.match(root.textContent,/Prepared-output readiness/);session.destroy();
});
test('structured year filters handle explicit dates/ranges without inferring unknowns; planning applies those explicit filters',async()=>{
 const dated=asset('date'),range=asset('range'),unknown=asset('unknown');dated.date={mode:'Date',value:'2001-05-01'};range.date={mode:'Range',value:'2000 .. 2002'};const calls=[];const c=live().createController({project,request:async url=>{calls.push(url);return url.includes('/planning?')?{candidates:[]}:catalog([dated,range,unknown]);}});await c.load();c.setFilter('year','2001');assert.deepEqual(c.page().items.map(a=>a.id).sort(),['date','range']);c.setFilter('allowUnknown',true);assert.equal(c.page().total,3);await c.planning({year:'2001',allowUnknown:'true'});assert.ok(calls.at(-1).includes('allowUnknown=true'));assert.ok(calls.at(-1).includes('year=2001'));
});
test('setup navigation fences match server blocking probe/scan/variant/composite, not replaceable preview/frame jobs',async()=>{
 for(const kind of ['probe','scan','variant','composite','preview','source-frame','final-frame','crop-detect']){const values=[];const snap=catalog([]);snap.jobs=[{id:'job',kind,state:'running'}];const c=live().createController({project,onBlockingChange:v=>values.push(v),request:async()=>snap});await c.load();assert.equal(values.at(-1),['probe','scan','variant','composite'].includes(kind),kind);}
});
test('live styles keep desktop panes independently scrollable, use bounded weights and stack on mobile',()=>{
 const fs=require('node:fs'),path=require('node:path');const css=fs.readFileSync(path.join(__dirname,'../live-workspace.css'),'utf8');assert.match(css,/overflow-y:\s*auto/);assert.match(css,/--lw-weight-0/);assert.match(css,/@media\s*\(max-width:\s*800px\)/);assert.doesNotMatch(css,/@import|https?:|\bfr\s*\*/);
});
test('recipe controls use removed seconds and integer original pixels, frames/playback use owned URLs, save differs from prepare',async()=>{
 const {root,get}=fixtureDOM(),a=asset('a'),calls=[];a.technical={duration:120,width:720,height:480,sar:'8:9',hasAudio:true};let snap=catalog([a]);
 const session=live().mount(root,{project,schedule:()=>0,request:async(url,body)=>{calls.push({url,body});if(body?.operation==='save-recipe'){assert.equal(Object.hasOwn(body.payload.values,'revision'),false);snap=structuredClone(snap);Object.assign(snap.assets[0].recipe,body.payload.values);snap.assets[0].recipe.revision++;snap.etag='next';}return body?{catalog:snap,result:{jobId:'job'}}:snap;}});await session.ready;get('live-asset-a').onclick();get('live-tab-Recipe').onclick();
 get('live-trimStartSeconds').value=2.5;get('live-trimStartSeconds').oninput();get('live-cropLeft').value=10;get('live-cropLeft').oninput();assert.equal(session.controller.draft().recipe.cropLeft,10);assert.ok(get('live-source-player').src.startsWith('/api/library/media?'));
 await get('live-save-recipe').onclick();assert.equal(calls.at(-1).body.operation,'save-recipe');await get('live-prepare-variant').onclick();assert.equal(calls.at(-1).body.kind,'variant');
 get('live-sample-time').value=12;get('live-sample-time').oninput();await get('live-source-frame').onclick();assert.equal(calls.at(-1).body.sampleTime,12);get('live-no-crop').onclick();assert.equal(session.controller.draft().recipe.cropLeft,0);session.destroy();
});
