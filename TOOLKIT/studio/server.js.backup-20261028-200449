'use strict';

const http = require('http');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const { URL } = require('url');

function argValue(name, fallback='') {
  const i = process.argv.indexOf(name);
  return i >= 0 && i + 1 < process.argv.length ? process.argv[i + 1] : fallback;
}

const SETTINGS_PATH = argValue('--settings');
const TOOLKIT_DIR = argValue('--toolkit', path.resolve(__dirname, '..'));
const INITIAL_CART = argValue('--cart', '');
const PORT = Number(argValue('--port', '17871'));

if (!SETTINGS_PATH) {
  console.error('Missing --settings <settings.json>');
  process.exit(2);
}

const settings = JSON.parse(fs.readFileSync(SETTINGS_PATH, 'utf8').replace(/^\uFEFF/, ''));
const SYSTEM_ROOT = settings.SystemRoot;
const CACHE_ROOT = path.join(SYSTEM_ROOT, 'CACHE', 'studio-v3');
const CROP_FRAME_ROOT = path.join(SYSTEM_ROOT, 'CACHE', 'studio-crop-frames');
const CROP_FINAL_ROOT = path.join(SYSTEM_ROOT, 'CACHE', 'studio-crop-final');
const DRAFT_ROOT = path.join(SYSTEM_ROOT, 'STATE', 'studio-drafts');
fs.mkdirSync(CACHE_ROOT, { recursive: true });
fs.mkdirSync(CROP_FRAME_ROOT, { recursive: true });
fs.mkdirSync(CROP_FINAL_ROOT, { recursive: true });
fs.mkdirSync(DRAFT_ROOT, { recursive: true });

const AUDIO_LEVELS = ['NONE', 'RESTORE', 'STRONG', 'AGGRESSIVE', 'MAX'];
const AUDIO_FILTERS = {
  NONE: 'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=44100',
  RESTORE: 'highpass=f=70,lowpass=f=12500,adeclip,adeclick,afftdn=nr=18:nf=-32:tn=1:gs=8,dynaudnorm=f=250:g=15:p=0.90:m=6:c=1,loudnorm=I=-16:TP=-1.5:LRA=8,aresample=44100',
  STRONG: 'highpass=f=90,lowpass=f=10500,adeclip,adeclick,afftdn=nr=28:nf=-28:tn=1:gs=12,anlmdn=s=0.002:p=0.002:r=0.006:m=11,dynaudnorm=f=200:g=11:p=0.88:m=4:c=1,loudnorm=I=-16:TP=-1.5:LRA=7,aresample=44100',
  AGGRESSIVE: 'highpass=f=100,lowpass=f=9500,adeclip,adeclick,afftdn=nr=36:nf=-27:tn=1:gs=15,afftdn=nr=18:nf=-34:tn=1:gs=8,dynaudnorm=f=180:g=9:p=0.86:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=6,aresample=44100',
  MAX: 'highpass=f=120,lowpass=f=8000,adeclip,adeclick,afftdn=nr=48:nf=-24:tn=1:gs=20,afftdn=nr=26:nf=-31:tn=1:gs=12,dynaudnorm=f=160:g=7:p=0.84:m=3:c=1,loudnorm=I=-16:TP=-1.5:LRA=5,aresample=44100'
};

function normalizeAudio(v) {
  let x = String(v || 'NONE').trim().toUpperCase();
  if (!x) x = 'NONE';
  if (x === 'LIGHT') x = 'RESTORE';
  if (!AUDIO_LEVELS.includes(x)) x = 'NONE';
  return x;
}

function csvParse(text) {
  const rows = [];
  let row = [], field = '', quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
    } else {
      if (c === '"') quoted = true;
      else if (c === ',') { row.push(field); field = ''; }
      else if (c === '\r') {}
      else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
      else field += c;
    }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  if (!rows.length) return [];
  const headers = rows[0];
  return rows.slice(1).filter(r => r.some(x => x !== '')).map(r => {
    const o = {};
    headers.forEach((h, i) => o[h] = r[i] ?? '');
    return o;
  });
}

function csvQ(v) { return `"${String(v ?? '').replace(/"/g, '""')}"`; }
function csvStringify(rows, columns) {
  const cols = columns || (rows[0] ? Object.keys(rows[0]) : []);
  return [cols.map(csvQ).join(','), ...rows.map(r => cols.map(c => csvQ(r[c] ?? '')).join(','))].join('\r\n') + '\r\n';
}
function readCsv(file) { return csvParse(fs.readFileSync(file, 'utf8').replace(/^\uFEFF/, '')); }
function writeCsv(file, rows, columns) { fs.writeFileSync(file, '\uFEFF' + csvStringify(rows, columns), 'utf8'); }
function num(v, d=0) { const n = Number(v); return Number.isFinite(n) ? n : d; }
function int(v, d=0) { return Math.max(0, Math.round(num(v,d))); }
function nowIso() { return new Date().toISOString(); }
function stableId(prefix, seed) { return `${prefix}-${crypto.createHash('sha1').update(seed).digest('hex').slice(0,12)}`; }
function sha(seed) { return crypto.createHash('sha1').update(seed).digest('hex').slice(0,20); }

function getCarts() { return readCsv(settings.CartRegistryPath); }
function getCart(cartId) {
  const cart = getCarts().find(c => c.CartID === cartId);
  if (!cart) throw new Error(`Unknown cart: ${cartId}`);
  return cart;
}
function getRegistry() { return readCsv(settings.RegistryPath); }
function getAssignments() { return fs.existsSync(settings.AssignmentPath) ? readCsv(settings.AssignmentPath) : []; }

function manifestDefaults(m) {
  return {
    ...m,
    TrimStartSeconds: String(num(m.TrimStartSeconds, 0)),
    TrimEndSeconds: String(num(m.TrimEndSeconds, 0)),
    CropLeft: String(int(m.CropLeft, 0)),
    CropRight: String(int(m.CropRight, 0)),
    CropTop: String(int(m.CropTop, 0)),
    CropBottom: String(int(m.CropBottom, 0)),
    AudioRepair: normalizeAudio(m.AudioRepair),
    ReviewStatus: m.ReviewStatus || 'UNREVIEWED'
  };
}
function getManifest(cart) { return readCsv(cart.ManifestPath).map(manifestDefaults); }
function draftPath(cartId, revision) { return path.join(DRAFT_ROOT, `${cartId}-r${String(revision).padStart(3,'0')}.json`); }

