'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const defaults = { projectFolder: 'C:\\Projects\\New', buildsFolder: 'C:\\Outputs', compositeFolder: 'C:\\Composites', cacheFolder: 'C:\\Cache', libraryFolders: [] };
const project = { kind: 'managed', name: 'Test project', projectFolder: 'C:\\Projects\\Test', readOnly: false, paths: { dataFolder: 'C:\\Projects\\Test\\STATE', ...defaults }, warnings: [], summary: { assets: 2, carts: 1, drafts: 0 } };
function controller(request, options = {}) {
  return require('../app.js').createController({ request, ...options });
}
function bootstrap(activeProject = null) {
  return { phase: '2', csrfToken: 'test-token', status: { activeProject, recentProjects: [], defaults }, capabilities: { folderPicker: true } };
}

test('create reviews all real locations without writing; acknowledgement and explicit confirmation are required', async () => {
  const calls = [];
  const reviewed = { token: 'preview-1', expiresAt: '2099-01-01T00:00:00Z', operation: 'create', project, changes: ['Write retro-project.json'], warnings: [] };
  const app = controller(async (url, body) => {
    calls.push({ url, body });
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/preview') return { preview: reviewed };
    if (url === '/api/confirm') return { project };
    throw Error('Unexpected request');
  });
  await app.start();
  app.chooseMode('create');
  assert.equal(app.state.drafts.create.projectFolder, defaults.projectFolder);
  assert.deepEqual(app.state.drafts.create.paths.libraryFolders, []);
  app.updateField('name', 'My project');
  await app.review();
  assert.equal(app.state.view, 'review');
  assert.deepEqual(calls.at(-1).body, { operation: 'create', name: 'My project', projectFolder: defaults.projectFolder, paths: { buildsFolder: defaults.buildsFolder, compositeFolder: defaults.compositeFolder, cacheFolder: defaults.cacheFolder, libraryFolders: [] } });
  assert.equal(app.state.activeProject, null);
  reviewed.changes.push('mutated after response');
  assert.equal(app.state.preview.changes.length, 1, 'review evidence is an independent immutable snapshot');
  await app.confirmReview();
  assert.equal(calls.some(c => c.url === '/api/confirm'), false);
  app.acknowledge(true);
  assert.equal(calls.some(c => c.url === '/api/confirm'), false);
  await app.confirmReview();
  assert.deepEqual(calls.at(-1), { url: '/api/confirm', body: { token: 'preview-1' } });
  assert.equal(app.state.view, 'active');
  assert.equal(app.state.activeProject, project);
});

test('import requires explicit inspected source, keeps media references, and uses a separate target', async () => {
  const legacy = { ...project, kind: 'legacy', readOnly: true, paths: { ...project.paths, libraryFolders: ['D:\\Originals'] } };
  const app = controller(async url => url === '/api/bootstrap' ? bootstrap() : { project: legacy });
  await app.start();
  app.beginImport();
  assert.equal(app.state.view, 'chooser');
  app.setOpenFolder(legacy.projectFolder); await app.inspect();
  app.beginImport();
  assert.equal(app.state.mode, 'import');
  assert.equal(app.state.view, 'editor');
  assert.equal(app.state.drafts.import.sourceFolder, legacy.projectFolder);
  assert.equal(app.state.drafts.import.projectFolder, defaults.projectFolder);
  assert.deepEqual(app.state.drafts.import.paths.libraryFolders, ['D:\\Originals']);
  assert.equal(app.state.activeProject, null);
});

