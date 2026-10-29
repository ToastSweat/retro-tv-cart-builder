'use strict';
const http = require('node:http');
const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { execFile } = require('node:child_process');
const { promisify } = require('node:util');
const exec = promisify(execFile);
async function checkTools() {
  const definitions = [
    ['Node.js', process.execPath, ['--version']],
    ['PowerShell', 'powershell.exe', ['-NoProfile', '-Command', '$PSVersionTable.PSVersion.ToString()']],
    ['FFmpeg', 'ffmpeg', ['-version']],
    ['ffprobe', 'ffprobe', ['-version']]
  ];
  return Promise.all(definitions.map(async ([name, file, args]) => {
    try {
      const { stdout } = await exec(file, args, { windowsHide: true, timeout: 5000, maxBuffer: 128 * 1024 });
      return { name, available: true, version: stdout.trim().split(/\r?\n/)[0] };
    } catch (error) { return { name, available: false, error: error.code === 'ENOENT' ? 'Not found on PATH.' : 'Tool check failed or timed out.' }; }
  }));
}
async function pickWindowsFolder(initialPath = '') {
  if (process.platform !== 'win32') throw new Error('Native folder selection requires Windows. Enter an absolute folder path instead.');
  if (typeof initialPath !== 'string' || initialPath.length > 4096 || /[\x00-\x1f]/.test(initialPath)) throw new Error('Invalid starting folder.');
  const helper = path.join(__dirname, 'Select-ProjectFolder.ps1');
  try {
    const { stdout } = await exec('powershell.exe', ['-NoProfile', '-STA', '-ExecutionPolicy', 'Bypass', '-File', helper], { windowsHide: true, timeout: 120000, maxBuffer: 32768, env: { ...process.env, RETROTV_PICKER_START: initialPath } });
    return JSON.parse(stdout.replace(/^\uFEFF/, '').trim());
  } catch (_) { throw new Error('Folder selection failed or timed out. You can type an absolute path instead. No project settings were changed.'); }
}
function createSetupServer({ store, pickFolder = pickWindowsFolder, assetsDir = __dirname, mockupDir = path.resolve(__dirname,'../mockups/library-manager') } = {}) {
  const csrfToken = crypto.randomBytes(32).toString('hex');
  let changingProject = false;
  let pickingFolder = false;
  const server = http.createServer(async (req, res) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Referrer-Policy', 'no-referrer');
    res.setHeader('Content-Security-Policy', "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; connect-src 'self'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'");
    const host = `127.0.0.1:${server.address().port}`;
    if (req.headers.host !== host || (req.headers.origin && req.headers.origin !== `http://${host}`) || req.headers['sec-fetch-site'] === 'cross-site' || (req.method !== 'GET' && req.headers['x-retrotv-token'] !== csrfToken)) {
      res.writeHead(403, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
      return res.end(JSON.stringify({ error: 'Request refused. Open this setup page on its local address and retry.' }));
    }
    const mockupPolicy="default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self'; media-src 'none'; connect-src 'none'; worker-src 'none'; frame-src 'none'; object-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'";
    if(req.method==='GET' && req.url==='/mockups/library-manager') {
      res.writeHead(302,{'Location':'/mockups/library-manager/','Cache-Control':'no-store','Content-Security-Policy':mockupPolicy});return res.end();
    }
    const designAssets={
      '/mockups/library-manager/':['index.html','text/html',mockupDir],
      '/mockups/library-manager/app.js':['app.js','text/javascript',mockupDir],
      '/mockups/library-manager/style.css':['style.css','text/css',mockupDir],
      '/mockups/library-manager/demo-data.js':['demo-data.js','text/javascript',mockupDir]
    };
    const assets = { '/': ['index.html', 'text/html'], '/index.html': ['index.html', 'text/html'], '/app.js': ['app.js', 'text/javascript'], '/style.css': ['style.css', 'text/css'], ...designAssets };
    if (req.method === 'GET' && Object.hasOwn(assets, req.url)) {
      if(Object.hasOwn(designAssets,req.url))res.setHeader('Content-Security-Policy',mockupPolicy);
      try {
        const [name, mime,base=assetsDir] = assets[req.url];
        const bytes = fs.readFileSync(path.join(base, name));
        res.writeHead(200, { 'Content-Type': `${mime}; charset=utf-8`, 'Content-Length': bytes.length, 'Cache-Control': 'no-store' });
        return res.end(bytes);
      } catch (_) { res.writeHead(500); return res.end('Setup asset is missing. Restore the complete application folder; project data was not changed.'); }
    }
    if (req.method === 'GET' && ['/api/bootstrap', '/api/status', '/api/tools'].includes(req.url)) {
      try {
        const result = req.url === '/api/tools' ? { tools: await checkTools() } : req.url === '/api/status' ? { status: await store.status() } : { phase: '2', csrfToken, status: await store.status(), capabilities: { folderPicker: process.platform === 'win32' } };
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(result));
      } catch (_) {
        res.writeHead(500, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ error: 'Unable to read project preferences. No project was initialized or reset. Check access to the application data folder.' }));
      }
    }
    if (req.method === 'POST' && ['/api/inspect', '/api/open', '/api/preview', '/api/confirm', '/api/browse'].includes(req.url)) {
      const mutation = ['/api/open', '/api/confirm'].includes(req.url);
      if (changingProject) {
        res.writeHead(409, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ error: 'Another project change is running. Wait, then check current project status before retrying.' }));
      }
      if (mutation) changingProject = true;
      let validatedInput = false;
      try {
        if (!/^application\/json(?:\s*;|$)/i.test(req.headers['content-type'] || '')) throw Object.assign(new Error('Use application/json.'), { status: 415 });
        let size = 0; const chunks = [];
        for await (const chunk of req) {
          size += chunk.length;
          if (size > 65536) throw Object.assign(new Error('Setup request exceeds 64 KiB.'), { status: 413 });
          chunks.push(chunk);
        }
        const text = new TextDecoder('utf-8', { fatal: true }).decode(Buffer.concat(chunks));
        const input = JSON.parse(text);
        if (!input || typeof input !== 'object' || Array.isArray(input)) throw new Error('A JSON object is required.');
        validatedInput = true;
        let result;
        if (req.url === '/api/inspect') result = { project: await store.inspect(input.projectFolder) };
        if (req.url === '/api/open') result = { project: await store.open(input.projectFolder) };
        if (req.url === '/api/preview') result = { preview: await store.preview(input) };
        if (req.url === '/api/confirm') result = { project: await store.confirm(input.token) };
        if (req.url === '/api/browse') {
          if (pickingFolder) throw Object.assign(new Error('A folder chooser is already open. Finish or cancel it first.'), { status: 409 });
          pickingFolder = true;
          try { result = await pickFolder(input.initialPath || ''); } finally { pickingFolder = false; }
        }
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify(result));
      } catch (error) {
        res.writeHead(error.status || (mutation && validatedInput ? 500 : 400), { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
        return res.end(JSON.stringify({ error: error instanceof SyntaxError ? 'Invalid JSON request.' : error.message }));
      } finally { if (mutation) changingProject = false; }
    }
    res.writeHead(404); res.end('Not found');
  });
  return server;
}
module.exports = { createSetupServer };
if (require.main === module) {
  if (process.argv.includes('--help')) {
    console.log('Retro TV — Phase 2 hub and project settings\nUsage: node server.js [--port 17872] [--app-data <preferences-folder>]\nWorkspace navigation only; workspace tools are not implemented. Existing Studio has a separate launcher.');
  } else {
    let port = 17872, appDataDir;
    try {
      for (let i = 2; i < process.argv.length; i++) {
        const arg = process.argv[i];
        if (arg === '--port') {
          const raw = process.argv[++i];
          if (!/^\d{1,5}$/.test(raw || '') || Number(raw) > 65535) throw new Error('Invalid port. Use an integer from 0 through 65535.');
          port = Number(raw);
        } else if (arg === '--app-data') {
          appDataDir = process.argv[++i];
          if (!appDataDir || !path.isAbsolute(appDataDir)) throw new Error('The --app-data folder must be an absolute path.');
        } else throw new Error(`Unknown option: ${arg}`);
      }
    } catch (error) { console.error(error.message); process.exit(2); }
    try {
      const { ProjectStore } = require('./project-store');
      const os = require('node:os');
      appDataDir ||= path.join(process.env.LOCALAPPDATA || path.join(os.homedir(), 'AppData', 'Local'), 'RetroTVCartBuilder');
      const store = new ProjectStore({ appDataDir, installRoot: path.resolve(__dirname, '../..') });
      const server = createSetupServer({ store });
      server.requestTimeout = 15000;
      server.headersTimeout = 10000;
      server.on('error', error => { console.error(`Setup could not start: ${error.message}`); process.exitCode = 1; });
      server.listen(port, '127.0.0.1', () => console.log(`Retro TV Phase 2 hub listening on http://127.0.0.1:${server.address().port}/`));
      const stop = () => { server.closeAllConnections(); server.close(); };
      process.once('SIGINT', stop); process.once('SIGTERM', stop);
    } catch (error) { console.error(`Setup could not start: ${error.message}`); process.exitCode = 1; }
  }
}