function newDraft(cart, manifest) {
  const slots = {};
  for (const m of manifest) {
    slots[m.SlotID] = {
      slotId: m.SlotID,
      baseAssetId: m.AssetID,
      assetId: m.AssetID,
      action: m.ReviewStatus || 'UNREVIEWED',
      notes: '',
      trimStartSeconds: num(m.TrimStartSeconds),
      trimEndSeconds: num(m.TrimEndSeconds),
      cropLeft: int(m.CropLeft), cropRight: int(m.CropRight), cropTop: int(m.CropTop), cropBottom: int(m.CropBottom),
      audioRepair: normalizeAudio(m.AudioRepair),
      rejected: []
    };
  }
  return {
    version: 1,
    cartId: cart.CartID,
    baseRevision: Number(cart.CurrentRevision),
    baseManifestPath: cart.ManifestPath,
    createdUtc: nowIso(), updatedUtc: nowIso(), slots
  };
}

function loadDraft(cart, manifest) {
  const dp = draftPath(cart.CartID, Number(cart.CurrentRevision));
  if (fs.existsSync(dp)) {
    try {
      const d = JSON.parse(fs.readFileSync(dp, 'utf8'));
      if (d.baseRevision === Number(cart.CurrentRevision) && d.baseManifestPath === cart.ManifestPath) return d;
    } catch (_) {}
  }
  const d = newDraft(cart, manifest);
  fs.writeFileSync(dp, JSON.stringify(d, null, 2), 'utf8');
  return d;
}
function saveDraft(draft) {
  draft.updatedUtc = nowIso();
  const dp = draftPath(draft.cartId, draft.baseRevision);
  fs.writeFileSync(dp, JSON.stringify(draft, null, 2), 'utf8');
}

function assetMap(registry) { const x = {}; for (const a of registry) x[a.AssetID] = a; return x; }
function effectiveAsset(m, d, regMap) {
  const a = regMap[d.assetId];
  if (!a) throw new Error(`Asset not found in registry: ${d.assetId}`);
  return a;
}
function sourceStatus(a) { return String(a.SourceStatus || a.CuratedStatus || 'READY').trim().toUpperCase(); }

function compatible(roleRow, a) {
  if (sourceStatus(a) !== 'READY') return false;
  if (a.AssetID === roleRow.AssetID) return false;
  if (roleRow.Role === 'AD') return a.AssetType === 'COMMERCIAL' && a.Pool === roleRow.Pool;
  if (roleRow.Role === 'SHOW') return a.AssetType === 'EPISODE' && a.Network === roleRow.Network;
  if (a.AssetType !== 'BRANDING' || a.Network !== roleRow.Network) return false;
  const dur = num(a.DurationSeconds, 0);
  if (roleRow.Role === 'ANCHOR_BRANDING') return ['IDENT','PROMO','INTRO'].includes(a.Subtype) && dur >= 20;
  if (roleRow.Role === 'STING') return ['IDENT','BUMPER_GENERIC','TRANSITION'].includes(a.Subtype) && dur <= 15;
  if (roleRow.Role === 'BUMPER_OUT') return ['BUMPER_OUT','BUMPER_GENERIC'].includes(a.Subtype);
  if (roleRow.Role === 'BUMPER_IN') return ['BUMPER_IN','BUMPER_GENERIC'].includes(a.Subtype);
  if (roleRow.Role === 'NEXT') return a.Subtype === 'NEXT';
  if (roleRow.Role === 'SIGN_OFF') return a.Subtype === 'SIGN_OFF';
  return true;
}

function episodeSeries(row) {
  return String(row.Series || row.Subtype || '').trim();
}

function availableCandidates(m, registry, assignments, manifest, draft) {
  const activeAssignments = new Map();
  for (const x of assignments.filter(x => ['RESERVED','ACTIVE'].includes(x.AssignmentStatus))) {
    if (!activeAssignments.has(x.AssetID)) activeAssignments.set(x.AssetID, []);
    activeAssignments.get(x.AssetID).push(x);
  }
  const usedByCurrentDraft = new Set(Object.values(draft?.slots || {}).map(x => x.assetId).filter(Boolean));
  const currentSeries = episodeSeries(m);

  return registry.filter(a => {
    if (!compatible(m, a)) return false;
    if (a.AssetID === m.AssetID) return false;

    // Never offer another episode already used elsewhere in this cart draft.
    if (m.Role === 'SHOW' && usedByCurrentDraft.has(a.AssetID)) return false;

    // Preserve UNIQUE semantics across other carts. Assignments from this same
    // cart/revision are already filtered by usedByCurrentDraft above.
    if (String(a.ReusePolicy).toUpperCase() === 'UNIQUE') {
      const blockers = (activeAssignments.get(a.AssetID) || []).filter(x => x.CartID !== draft.cartId);
      if (blockers.length) return false;
    }
    return true;
  }).map(a => ({
    ...a,
    CandidateSeries: episodeSeries(a),
    CandidateGroup: m.Role === 'SHOW' && currentSeries && episodeSeries(a).toLowerCase() === currentSeries.toLowerCase() ? 'SAME_SHOW' : (m.Role === 'SHOW' ? 'OTHER_SHOW' : 'DEFAULT')
  })).sort((a,b) => {
    const rank = x => x.CandidateGroup === 'SAME_SHOW' ? 0 : x.CandidateGroup === 'OTHER_SHOW' ? 1 : 0;
    const r = rank(a) - rank(b);
    if (r) return r;
    const sr = String(a.CandidateSeries || '').localeCompare(String(b.CandidateSeries || ''));
    return sr || String(a.Title).localeCompare(String(b.Title));
  }).slice(0, 500);
}

function run(proc, args, opts={}) {
  return new Promise((resolve, reject) => {
    const child = spawn(proc, args, { windowsHide: true, ...opts });
    let out='', err='';
    if (child.stdout) child.stdout.on('data', d => out += d.toString());
    if (child.stderr) child.stderr.on('data', d => err += d.toString());
    child.on('error', reject);
    child.on('close', code => resolve({ code, out, err }));
  });
}

async function ffprobeDuration(file) {
  const r = await run('ffprobe', ['-v','error','-show_entries','format=duration','-of','default=nw=1:nk=1',file]);
  const d = Number(String(r.out).trim());
  if (r.code !== 0 || !Number.isFinite(d) || d <= 0) throw new Error(`ffprobe failed for ${file}: ${r.err || r.out}`);
  return d;
}
async function hasAudio(file) {
  const r = await run('ffprobe', ['-v','error','-select_streams','a:0','-show_entries','stream=index','-of','csv=p=0',file]);
  return r.code === 0 && String(r.out).trim().length > 0;
}