test('import uses independent future composite and cache defaults instead of the legacy installation', async () => {
  const legacy = { ...project, kind: 'legacy', readOnly: true, paths: { ...project.paths, buildsFolder: 'F:\\Original builds', compositeFolder: '', cacheFolder: 'F:\\OldInstall\\CACHE' } };
  const app = controller(async url => url === '/api/bootstrap' ? bootstrap() : { project: legacy });
  await app.start(); app.setOpenFolder(legacy.projectFolder); await app.inspect(); app.beginImport();
  assert.equal(app.state.drafts.import.paths.cacheFolder, defaults.cacheFolder);
  assert.equal(app.state.drafts.import.paths.compositeFolder, defaults.compositeFolder);
  assert.equal(app.state.drafts.import.paths.buildsFolder, legacy.paths.buildsFolder);
});

test('managed settings preserve metadata location; legacy settings are blocked', async () => {
  const app = controller(async () => bootstrap(project));
  await app.start(); app.editSettings();
  assert.equal(app.state.mode, 'settings');
  assert.equal(app.state.drafts.settings.projectFolder, project.projectFolder);
  app.updateField('projectFolder', 'C:\\Wrong');
  assert.equal(app.state.drafts.settings.projectFolder, project.projectFolder);
  app.updateField('buildsFolder', 'D:\\Next');
  assert.equal(project.paths.buildsFolder, defaults.buildsFolder);
  assert.equal(app.state.drafts.settings.paths.buildsFolder, 'D:\\Next');
  const legacy = controller(async () => bootstrap({ ...project, kind: 'legacy', readOnly: true }));
  await legacy.start(); legacy.editSettings();
  assert.equal(legacy.state.view, 'active');
  assert.equal(legacy.state.drafts.settings, undefined);
});

test('changing the data folder offers an explicit reviewed copy while retaining the original', async () => {
  const calls=[]; let allowLeave=false;
  const app=controller(async url=>{calls.push(url); if(url==='/api/bootstrap')return bootstrap(project); if(url==='/api/inspect')return {project}; throw Error('Unexpected request');},{confirmDiscard:()=>allowLeave});
  await app.start();app.editSettings();app.updateField('name','Unsaved settings');
  assert.equal(typeof app.copyProjectData,'function','settings needs a deliberate data-location copy action');
  await app.copyProjectData();assert.equal(app.state.mode,'settings');assert.equal(calls.includes('/api/inspect'),false);
  allowLeave=true;await app.copyProjectData();
  assert.equal(app.state.mode,'import');assert.equal(app.state.drafts.import.sourceFolder,project.projectFolder);
  assert.equal(app.state.activeProject.projectFolder,project.projectFolder);
  assert.equal(calls.includes('/api/confirm'),false);
});

test('edits and reference-only library changes invalidate previews; cancelled navigation preserves drafts', async () => {
  let allowLeave = false;
  const app = controller(async url => url === '/api/bootstrap' ? bootstrap() : { preview: { token: 'p', operation: 'create', expiresAt: '2099-01-01', changes: [], warnings: [], project } }, { confirmDiscard: () => allowLeave });
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Preserved');
  app.addLibrary(); app.updateLibrary(0, 'D:\\Media');
  assert.deepEqual(app.state.drafts.create.paths.libraryFolders, ['D:\\Media']);
  await app.review(); app.acknowledge(true); app.updateField('name', 'Changed');
  assert.equal(app.state.preview, null); assert.equal(app.state.acknowledged, false);
  await app.review(); app.removeLibrary(0);
  assert.equal(app.state.preview, null);
  assert.deepEqual(app.state.drafts.create.paths.libraryFolders, []);
  app.switchProject(); assert.equal(app.state.view, 'editor');
  allowLeave = true; app.switchProject(); assert.equal(app.state.view, 'chooser');
  app.chooseMode('create'); assert.equal(app.state.drafts.create.name, 'Changed');
  await app.review(); app.cancelReview();
  assert.equal(app.state.view, 'editor'); assert.equal(app.state.preview, null);
});

