'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const serverPath = path.join(__dirname, '..', 'server.js');

test('Phase 2 shell exposes a separately startable loopback server factory', () => {
  assert.ok(fs.existsSync(serverPath), 'separate setup HTTP server has not been implemented');
  assert.equal(typeof require(serverPath).createSetupServer, 'function');
});

async function running(t, store = { status: async () => ({ activeProject: null, recentProjects: [], defaults: {} }) }, options = {}) {
  const server = require(serverPath).createSetupServer({ store, ...options });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { server, base: `http://127.0.0.1:${server.address().port}` };
}

test('bootstrap returns actual project status and a session CSRF token without opening a project', async t => {
  const { base } = await running(t);
  const response = await fetch(base + '/api/bootstrap');
  assert.equal(response.status, 200);
  const data = await response.json();
  assert.equal(data.phase, '2');
  assert.equal(data.status.activeProject, null);
  assert.match(data.csrfToken, /^[a-f0-9]{64}$/);
  assert.equal(response.headers.get('cache-control'), 'no-store');
});

test('mutation endpoints reject missing tokens and foreign origins before accessing the store', async t => {
  let opens = 0;
  const { base } = await running(t, { status: async () => ({}), open: async () => { opens++; return {}; } });
  const { csrfToken } = await (await fetch(base + '/api/bootstrap')).json();
  for (const headers of [
    { 'Content-Type': 'application/json' },
    { 'Content-Type': 'application/json', 'X-RetroTV-Token': csrfToken, Origin: 'https://unrelated.invalid' }
  ]) {
    const response = await fetch(base + '/api/open', { method: 'POST', headers, body: JSON.stringify({ projectFolder: 'irrelevant' }) });
    assert.equal(response.status, 403);
  }
  assert.equal(opens, 0);
  const deniedStatus = await new Promise((resolve, reject) => {
    const req = require('node:http').get(base + '/api/bootstrap', { headers: { Host: 'unrelated.invalid' } }, res => { res.resume(); resolve(res.statusCode); });
    req.on('error', reject);
  });
  assert.equal(deniedStatus, 403);
});

test('inspect, review and confirmation use separate explicit requests and return service results', async t => {
  const calls = [];
  const project = { name: 'Fixture', projectFolder: 'C:/fixture', kind: 'managed' };
  const store = {
    status: async () => ({ activeProject: null }),
    inspect: async folder => { calls.push(['inspect', folder]); return project; },
    open: async folder => { calls.push(['open', folder]); return project; },
    preview: async input => { calls.push(['preview', input.operation]); return { token: 'review-token', project }; },
    confirm: async token => { calls.push(['confirm', token]); return project; }
  };
  const { base } = await running(t, store);
  const { csrfToken } = await (await fetch(base + '/api/bootstrap')).json();
  const post = async (route, body) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RetroTV-Token': csrfToken, Origin: base }, body: JSON.stringify(body) });
    assert.equal(response.status, 200);
    return response.json();
  };
  assert.equal((await post('/api/inspect', { projectFolder: 'C:/fixture' })).project.name, 'Fixture');
  const review = await post('/api/preview', { operation: 'create', name: 'Fixture', projectFolder: 'C:/fixture', paths: {} });
  assert.equal(review.preview.token, 'review-token');
  assert.deepEqual(calls, [['inspect', 'C:/fixture'], ['preview', 'create']], 'review must not confirm implicitly');
  assert.equal((await post('/api/confirm', { token: review.preview.token })).project.name, 'Fixture');
  await post('/api/open', { projectFolder: 'C:/fixture' });
  assert.deepEqual(calls.slice(-2), [['confirm', 'review-token'], ['open', 'C:/fixture']]);
});