function previewKey(asset, d) {
  const st = fs.statSync(asset.SourcePath);
  return sha(JSON.stringify({
    source: asset.SourcePath, size: st.size, mtime: st.mtimeMs,
    trimStart: d.trimStartSeconds, trimEnd: d.trimEndSeconds,
    crop: [d.cropLeft,d.cropRight,d.cropTop,d.cropBottom], audio: d.audioRepair,
    profile: 'studio-v6|618x480|30fps|h264-crf20|medium|aac128|44100-stereo|sar-safe|crop-box-v1|progress-dedupe|source-health'
  }));
}

const renderStatus = new Map();
const inflightRenders = new Map();
function renderStatusKey(cartId, slotId) { return `${cartId}|${slotId}`; }
function parseProgressFile(file, durationSeconds) {
  try {
    const txt = fs.readFileSync(file, 'utf8');
    const vals = [...txt.matchAll(/out_time_(?:us|ms)=(\d+)/g)].map(m => Number(m[1]));
    if (!vals.length || !durationSeconds) return 0;
    // FFmpeg's out_time_us/out_time_ms value is microseconds in current builds.
    const seconds = vals[vals.length - 1] / 1000000;
    return Math.max(0, Math.min(99, Math.round(seconds / durationSeconds * 100)));
  } catch (_) { return 0; }
}
function publicRenderStatus(cartId, slotId) {
  const st = renderStatus.get(renderStatusKey(cartId, slotId));
  if (!st) return {state:'idle',progress:0};
  let progress = st.progress || 0;
  if (st.state === 'rendering' && st.progressFile) progress = Math.max(progress, parseProgressFile(st.progressFile, st.duration));
  return {state:st.state,progress,title:st.title||'',error:st.error||''};
}

const sourceHealthCache = new Map();
function sourceHealthKey(file) {
  try {
    const st = fs.statSync(file);
    return `${file}|${st.size}|${st.mtimeMs}`;
  } catch (_) { return file; }
}
function corruptionSummary(text) {
  const lines = String(text || '').split(/\r?\n/).map(x=>x.trim()).filter(Boolean);
  const rx = /(Invalid NAL unit size|missing picture in access unit|Error splitting the input into NAL units|channel element .* is not allocated|Invalid data found when processing input|moov atom not found|corrupt decoded frame|error while decoding|non-existing PPS|sps_id .* out of range)/i;
  const hits = [];
  for (const line of lines) {
    if (rx.test(line) && !hits.includes(line)) hits.push(line);
    if (hits.length >= 6) break;
  }
  return hits;
}
async function inspectSourceHealth(file, startSeconds=0, durationSeconds=35) {
  const k = sourceHealthKey(file);
  if (sourceHealthCache.has(k)) return sourceHealthCache.get(k);
  const args = ['-hide_banner','-loglevel','error','-nostdin','-xerror'];
  if (startSeconds > 0) args.push('-ss',String(startSeconds));
  args.push('-i',file,'-t',String(Math.max(1,Math.min(35,durationSeconds||35))),'-map','0:v:0?','-map','0:a:0?','-f','null','NUL');
  const r = await run('ffmpeg', args);
  const diagnostic = `${r.err || ''}\n${r.out || ''}`.trim();
  const hits = corruptionSummary(diagnostic);
  const result = { damaged:hits.length>0, hits, exit:r.code, diagnostic };
  sourceHealthCache.set(k,result);
  return result;
}

async function renderPreview(cartId, slotId) {
  const cart = getCart(cartId), manifest = getManifest(cart), draft = loadDraft(cart, manifest), registry = getRegistry(), regMap = assetMap(registry);
  const m = manifest.find(x => x.SlotID === slotId);
  const d = draft.slots[slotId];
  if (!m || !d) throw new Error(`Unknown slot: ${slotId}`);
  const a = effectiveAsset(m,d,regMap);
  if (!fs.existsSync(a.SourcePath)) throw new Error(`Missing source: ${a.SourcePath}`);

  const key = previewKey(a,d), out = path.join(CACHE_ROOT, `${key}.mp4`);
  const statusKey = renderStatusKey(cartId, slotId);
  if (fs.existsSync(out)) {
    try {
      await ffprobeDuration(out);
      renderStatus.set(statusKey,{state:'ready',progress:100,title:a.Title});
      return out;
    } catch (_) { try { fs.unlinkSync(out); } catch (_) {} }
  }

  // Identical requests share one encode instead of launching duplicate FFmpeg jobs.
  if (inflightRenders.has(key)) return inflightRenders.get(key);

  const task = (async()=>{
    const srcDur = await ffprobeDuration(a.SourcePath);
    const start = Math.max(0,num(d.trimStartSeconds));
    const endTrim = Math.max(0,num(d.trimEndSeconds));
    const effective = srcDur - start - endTrim;
    if (effective <= .1) throw new Error(`Invalid trim: start ${start}s + end ${endTrim}s on ${srcDur.toFixed(2)}s source`);

    const ar = normalizeAudio(d.audioRepair);
    const audio = await hasAudio(a.SourcePath);
    if (!audio && ar !== 'NONE') throw new Error('Audio repair requested but source has no audio stream.');

    const runner = path.join(__dirname, 'Render-StudioPreview.ps1');
    const statusFile = out + '.status.json';
    const progressFile = out + '.progress.txt';
    try { fs.unlinkSync(statusFile); } catch (_) {}
    try { fs.unlinkSync(progressFile); } catch (_) {}
    renderStatus.set(statusKey,{state:'rendering',progress:0,duration:effective,progressFile,title:a.Title});

    const psArgs = [
      '-NoProfile','-ExecutionPolicy','Bypass','-File',runner,
      '-Source',a.SourcePath,
      '-Output',out,
      '-StatusFile',statusFile,
      '-ProgressFile',progressFile,
      '-StartSeconds',String(start),
      '-DurationSeconds',String(effective),
      '-CropLeft',String(int(d.cropLeft)),
      '-CropRight',String(int(d.cropRight)),
      '-CropTop',String(int(d.cropTop)),
      '-CropBottom',String(int(d.cropBottom)),
      '-AudioRepair',ar
    ];
    if (!audio) psArgs.push('-NoAudio');

    console.log(`Studio render: ${cartId} ${slotId} · ${ar} · ${a.Title}`);
    const r = await run('powershell.exe', psArgs, { stdio:['ignore','inherit','inherit'], windowsHide:false });
    let status = null;
    if (fs.existsSync(statusFile)) {
      try { status = JSON.parse(fs.readFileSync(statusFile,'utf8').replace(/^\uFEFF/,'')); } catch (_) {}
      try { fs.unlinkSync(statusFile); } catch (_) {}
    }
    try { fs.unlinkSync(progressFile); } catch (_) {}

    if (r.code !== 0 || !fs.existsSync(out)) {
      try { fs.unlinkSync(out); } catch (_) {}
      const originalExit = status && status.ffmpegExit !== undefined ? status.ffmpegExit : 'unknown';

      // A native FFmpeg crash can hide the actual decode error. On failure, do
      // one short source-health decode pass and turn known H.264/AAC corruption
      // into a concise review error instead of dumping an FFmpeg report at the user.
      let health = {damaged:false,hits:[]};
      try { health = await inspectSourceHealth(a.SourcePath,start,effective); } catch (_) {}

      let msg;
      if (health.damaged) {
        const evidence = health.hits.length ? `\n\nDetected:\n- ${health.hits.join('\n- ')}` : '';
        msg = `SOURCE MEDIA IS DAMAGED\n\n${a.Title}\n\nThe original file contains H.264/AAC decode errors. Audio restoration can reduce hiss/noise/level problems, but it cannot repair broken encoded packets. Replace this clip instead.${evidence}`;
      } else {
        const detail = status && status.diagnostic ? `\n\n${status.diagnostic}` : '';
        msg = `Preview encode failed for ${a.Title}\nAudio level: ${ar}\nFFmpeg exit: ${originalExit}${detail}`;
      }
      renderStatus.set(statusKey,{state:'error',progress:0,title:a.Title,error:msg});
      throw new Error(msg);
    }

    await ffprobeDuration(out);
    renderStatus.set(statusKey,{state:'ready',progress:100,title:a.Title});
    return out;
  })();

  inflightRenders.set(key, task);
  try { return await task; }
  finally { inflightRenders.delete(key); }
}