test('failed confirmation consumes client review, retains input, and requires explicit status recovery without replay', async () => {
  const calls = [];
  const app = controller(async (url, body) => {
    calls.push({ url, body });
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/preview') return { preview: { token: 'once', operation: 'create', expiresAt: '2099-01-01', project, changes: [], warnings: [] } };
    if (url === '/api/confirm') throw Error('Connection lost');
    if (url === '/api/status') return { status: { ...bootstrap(project).status } };
    throw Error('Unexpected request');
  });
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Keep me');
  await app.review(); app.acknowledge(true); await app.confirmReview();
  assert.equal(app.state.preview, null);
  assert.equal(app.state.view, 'editor');
  assert.equal(app.state.uncertain, true);
  assert.equal(app.state.drafts.create.name, 'Keep me');
  assert.match(app.state.error, /refresh status/i);
  await app.confirmReview(); await app.review();
  assert.equal(calls.filter(c => c.url === '/api/confirm').length, 1);
  assert.equal(calls.filter(c => c.url === '/api/preview').length, 1, 'uncertain write fences further mutations until explicit refresh');
  await app.refreshStatus();
  assert.equal(app.state.activeProject, project);
  assert.equal(app.state.uncertain, false);
  assert.equal(app.state.view, 'active');
  assert.equal(calls.filter(c => c.url === '/api/confirm').length, 1);
});

test('status for a different saved selection does not clear an uncertain save target', async () => {
  const previous={...project,name:'Previous project',projectFolder:'C:\\Projects\\Previous'};
  const calls=[];
  const app=controller(async(url,body)=>{
    calls.push({url,body});
    if(url==='/api/bootstrap')return bootstrap(previous);
    if(url==='/api/preview')return {preview:{token:'uncertain',operation:'create',expiresAt:'2099-01-01',project,changes:[],warnings:[]}};
    if(url==='/api/confirm')throw Error('Saved project but selection acknowledgement lost');
    if(url==='/api/status')return {status:bootstrap(previous).status};
    if(url==='/api/inspect'){assert.equal(body.projectFolder,project.projectFolder);return {project};}
    throw Error('Unexpected request');
  });
  await app.start();app.chooseMode('create');app.updateField('name','New project');await app.review();app.acknowledge(true);await app.confirmReview();
  await app.refreshStatus();assert.equal(app.state.uncertain,true,'a different last-project pointer does not establish the save outcome');
  assert.equal(typeof app.recoverPendingResult,'function');await app.recoverPendingResult();
  assert.equal(app.state.uncertain,false);assert.equal(app.state.inspected.projectFolder,project.projectFolder);assert.equal(app.state.view,'chooser');
  assert.equal(calls.filter(x=>x.url==='/api/confirm').length,1);assert.equal(calls.filter(x=>x.url==='/api/open').length,0);
});

test('HTTP server failures keep confirmation uncertainty fenced until explicit status recovery', async () => {
  let confirms = 0, previews = 0;
  const app = controller(async url => {
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/preview') { previews++; return { preview: { token: 'once', operation: 'create', expiresAt: '2099-01-01', project, changes: [], warnings: [] } }; }
    if (url === '/api/confirm') { confirms++; throw Object.assign(Error('Write outcome unknown'), { httpStatus: 503 }); }
    throw Error('Unexpected request');
  });
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Preserve');
  await app.review(); app.acknowledge(true); await app.confirmReview();
  assert.equal(app.state.uncertain, true, 'HTTP 5xx is not proof of rollback');
  await app.review(); await app.confirmReview();
  assert.equal(previews, 1); assert.equal(confirms, 1);
});

test('HTTP server failure during open also requires status recovery', async () => {
  const app = controller(async url => {
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/inspect') return { project };
    if (url === '/api/open') throw Object.assign(Error('Preferences outcome unknown'), { httpStatus: 500 });
    throw Error('Unexpected request');
  });
  await app.start(); app.setOpenFolder(project.projectFolder); await app.inspect(); await app.openExisting();
  assert.equal(app.state.uncertain, true);
});

