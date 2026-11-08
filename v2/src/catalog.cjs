// Project-local network/show organization. Never writes to media libraries.
const fs = require('node:fs/promises');
const path = require('node:path');
const { randomUUID } = require('node:crypto');
const { within } = require('./projects.cjs');
const empty = () => ({ schemaVersion: 1, networks: [], shows: [] });
function label(value, field, max = 100) {
  if (typeof value !== 'string' || !value.trim() || value.length > max) throw Error(`${field} must contain 1–${max} characters.`);
  return value.trim();
}
function artworkPath(value) {
  return value === null || (typeof value === 'string' && /^artwork\/(networks|shows)\/[0-9a-f-]+\.(png|jpg|webp)$/.test(value));
}
function validate(c) {
  if (c?.schemaVersion !== 1 || !Array.isArray(c.networks) || !Array.isArray(c.shows)) throw Error('Unsupported organization data. Nothing has been changed.');
  const ids = new Set();
  for (const [kind, rows] of [['networks', c.networks], ['shows', c.shows]]) {
    const names = new Set(), shorts = new Set();
    for (const row of rows) {
      if (!row || typeof row.id !== 'string' || !/^[0-9a-f-]{36}$/.test(row.id) || ids.has(row.id)) throw Error('Invalid or duplicate organization ID.');
      ids.add(row.id);
      const name = label(row.name, 'Name').toLowerCase();
      if (names.has(name)) throw Error('That name is already in use.');
      names.add(name);
      if (!artworkPath(row.artwork)) throw Error('Invalid artwork reference.');
      if (kind === 'networks') {
        const short = label(row.shortName, 'Short name', 16).toLowerCase();
        if (shorts.has(short)) throw Error('That network short name is already in use.');
        shorts.add(short);
      } else {
        if (!Array.isArray(row.networkIds) || new Set(row.networkIds).size !== row.networkIds.length || row.networkIds.some(id => !c.networks.some(n => n.id === id))) throw Error('Show refers to an unknown or duplicate network.');
      }
    }
  }
  return c;
}
async function safeDir(root, relative, create = false) {
  root = await fs.realpath(root);
  const target = path.join(root, relative);
  // Follow each existing ancestor before creating anything, so a junction cannot
  // redirect an app-owned directory into a source library or another project.
  let dir = root;
  for (const part of relative.split('/').filter(Boolean)) {
    dir = path.join(dir, part);
    try { const real = await fs.realpath(dir); if (!within(root, real)) throw Error('Project folder points outside the project.'); }
    catch (e) { if (e.code !== 'ENOENT') throw e; if (create) await fs.mkdir(dir); else throw e; }
  }
  return target;
}
async function read(root) {
  try {
    const data = await safeDir(root, 'data');
    const file = path.join(data, 'organization.json');
    const stat = await fs.lstat(file);
    if (stat.isSymbolicLink()) throw Error('Organization file must not be a link.');
    return validate(JSON.parse(await fs.readFile(file, 'utf8')));
  } catch (e) { if (e.code === 'ENOENT') return empty(); throw e; }
}
function image(buffer) {
  if (buffer.length > 15 * 1024 * 1024) throw Error('Artwork must be 15 MB or smaller.');
  if (buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10]))) return { ext: 'png', mime: 'image/png' };
  if (buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255) return { ext: 'jpg', mime: 'image/jpeg' };
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return { ext: 'webp', mime: 'image/webp' };
  throw Error('Choose a PNG, JPEG, or WebP image.');
}
async function loadImage(file) {
  const stat = await fs.stat(file); if (stat.size > 15 * 1024 * 1024) throw Error('Artwork must be 15 MB or smaller.');
  const buffer = await fs.readFile(file); return { buffer, ...image(buffer) };
}
async function write(root, c) {
  validate(c);
  const dir = await safeDir(root, 'data', true), file = path.join(dir, 'organization.json');
  const tmp = path.join(dir, `organization.${randomUUID()}.tmp`);
  try {
    try { await fs.copyFile(file, path.join(dir, `organization-backup-${randomUUID()}.json`), fs.constants.COPYFILE_EXCL); }
    catch(e) { if (e.code !== 'ENOENT') throw e; }
    await fs.writeFile(tmp, JSON.stringify(c, null, 2) + '\n', { flag: 'wx' });
    await fs.rename(tmp, file);
  } finally { await fs.rm(tmp, { force: true }); }
}
async function save(root, kind, input, selectedImage = null) {
  if (!['networks', 'shows'].includes(kind)) throw Error('Unknown organization type.');
  const c = await read(root), previous = c[kind].find(r => r.id === input.id);
  if (input.id && !previous) throw Error('This entry no longer exists.');
  const record = { id: previous?.id || randomUUID(), name: label(input.name, 'Name'), artwork: previous?.artwork || null };
  if (kind === 'networks') record.shortName = label(input.shortName, 'Short name', 16);
  else { if (!Array.isArray(input.networkIds)) throw Error('Choose networks from the list.'); record.networkIds = [...input.networkIds]; }
  if (input.removeArtwork) record.artwork = null;
  if (previous) c[kind][c[kind].findIndex(r => r.id === previous.id)] = record; else c[kind].push(record);
  validate(c); // Validate names and relationships before copying an image.
  let created;
  try {
    if (selectedImage) {
      const info = image(selectedImage.buffer);
      const dir = await safeDir(root, `artwork/${kind}`, true);
      const filename = `${randomUUID()}.${info.ext}`;
      created = path.join(dir, filename);
      await fs.writeFile(created, selectedImage.buffer, { flag: 'wx' });
      record.artwork = `artwork/${kind}/${filename}`;
    }
    await write(root, c);
  } catch (e) { if (created) await fs.rm(created, { force: true }); throw e; }
  return c;
}
async function remove(root, kind, id) {
  if (!['networks', 'shows'].includes(kind)) throw Error('Unknown organization type.');
  const c = await read(root);
  if (!c[kind].some(r => r.id === id)) throw Error('Entry no longer exists.');
  c[kind] = c[kind].filter(r => r.id !== id);
  if (kind === 'networks') for (const show of c.shows) show.networkIds = show.networkIds.filter(n => n !== id);
  // Keep imported artwork for recovery through the metadata snapshots.
  await write(root, c); return c;
}
async function view(root) {
  const c = await read(root); const previews = {};
  for (const row of [...c.networks, ...c.shows]) if (row.artwork) {
    try {
      const resolved = await fs.realpath(path.join(root, row.artwork));
      if (!within(await fs.realpath(root), resolved)) throw Error('Invalid artwork path.');
      const info = await loadImage(resolved); previews[row.id] = `data:${info.mime};base64,${info.buffer.toString('base64')}`;
    } catch { previews[row.id] = null; }
  }
  return { ...c, previews };
}
module.exports = { read, save, remove, view, loadImage, validate, safeDir };