function parseRatio(value, fallback=1) {
  const s=String(value||'').trim();
  if(!s || s==='N/A') return fallback;
  const m=s.match(/^(\d+(?:\.\d+)?):(\d+(?:\.\d+)?)$/);
  if(m){
    const a=Number(m[1]),b=Number(m[2]);
    if(Number.isFinite(a)&&Number.isFinite(b)&&a>0&&b>0) return a/b;
  }
  const n=Number(s);
  return Number.isFinite(n)&&n>0?n:fallback;
}

async function ffprobeVideoInfo(file) {
  const r = await run('ffprobe',[
    '-v','error',
    '-select_streams','v:0',
    '-show_entries','stream=width,height,sample_aspect_ratio,display_aspect_ratio',
    '-show_entries','format=duration',
    '-of','json',
    file
  ]);
  if(r.code!==0) throw new Error(`ffprobe failed for ${file}: ${r.err || r.out}`);
  let j;
  try { j=JSON.parse(String(r.out||'{}')); } catch (_) { throw new Error(`Could not parse ffprobe video info for ${file}`); }
  const st=(j.streams||[])[0]||{};
  const width=Number(st.width||0), height=Number(st.height||0), duration=Number(j.format?.duration||0);
  if(!Number.isFinite(width)||!Number.isFinite(height)||width<=0||height<=0) throw new Error(`Could not read source dimensions: ${file}`);
  const sar=parseRatio(st.sample_aspect_ratio,1);
  const dar=parseRatio(st.display_aspect_ratio,(width*sar)/height);
  return {width,height,sar,dar,duration:Number.isFinite(duration)?duration:0};
}

function cropFrameKey(asset) {
  const st=fs.statSync(asset.SourcePath);
  return sha(JSON.stringify({source:asset.SourcePath,size:st.size,mtime:st.mtimeMs,profile:'crop-reference-v3-display-correct'}));
}

async function renderCropReference(cartId, slotId) {
  const cart=getCart(cartId), manifest=getManifest(cart), draft=loadDraft(cart,manifest), registry=getRegistry(), regMap=assetMap(registry);
  const m=manifest.find(x=>x.SlotID===slotId), d=draft.slots[slotId];
  if(!m||!d) throw new Error(`Unknown slot: ${slotId}`);
  const a=effectiveAsset(m,d,regMap);
  if(!fs.existsSync(a.SourcePath)) throw new Error(`Missing source: ${a.SourcePath}`);

  const info=await ffprobeVideoInfo(a.SourcePath);
  const key=cropFrameKey(a), out=path.join(CROP_FRAME_ROOT,`${key}.jpg`);
  if(!fs.existsSync(out)){
    const seek=info.duration>1 ? Math.max(0.25,Math.min(info.duration-0.25,info.duration*0.25)) : 0;
    const r=await run('ffmpeg',[
      '-hide_banner','-loglevel','error','-nostdin','-y',
      '-ss',String(seek),'-i',a.SourcePath,
      '-frames:v','1',
      '-vf',"scale='min(960,max(2,trunc(iw*sar/2)*2))':-2,setsar=1",
      '-q:v','3',
      out
    ]);
    if(r.code!==0 || !fs.existsSync(out)){
      try{fs.unlinkSync(out)}catch(_){}
      throw new Error(`Could not create crop reference frame for ${a.Title}: ${r.err || r.out}`);
    }
  }
  return {file:out,width:info.width,height:info.height,sar:info.sar,dar:info.dar,title:a.Title};
}


function cropFinalKey(asset, crop) {
  const st=fs.statSync(asset.SourcePath);
  return sha(JSON.stringify({
    source:asset.SourcePath,size:st.size,mtime:st.mtimeMs,
    crop:[crop.left,crop.right,crop.top,crop.bottom],
    profile:'crop-final-v2|618x480|sar-safe|same-as-studio-preview'
  }));
}