test('native picker cancellation preserves values; successful picks invalidate review and tool checks use GET', async () => {
  const calls = []; let cancel = true;
  const app = controller(async (url, body) => {
    calls.push({ url, body });
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/browse') return cancel ? { path: '', cancelled: true } : { path: 'D:\\Chosen' };
    if (url === '/api/tools') return { tools: [{ name: 'ffmpeg', available: false, error: 'not found' }] };
    if (url === '/api/preview') return { preview: { token: 'p', operation: 'create', project, changes: [], warnings: [], expiresAt: '2099-01-01' } };
    throw Error('Unexpected request');
  });
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Picker'); await app.review();
  await app.browse('buildsFolder');
  assert.equal(app.state.preview.token, 'p');
  assert.equal(app.state.drafts.create.paths.buildsFolder, defaults.buildsFolder);
  assert.equal(app.state.error, '');
  cancel = false; await app.browse('buildsFolder');
  assert.equal(app.state.preview, null); assert.equal(app.state.drafts.create.paths.buildsFolder, 'D:\\Chosen');
  assert.deepEqual(calls.filter(c => c.url === '/api/browse')[0].body, { initialPath: defaults.buildsFolder });
  await app.checkTools();
  assert.deepEqual(calls.at(-1), { url: '/api/tools', body: undefined });
  assert.equal(app.state.tools[0].available, false);
});

test('expired review cannot confirm and server rejection requires fresh review without losing values', async () => {
  let clock = Date.parse('2026-01-01T00:00:00Z'); const calls = [];
  const app = controller(async url => {
    calls.push(url);
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/preview') return { preview: { token: 'expiry', operation: 'create', expiresAt: '2026-01-01T00:01:00Z', project, changes: [], warnings: [] } };
    if (url === '/api/confirm') { const error = Error('Project content changed'); error.httpStatus = 400; throw error; }
    throw Error('Unexpected request');
  }, { now: () => clock });
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Expiry'); await app.review(); app.acknowledge(true);
  clock = Date.parse('2026-01-01T00:01:00Z'); await app.confirmReview();
  assert.equal(calls.includes('/api/confirm'), false); assert.match(app.state.error, /expired/i);
  assert.equal(app.state.preview, null);
  clock = Date.parse('2026-01-01T00:00:00Z'); await app.review(); app.acknowledge(true); await app.confirmReview();
  assert.equal(app.state.uncertain, false); assert.equal(app.state.preview, null); assert.equal(app.state.view, 'editor');
  assert.equal(app.state.drafts.create.name, 'Expiry'); assert.match(app.state.error, /review again/i);
});

// Test-owned minimal DOM: executes the real renderer and handlers, not a browser/layout substitute.
class Element {
  constructor(tag, doc) { this.tagName = tag.toUpperCase(); this.ownerDocument = doc; this.children = []; this.attributes = {}; this.value = ''; this.id = ''; this._text = ''; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(''); }
  set innerHTML(_) { throw Error('Unsafe HTML rendering is not permitted'); }
  append(...children) { this.children.push(...children); }
  replaceChildren(...children) { this._text = ''; this.children = children; }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  removeAttribute(name) { delete this.attributes[name]; }
  focus() { this.ownerDocument.activeElement = this; }
  setSelectionRange() {}
}
function documentStub() {
  const doc = { activeElement: null };
  doc.createElement = tag => new Element(tag, doc);
  doc.roots = ['setup-content', 'notice', 'error', 'active-indicator', 'step-choose', 'step-review', 'step-ready'].map(id => { const e = doc.createElement('div'); e.id = id; return e; });
  doc.getElementById = id => {
    const visit = node => node.id === id ? node : node.children.map(visit).find(Boolean);
    return doc.roots.map(visit).find(Boolean) || null;
  };
  return doc;
}