test('requests are bounded JSON objects and malformed bodies never reach the service', async t => {
  let calls = 0;
  const { base } = await running(t, { status: async () => ({}), preview: async () => { calls++; return {}; } });
  const { csrfToken } = await (await fetch(base + '/api/bootstrap')).json();
  for (const [body, type, code] of [['{', 'application/json', 400], ['null', 'application/json', 400], ['[]', 'application/json', 400], ['{}', 'text/plain', 415], ['"' + 'a'.repeat(70000) + '"', 'application/json', 413]]) {
    const response = await fetch(base + '/api/preview', { method: 'POST', headers: { 'Content-Type': type, 'X-RetroTV-Token': csrfToken }, body });
    assert.equal(response.status, code);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.equal(calls, 0);
  const invalidOpen = await fetch(base + '/api/open', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RetroTV-Token': csrfToken }, body: 'null' });
  assert.equal(invalidOpen.status, 400, 'malformed input is a definite pre-service rejection, not an uncertain write failure');
});

test('a pending confirmation rejects conflicting opens and confirms immediately', async t => {
  let release, entered;
  const start = new Promise(resolve => { entered = resolve; });
  const gate = new Promise(resolve => { release = resolve; });
  let confirms = 0;
  const { base } = await running(t, {
    status: async () => ({}),
    confirm: async () => { confirms++; if (confirms > 1) throw new Error('duplicate reached service'); entered(); await gate; return { name: 'saved' }; },
    open: async () => { throw new Error('conflicting open reached service'); }
  });
  const { csrfToken } = await (await fetch(base + '/api/bootstrap')).json();
  const post = (route, body) => fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RetroTV-Token': csrfToken }, body: JSON.stringify(body) });
  const pending = post('/api/confirm', { token: 'a' });
  try {
    await start;
    assert.equal((await post('/api/confirm', { token: 'a' })).status, 409);
    assert.equal((await post('/api/open', { projectFolder: 'C:/other' })).status, 409);
  } finally { release(); }
  assert.equal((await pending).status, 200);
  assert.equal(confirms, 1);
});

test('status and real runtime diagnostics remain readable without creating a project', async t => {
  const { base } = await running(t);
  const statusResponse = await fetch(base + '/api/status');
  assert.equal(statusResponse.status, 200);
  assert.equal((await statusResponse.json()).status.activeProject, null);
  const response = await fetch(base + '/api/tools');
  assert.equal(response.status, 200);
  const { tools } = await response.json();
  const node = tools.find(tool => tool.name === 'Node.js');
  assert.equal(node.available, true);
  assert.equal(node.version, process.version);
  assert.equal(tools.length, 4);
});

test('explicit folder selection returns cancellation without changing project state', async t => {
  let picked;
  const { base } = await running(t, undefined, { pickFolder: async initial => { picked = initial; return { cancelled: true, path: '' }; } });
  const { csrfToken } = await (await fetch(base + '/api/bootstrap')).json();
  const response = await fetch(base + '/api/browse', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RetroTV-Token': csrfToken }, body: JSON.stringify({ initialPath: 'F:/[VIDEOS]' }) });
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { cancelled: true, path: '' });
  assert.equal(picked, 'F:/[VIDEOS]');
});

test('setup serves only its fixed local assets with browser security headers', async t => {
  const scratch = process.env.RETRO_TV_TEST_ROOT;
  assert.ok(scratch, 'Set RETRO_TV_TEST_ROOT to a disposable scratch directory.');
  fs.mkdirSync(scratch, { recursive: true });
  const assetsDir = fs.mkdtempSync(path.join(scratch, 'http-assets-'));
  t.after(() => fs.rmSync(assetsDir, { recursive: true, force: true }));
  fs.writeFileSync(path.join(assetsDir, 'index.html'), '<!doctype html><title>Setup fixture</title>');
  fs.writeFileSync(path.join(assetsDir, 'app.js'), "'use strict';");
  fs.writeFileSync(path.join(assetsDir, 'style.css'), 'body{color:white}');
  const { base } = await running(t, undefined, { assetsDir });
  const response = await fetch(base + '/');
  assert.equal(response.status, 200);
  assert.match(await response.text(), /Setup fixture/);
  assert.match(response.headers.get('content-security-policy'), /frame-ancestors 'none'/);
  assert.equal(response.headers.get('x-content-type-options'), 'nosniff');
  assert.match((await fetch(base + '/app.js')).headers.get('content-type'), /javascript/);
  assert.equal((await fetch(base + '/project-store.js')).status, 404);
  assert.equal((await fetch(base + '/STATE/settings.json')).status, 404);
});

test('Library Manager design assets are a fixed isolated static surface with no data API', async t => {
  const scratch=process.env.RETRO_TV_TEST_ROOT;assert.ok(scratch,'Set RETRO_TV_TEST_ROOT to disposable scratch.');fs.mkdirSync(scratch,{recursive:true});
  const mockupDir=fs.mkdtempSync(path.join(scratch,'design-assets-'));t.after(()=>fs.rmSync(mockupDir,{recursive:true,force:true}));
  for(const[name,text]of Object.entries({'index.html':'<!doctype html><title>Library Manager design fixture</title>','app.js':'// design fixture','style.css':'/* design fixture */','demo-data.js':'// illustrative fixture data'}))fs.writeFileSync(path.join(mockupDir,name),text);
  let statusCalls=0;const {base}=await running(t,{status:async()=>{statusCalls++;return {};}},{mockupDir});
  const response=await fetch(base+'/mockups/library-manager/');assert.equal(response.status,200);assert.match(await response.text(),/Library Manager design fixture/);
  assert.match(response.headers.get('content-security-policy'),/connect-src 'none'/);assert.match(response.headers.get('content-security-policy'),/form-action 'none'/);assert.equal(response.headers.get('cache-control'),'no-store');
  for(const name of ['app.js','style.css','demo-data.js'])assert.equal((await fetch(base+'/mockups/library-manager/'+name)).status,200);
  const redirect=await fetch(base+'/mockups/library-manager',{redirect:'manual'});assert.equal(redirect.status,302);assert.equal(redirect.headers.get('location'),'/mockups/library-manager/');
  assert.equal((await fetch(base+'/mockups/library-manager/project-store.js')).status,404);assert.equal((await fetch(base+'/mockups/library-manager/STATE/settings.json')).status,404);assert.equal(statusCalls,0,'static design must not read project preferences');
  const {csrfToken}=await(await fetch(base+'/api/bootstrap')).json();const blocked=await fetch(base+'/api/library/scan',{method:'POST',headers:{'Content-Type':'application/json','X-RetroTV-Token':csrfToken},body:'{}'});assert.equal(blocked.status,404,'Phase3.2 scan endpoint must not exist');
});

test('unexpected storage write failure is not represented as a definite validation rejection', async t => {
  const { base } = await running(t, { status: async () => ({}), confirm: async () => { throw Error('Could not persist last project after project publication'); } });
  const { csrfToken } = await (await fetch(base + '/api/bootstrap')).json();
  const response = await fetch(base + '/api/confirm', { method: 'POST', headers: { 'Content-Type': 'application/json', 'X-RetroTV-Token': csrfToken }, body: JSON.stringify({ token: 'reviewed' }) });
  assert.equal(response.status, 500);
  assert.match((await response.json()).error, /persist/);
});

test('standalone setup documents its isolated launcher options without loading project state', () => {
  const result = require('node:child_process').spawnSync(process.execPath, [serverPath, '--help'], { encoding: 'utf8', timeout: 10000, windowsHide: true });
  assert.equal(result.status, 0);
  assert.match(result.stdout, /Phase 2/);
  assert.match(result.stdout, /--app-data/);
  assert.match(result.stdout, /--port/);
});

test('standalone setup rejects invalid port and unknown options before opening project state', () => {
  for (const args of [['--port', '-1'], ['--port', 'wat'], ['--unexpected']]) {
    const result = require('node:child_process').spawnSync(process.execPath, [serverPath, ...args], { encoding: 'utf8', timeout: 10000, windowsHide: true });
    assert.equal(result.status, 2);
    assert.match(result.stderr, /Invalid port|Unknown option/);
  }
});