async function renderCropFinalReference(cartId, slotId, proposed) {
  const cart=getCart(cartId), manifest=getManifest(cart), draft=loadDraft(cart,manifest), registry=getRegistry(), regMap=assetMap(registry);
  const m=manifest.find(x=>x.SlotID===slotId), d=draft.slots[slotId];
  if(!m||!d) throw new Error(`Unknown slot: ${slotId}`);
  const a=effectiveAsset(m,d,regMap);
  if(!fs.existsSync(a.SourcePath)) throw new Error(`Missing source: ${a.SourcePath}`);

  const info=await ffprobeVideoInfo(a.SourcePath);
  const crop={
    left:int(proposed?.left), right:int(proposed?.right),
    top:int(proposed?.top), bottom:int(proposed?.bottom)
  };
  if(crop.left+crop.right>=info.width || crop.top+crop.bottom>=info.height){
    throw new Error(`Invalid crop for ${info.width}x${info.height} source.`);
  }

  const key=cropFinalKey(a,crop), out=path.join(CROP_FINAL_ROOT,`${key}.jpg`);
  if(!fs.existsSync(out)){
    const seek=info.duration>1 ? Math.max(0.25,Math.min(info.duration-0.25,info.duration*0.25)) : 0;
    const cropW=crop.left+crop.right, cropH=crop.top+crop.bottom;
    const vfParts=[];
    if(cropW+cropH>0){
      vfParts.push(`crop=iw-${cropW}:ih-${cropH}:${crop.left}:${crop.top}`);
    }
    // SAME geometry as Render-StudioPreview.ps1:
    // crop original coded pixels, correct source pixel aspect, then fit the TV.
    vfParts.push("scale='max(2,trunc(iw*sar/2)*2)':ih");
    vfParts.push('setsar=1');
    vfParts.push('scale=618:480:force_original_aspect_ratio=decrease:force_divisible_by=2');
    vfParts.push('pad=618:480:(ow-iw)/2:(oh-ih)/2:black');
    vfParts.push('setsar=1');

    const r=await run('ffmpeg',[
      '-hide_banner','-loglevel','error','-nostdin','-y',
      '-ss',String(seek),'-i',a.SourcePath,
      '-frames:v','1',
      '-vf',vfParts.join(','),
      '-q:v','2',
      out
    ]);
    if(r.code!==0 || !fs.existsSync(out)){
      try{fs.unlinkSync(out)}catch(_){}
      throw new Error(`Could not render exact crop result for ${a.Title}: ${r.err || r.out}`);
    }
  }
  return {file:out,width:618,height:480,title:a.Title};
}

async function cropDetect(source) {
  const duration = await ffprobeDuration(source);
  const probes = duration <= 12 ? [[Math.max(.3,duration*.15),Math.max(2,Math.min(6,duration*.65))]] : [.18,.5,.82].map(f => [Math.max(1,Math.min(duration-5,duration*f)),Math.min(5,Math.max(2,duration-Math.max(1,Math.min(duration-5,duration*f))-.2))]);
  const dim = await run('ffprobe',['-v','error','-select_streams','v:0','-show_entries','stream=width,height','-of','csv=p=0:s=x',source]);
  const dm=String(dim.out).trim().match(/^(\d+)x(\d+)$/); if(!dm) throw new Error('Could not read video dimensions');
  const W=Number(dm[1]),H=Number(dm[2]), counts=new Map();
  for (const [s,l] of probes) {
    const r=await run('ffmpeg',['-hide_banner','-loglevel','info','-nostdin','-ss',String(s),'-i',source,'-t',String(l),'-vf','cropdetect=limit=24:round=2:reset=0','-an','-f','null','NUL']);
    const txt=r.err+'\n'+r.out; const re=/crop=(\d+):(\d+):(\d+):(\d+)/g; let m;
    while((m=re.exec(txt))) { const k=`${m[1]}:${m[2]}:${m[3]}:${m[4]}`; counts.set(k,(counts.get(k)||0)+1); }
  }
  if(!counts.size) return {left:0,right:0,top:0,bottom:0,message:'No meaningful crop detected'};
  const [best]=[...counts.entries()].sort((a,b)=>b[1]-a[1])[0]; const [w,h,x,y]=best.split(':').map(Number);
  return {left:x,right:Math.max(0,W-(x+w)),top:y,bottom:Math.max(0,H-(y+h)),message:`Detected ${w}x${h} inside ${W}x${H}`};
}

function viewState(cartId) {
  const cart=getCart(cartId), manifest=getManifest(cart), draft=loadDraft(cart,manifest), registry=getRegistry(), regMap=assetMap(registry), assignments=getAssignments();
  const clips=manifest.map(m=>{
    const d=draft.slots[m.SlotID], a=regMap[d.assetId] || regMap[m.AssetID];
    const changed=d.assetId!==m.AssetID || num(d.trimStartSeconds)!==num(m.TrimStartSeconds) || num(d.trimEndSeconds)!==num(m.TrimEndSeconds) || int(d.cropLeft)!==int(m.CropLeft) || int(d.cropRight)!==int(m.CropRight) || int(d.cropTop)!==int(m.CropTop) || int(d.cropBottom)!==int(m.CropBottom) || normalizeAudio(d.audioRepair)!==normalizeAudio(m.AudioRepair) || d.action!==(m.ReviewStatus||'UNREVIEWED');
    return {
      position:m.Position,slotId:m.SlotID,role:m.Role,baseAssetId:m.AssetID,assetId:d.assetId,
      title:a?.Title || m.Title,baseTitle:m.Title,sourcePath:a?.SourcePath || m.SourcePath,pool:m.Pool,network:m.Network,series:(a?.AssetType==='EPISODE'?(a?.Subtype||m.Series):m.Series)||'',
      action:d.action||'UNREVIEWED',notes:d.notes||'',trimStartSeconds:num(d.trimStartSeconds),trimEndSeconds:num(d.trimEndSeconds),
      cropLeft:int(d.cropLeft),cropRight:int(d.cropRight),cropTop:int(d.cropTop),cropBottom:int(d.cropBottom),audioRepair:normalizeAudio(d.audioRepair),
      base:{trimStartSeconds:num(m.TrimStartSeconds),trimEndSeconds:num(m.TrimEndSeconds),cropLeft:int(m.CropLeft),cropRight:int(m.CropRight),cropTop:int(m.CropTop),cropBottom:int(m.CropBottom),audioRepair:normalizeAudio(m.AudioRepair)},
      changed,candidates:availableCandidates(m,registry,assignments,manifest,draft).map(x=>({assetId:x.AssetID,title:x.Title,type:x.AssetType,subtype:x.Subtype,pool:x.Pool,network:x.Network,duration:num(x.DurationSeconds),series:x.CandidateSeries||'',group:x.CandidateGroup||'DEFAULT'}))
    };
  });
  return {cart:{cartId:cart.CartID,revision:Number(cart.CurrentRevision),displayName:cart.DisplayName,network:cart.Network},audioLevels:AUDIO_LEVELS,clips};
}