test('only Library Manager exposes an explicitly labelled separate-tab design mockup link', async () => {
  const doc=documentStub(),calls=[];
  const app=require('../app.js').mount(doc,{schedule:()=>0,request:async url=>{calls.push(url);return bootstrap(project);}});
  await app.ready;app.openWorkspace('library');
  const link=doc.getElementById('library-design-link');assert.ok(link,'Library Manager design entry is missing');
  assert.equal(link.tagName,'A');assert.equal(link.attributes.href,'/mockups/library-manager/');assert.equal(link.attributes.target,'_blank');assert.match(link.attributes.rel,/noopener/);assert.match(link.textContent,/mockup.*sample data/i);
  app.openWorkspace('cart-builder');assert.equal(doc.getElementById('library-design-link'),null);app.openWorkspace('tv-studio');assert.equal(doc.getElementById('library-design-link'),null);
  assert.deepEqual(calls,['/api/bootstrap']);
});

test('real DOM adapter wires semantic editable fields to locked review and explicit acknowledged save', async () => {
  const doc = documentStub(); const calls = [];
  const app = require('../app.js').mount(doc, {
    schedule: () => 0,
    request: async (url, body) => {
      calls.push({ url, body });
      if (url === '/api/bootstrap') return bootstrap();
      if (url === '/api/preview') return { preview: { token: 'dom', operation: 'create', expiresAt: '2099-01-01', project: { ...project, name: '<img src=x onerror=alert(1)>' }, changes: ['Write retro-project.json'], warnings: ['References retained.'] } };
      if (url === '/api/confirm') return { project };
      throw Error('Unexpected API');
    }
  });
  await app.ready;
  assert.match(doc.getElementById('setup-content').textContent, /Open existing project/);
  assert.equal(doc.getElementById('settings-button').disabled, true);
  doc.getElementById('create-button').onclick();
  for (const id of ['project-name', 'project-folder', 'builds-folder', 'composite-folder', 'cache-folder']) {
    assert.ok(doc.getElementById(id), `Missing ${id}`);
    assert.equal(doc.getElementById(id).required, true);
    assert.ok(doc.getElementById(id).attributes['aria-describedby']);
  }
  const input = doc.getElementById('project-name'); input.value = 'DOM project'; input.oninput();
  await doc.getElementById('project-form').onsubmit({ preventDefault() {} });
  assert.equal(doc.getElementById('project-form'), null, 'review is not an editable form');
  assert.match(doc.getElementById('setup-content').textContent, /<img src=x onerror=alert\(1\)>/);
  assert.equal(doc.getElementById('confirm-button').disabled, true);
  const ack = doc.getElementById('review-ack'); ack.checked = true; ack.onchange();
  assert.equal(doc.getElementById('confirm-button').disabled, false);
  assert.equal(calls.some(c => c.url === '/api/confirm'), false);
  await doc.getElementById('confirm-button').onclick();
  assert.match(doc.getElementById('setup-content').textContent, /Main hub/);
  assert.match(doc.getElementById('setup-content').textContent, /tools inside each workspace are not built yet/);
  assert.equal(doc.getElementById('settings-button').disabled, false);
});

