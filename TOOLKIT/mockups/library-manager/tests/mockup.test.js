'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const demo = require('../app.js');

class DemoNode {
  constructor(tag, doc) { this.tagName = tag; this.doc = doc; this.children = []; this.attributes = {}; this.listeners = {}; this.value = ''; this.hidden = false; this.textContent = ''; }
  setAttribute(k,v) {this.attributes[k] = String(v); if (k === 'id') this.id = v;}
  getAttribute(k) {return this.attributes[k];}
  append(...nodes) {this.children.push(...nodes);}
  replaceChildren(...nodes) {this.children = nodes;}
  addEventListener(k,fn) {this.listeners[k] ||= []; this.listeners[k].push(fn);}
  emit(k) {(this.listeners[k] || []).forEach(fn => fn({target:this, preventDefault(){}, key:''}));}
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
    get('scenario-select').value = scenario; get('scenario-select').emit('change');
    assert.equal(ui.model.scenario, scenario);
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
  const add=doc.getElementById('add-asset');assert.ok(add,'media-reference registration entry is missing');add.emit('click');
  const p=doc.getElementById('asset-reference-path');p.value='D:/Example media/new reference.mp4';p.emit('input');
  const title=doc.getElementById('asset-reference-title');title.value='Added reference';title.emit('input');doc.getElementById('register-asset').emit('click');
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
    assert.doesNotMatch(source,/innerHTML|outerHTML|insertAdjacentHTML|\.style\b|\b(?:setInterval|setTimeout)\s*\(/);
  }
  const html = fs.readFileSync(path.join(root,'index.html'),'utf8');
  assert.match(html,/connect-src 'none'/);
  assert.match(html,/media-src 'none'/);
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
  m.bulk(['demo-ad','demo-next'], {pool: 'Demo temporary pool'});
  assert.equal(m.asset('demo-ad').pool, 'Demo temporary pool');
  assert.equal(m.asset('demo-next').pool, 'Demo temporary pool');
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