function patchSlot(cartId, slotId, patch) {
  const cart=getCart(cartId), manifest=getManifest(cart), draft=loadDraft(cart,manifest), d=draft.slots[slotId];
  if(!d) throw new Error(`Unknown slot: ${slotId}`);
  const allowed=['assetId','action','notes','trimStartSeconds','trimEndSeconds','cropLeft','cropRight','cropTop','cropBottom','audioRepair'];
  if(Object.prototype.hasOwnProperty.call(patch,'assetId') && patch.assetId && patch.assetId !== d.assetId){
    const finding=String(d.action||'').toUpperCase();
    if(['BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE'].includes(finding)){
      if(!Array.isArray(d.rejected)) d.rejected=[];
      d.rejected.push({assetId:d.assetId,action:finding,notes:d.notes||'',utc:nowIso()});
    }
  }
  for(const k of allowed) if(Object.prototype.hasOwnProperty.call(patch,k)) d[k]=patch[k];
  d.trimStartSeconds=Math.max(0,num(d.trimStartSeconds)); d.trimEndSeconds=Math.max(0,num(d.trimEndSeconds));
  d.cropLeft=int(d.cropLeft);d.cropRight=int(d.cropRight);d.cropTop=int(d.cropTop);d.cropBottom=int(d.cropBottom);d.audioRepair=normalizeAudio(d.audioRepair);
  saveDraft(draft); return d;
}

function resetSlot(cartId, slotId, what) {
  const cart=getCart(cartId), manifest=getManifest(cart), draft=loadDraft(cart,manifest), m=manifest.find(x=>x.SlotID===slotId), d=draft.slots[slotId];
  if(!m||!d) throw new Error(`Unknown slot: ${slotId}`);
  if(what==='audio') d.audioRepair='NONE';
  else if(what==='crop') {d.cropLeft=0;d.cropRight=0;d.cropTop=0;d.cropBottom=0;}
  else if(what==='trim') {d.trimStartSeconds=0;d.trimEndSeconds=0;}
  else if(what==='replacement') {d.assetId=m.AssetID; d.trimStartSeconds=num(m.TrimStartSeconds);d.trimEndSeconds=num(m.TrimEndSeconds);d.cropLeft=int(m.CropLeft);d.cropRight=int(m.CropRight);d.cropTop=int(m.CropTop);d.cropBottom=int(m.CropBottom);d.audioRepair=normalizeAudio(m.AudioRepair);d.rejected=[];}
  else if(what==='all') Object.assign(d,newDraft(cart,[m]).slots[slotId]);
  saveDraft(draft); return d;
}

function commitDraft(cartId) {
  const carts=getCarts(), cart=carts.find(c=>c.CartID===cartId); if(!cart) throw new Error(`Unknown cart: ${cartId}`);
  const oldRev=Number(cart.CurrentRevision), manifest=getManifest(cart), draft=loadDraft(cart,manifest);
  if(draft.baseRevision!==oldRev || draft.baseManifestPath!==cart.ManifestPath) throw new Error('Cart changed after Studio opened. Reload Studio before committing.');
  const registry=getRegistry(), regMap=assetMap(registry), assignments=getAssignments();
  const cols=['Position','SlotID','Role','AssetID','AssetType','AssetSubtype','Title','Series','Pool','Network','SourcePath','DurationSeconds','ReusePolicy','ReviewStatus','TrimStartSeconds','TrimEndSeconds','CropLeft','CropRight','CropTop','CropBottom','AudioRepair'];
  const newManifest=manifest.map(m=>{
    const d=draft.slots[m.SlotID]; if(!d) return m;
    const a=regMap[d.assetId]; if(!a) throw new Error(`Missing registry asset ${d.assetId}`);
    const replacing=d.assetId!==m.AssetID;
    return {
      Position:m.Position,SlotID:m.SlotID,Role:m.Role,AssetID:a.AssetID,AssetType:a.AssetType,AssetSubtype:a.Subtype,
      Title:a.Title,Series:(a.AssetType==='EPISODE'?(a.Subtype||m.Series):m.Series),Pool:(a.Pool||m.Pool),Network:(a.Network||m.Network),SourcePath:a.SourcePath,DurationSeconds:a.DurationSeconds,
      ReusePolicy:a.ReusePolicy,ReviewStatus:d.action||'UNREVIEWED',TrimStartSeconds:String(num(d.trimStartSeconds)),TrimEndSeconds:String(num(d.trimEndSeconds)),
      CropLeft:String(int(d.cropLeft)),CropRight:String(int(d.cropRight)),CropTop:String(int(d.cropTop)),CropBottom:String(int(d.cropBottom)),AudioRepair:normalizeAudio(d.audioRepair)
    };
  });
  const changed=newManifest.filter((n,i)=>JSON.stringify(n)!==JSON.stringify({...manifest[i],...Object.fromEntries(cols.filter(c=>manifest[i][c]===undefined).map(c=>[c,'']))}));
  // Compare key fields explicitly instead of relying on object shape.
  const actualChanges=[];
  for(let i=0;i<manifest.length;i++){
    const o=manifest[i],n=newManifest[i];
    if(['AssetID','ReviewStatus','TrimStartSeconds','TrimEndSeconds','CropLeft','CropRight','CropTop','CropBottom','AudioRepair'].some(k=>String(o[k]??'')!==String(n[k]??''))) actualChanges.push({SlotID:n.SlotID,OldAssetID:o.AssetID,NewAssetID:n.AssetID,ReviewStatus:n.ReviewStatus,TrimStartSeconds:n.TrimStartSeconds,TrimEndSeconds:n.TrimEndSeconds,CropLeft:n.CropLeft,CropRight:n.CropRight,CropTop:n.CropTop,CropBottom:n.CropBottom,AudioRepair:n.AudioRepair});
  }
  if(!actualChanges.length) throw new Error('Nothing changed in the Studio draft.');

  // Preserve source-health knowledge while Studio uses absolute draft recipes.
  // A repaired source stays excluded from raw automatic reuse, and rejected
  // BAD_QUALITY / DUPLICATE assets remain globally excluded.
  const statusPriority={READY:0,NEEDS_CLIPPED:10,NEEDS_CROP:20,BAD_AUDIO:30,BAD_QUALITY:40,DUPLICATE:50};
  const setSourceStatus=(assetId,status,note='')=>{
    const a=regMap[assetId]; if(!a)return;
    const old=String(a.SourceStatus||'READY').toUpperCase();
    if((statusPriority[status]??0) >= (statusPriority[old]??0)) a.SourceStatus=status;
    if(note) a.UserNotes=note;
  };
  for(const m of manifest){
    const d=draft.slots[m.SlotID]; if(!d)continue;
    for(const r of (Array.isArray(d.rejected)?d.rejected:[])){
      if(['BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE'].includes(r.action)) setSourceStatus(r.assetId,r.action,r.notes||'');
    }
    const finalAsset=d.assetId;
    if(normalizeAudio(d.audioRepair)!=='NONE') setSourceStatus(finalAsset,'BAD_AUDIO',d.notes||'');
    else if(int(d.cropLeft)+int(d.cropRight)+int(d.cropTop)+int(d.cropBottom)>0) setSourceStatus(finalAsset,'NEEDS_CROP',d.notes||'');
    else if(num(d.trimStartSeconds)>0||num(d.trimEndSeconds)>0) setSourceStatus(finalAsset,'NEEDS_CLIPPED',d.notes||'');
    else if(['BAD_QUALITY','BAD_AUDIO','NEEDS_CLIPPED','NEEDS_CROP','DUPLICATE'].includes(String(d.action||'').toUpperCase())) setSourceStatus(finalAsset,String(d.action).toUpperCase(),d.notes||'');
  }

  const newRev=oldRev+1, revName=`r${String(newRev).padStart(3,'0')}`, newRevDir=path.join(settings.BuildRoot,cartId,revName); fs.mkdirSync(newRevDir,{recursive:true});
  const newManifestPath=path.join(newRevDir,'cart-manifest.csv'); writeCsv(newManifestPath,newManifest,cols);
  writeCsv(settings.RegistryPath,registry,Object.keys(registry[0]||{}));
  const when=nowIso();
  for(const asg of assignments){
    if(asg.CartID===cartId && Number(asg.Revision)===oldRev && ['RESERVED','ACTIVE'].includes(asg.AssignmentStatus)){
      const ns=newManifest.find(x=>x.SlotID===asg.SlotID);
      asg.AssignmentStatus=(ns&&ns.AssetID===asg.AssetID)?'SUPERSEDED':'RELEASED'; asg.ReleasedUtc=when; asg.ReleaseReason=(asg.AssignmentStatus==='SUPERSEDED')?`Carried forward to ${revName}`:`Replaced in ${revName}`;
    }
  }
  for(const m of newManifest) assignments.push({AssignmentID:stableId('ASG',`${cartId}|${newRev}|${m.SlotID}|${m.AssetID}`),CartID:cartId,Revision:String(newRev),SlotID:m.SlotID,AssetID:m.AssetID,AssignmentStatus:'RESERVED',AssignedUtc:when,ReleasedUtc:'',ReleaseReason:''});
  writeCsv(settings.AssignmentPath,assignments,['AssignmentID','CartID','Revision','SlotID','AssetID','AssignmentStatus','AssignedUtc','ReleasedUtc','ReleaseReason']);
  for(const c of carts){if(c.CartID===cartId){c.CurrentRevision=String(newRev);c.Status='DRAFT';c.UpdatedUtc=when;c.ManifestPath=newManifestPath;}}
  writeCsv(settings.CartRegistryPath,carts,['CartID','CurrentRevision','Status','Network','DisplayName','CreatedUtc','UpdatedUtc','ManifestPath']);
  writeCsv(path.join(newRevDir,'changes-from-studio.csv'),actualChanges,['SlotID','OldAssetID','NewAssetID','ReviewStatus','TrimStartSeconds','TrimEndSeconds','CropLeft','CropRight','CropTop','CropBottom','AudioRepair']);
  return {revision:newRev,manifestPath:newManifestPath,changes:actualChanges.length};
}