test('responsive native styles preserve Studio palette, keyboard focus and 44px controls without remote assets', () => {
  const css = fs.readFileSync(path.join(root, 'style.css'), 'utf8');
  for (const color of ['#101214', '#181c20', '#edf3f3', '#96a3aa', '#61d5c8']) assert.ok(css.includes(color));
  assert.match(css, /Segoe UI/); assert.match(css, /min-height:\s*44px/);
  assert.match(css, /:focus-visible/); assert.match(css, /@media/);
  assert.doesNotMatch(css, /@import|https?:\/\//);
});

test('transport sends token-protected JSON only for POST and preserves HTTP versus uncertain network errors', async () => {
  const calls = [];
  const request = require('../app.js').createRequest(async (url, options) => {
    calls.push({ url, options });
    return { ok: true, status: 200, json: async () => ({ result: 'ok' }) };
  });
  await request('/api/tools'); await request('/api/confirm', { token: 'review' }, 'csrf');
  assert.equal(calls[0].options.method, 'GET');
  assert.equal(calls[0].options.body, undefined);
  assert.equal(calls[0].options.cache, 'no-store');
  assert.equal(calls[1].options.headers['X-RetroTV-Token'], 'csrf');
  assert.equal(calls[1].options.body, JSON.stringify({ token: 'review' }));
  const rejected = require('../app.js').createRequest(async () => ({ ok: false, status: 400, json: async () => ({ error: 'Invalid folder' }) }));
  await assert.rejects(rejected('/api/preview', {}, 'csrf'), e => e.httpStatus === 400 && e.message === 'Invalid folder');
  const lost = require('../app.js').createRequest(async () => { throw Error('offline'); });
  await assert.rejects(lost('/api/confirm', {}, 'csrf'), e => !e.httpStatus && /connection/i.test(e.message));
  const source = fs.readFileSync(path.join(root, 'app.js'), 'utf8');
  assert.match(source, /mount\(document/);
  assert.doesNotMatch(source, /\.innerHTML\s*=|\.style\.|localStorage|sessionStorage/);
});

test('unsaved navigation can be cancelled from every mode and active return preserves the draft', async () => {
  let allowLeave = false;
  const app = controller(async () => bootstrap(project), { confirmDiscard: () => allowLeave });
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Do not lose');
  app.chooseMode('open'); assert.equal(app.state.mode, 'create');
  app.editSettings(); assert.equal(app.state.mode, 'create');
  app.showActive(); assert.equal(app.state.view, 'editor');
  allowLeave = true; app.showActive(); assert.equal(app.state.view, 'active');
  app.chooseMode('create'); assert.equal(app.state.drafts.create.name, 'Do not lose');
});

test('stable browser QA hooks cover inspected legacy import, references, review and active settings', async () => {
  const doc = documentStub();
  const legacy = { ...project, kind: 'legacy', readOnly: true };
  const app = require('../app.js').mount(doc, { schedule: () => 0, request: async (url, body) => {
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/inspect') return { project: legacy };
    if (url === '/api/preview') return { preview: { token: 'import', operation: body.operation, expiresAt: '2099-01-01', project, changes: ['Copy metadata'], warnings: ['Original references retained'], backup: 'C:\\Backup' } };
    if (url === '/api/open' || url === '/api/confirm') return { project };
    throw Error('Unexpected API');
  } });
  const hook = (id, name) => assert.equal(doc.getElementById(id)?.attributes['data-testid'], name, id);
  await app.ready;
  hook('open-mode-button', 'mode-open'); hook('create-button', 'mode-create'); hook('existing-folder', 'existing-folder'); hook('inspect-button', 'inspect-existing'); hook('settings-button', 'settings');
  app.setOpenFolder(legacy.projectFolder); await app.inspect();
  hook('open-button', 'open-existing'); hook('import-button', 'import-copy');
  doc.getElementById('import-button').onclick();
  assert.match(doc.getElementById('setup-content').textContent, /Source metadata/);
  for (const id of ['project-name', 'project-folder', 'builds-folder', 'composite-folder', 'cache-folder']) hook(id, id);
  hook('add-library', 'add-library'); doc.getElementById('add-library').onclick(); hook('library-0', 'library-folder');
  app.updateLibrary(0, 'D:\\Media'); hook('review-button', 'review-changes'); await app.review();
  hook('review-ack', 'review-ack'); hook('confirm-button', 'confirm-changes'); hook('cancel-review', 'cancel-review');
  assert.equal(doc.getElementById('confirm-button').textContent, 'Import a copy');
  app.acknowledge(true); await app.confirmReview();
  hook('active-project', 'active-project'); hook('switch-button', 'switch-project');
  app.editSettings(); await app.review();
  assert.equal(doc.getElementById('confirm-button').textContent, 'Save settings');
  assert.match(fs.readFileSync(path.join(root, 'index.html'), 'utf8'), /data-testid="error"/);
});

test('returning to another form never clears an unsaved draft warning', async () => {
  const app = controller(async () => bootstrap(project));
  await app.start(); app.chooseMode('create'); app.updateField('name', 'Unsaved create'); app.showActive();
  app.editSettings(); assert.equal(app.state.dirty, true);
  app.showActive(); app.chooseMode('create'); assert.equal(app.state.drafts.create.name, 'Unsaved create');
});

test('failed preview preserves the form and returns keyboard focus after the request lock', async () => {
  const doc = documentStub(); let reject;
  const content = doc.getElementById('setup-content');
  content.replaceChildren = function (...children) { this.children = children; doc.activeElement = null; };
  const app = require('../app.js').mount(doc, { schedule: () => 0, request: async url => {
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/preview') return new Promise((_, fail) => { reject = fail; });
    throw Error('Unexpected API');
  } });
  await app.ready; app.chooseMode('create'); app.updateField('name', 'Retained');
  doc.getElementById('review-button').focus();
  const reviewing = doc.getElementById('project-form').onsubmit({ preventDefault() {} });
  assert.equal(app.state.busy, true); assert.equal(doc.getElementById('review-button').disabled, true);
  reject(Error('Folder is not writable')); await reviewing;
  assert.equal(doc.getElementById('project-name').value, 'Retained');
  assert.equal(doc.getElementById('review-button').disabled, false);
  assert.equal(doc.activeElement?.id, 'review-button');
  assert.match(doc.getElementById('error').textContent, /not writable/);
});

test('bootstrap restores only the server active project, never opens or scans media', async () => {
  const calls = [];
  const app = controller(async (url) => { calls.push(url); return bootstrap(project); });
  await app.start();
  assert.equal(app.state.activeProject, project);
  assert.equal(app.state.view, 'active');
  assert.equal(app.state.csrfToken, 'test-token');
  assert.equal(app.state.busy, false);
  assert.deepEqual(calls, ['/api/bootstrap']);
});

test('setup provides a semantic local-only entry point with honest setup steps', () => {
  const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
  assert.match(html, /lang="en"/);
  assert.match(html, /<h1>Retro TV<\/h1>/);
  assert.match(html, /name="viewport"/);
  assert.match(html, /Choose project/);
  assert.match(html, /Review locations/);
  assert.match(html, /Ready/);
  assert.match(html, /role="alert"/);
  assert.match(html, /role="status"/);
  assert.match(html, /src="app.js"/);
  assert.doesNotMatch(html, /https?:\/\//);
});

test('inspection is read-only; explicit open requires current inspection and locks duplicate requests', async () => {
  const calls = [];
  let release;
  const legacy = { ...project, kind: 'legacy', readOnly: true };
  const app = controller(async (url, body, token) => {
    calls.push({ url, body, token });
    if (url === '/api/bootstrap') return bootstrap();
    if (url === '/api/inspect') return { project: legacy };
    if (url === '/api/open') { await new Promise(resolve => { release = resolve; }); return { project: legacy }; }
    throw Error('Unexpected request');
  });
  await app.start();
  app.setOpenFolder(project.projectFolder);
  await app.openExisting();
  assert.equal(calls.length, 1, 'uninspected paths never open');
  await app.inspect();
  assert.equal(app.state.activeProject, null);
  assert.equal(app.state.inspected, legacy);
  const opening = app.openExisting();
  assert.equal(app.state.busy, true);
  await app.openExisting();
  assert.equal(calls.filter(c => c.url === '/api/open').length, 1);
  release(); await opening;
  assert.equal(app.state.activeProject.readOnly, true);
  assert.equal(app.state.view, 'active');
  assert.deepEqual(calls.at(-1), { url: '/api/open', body: { projectFolder: project.projectFolder }, token: 'test-token' });
  app.switchProject();
  app.setOpenFolder('C:\\Another');
  assert.equal(app.state.inspected, null);
});
