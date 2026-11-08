'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const demo = require('../app.js');

class DemoNode {
  constructor(tag, doc) { this.tagName = tag; this.doc = doc; this.children = []; this.attributes = {}; this.listeners = {}; this.value = ''; this.hidden = false; this.textContent = ''; this.style = {setProperty:(key,value)=>{this.attributes[key]=value;}}; }
  setAttribute(k,v) {this.attributes[k] = String(v); if (k === 'id') this.id = v;}
  getAttribute(k) {return this.attributes[k];}
  append(...nodes) {this.children.push(...nodes);}
  replaceChildren(...nodes) {this.children = nodes;}
  addEventListener(k,fn) {this.listeners[k] ||= []; this.listeners[k].push(fn);}
  emit(k, extra = {}) {(this.listeners[k] || []).forEach(fn => fn({target:this, preventDefault(){}, key:'', ...extra}));}
  getBoundingClientRect() {return {width:1000, left:0};}
  setPointerCapture() {}
  releasePointerCapture() {}
  focus() {this.doc.activeElement = this;}
  showModal() {this.open = true;}
  close() {this.open = false; this.emit('close');}
}
function documentFixture() {
  const doc = {createElement: tag => new DemoNode(tag, doc), createElementNS: (_,tag) => new DemoNode(tag, doc), activeElement:null};
  doc.root = new DemoNode('main',doc); doc.root.id = 'rl-demo';
  doc.getElementById = id => {
    function walk(n) {if (n.id === id) return n; for (const c of n.children) {if (typeof c === 'object') {const found = walk(c); if (found) return found;}} return null;}
    return walk(doc.root);
  };
  return doc;
}