async function listDrives() {
  // Do not auto-select anything in the UI. Return mounted removable/fixed
  // volumes so the user must deliberately choose the cartridge target.
  const ps = [
    "$ErrorActionPreference='Stop'",
    "$rows=@(Get-CimInstance Win32_LogicalDisk | Where-Object { $_.DriveType -in 2,3 -and $_.DeviceID } | ForEach-Object {",
    "  [pscustomobject]@{ device=$_.DeviceID; label=[string]$_.VolumeName; filesystem=[string]$_.FileSystem; free=[int64]$_.FreeSpace; size=[int64]$_.Size; driveType=[int]$_.DriveType }",
    "})",
    "@($rows) | ConvertTo-Json -Compress"
  ].join('; ');
  const r = await run('powershell.exe',['-NoProfile','-Command',ps],{});
  if (r.code !== 0) throw new Error(`Could not enumerate drives: ${r.err || r.out}`);
  let rows=[];
  const raw=String(r.out||'').trim();
  if(raw){
    const parsed=JSON.parse(raw.replace(/^\uFEFF/,''));
    rows=Array.isArray(parsed)?parsed:[parsed];
  }
  return rows.map(x=>({
    drive:`${String(x.device||'').toUpperCase()}\\`,
    label:String(x.label||''),
    filesystem:String(x.filesystem||''),
    free:Number(x.free||0),
    size:Number(x.size||0),
    type:Number(x.driveType)===2?'REMOVABLE':'FIXED'
  })).filter(x=>/^[A-Z]:\\$/.test(x.drive))
    .sort((a,b)=>(a.type==='REMOVABLE'?0:1)-(b.type==='REMOVABLE'?0:1)||a.drive.localeCompare(b.drive));
}

function assertFinalReady(cartId) {
  const state=viewState(cartId);
  const changed=state.clips.filter(c=>c.changed);
  if(changed.length){
    throw new Error(`${changed.length} Studio draft change(s) are not committed. Commit the draft before building the final cartridge.`);
  }
  const notGood=state.clips.filter(c=>String(c.action||'').toUpperCase()!=='GOOD');
  if(notGood.length){
    const sample=notGood.slice(0,5).map(c=>`${c.position} ${c.title} [${c.action}]`).join('\n');
    throw new Error(`${notGood.length} clip(s) are not marked GOOD. Finish review before building the cartridge.${sample?`\n\n${sample}`:''}`);
  }
  return state;
}

async function buildFinal(cartId,targetDrive='') {
  assertFinalReady(cartId);
  const ps=path.join(TOOLKIT_DIR,'Build-RetroCartFinal.ps1');
  const args=['-NoProfile','-ExecutionPolicy','Bypass','-File',ps,'-CartID',cartId,'-SystemRoot',SYSTEM_ROOT,'-Force'];

  if(targetDrive){
    const normalized=String(targetDrive).toUpperCase();
    if(!/^[A-Z]:\\$/.test(normalized)) throw new Error(`Invalid target drive: ${targetDrive}`);
    const drives=await listDrives();
    const selected=drives.find(d=>d.drive===normalized);
    if(!selected) throw new Error(`Selected drive is no longer mounted: ${normalized}`);
    args.push('-TargetDrive',normalized);
  }

  const r=await run('powershell.exe',args,{});
  if(r.code!==0) throw new Error((r.out+'\n'+r.err).trim()||`Final build failed with exit ${r.code}.`);
  return {code:r.code,output:(r.out+'\n'+r.err).trim(),targetDrive:targetDrive||''};
}

function json(res,status,obj){const b=Buffer.from(JSON.stringify(obj));res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Content-Length':b.length,'Cache-Control':'no-store'});res.end(b);}
async function body(req){let s='';for await(const ch of req)s+=ch;return s?JSON.parse(s):{};}
function serveFile(res,file,type){const b=fs.readFileSync(file);res.writeHead(200,{'Content-Type':type,'Content-Length':b.length,'Cache-Control':'no-store'});res.end(b);}
function serveVideo(req,res,file){
  if(!fs.existsSync(file)){res.writeHead(404);return res.end();}
  const stat=fs.statSync(file), range=req.headers.range;
  if(range){const m=/bytes=(\d+)-(\d*)/.exec(range);const start=m?Number(m[1]):0;const end=m&&m[2]?Number(m[2]):stat.size-1;const chunk=end-start+1;res.writeHead(206,{'Content-Range':`bytes ${start}-${end}/${stat.size}`,'Accept-Ranges':'bytes','Content-Length':chunk,'Content-Type':'video/mp4','Cache-Control':'no-store'});fs.createReadStream(file,{start,end}).pipe(res);}
  else{res.writeHead(200,{'Content-Length':stat.size,'Content-Type':'video/mp4','Accept-Ranges':'bytes','Cache-Control':'no-store'});fs.createReadStream(file).pipe(res);}
}

let previewByToken=new Map();
let cropFrameByToken=new Map();
let cropFinalByToken=new Map();
const server=http.createServer(async(req,res)=>{
  try{
    const u=new URL(req.url,`http://${req.headers.host}`);
    if(req.method==='GET'&&u.pathname==='/'){return serveFile(res,path.join(__dirname,'index.html'),'text/html; charset=utf-8');}
    if(req.method==='GET'&&u.pathname==='/api/carts'){return json(res,200,{carts:getCarts().map(c=>({cartId:c.CartID,revision:Number(c.CurrentRevision),displayName:c.DisplayName,network:c.Network})),initialCart:INITIAL_CART});}
    if(req.method==='GET'&&u.pathname==='/api/state'){return json(res,200,viewState(u.searchParams.get('cart')||INITIAL_CART));}
    if(req.method==='POST'&&u.pathname==='/api/slot'){const b=await body(req);return json(res,200,{slot:patchSlot(b.cartId,b.slotId,b.patch||{})});}
    if(req.method==='POST'&&u.pathname==='/api/reset'){const b=await body(req);return json(res,200,{slot:resetSlot(b.cartId,b.slotId,b.what)});}
    if(req.method==='POST'&&u.pathname==='/api/render'){const b=await body(req);const file=await renderPreview(b.cartId,b.slotId);const token=sha(file+Date.now()+Math.random());previewByToken.set(token,file);return json(res,200,{url:`/media/${token}`});}
    if(req.method==='GET'&&u.pathname==='/api/render-status'){return json(res,200,publicRenderStatus(u.searchParams.get('cart')||INITIAL_CART,u.searchParams.get('slot')||''));}
    if(req.method==='GET'&&u.pathname.startsWith('/media/')){const token=u.pathname.slice('/media/'.length),file=previewByToken.get(token);if(!file){res.writeHead(404);return res.end();}return serveVideo(req,res,file);}
    if(req.method==='POST'&&u.pathname==='/api/cropdetect'){const b=await body(req);const cart=getCart(b.cartId),manifest=getManifest(cart),draft=loadDraft(cart,manifest),regMap=assetMap(getRegistry()),m=manifest.find(x=>x.SlotID===b.slotId),d=draft.slots[b.slotId],a=effectiveAsset(m,d,regMap);return json(res,200,await cropDetect(a.SourcePath));}
    if(req.method==='POST'&&u.pathname==='/api/crop-reference'){const b=await body(req);const ref=await renderCropReference(b.cartId,b.slotId);const token=sha(ref.file+Date.now()+Math.random());cropFrameByToken.set(token,ref.file);return json(res,200,{url:`/crop-media/${token}`,width:ref.width,height:ref.height,sar:ref.sar,dar:ref.dar,title:ref.title});}
    if(req.method==='GET'&&u.pathname.startsWith('/crop-media/')){const token=u.pathname.slice('/crop-media/'.length),file=cropFrameByToken.get(token);if(!file){res.writeHead(404);return res.end();}return serveFile(res,file,'image/jpeg');}
    if(req.method==='POST'&&u.pathname==='/api/crop-final-reference'){const b=await body(req);const ref=await renderCropFinalReference(b.cartId,b.slotId,b.crop||{});const token=sha(ref.file+Date.now()+Math.random());cropFinalByToken.set(token,ref.file);return json(res,200,{url:`/crop-final-media/${token}`,width:ref.width,height:ref.height,title:ref.title});}
    if(req.method==='GET'&&u.pathname.startsWith('/crop-final-media/')){const token=u.pathname.slice('/crop-final-media/'.length),file=cropFinalByToken.get(token);if(!file){res.writeHead(404);return res.end();}return serveFile(res,file,'image/jpeg');}
    if(req.method==='POST'&&u.pathname==='/api/commit'){const b=await body(req);return json(res,200,commitDraft(b.cartId));}
    if(req.method==='POST'&&u.pathname==='/api/build-review'){const b=await body(req);const ps=path.join(TOOLKIT_DIR,'Build-RetroCartReview.ps1');const r=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',ps,'-CartID',b.cartId,'-SystemRoot',SYSTEM_ROOT],{});return json(res,r.code===0?200:500,{code:r.code,output:r.out+"\n"+r.err});}
    if(req.method==='POST'&&u.pathname==='/api/open-review'){const b=await body(req);const ps=path.join(TOOLKIT_DIR,'Open-RetroCart.ps1');const r=await run('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',ps,'-CartID',b.cartId,'-SystemRoot',SYSTEM_ROOT],{});return json(res,r.code===0?200:500,{code:r.code,output:r.out+"\n"+r.err});}
    if(req.method==='GET'&&u.pathname==='/api/drives'){return json(res,200,{drives:await listDrives()});}
    if(req.method==='POST'&&u.pathname==='/api/build-final'){const b=await body(req);return json(res,200,await buildFinal(b.cartId,b.targetDrive||''));}
    res.writeHead(404);res.end('Not found');
  }catch(e){console.error(e);json(res,500,{error:e.message||String(e)});}
});

server.listen(PORT,'127.0.0.1',()=>{
  console.log(`Retro TV Cart Studio listening on http://127.0.0.1:${PORT}/`);
  console.log(`Settings: ${SETTINGS_PATH}`);
  if(INITIAL_CART) console.log(`Cart: ${INITIAL_CART}`);
});