test('combined workspace has bounded real resize, keyboard separators, expand/restore and independent asset drafts', () => {
  const doc=documentFixture(), {model:m}=demo.mount(doc.root,{document:doc,protocol:'file:'});
  const get=id=>{const n=doc.getElementById(id);assert.ok(n,'missing hook '+id);return n;};
  const names=['library','cart-builder','tv-studio'];
  for(const key of names) assert.equal(get('workspace-'+key).hidden,false);
  m.draft('demo-ad','metadata',{notes:'keep layout-independent note'});
  m.draft('demo-audio','recipe',{trimStart:2});
  const drafts=structuredClone(m.drafts), start=[...m.layout.weights];
  const handle=get('resize-library-cart');
  assert.equal(handle.getAttribute('role'),'separator');assert.equal(handle.getAttribute('tabindex'),'0');
  assert.equal(handle.getAttribute('aria-orientation'),'vertical');
  handle.emit('keydown',{key:'ArrowRight'});assert.ok(m.layout.weights[0]>start[0]);
  handle.emit('pointerdown',{clientX:100,pointerId:1});handle.emit('pointermove',{clientX:180,pointerId:1});handle.emit('pointerup',{pointerId:1});
  assert.ok(m.layout.weights[0]>start[0]+2);
  for(const [boundary,delta] of [[0,999],[0,-999],[1,999],[1,-999]]) {
    m.resizeWorkspace(boundary,delta);
    assert.ok(m.layout.weights.every(w=>w>=15&&w<=70));assert.equal(m.layout.weights.reduce((a,b)=>a+b,0),100);
  }
  const saved=[...m.layout.weights];
  for(const key of names) {
    get('expand-'+key).emit('click');assert.equal(m.layout.expanded,key);
    for(const other of names) assert.equal(get('workspace-'+other).hidden,other!==key);
    assert.equal(handle.hidden,true);
    get('restore-workspaces').emit('click');assert.equal(m.layout.expanded,null);assert.deepEqual(m.layout.weights,saved);
    assert.ok(doc.activeElement===get('expand-'+key),'restore returns focus to expanded area trigger');
    for(const other of names) assert.equal(get('workspace-'+other).hidden,false);
  }
  assert.deepEqual(m.drafts,drafts);
  get('library-browse').emit('click');assert.equal(get('library-content').getAttribute('data-view'),'browse');
  get('inspect-demo-ad').emit('click');assert.equal(get('library-content').getAttribute('data-view'),'inspect');
  assert.equal(get('notes').value,'keep layout-independent note');
  const css=require('node:fs').readFileSync(require('node:path').join(__dirname,'../style.css'),'utf8');
  assert.match(css,/@container library/);assert.match(css,/--rl-library-weight/);
  assert.doesNotMatch(css,/calc\([^;{}]*\b1fr\b/,'CSS calc cannot multiply fr units');
  assert.match(css,/@media \(max-width:800px\)/);
  assert.doesNotMatch(css,/minmax\((?:300|390|400|470)px/);
  assert.equal(get('workbench').attributes['--rl-library-weight'],String(m.layout.weights[0]));
});

test('category-specific explicit flags keep Normal empty and retain separate category proposals and legacy provenance', () => {
  const doc=documentFixture(),{model:m}=demo.mount(doc.root,{document:doc,protocol:'file:'});
  const get=id=>{const n=doc.getElementById(id);assert.ok(n,'missing hook '+id);return n;};
  const click=id=>get(id).emit('click');
  const change=(id,v)=>{get(id).value=v;get(id).emit('change');};
  const check=(id,v)=>{get(id).checked=v;get(id).emit('change');};
  assert.equal(doc.getElementById('asset-subtype'),null,'commercial must not offer branding roles');
  check('classification-Food',true);check('classification-Restaurant',true);
  assert.deepEqual(m.view('demo-ad','metadata').classificationByCategory.Commercial,['Food','Restaurant']);
  change('asset-category','Episode/Show');
  assert.equal(doc.getElementById('classification-Food'),null);
  assert.equal(get('classification-normal').checked,true);
  check('classification-Holiday',true);check('classification-Crossover',true);
  assert.equal(get('classification-normal').checked,false);
  assert.deepEqual(m.view('demo-ad','metadata').classificationByCategory['Episode/Show'],['Holiday','Crossover']);
  check('classification-normal',true);assert.deepEqual(m.view('demo-ad','metadata').classificationByCategory['Episode/Show'],[]);
  change('asset-category','Commercial');assert.equal(get('classification-Food').checked,true);
  click('save-metadata');assert.deepEqual(m.asset('demo-ad').classificationByCategory.Commercial,['Food','Restaurant']);
  assert.equal(m.asset('demo-ad').legacySubtype,'OTHER');
  click('inspect-demo-part-1');assert.match(get('legacy-classification').textContent,/legacy series in Subtype/);
  click('inspect-demo-ident');assert.equal(get('asset-subtype').value,'IDENT');
  change('asset-subtype','NEXT');click('save-metadata');assert.equal(m.asset('demo-ident').subtype,'NEXT');assert.equal(m.asset('demo-ident').legacySubtype,'IDENT');
  change('asset-category','Other');assert.equal(doc.getElementById('asset-subtype'),null);get('classification-Short');
  change('asset-category','Branding');assert.equal(get('asset-subtype').value,'NEXT');
  assert.throws(()=>m.setClassifications('demo-ident',['Holiday']),/classification/i);
  assert.throws(()=>m.setClassifications('demo-ident',['IDENT','PROMO']),/primary|classification/i);
  change('asset-category','Commercial');assert.equal(get('classification-Food').checked,false);
  assert.equal(m.asset('demo-ident').subtype,'NEXT','category switching does not reinterpret branding roles');
});

test('multiple selection pools support explicit add/remove/replace without clobbering metadata or legacy Pool', () => {
  const doc=documentFixture(),{model:m}=demo.mount(doc.root,{document:doc,protocol:'file:'});
  const get=id=>{const n=doc.getElementById(id);assert.ok(n,'missing hook '+id);return n;};
  assert.ok(get('selection-pools-help').textContent.includes('not content types'));
  m.draft('demo-ad','metadata',{notes:'unrelated unsaved note'});m.draft('demo-audio','recipe',{trimStart:2});
  const legacy=m.asset('demo-ad').pool;
  get('asset-pool-KIDS_00S').checked=true;get('asset-pool-KIDS_00S').emit('change');
  get('asset-pool-GENERAL_00S').checked=true;get('asset-pool-GENERAL_00S').emit('change');
  get('save-metadata').emit('click');
  assert.deepEqual(m.asset('demo-ad').pools,['DemoGeneral','KIDS_00S','GENERAL_00S']);
  assert.equal(m.asset('demo-ad').pool,legacy);assert.equal(m.asset('demo-ad').notes,'unrelated unsaved note');
  m.setClassifications('demo-ad',['Food','Restaurant']);
  const flags=structuredClone(m.view('demo-ad','metadata').classificationByCategory);
  m.bulkPools(['demo-ad','demo-next'],'Add',['KIDS_00S']);
  assert.deepEqual(m.asset('demo-next').pools,['DemoBranding','KIDS_00S']);
  m.bulkPools(['demo-ad'],'Remove',['GENERAL_00S']);assert.deepEqual(m.asset('demo-ad').pools,['DemoGeneral','KIDS_00S']);
  m.bulkPools(['demo-ad'],'Replace',['GENERAL_00S']);assert.deepEqual(m.view('demo-ad','metadata').pools,['GENERAL_00S']);
  assert.deepEqual(m.view('demo-ad','metadata').classificationByCategory,flags);assert.equal(m.view('demo-audio','recipe').trimStart,2);
  const before=structuredClone(m.assets);assert.throws(()=>m.bulkPools(['demo-ad'],'Add',['Unknown']),/pool/i);assert.deepEqual(m.assets,before);
  assert.equal(m.asset('demo-ad').network,'Unassigned');assert.equal(m.asset('demo-ad').date.mode,'Unknown');
  get('select-demo-ad').checked=true;get('select-demo-ad').emit('change');get('bulk-edit').emit('click');
  get('bulk-pool-mode').value='Replace';get('bulk-pool-mode').emit('change');
  get('bulk-pool-KIDS_00S').checked=true;get('bulk-pool-KIDS_00S').emit('change');get('apply-bulk').emit('click');
  assert.deepEqual(m.asset('demo-ad').pools,['KIDS_00S']);assert.equal(m.asset('demo-ad').pool,legacy);
  assert.match(get('legacy-pool').textContent,/Demo general pool/);
});

test('network definitions preserve stable identities, pins and archive visibility while deletion preflights dependencies', () => {
  const m=demo.createModel();
  assert.equal(typeof m.addNetwork,'function','project definition management is missing');
  for(const code of ['nick',' BAD','BAD ','BAD-CODE','']) assert.throws(()=>m.addNetwork({code,name:'Invalid',kind:'Network'}),/code/i);
  assert.throws(()=>m.addNetwork({code:'NICK',name:'Duplicate',kind:'Network'}),/unique|exists/i);
  const added=m.addNetwork({code:'DEMO',name:'Demo Network',kind:'Network'});
  const block=m.addNetwork({code:'DEMO_BLOCK',name:'Demo block',kind:'Block',parentNetwork:'DEMO'});
  assert.equal(added.code,'DEMO');assert.equal(block.parentNetwork,'DEMO');
  assert.throws(()=>m.addNetwork({code:'WRONG',name:'Wrong',kind:'Block',parentNetwork:'SNICK'}),/parent/i);
  assert.ok(m.networkImpact('DEMO').blocks.some(n=>n.code==='DEMO_BLOCK'));
  assert.throws(()=>m.deleteNetwork('DEMO'),/depend|referenc/i);
  m.deleteNetwork('DEMO_BLOCK');
  m.draft('demo-ad','metadata',{network:'DEMO',notes:'keep network draft'});
  assert.throws(()=>m.deleteNetwork('DEMO'),/depend|referenc/i);
  m.saveMetadata('demo-ad');m.renameNetwork('DEMO','Renamed demo');
  assert.equal(m.asset('demo-ad').network,'DEMO');
  assert.ok(m.networkChoices('DEMO').some(o=>o.value==='DEMO'&&o.label.includes('Renamed demo')));
  m.archiveNetwork('DEMO',true);assert.ok(!m.networkChoices().some(o=>o.value==='DEMO'));
  assert.ok(m.networkChoices('DEMO').some(o=>o.label.includes('archived')));
  assert.throws(()=>m.saveMetadata('demo-next',{network:'DEMO'}),/archiv/i);
  assert.equal(m.asset('demo-next').network,'CN');
  m.saveMetadata('demo-ad',{notes:'save while assigned archived'});assert.equal(m.asset('demo-ad').network,'DEMO');
  m.archiveNetwork('DEMO',false);assert.ok(m.networkChoices().some(o=>o.value==='DEMO'));
  const pins=structuredClone(m.cartNetworkPins), legacyImpact=m.networkImpact('NICK');assert.ok(legacyImpact.carts.length);
  m.assets.filter(a=>a.network==='NICK').forEach(a=>m.saveMetadata(a.id,{network:'Unassigned'}));
  assert.throws(()=>m.deleteNetwork('NICK'),/depend|referenc/i);assert.deepEqual(m.cartNetworkPins,pins);
  m.renameNetwork('NICK','Nick renamed');assert.deepEqual(m.cartNetworkPins,pins);
  assert.equal(m.query({network:'NICK'}).some(a=>a.network==='SNICK'),false);
  m.saveMetadata('demo-ad',{network:'Unassigned'});m.deleteNetwork('DEMO');assert.ok(!m.networks.some(n=>n.code==='DEMO'));
});

test('network/block manager UI adds definitions, edits names, shows impact and blocks referenced deletion', () => {
  const doc=documentFixture(),{model:m}=demo.mount(doc.root,{document:doc,protocol:'file:'});
  const get=id=>{const n=doc.getElementById(id);assert.ok(n,'missing hook '+id);return n;};
  const click=id=>get(id).emit('click'),input=(id,v)=>{get(id).value=v;get(id).emit('input');};
  click('manage-networks');get('network-manager');input('network-code','DEMO');input('network-name','Demo network');click('add-network');
  input('network-name-DEMO','Display name changed');click('save-network-DEMO');
  assert.equal(m.networks.find(n=>n.code==='DEMO').name,'Display name changed');
  assert.ok(get('network-impact-NICK').children.length);click('delete-network-NICK');assert.match(get('mock-status').textContent,/depend|referenc/i);
  click('archive-network-NICK');assert.equal(m.networks.find(n=>n.code==='NICK').archived,true);
  click('dialog-close');assert.ok(get('asset-network').children.some(o=>o.attributes.value==='DEMO'&&o.textContent.includes('Display name changed')));
  click('inspect-demo-missing');assert.ok(get('asset-network').children.some(o=>o.attributes.value==='NICK'&&o.textContent.includes('archived')));
  click('manage-networks');click('unarchive-network-NICK');click('delete-network-DEMO');assert.ok(!m.networks.some(n=>n.code==='DEMO'));
});

test('category changes require explicit Branding choice and failed proposals leave assets and drafts intact', () => {
  const m=demo.createModel(),a=m.asset('demo-ad');
  a.legacySubtype='UNRECOGNIZED_LEGACY';a.subtype='UNRECOGNIZED_LEGACY';
  const before=structuredClone(a);
  assert.throws(()=>m.saveMetadata(a.id,{category:'Branding'}),/explicit.*Branding|primary.*role/i);
  assert.deepEqual(a,before);
  m.draft(a.id,'metadata',{category:'Branding'});m.setClassifications(a.id,['PROMO']);m.saveMetadata(a.id);
  assert.equal(a.subtype,'PROMO');assert.equal(a.legacySubtype,'UNRECOGNIZED_LEGACY');
  m.draft(a.id,'recipe',{trimStart:2});const drafts=structuredClone(m.drafts),saved=structuredClone(a);
  assert.throws(()=>m.saveMetadata(a.id,{classificationByCategory:{...a.classificationByCategory,Commercial:['Holiday']}}),/classification/i);
  assert.deepEqual(a,saved);assert.deepEqual(m.drafts,drafts);
  assert.throws(()=>m.saveMetadata(a.id,{pool:'rewrite legacy'}),/read only/i);
});

test('skip link restores a hidden Library inspector without discarding work-area sizes', () => {
  const doc=documentFixture(),skip=doc.createElement('a'),original=doc.getElementById;
  doc.getElementById=id=>id==='skip-inspector'?skip:original(id);
  const {model:m}=demo.mount(doc.root,{document:doc,protocol:'file:'});
  doc.getElementById('library-browse').emit('click');
  doc.getElementById('expand-cart-builder').emit('click');
  const weights=[...m.layout.weights];skip.emit('click');
  assert.equal(m.layout.expanded,null);assert.deepEqual(m.layout.weights,weights);
  assert.equal(doc.getElementById('library-content').getAttribute('data-view'),'inspect');
  assert.ok(doc.activeElement===doc.getElementById('inspector'));
});

test('review-state switching and composite saving reveal their Library surface from compact navigation', () => {
  const doc=documentFixture(),{model:m}=demo.mount(doc.root,{document:doc,protocol:'file:'});
  const get=id=>{const n=doc.getElementById(id);assert.ok(n,id);return n;},click=id=>get(id).emit('click');
  click('expand-cart-builder');get('scenario-select').value='Error';get('scenario-select').emit('change');
  assert.equal(m.layout.expanded,null,'Library review state must not stay hidden behind another expanded workspace');
  assert.equal(get('library-content').getAttribute('data-view'),'inspect');get('job-panel');
  get('scenario-select').value='Populated';get('scenario-select').emit('change');click('library-browse');
  for(const id of ['demo-part-1','demo-part-2']){get('select-'+id).checked=true;get('select-'+id).emit('change');}
  click('create-composite');click('save-group');
  assert.equal(get('library-content').getAttribute('data-view'),'inspect','saved definition is shown, not hidden behind Browse');
  assert.equal(get('tab-relationships').getAttribute('aria-selected'),'true');assert.equal(m.groups.length,1);assert.equal(m.jobs.length,0);
});

test('navigable DOM keeps notes beside preview, drafts across selection, and exposes all five review states', () => {
  const doc = documentFixture();
  const ui = demo.mount(doc.root, {document: doc, protocol: 'file:'});
  const get = id => {const n = doc.getElementById(id); assert.ok(n, 'missing hook ' + id); return n;};
  for (const id of ['scenario-select','search','category-filter','health-filter','network-filter','sort','inspector','manage-locations','add-location','bulk-edit','create-composite']) get(id);
  assert.equal(get('back-to-hub').hidden, true);
  get('notes').value = 'draft moon'; get('notes').emit('input');
  get('inspect-demo-ident').emit('click');
  get('inspect-demo-ad').emit('click');
  assert.equal(get('notes').value,'draft moon');
  get('tab-preview').emit('click');
  assert.match(get('notes-summary').textContent, /draft moon/);
  get('trim-start').value = '2'; get('trim-start').emit('input');
  get('save-recipe').emit('click');
  assert.equal(ui.model.view('demo-ad','metadata').notes, 'draft moon');
  get('tab-properties').emit('click'); get('save-metadata').emit('click');
  assert.equal(ui.model.asset('demo-ad').notes, 'draft moon');
  for (const scenario of ['Empty','Missing source','Busy','Error','Populated']) {
    get('library-browse').emit('click');
    get('scenario-select').value = scenario; get('scenario-select').emit('change');
    assert.equal(ui.model.scenario, scenario);
    assert.equal(get('library-content').getAttribute('data-view'),scenario==='Empty'?'browse':'inspect','review states expose the relevant Library surface immediately');
    if (scenario === 'Empty') get('empty-add-location');
    if (scenario === 'Missing source') get('relink');
    if (['Busy','Error'].includes(scenario)) get('job-panel');
  }
});

test('episode availability has its own visible fields and is not borrowed from branding dates', () => {
  const doc=documentFixture(),ui=demo.mount(doc.root,{document:doc,protocol:'file:'});
  doc.getElementById('inspect-demo-part-1').emit('click');
  const from=doc.getElementById('available-from');assert.ok(from,'episode availability needs an explicit layout field');
  from.value='1997-01-01';from.emit('input');doc.getElementById('save-metadata').emit('click');
  assert.equal(ui.model.asset('demo-part-1').availableFrom,'1997-01-01');assert.equal(ui.model.jobs.length,0);
  doc.getElementById('inspect-demo-ident').emit('click');assert.equal(doc.getElementById('available-from'),null);
  doc.getElementById('inspect-demo-part-1').emit('click');
  const precision=doc.getElementById('year-mode');precision.focus();precision.value='Range';precision.emit('change');
  assert.equal(doc.activeElement===doc.getElementById('year-mode'),true,'date precision change retains keyboard focus');
  const category=doc.getElementById('asset-category');category.value='Branding';category.emit('change');
  assert.equal(Boolean(doc.getElementById('available-from')),false,'role-specific availability updates with the proposed category before Save');
});

test('relationship layout chooses assets by readable names rather than requiring internal IDs', () => {
  const doc=documentFixture(),ui=demo.mount(doc.root,{document:doc,protocol:'file:'});
  doc.getElementById('inspect-demo-duplicate').emit('click');doc.getElementById('tab-relationships').emit('click');
  const source=doc.getElementById('source-id');assert.equal(source.tagName,'select','source association must be a human-readable chooser');
  assert.ok(source.children.some(option=>option.attributes.value==='demo-audio'&&option.textContent==='Demo audio repair'));
  assert.equal(doc.getElementById('variant-of').tagName,'select');assert.equal(doc.getElementById('source-family').tagName,'select');
  doc.getElementById('create-source-group').emit('click');const name=doc.getElementById('source-group-name');name.value='My original recording';name.emit('input');doc.getElementById('use-source-group').emit('click');
  assert.equal(ui.model.view('demo-duplicate','metadata').family,'My original recording');assert.equal(ui.model.asset('demo-duplicate').id,'demo-duplicate');
});

test('individual reference registration is explicit, unreviewed and duplicate-safe without inferring editorial fields', () => {
  const m=demo.createModel();assert.equal(typeof m.addReference,'function','individual media registration needs a mock workflow');
  const row=m.addReference('D:/Example media/CN_2001_Demo-show.mp4','Manually named sample','demo-location-1');
  assert.equal(row.name,'Manually named sample');assert.equal(row.health,'UNREVIEWED');assert.equal(row.category,'Other');assert.equal(row.date.mode,'Unknown');assert.equal(row.network,'Unassigned');assert.equal(row.show,'');assert.equal(row.notes,'');assert.equal(row.unverified,true);
  assert.throws(()=>m.addReference('d:\\Example media\\CN_2001_Demo-show.mp4','Duplicate','demo-location-1'),/already registered/i);assert.equal(m.assets.length,11);
});

test('individual media registration is reachable and leads to explicit classification in the inspector', () => {
  const doc=documentFixture(),ui=demo.mount(doc.root,{document:doc,protocol:'file:'});
  doc.getElementById('library-browse').emit('click');
  const add=doc.getElementById('add-asset');assert.ok(add,'media-reference registration entry is missing');add.emit('click');
  const p=doc.getElementById('asset-reference-path');p.value='D:/Example media/new reference.mp4';p.emit('input');
  const title=doc.getElementById('asset-reference-title');title.value='Added reference';title.emit('input');doc.getElementById('register-asset').emit('click');
  assert.equal(doc.getElementById('library-content').getAttribute('data-view'),'inspect','registration reveals the added reference');
  assert.equal(ui.model.assets.length,11);assert.equal(doc.getElementById('asset-name').value,'Added reference');assert.equal(doc.getElementById('source-health').value,'UNREVIEWED');
});

test('classic browser entry boots with forbidden capabilities trapped and has no IO API surface', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const vm = require('node:vm');
  const root = path.resolve(__dirname,'..');
  const doc = documentFixture();
  let forbiddenCalls = 0;
  const win = {document:doc,location:{protocol:'file:'}};
  for (const key of ['fetch','XMLHttpRequest','WebSocket','FileReader','localStorage','indexedDB','showOpenFilePicker','showDirectoryPicker','Worker']) Object.defineProperty(win,key,{get(){forbiddenCalls++; throw Error('Forbidden: ' + key);}});
  win.navigator = new Proxy({}, {get(){forbiddenCalls++; throw Error('Forbidden navigator API');}});
  const context = vm.createContext({window:win});
  const scripts = ['demo-data.js','app.js'].map(name => fs.readFileSync(path.join(root,name),'utf8'));
  scripts.forEach(source => vm.runInContext(source,context));
  assert.ok(doc.getElementById('scenario-select'));
  assert.equal(forbiddenCalls,0);
  assert.deepEqual(Object.keys(win.RetroLibraryDemo).sort(),['createModel','data','mount']);
  for (const source of scripts) {
    assert.doesNotMatch(source,/\b(?:fetch|XMLHttpRequest|WebSocket|FileReader|localStorage|indexedDB|sessionStorage|serviceWorker|sendBeacon|clipboard|showOpenFilePicker|showDirectoryPicker)\b/);
    const nonLayoutSource=source.replace("workbench.style.setProperty('--rl-' + key + '-weight', String(m.layout.weights[i]));",'');
    assert.doesNotMatch(nonLayoutSource,/innerHTML|outerHTML|insertAdjacentHTML|\.style\b|\b(?:setInterval|setTimeout)\s*\(/);
  }
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/media-src 'none'/);
  assert.match(html,/frame-src 'none'/);assert.match(html,/worker-src 'none'/);
  assert.match(html,/<title>Combined workspace/);
  assert.doesNotMatch(html,/<style\b|\son\w+=|\sstyle=|<script\b[^>]*>\s*[^<\s]/i);
  assert.equal((html.match(/<script src="\.\//g)||[]).length,2);
});

test('notes search is soft; canonical hard dates reject unknown unless explicitly allowed', () => {
  const m = demo.createModel();
  assert.deepEqual(m.query({search: 'moon'}).map(a => a.id), ['demo-ad']);
  assert.ok(!m.query({year: 1997}).some(a => a.id === 'demo-ad'));
  assert.ok(m.query({year: 1997, allowUnknown: true}).some(a => a.id === 'demo-ad'));
  m.draft('demo-ad', 'metadata', {notes: 'READY 1997 CN'});
  m.saveMetadata('demo-ad');
  assert.equal(m.asset('demo-ad').date.mode, 'Unknown');
  assert.equal(m.asset('demo-ad').health, 'UNREVIEWED');
  assert.equal(m.asset('demo-ad').network, 'Unassigned');
  assert.equal(m.query({network: 'NICK'}).some(a => a.network === 'SNICK'), false);
  assert.throws(() => m.saveMetadata('demo-ad', {date: {mode: 'Year', value: '1997-1999'}}), /year/i);
});

test('recipe save is not processing, health approval or blanket draft clearing; stale jobs cannot apply', () => {
  const m = demo.createModel();
  m.draft('demo-audio', 'metadata', {notes: 'keep this unsaved'});
  m.draft('demo-audio', 'recipe', {audio: 'MAX', trimStart: 2});
  m.saveRecipe('demo-audio');
  assert.equal(m.jobs.length, 0);
  assert.equal(m.asset('demo-audio').health, 'BAD_AUDIO');
  assert.equal(m.view('demo-audio', 'metadata').notes, 'keep this unsaved');
  const job = m.prepare('demo-audio');
  assert.equal(job.input, 'ORIGINAL');
  assert.equal(job.state, 'Queued');
  m.stepJob(job.id, 'run');
  m.draft('demo-audio', 'recipe', {trimStart: 3});
  m.stepJob(job.id, 'complete');
  assert.equal(job.state, 'Stale ignored');
  const retry = m.prepare('demo-audio');
  m.stepJob(retry.id, 'fail');
  assert.equal(retry.state, 'Failed');
  m.stepJob(retry.id, 'retry');
  m.stepJob(retry.id, 'cancel');
  assert.equal(retry.state, 'Cancel requested');
  m.stepJob(retry.id, 'confirm-cancel');
  assert.equal(retry.state, 'Cancelled');
  assert.equal(m.asset('demo-audio').recipe.audio, 'MAX');
  assert.equal(m.view('demo-audio', 'recipe').trimStart, 3);
  m.draft('demo-part-1', 'recipe', {trimStart: 200});
  assert.throws(() => m.saveRecipe('demo-part-1'), /trim/i);
});

test('dependencies block removal, explicit families count underlying use, and relink preserves identity and recipes', () => {
  const m = demo.createModel();
  const before = structuredClone(m.asset('demo-missing'));
  assert.equal(m.removeReference('demo-missing').blocked, true);
  assert.equal(m.dependencies('demo-part-2').length, 2);
  m.relink('demo-missing', 'D:/Example media/relinked.mp4');
  assert.equal(m.asset('demo-missing').id, before.id);
  assert.deepEqual(m.asset('demo-missing').recipe, before.recipe);
  assert.equal(m.asset('demo-missing').missing, false);
  assert.deepEqual(m.asset('demo-missing').uses, before.uses);
  m.setHealth('demo-missing', 'EXCLUDED', 'Keep history');
  assert.equal(m.removeReference('demo-missing').blocked, true);
  assert.equal(m.removeReference('demo-duplicate').blocked, false);
  assert.equal(m.asset('demo-duplicate'), undefined);
  m.setHealth('demo-audio', 'READY', 'Explicit illustrative re-review');
  assert.equal(m.asset('demo-audio').health, 'READY');
  assert.equal(m.asset('demo-audio').recipe.audio, 'RESTORE');
});

test('location simulations protect duplicate registration and keep editorial work, recipes and references', () => {
  const m = demo.createModel();
  assert.throws(() => m.addLocation('d:\\Example media\\'), /already registered/i);
  const snapshot = structuredClone(m.assets);
  m.scanLocation('demo-location-1');
  assert.equal(m.locations[0].scanning, true);
  m.finishScan('demo-location-1');
  assert.deepEqual(m.assets, snapshot);
  m.scanLocation('demo-location-1');
  m.relinkLocation('demo-location-1', 'D:/Example media/New');
  assert.equal(m.asset('demo-ad').id, 'demo-ad');
  assert.equal(m.asset('demo-ad').path, 'D:/Example media/New/ad.mp4');
  m.removeLocation('demo-location-1');
  assert.equal(m.locations.length, 0);
  assert.equal(m.assets.length, 10);
  assert.equal(m.asset('demo-ad').missing, false, 'removing a scan location does not make an unchanged referenced file missing');
});

test('location relink replaces Windows prefixes and preserves nested references and source metadata', () => {
  const m = demo.createModel();
  const paths = ['D:\\Example media\\subfolder\\clip.mp4', 'D:/Example media/series/season/part.mp4', 'd:\\eXample MEDIA/mixed\\nested/clip.mp4'];
  const rows = paths.map((path,i) => m.addReference(path, 'Explicit title ' + i, 'demo-location-1'));
  m.draft(rows[0].id, 'metadata', {notes:'Keep this unsaved note'});
  const before = structuredClone(rows), drafts = structuredClone(m.drafts);
  m.relinkLocation('demo-location-1', 'D:/Example media/Relinked');
  const relatives = ['subfolder/clip.mp4', 'series/season/part.mp4', 'mixed/nested/clip.mp4'];
  rows.forEach((row,i) => assert.deepEqual(row, {...before[i], path:'D:/Example media/Relinked/' + relatives[i], missing:false}));
  assert.deepEqual(m.drafts, drafts);
  assert.equal(m.locations[0].path, 'D:/Example media/Relinked');
});

test('location relink preflights the whole batch and reports boundary or ambiguous-reference errors without mutation', () => {
  for (const path of ['D:/Example media-other/clip.mp4', 'E:/elsewhere/clip.mp4', 'D:/Example media/sub/../clip.mp4', 'D:\\Example media\\..\\clip.mp4', 'D:/Example media/./clip.mp4', 'D:/Example media//clip.mp4', 'D:/Example media/', 'D:/Example media/C:/clip.mp4']) {
    const doc = documentFixture(), {model:m} = demo.mount(doc.root, {document:doc, protocol:'file:'});
    m.addReference(path, 'Inconsistent example reference', 'demo-location-1');
    m.scanLocation('demo-location-1');
    const before = structuredClone({assets:m.assets, locations:m.locations});
    doc.getElementById('manage-locations').emit('click');
    const field = doc.getElementById('location-relink-demo-location-1');
    field.value = 'D:/Relocated'; field.emit('input');
    assert.doesNotThrow(() => doc.getElementById('relink-location-demo-location-1').emit('click'));
    assert.match(doc.getElementById('mock-status').textContent, /outside|ambiguous/i, path);
    assert.deepEqual({assets:m.assets, locations:m.locations}, before, path);
  }
});

test('removing a location preserves asset references and known availability instead of inventing missing files', () => {
  const m=demo.createModel(),before=structuredClone(m.assets);
  m.removeLocation('demo-location-1');
  assert.equal(m.locations.length,0);assert.deepEqual(m.assets,before);
  assert.equal(m.asset('demo-missing').missing,true);
  assert.equal(m.asset('demo-ad').missing,false);
});

test('composite definitions preserve ordered constituents and pinned recipe revisions without preparing a job', () => {
  const m = demo.createModel();
  const g = m.saveGroup('Demo episode group', ['demo-part-2','demo-part-1']);
  assert.deepEqual(g.parts, ['demo-part-2','demo-part-1']);
  assert.equal(m.jobs.length, 0);
  m.draft('demo-part-1', 'recipe', {trimStart: 3}); m.saveRecipe('demo-part-1');
  assert.equal(g.pins['demo-part-1'], 1);
  assert.equal(m.removeReference('demo-part-2').blocked, true);
  assert.throws(() => m.saveGroup('Wrong', ['demo-ad','demo-ident']), /episode/i);
  m.bulkPools(['demo-ad','demo-next'], 'Add', ['KIDS_00S']);
  assert.ok(m.asset('demo-ad').pools.includes('KIDS_00S'));
  assert.ok(m.asset('demo-next').pools.includes('KIDS_00S'));
  assert.equal(m.asset('demo-ad').health, 'UNREVIEWED');
  assert.equal(demo.createModel('Busy').jobs[0].state, 'Running');
  assert.equal(demo.createModel('Busy').jobs[1].state, 'Queued');
  assert.equal(demo.createModel('Error').jobs[0].state, 'Failed');
});

test('linked variant samples and composite mock jobs report their actual constituent count and stale proposals', () => {
  const m = demo.createModel();
  assert.equal(m.asset('demo-duplicate').variantOf,'demo-audio');
  assert.equal(m.asset('demo-duplicate').sourceId,'demo-audio');
  assert.equal(m.asset('demo-duplicate').family,m.asset('demo-audio').family);
  const g = m.saveGroup('Demo composite',['demo-part-1','demo-part-2']);
  const j = m.prepareGroup(g.id);
  assert.equal(j.count,2);
  assert.deepEqual(j.sourceIds,['demo-part-1','demo-part-2']);
  m.stepJob(j.id,'run');
  m.draft('demo-part-2','recipe',{trimEnd:2});
  m.stepJob(j.id,'complete');
  assert.equal(j.state,'Stale ignored');
});

test('composite completion ignores results when the saved ordered definition changes and preserves the new definition', () => {
  for (const change of ['order','add','remove','name','pins']) {
    const m = demo.createModel();
    const extra = m.addReference('D:/Example media/extra-part.mp4', 'Explicit extra part', 'demo-location-1');
    m.saveMetadata(extra.id, {category:'Episode/Show'});
    const parts = ['demo-part-1','demo-part-2'];
    if (change === 'remove') parts.push(extra.id);
    const group = m.saveGroup('Original definition', parts), job = m.prepareGroup(group.id);
    const queuedSources = [...job.sourceIds];
    m.stepJob(job.id,'run');
    const nextParts = change === 'order' ? [...parts].reverse() : change === 'add' ? [...parts,extra.id] : change === 'remove' ? parts.slice(0,2) : parts;
    const saved = m.saveGroup(change === 'name' ? 'Updated definition' : group.name, nextParts, group.id);
    if (change === 'pins') saved.pins['demo-part-1']++;
    const before = structuredClone({groups:m.groups, assets:m.assets});
    m.stepJob(job.id,'complete');
    assert.equal(job.state,'Stale ignored',change);
    assert.deepEqual(job.sourceIds,queuedSources,change);
    assert.deepEqual({groups:m.groups, assets:m.assets},before,change);
  }
});

test('composite retry refreshes all queued inputs from the current saved definition', () => {
  const m = demo.createModel();
  const group = m.saveGroup('Original group',['demo-part-1','demo-part-2']), job = m.prepareGroup(group.id);
  m.stepJob(job.id,'fail');
  const extra = m.addReference('D:/Example media/third-part.mp4','Explicit third part','demo-location-1');
  m.saveMetadata(extra.id,{category:'Episode/Show'});
  const saved = m.saveGroup('Updated group',[extra.id,'demo-part-2','demo-part-1'],group.id);
  const before = structuredClone(m.groups), oldSnapshot = job.snapshot;
  m.stepJob(job.id,'retry');
  assert.equal(job.state,'Queued');
  assert.deepEqual(job.sourceIds,saved.parts);
  assert.equal(job.assetId,extra.id);
  assert.equal(job.count,3);
  assert.equal(job.currentItem,'Updated group / first constituent: Explicit third part');
  assert.notEqual(job.snapshot,oldSnapshot);
  assert.deepEqual(m.groups,before);
  assert.equal(m.jobs.length,1);
  m.stepJob(job.id,'run'); m.stepJob(job.id,'complete');
  assert.equal(job.state,'Sample success');
});

test('composite retry validates current pins and drafts before changing any terminal job fields', () => {
  for (const state of ['Failed','Cancelled','Stale ignored']) for (const invalid of ['draft','pins']) {
    const m = demo.createModel();
    const group = m.saveGroup('Original group',['demo-part-1','demo-part-2']), job = m.prepareGroup(group.id);
    if (state === 'Failed') m.stepJob(job.id,'fail');
    if (state === 'Cancelled') {m.stepJob(job.id,'cancel'); m.stepJob(job.id,'confirm-cancel');}
    if (state === 'Stale ignored') {m.saveGroup('Changed group',group.parts,group.id); m.stepJob(job.id,'complete');}
    assert.equal(job.state,state);
    const extra = m.addReference('D:/Example media/current-part.mp4','Current part','demo-location-1');
    m.saveMetadata(extra.id,{category:'Episode/Show'});
    const saved = m.saveGroup('Current group',['demo-part-2',extra.id],group.id);
    m.draft(extra.id,'recipe',{trimStart:1});
    if (invalid === 'pins') m.saveRecipe(extra.id);
    const before = structuredClone({jobs:m.jobs,groups:m.groups,assets:m.assets,drafts:m.drafts});
    assert.throws(() => m.stepJob(job.id,'retry'),/pins are stale|draft is unsaved/i);
    assert.deepEqual({jobs:m.jobs,groups:m.groups,assets:m.assets,drafts:m.drafts},before);
    if (invalid === 'draft') m.saveRecipe(extra.id);
    m.saveGroup(saved.name,saved.parts,saved.id);
    m.stepJob(job.id,'retry');
    assert.equal(job.state,'Queued');
    assert.deepEqual(job.sourceIds,saved.parts);
  }
});

test('composite UI keeps running edits safe and reports retry validation errors through status', () => {
  const doc = documentFixture(), {model:m} = demo.mount(doc.root,{document:doc,protocol:'file:'});
  const group = m.saveGroup('Editable group',['demo-part-1','demo-part-2']), job = m.prepareGroup(group.id);
  const click = id => {const node = doc.getElementById(id); assert.ok(node,id); node.emit('click');};
  click('inspect-demo-part-1'); click('tab-jobs'); click(job.id + '-run');
  click('tab-relationships'); click('edit-' + group.id); click('part-up-demo-part-2'); click('save-group');
  assert.equal(job.state,'Running');
  assert.deepEqual(m.groups[0].parts,['demo-part-2','demo-part-1']);
  click('tab-jobs'); click(job.id + '-complete');
  assert.equal(job.state,'Stale ignored');
  m.draft('demo-part-2','recipe',{trimStart:1});
  const before = structuredClone(job);
  assert.doesNotThrow(() => click(job.id + '-retry'));
  assert.match(doc.getElementById('mock-status').textContent,/pins are stale|draft is unsaved/i);
  assert.equal(doc.getElementById('mock-status').getAttribute('class'),'rl-status rl-error');
  assert.deepEqual(job,before);
  m.saveRecipe('demo-part-2');
  assert.doesNotThrow(() => click(job.id + '-retry'));
  assert.deepEqual(job,before,'saved recipe still needs an explicit group pin update');
  m.saveGroup('Editable group',m.groups[0].parts,group.id);
  click(job.id + '-retry');
  assert.equal(job.state,'Queued');
  assert.deepEqual(job.sourceIds,['demo-part-2','demo-part-1']);
  assert.equal(job.count,2);
  assert.equal(job.currentItem,'Editable group / first constituent: ' + m.asset('demo-part-2').name);
  assert.match(doc.getElementById('mock-status').textContent,/Queued/);
});

test('metadata health changes require reasons and commercial availability is validated without inference', () => {
  const m = demo.createModel();
  assert.throws(() => m.saveMetadata('demo-ad',{health:'READY',reason:''}), /reason/i);
  assert.throws(() => m.saveMetadata('demo-ad',{availableFrom:'1997-12-01',availableTo:'1997-01-01'}), /availability/i);
  assert.equal(m.asset('demo-ad').health,'UNREVIEWED');
});

test('active mock jobs and child variants are visible removal blockers; historical jobs never crash after row removal', () => {
  const m = demo.createModel();
  assert.ok(m.dependencies('demo-audio').some(u => u.state === 'Linked variant / source reference'));
  const j = m.prepare('demo-ad');
  assert.equal(m.removeReference('demo-ad').blocked,true);
  m.stepJob(j.id,'cancel'); m.stepJob(j.id,'confirm-cancel');
  assert.equal(m.removeReference('demo-ad').blocked,false);
  assert.equal(m.stepJob(j.id,'retry').state,'Cancelled');
});

test('composite preparation refuses stale pins until an explicit definition update', () => {
  const m = demo.createModel();
  const g = m.saveGroup('Demo composite',['demo-part-1','demo-part-2']);
  m.draft('demo-part-1','recipe',{trimStart:1}); m.saveRecipe('demo-part-1');
  assert.throws(() => m.prepareGroup(g.id),/stale/i);
  assert.equal(m.jobs.length,0);
  m.saveGroup(g.name,g.parts,g.id);
  assert.equal(m.prepareGroup(g.id).count,2);
});

test('hub return is available only for HTTP and keyboard crop actions retain focus', () => {
  for (const protocol of ['file:','data:','https:']) {
    const doc = documentFixture();
    demo.mount(doc.root,{document:doc,protocol});
    const link = doc.getElementById('back-to-hub');
    assert.equal(link.hidden,protocol !== 'https:');
    assert.equal(link.getAttribute('href'),protocol === 'https:' ? '/' : undefined);
    doc.getElementById('tab-preview').emit('click');
    doc.getElementById('crop-fit').focus(); doc.getElementById('crop-fit').emit('click');
    assert.ok(doc.activeElement === doc.getElementById('crop-fit'),'focus remains on current crop button');
  }
});

test('modal rebuilds restore keyboard focus and cancelling scenario reset preserves drafts', () => {
  const doc = documentFixture();
  const ui = demo.mount(doc.root,{document:doc,protocol:'file:'});
  const get = id => doc.getElementById(id);
  get('manage-locations').focus(); get('manage-locations').emit('click');
  get('scan-location').focus(); get('scan-location').emit('click');
  get('dialog-close').emit('click');
  assert.ok(doc.activeElement === get('manage-locations'),'close restores current Manage trigger after dialog rebuild');
  get('notes').value = 'retain'; get('notes').emit('input');
  get('scenario-select').value = 'Empty'; get('scenario-select').emit('change');
  assert.equal(ui.model.scenario,'Populated');
  get('dialog-close').emit('click');
  assert.equal(get('notes').value,'retain');
  assert.equal(get('scenario-select').value,'Populated');
});

test('five scenarios contain only isolated sample state and require explicit reset for dirty work', () => {
  for (const name of ['Populated', 'Empty', 'Missing source', 'Busy', 'Error']) {
    const m = demo.createModel(name);
    assert.equal(m.scenario, name);
    assert.equal(m.assets.length, name === 'Empty' ? 0 : 10);
    assert.ok(m.assets.every(a => a.id.startsWith('demo-') && a.path.startsWith('D:/Example media/')));
  }
  const m = demo.createModel();
  m.draft('demo-ad', 'metadata', {notes: 'unsaved'});
  assert.equal(m.reset('Empty'), false);
  assert.equal(m.reset('Empty', true), true);
  assert.equal(m.assets.length, 0);
});
