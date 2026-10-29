(function (root, factory) {
  'use strict';
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./demo-data.js'));
  else {
    Object.assign(root.RetroLibraryDemo, factory(root.RetroLibraryDemo.data));
    root.RetroLibraryDemo.mount(root.document.getElementById('rl-demo'), {document:root.document, protocol:root.location.protocol});
  }
}(typeof window !== 'undefined' ? window : globalThis, function (data) {
  'use strict';
  const copy = value => JSON.parse(JSON.stringify(value));
  function createModel(scenario = 'Populated') {
    const m = {scenario, assets: [], locations: [], drafts: {}, jobs: [], groups: [], selected: new Set()};
    m.asset = id => m.assets.find(a => a.id === id);
    const metadata = a => Object.fromEntries(['name','category','subtype','network','notes','reason','health','show','pool','date','availableFrom','availableTo','family','sourceId','variantOf'].map(k => [k, copy(a[k])]));
    m.draft = (id, kind, values) => {
      m.drafts[id] ||= {};
      m.drafts[id][kind] = Object.assign(m.drafts[id][kind] || (kind === 'metadata' ? metadata(m.asset(id)) : copy(m.asset(id).recipe)), copy(values));
      return m.drafts[id][kind];
    };
    m.view = (id, kind) => copy(m.drafts[id]?.[kind] || (kind === 'metadata' ? metadata(m.asset(id)) : m.asset(id).recipe));
    m.saveMetadata = (id, values) => {
      const v = values || m.view(id, 'metadata');
      if (v.health && v.health !== m.asset(id).health && !v.reason?.trim()) throw Error('Give a reason for this source-health decision.');
      if (v.availableFrom && v.availableTo && v.availableFrom > v.availableTo) throw Error('Availability end must be on or after start.');
      if (v.date) {
        const d = v.date;
        if (d.mode === 'Year' && !/^\d{4}$/.test(d.value)) throw Error('Year requires four digits.');
        if (d.mode === 'Range' && (!/^\d{4}–\d{4}$/.test(d.value) || d.value.slice(0,4) > d.value.slice(5))) throw Error('Range requires YYYY–YYYY, start before end.');
        if (d.mode === 'Exact date' && (!/^\d{4}-\d{2}-\d{2}$/.test(d.value) || !Number.isFinite(Date.parse(d.value)) || new Date(d.value).toISOString().slice(0,10) !== d.value)) throw Error('Exact date requires a valid YYYY-MM-DD.');
        if (d.mode === 'Unknown') d.value = '';
      }
      Object.assign(m.asset(id), copy(v));
      if (m.drafts[id]) delete m.drafts[id].metadata;
    };
    m.query = (f = {}) => m.assets.filter(a => {
      if (f.search && ![a.name, a.notes, a.show, a.path].join(' ').toLowerCase().includes(f.search.toLowerCase())) return false;
      for (const key of ['category','health','network','locationId']) if (f[key] && a[key] !== f[key]) return false;
      if (f.year) {
        if (a.date.mode === 'Unknown') return !!f.allowUnknown;
        const first = Number(a.date.value.slice(0,4));
        const last = a.date.mode === 'Range' ? Number(a.date.value.slice(5)) : first;
        if (Number(f.year) < first || Number(f.year) > last) return false;
      }
      return true;
    }).sort((a,b) => (f.sort === 'Health' ? a.health.localeCompare(b.health) : a.name.localeCompare(b.name)) * (f.sort === 'Name Z–A' ? -1 : 1));
    m.saveRecipe = id => {
      const r = m.view(id, 'recipe');
      if (![r.trimStart, r.trimEnd].every(x => Number.isFinite(x) && x >= 0) || r.trimStart + r.trimEnd >= m.asset(id).technical.duration) throw Error('Trim must leave positive sample duration.');
      if (!Object.values(r.crop).every(x => Number.isFinite(x) && x >= 0 && x <= 40)) throw Error('Crop edges must be 0–40% in this layout illustration.');
      r.revision = m.asset(id).recipe.revision + 1;
      m.asset(id).recipe = r;
      if (m.drafts[id]) delete m.drafts[id].recipe;
    };
    m.prepare = id => {
      const job = {id: 'demo-job-' + (m.jobs.length + 1), assetId: id, state: 'Queued', stage: 'Waiting for design-review action', currentItem: m.asset(id).name, count: 1, input: 'ORIGINAL', snapshot: JSON.stringify(m.view(id, 'recipe'))};
      m.jobs.push(job); return job;
    };
    const groupSnapshot = group => JSON.stringify(group ? {definition:group, recipes:group.parts.map(id => m.asset(id) ? m.view(id,'recipe') : null)} : null);
    const groupInputs = group => ({groupId:group.id, assetId:group.parts[0], sourceIds:[...group.parts], count:group.parts.length, currentItem:group.name + ' / first constituent: ' + m.asset(group.parts[0]).name, snapshot:groupSnapshot(group)});
    const preparationGroup = groupId => {
      const group = m.groups.find(g => g.id === groupId);
      if (!group || group.parts.some(id => !m.asset(id) || m.asset(id).recipe.revision !== group.pins[id] || m.drafts[id]?.recipe)) throw Error('Composite pins are stale or a recipe draft is unsaved. Save constituent recipes, then explicitly edit/save the group definition to update pins.');
      return group;
    };
    m.prepareGroup = groupId => {
      const group = preparationGroup(groupId);
      const j = m.prepare(group.parts[0]);
      Object.assign(j, groupInputs(group));
      return j;
    };
    const currentSnapshot = j => j.groupId ? groupSnapshot(m.groups.find(g => g.id === j.groupId)) : JSON.stringify(m.view(j.assetId,'recipe'));
    m.stepJob = (id, action) => {
      const j = m.jobs.find(x => x.id === id);
      if (![j.assetId,...(j.sourceIds || [])].every(id => m.asset(id))) return j;
      if (action === 'run' && j.state === 'Queued') { j.state = 'Running'; j.stage = 'Replaceable preview layout'; }
      if (action === 'fail' && ['Running','Queued'].includes(j.state)) {j.state = 'Failed'; j.stage = 'Sample decoder failure. Recipe retained; retry or relink.';}
      if (action === 'retry' && ['Failed','Cancelled','Stale ignored'].includes(j.state)) {
        const inputs = j.groupId ? groupInputs(preparationGroup(j.groupId)) : {snapshot:currentSnapshot(j)};
        Object.assign(j, inputs, {state:'Queued', stage:'Retry queued (mock)'});
      }
      if (action === 'cancel' && ['Running','Queued'].includes(j.state)) {j.state = 'Cancel requested'; j.stage = 'Awaiting simulated safe stop';}
      if (action === 'confirm-cancel' && j.state === 'Cancel requested') {j.state = 'Cancelled'; j.stage = 'Terminal cancellation (mock)';}
      if (action === 'complete' && ['Running','Queued'].includes(j.state)) {
        j.state = j.snapshot === currentSnapshot(j) ? 'Sample success' : 'Stale ignored';
        j.stage = j.state === 'Stale ignored' ? 'Recipe proposal changed; result not applied' : 'No file or real preview was generated';
      }
      return j;
    };
    m.dependencies = id => {
      const a = m.asset(id);
      const linked = m.assets.filter(x => x.id === id || x.family === a.family || x.variantOf === id || x.sourceId === id);
      const uses = linked.flatMap(x => x.uses.map(u => ({...u, via: x.id})));
      for (const g of m.groups.filter(g => g.parts.includes(id))) uses.push({cart: g.name, state: 'Composite definition', recipe: 'Pinned constituents', via: id});
      for (const x of m.assets.filter(x => x.variantOf === id || x.sourceId === id)) uses.push({cart:x.name, state:'Linked variant / source reference', recipe:x.recipe.revision, via:x.id});
      for (const j of m.jobs.filter(j => [j.assetId,...(j.sourceIds || [])].includes(id) && ['Queued','Running','Cancel requested'].includes(j.state))) uses.push({cart:j.id, state:'Active mock job — cancel before removal', recipe:'job snapshot', via:id});
      return [...new Map(uses.map(u => [u.cart, u])).values()];
    };
    m.removeReference = id => {
      if (m.dependencies(id).length || m.assets.some(a => a.variantOf === id || a.sourceId === id)) return {blocked: true};
      m.assets = m.assets.filter(a => a.id !== id); delete m.drafts[id]; m.selected.delete(id);
      return {blocked: false};
    };
    m.relink = (id, path) => { if (!path.trim()) throw Error('Enter an illustrative replacement path.'); m.asset(id).path = path.trim(); m.asset(id).missing = false; };
    m.setHealth = (id, state, reason) => {
      if (!reason.trim()) throw Error('Give a reason for this explicit source-health decision.');
      Object.assign(m.asset(id), {health: state, reason});
      if (m.drafts[id]?.metadata) Object.assign(m.drafts[id].metadata, {health: state, reason});
    };
    const normalize = p => p.trim().replace(/\\/g, '/').replace(/\/+$/, '').toLowerCase();
    m.addReference = (sourcePath,title,locationId='') => {
      if(!sourcePath.trim() || !title.trim())throw Error('Enter an illustrative source path and an explicit display name.');
      if(m.assets.some(a=>normalize(a.path)===normalize(sourcePath)))throw Error('Media reference already registered in this sample.');
      const id='demo-added-'+(++m.referenceSerial),a=copy(data.seed()[0]);
      Object.assign(a,{id,name:title.trim(),path:sourcePath.trim(),locationId,missing:false,unverified:true,category:'Other',subtype:'OTHER',network:'Unassigned',health:'UNREVIEWED',reason:'New illustrative reference; no source inspection was performed',notes:'',show:'',pool:'',date:{mode:'Unknown',value:''},availableFrom:'',availableTo:'',family:'demo-family-'+id,sourceId:'',variantOf:'',uses:[],legacyType:'ARCHIVE_MISC',legacySubtype:'OTHER',technical:{duration:30,dimensions:'720 × 480',codec:'H.264',sar:'8:9'},recipe:{trimStart:0,trimEnd:0,crop:{left:0,right:0,top:0,bottom:0},audio:'NONE',revision:1}});
      m.assets.push(a);return a;
    };
    m.addLocation = path => {
      if (!path.trim()) throw Error('Enter an illustrative path.');
      if (m.locations.some(l => normalize(l.path) === normalize(path))) throw Error('Location already registered in this sample.');
      const l = {id: 'demo-location-' + (++m.locationSerial), path: path.trim().replace(/\\/g, '/').replace(/\/+$/, ''), scanning: false};
      m.locations.push(l); return l;
    };
    m.scanLocation = id => {m.locations.find(l => l.id === id).scanning = true;};
    m.finishScan = id => {m.locations.find(l => l.id === id).scanning = false;};
    m.removeLocation = id => {
      m.finishScan(id);
      m.locations = m.locations.filter(l => l.id !== id);
    };
    m.relinkLocation = (id, path) => {
      if (!path.trim()) throw Error('Enter an illustrative path.');
      if (m.locations.some(l => l.id !== id && normalize(l.path) === normalize(path))) throw Error('Location already registered in this sample.');
      const l = m.locations.find(l => l.id === id);
      const replacement = path.trim().replace(/\\/g, '/').replace(/\/+$/, '');
      const prefix = l.path.replace(/\\/g, '/').replace(/\/+$/, '') + '/';
      const windows = /^(?:[a-z]:\/|\/\/)/i.test(prefix);
      const moved = m.assets.filter(a => a.locationId === id).map(a => {
        const source = a.path.replace(/\\/g, '/');
        if (!(windows ? source.toLowerCase().startsWith(prefix.toLowerCase()) : source.startsWith(prefix))) throw Error('Associated source path is outside the old location; relink references explicitly first.');
        const relative = source.slice(prefix.length);
        if (relative.split('/').some(part => !part || part === '.' || part === '..' || part.includes(':'))) throw Error('Associated source path has an ambiguous relative reference; relink it explicitly first.');
        return {asset:a, path:replacement + '/' + relative};
      });
      moved.forEach(({asset, path}) => {asset.path = path; asset.missing = false;});
      l.path = replacement;
    };
    m.saveGroup = (name, parts, groupId) => {
      if (!name.trim()) throw Error('Name the sample composite.');
      if (parts.length < 2 || new Set(parts).size !== parts.length || !parts.every(id => m.asset(id)?.category === 'Episode/Show')) throw Error('Choose at least two distinct episode parts.');
      const g = {id: groupId || 'demo-group-' + (m.groups.length + 1), name: name.trim(), parts: [...parts], pins: Object.fromEntries(parts.map(id => [id, m.asset(id).recipe.revision]))};
      const i = m.groups.findIndex(x => x.id === g.id);
      if (i >= 0) m.groups[i] = g; else m.groups.push(g);
      return g;
    };
    m.bulk = (ids, values) => ids.forEach(id => {Object.assign(m.asset(id), copy(values)); if (m.drafts[id]?.metadata) Object.assign(m.drafts[id].metadata, copy(values));});
    m.dirty = () => Object.values(m.drafts).some(d => Object.keys(d).length);
    m.reset = (name, discard = false) => {
      if (m.dirty() && !discard) return false;
      m.scenario = name;
      m.assets = name === 'Empty' ? [] : data.seed();
      m.locations = name === 'Empty' ? [] : [{id: 'demo-location-1', path: 'D:/Example media', scanning: false}];
      m.drafts = {}; m.jobs = []; m.groups = []; m.selected.clear(); m.locationSerial = 1; m.referenceSerial=0;
      if (name === 'Busy' || name === 'Error') {
        const j = m.prepare('demo-audio');
        m.stepJob(j.id, name === 'Busy' ? 'run' : 'fail');
        if (name === 'Busy') m.prepare('demo-part-1');
      }
      return true;
    };
    m.reset(scenario);
    return m;
  }
  function mount(root, options = {}) {
    const doc = options.document || root.ownerDocument;
    const m = createModel();
    let assetId = 'demo-ad', tab = 'properties', pathDraft = 'D:/Example media/New location';
    const filters = {};
    const refs = {};
    function el(tag, text, attrs = {}) {
      const n = doc.createElement(tag);
      if (text !== undefined && text !== null) n.textContent = text;
      Object.entries(attrs).forEach(([k,v]) => n.setAttribute(k,v));
      if (attrs.id) n.setAttribute('data-testid', attrs.id);
      return n;
    }
    function p(text, cls = 'rl-help') {return el('p', text, {class: cls});}
    function button(text, fn, id, cls = '') {
      const n = el('button', text, {type: 'button', class: cls, ...(id ? {id} : {})});
      n.addEventListener('click', fn); return n;
    }
    function field(parent, title, id, value, change, config = {}) {
      const wrap = el('div', null, {class: 'rl-field'});
      const label = el('label', title, {for: id});
      let input;
      if (config.choices) {
        input = el('select', null, {id});
        config.choices.forEach(c => {const option=typeof c==='object'?c:{label:c||'All',value:c};input.append(el('option',option.label,{value:option.value}));});
      } else input = el(config.multiline ? 'textarea' : 'input', null, {id, ...(config.multiline ? {rows: 3} : {type: config.type || 'text'})});
      input.value = value ?? '';
      if (config.min !== undefined) input.setAttribute('min', config.min);
      if (config.max !== undefined) input.setAttribute('max', config.max);
      if (config.type === 'number') input.setAttribute('step', config.step || '1');
      input.addEventListener(config.choices ? 'change' : 'input', () => change(config.type === 'number' ? Number(input.value) : input.value));
      wrap.append(label, input);
      if (config.help) wrap.append(p(config.help));
      parent.append(wrap); return input;
    }
    function actions(parent) {const n = el('div', null, {class: 'rl-actions'}); parent.append(n); return n;}
    function details(parent, title, text) {
      const n = el('details'); n.append(el('summary', title), p(text)); parent.append(n); return n;
    }
    const banner = el('div', 'PHASE 3.1 DESIGN MOCKUP — illustrative sample data — nothing is saved or processed', {class: 'rl-banner'});
    const header = el('header', null, {class: 'rl-header'});
    const brand = el('div'); brand.append(p('RETRO TV / LIBRARY', 'rl-eyebrow'), el('h1', 'Library Manager'));
    const back = el('a', 'Back to live hub', {id: 'back-to-hub', class: 'rl-link-button'});
    const standalone = !['http:','https:'].includes(options.protocol);
    if (standalone) back.hidden = true; else back.setAttribute('href', '/');
    const returnArea = el('div'); returnArea.append(back, p(standalone ? 'Standalone sample · close this tab to return.' : 'Live workspace stays in its original tab.'));
    header.append(brand, returnArea);
    const review = el('section', null, {class: 'rl-review', 'aria-label': 'Design review states'});
    const scenarioSelect = field(review, 'Design review state', 'scenario-select', 'Populated', scenarioChange, {choices: data.scenarios});
    review.append(p('Switching state resets this sample, including saved-in-memory edits and jobs. Reload also resets everything.'));
    const notice = el('p', 'Sample workspace only. No current project is connected.', {id: 'mock-status', role: 'status', 'aria-live': 'polite', class: 'rl-status'});
    const workspace = el('div', null, {class: 'rl-workspace'});
    const left = el('aside', null, {class: 'rl-locations', 'aria-label': 'Locations and filters'});
    const locations = el('section');
    const filtersPane = el('section'); filtersPane.append(el('h2', 'Refine sample'));
    field(filtersPane, 'Search names & notes', 'search', '', v => {filters.search = v; renderResults();});
    for (const [key,label,values] of [['category','Category',data.categories],['health','Source health',data.health],['network','Network / block',data.networks]]) {
      refs[key] = field(filtersPane,label,key + '-filter','',v => {filters[key] = v; renderResults();},{choices:['',...values]});
    }
    field(filtersPane, 'Hard year filter', 'date-filter', '', v => {filters.year = v; renderResults();}, {type: 'number', min: 1, max: 9999, help: 'Structured dates only; notes never change eligibility.'});
    const allowWrap = el('label', null, {class:'rl-check'});
    const allow = el('input', null, {id:'allow-unknown', type:'checkbox'});
    allow.addEventListener('change', () => {filters.allowUnknown = allow.checked; renderResults();});
    allowWrap.append(allow, el('span','Explicitly allow unknown dates')); filtersPane.append(allowWrap);
    left.append(locations, filtersPane);
    const results = el('section', null, {class:'rl-results', 'aria-label':'Sample asset results'});
    const resultHead = el('div', null, {class:'rl-section-head'});
    const count = el('h2', '', {id:'sample-count'});
    resultHead.append(count);
    field(resultHead, 'Sort samples', 'sort', 'Name A–Z', v => {filters.sort = v; renderResults();}, {choices:['Name A–Z','Name Z–A','Health']});
    const toolbar = el('div', null, {class:'rl-toolbar'});
    const selectedCount = p('', 'rl-help');
    toolbar.append(selectedCount,button('Add media reference (mock)',()=>addReferenceDialog(),'add-asset'), button('Bulk edit (mock)', bulkDialog, 'bulk-edit'), button('Create composite (mock)', () => compositeDialog(), 'create-composite'));
    const list = el('div', null, {class:'rl-list'});
    results.append(resultHead, toolbar, list);
    const inspector = el('aside', null, {id:'inspector', class:'rl-inspector', tabindex:'-1', 'aria-label':'Asset inspector'});
    workspace.append(left,results,inspector);
    const dialog = el('dialog', null, {class:'rl-dialog', 'aria-labelledby':'dialog-title'});
    let dialogOrigin;
    dialog.addEventListener('close', () => {const current = dialogOrigin?.id ? doc.getElementById(dialogOrigin.id) : dialogOrigin; current?.focus();});
    root.replaceChildren(banner,header,review,notice,workspace,dialog);
    function say(text, error = false) {
      notice.textContent = text;
      notice.setAttribute('class', error ? 'rl-status rl-error' : 'rl-status');
      if (dialog.open && refs.dialogNotice) refs.dialogNotice.textContent = text;
    }
    function run(fn, message) {
      try {fn(); if (message) say(message); return true;} catch (err) {say(err.message, true); return false;}
    }
    function refresh() {
      const focusId = doc.activeElement?.id;
      renderLocations(); renderResults(); renderInspector();
      if (focusId) doc.getElementById(focusId)?.focus();
    }
    function modal(title, intro, build) {
      if (!dialog.open) dialogOrigin = doc.activeElement;
      dialog.replaceChildren(el('h2', title, {id:'dialog-title',tabindex:'-1'}),p(intro));
      refs.dialogNotice = p('', 'rl-status'); refs.dialogNotice.setAttribute('role','status'); dialog.append(refs.dialogNotice);
      build(dialog);
      actions(dialog).append(button('Close', () => dialog.close(), 'dialog-close'));
      if (!dialog.open) dialog.showModal();
      else doc.getElementById('dialog-title')?.focus();
    }
    function scenarioChange(name) {
      const reset = () => {m.reset(name,true); assetId = name === 'Missing source' ? 'demo-missing' : ['Busy','Error'].includes(name) ? 'demo-audio' : 'demo-ad'; tab = name === 'Error' ? 'jobs' : name === 'Busy' ? 'preview' : 'properties'; filters.locationId = ''; scenarioSelect.value = name; refresh(); say('Design review: ' + name + '. Sample reset; no project data was read.');};
      if (m.dirty()) {
        scenarioSelect.value = m.scenario;
        modal('Reset sample and discard drafts?', 'Asset drafts are retained while navigating. This explicit state change would discard all sample work.', body => {
          actions(body).append(button('Discard sample work & change state', () => {dialog.close(); reset();}, 'confirm-reset'));
        });
      } else reset();
    }
    function renderLocations() {
      locations.replaceChildren(el('h2','Library locations'));
      locations.append(p(m.locations.length + ' sample location' + (m.locations.length === 1 ? '' : 's')));
      actions(locations).append(button('Manage (mock)',manageLocations,'manage-locations'), button('Add location (mock)',addLocationDialog,'add-location'));
      const all = button('All sample references · ' + m.assets.length, () => {filters.locationId = ''; renderResults();}, 'all-locations', 'rl-root-button'); locations.append(all);
      m.locations.forEach(l => {
        const n = button(l.path + (l.scanning ? ' · scan simulation active' : ''), () => {filters.locationId = l.id; renderResults();}, 'location-' + l.id, 'rl-root-button');
        n.setAttribute('aria-pressed', String(filters.locationId === l.id)); locations.append(n);
      });
      locations.append(p('Typed example paths only. Originals are never removed.'));
    }
    function renderResults() {
      const rows = m.query(filters);
      count.textContent = rows.length + ' / ' + m.assets.length + ' sample assets';
      selectedCount.textContent = m.selected.size + ' sample selected';
      list.replaceChildren();
      if (!rows.length) {
        const empty = el('div', null, {class:'rl-empty'});
        empty.append(el('h3', m.assets.length ? 'No sample matches' : 'Your sample library is empty'), p(m.assets.length ? 'Adjust filters to browse the illustrative assets. Nothing has been removed.' : 'Start with a fictional library location. Registering it will not read a folder.'));
        empty.append(button('Add location (mock)',addLocationDialog,'empty-add-location'));
        list.append(empty); return;
      }
      const table = el('table', null, {class:'rl-table'});
      const caption = el('caption','Illustrative asset catalog — select a title to inspect; checkboxes select for bulk actions.');
      const head = el('thead'), hr = el('tr');
      ['Select','Sample asset / notes','Source health'].forEach(s => hr.append(el('th',s,{scope:'col'}))); head.append(hr);
      const body = el('tbody');
      rows.forEach(a => {
        const tr = el('tr', null, {'data-testid':'asset-row','data-asset-id':a.id, class: a.id === assetId ? 'rl-current' : ''});
        const checkCell = el('td'), checkLabel = el('label', null, {class:'rl-checkbox-hit'}), check = el('input',null,{type:'checkbox','aria-label':'Select ' + a.name,id:'select-' + a.id});
        check.checked = m.selected.has(a.id);
        check.addEventListener('change', () => {if (check.checked) m.selected.add(a.id); else m.selected.delete(a.id); selectedCount.textContent = m.selected.size + ' sample selected';});
        checkLabel.append(check); checkCell.append(checkLabel);
        const title = el('td');
        const open = button(a.name, () => {assetId = a.id; renderResults(); renderInspector(); doc.getElementById('asset-title')?.focus();}, 'inspect-' + a.id, 'rl-asset-button');
        open.setAttribute('aria-pressed', String(a.id === assetId));
        title.append(open,p(a.category + ' / ' + a.network + ' / ' + a.subtype,'rl-row-meta'),p(a.notes,'rl-row-notes'));
        const state = el('td'); state.append(el('span',a.health,{class:'rl-badge'}),p(a.missing ? 'Missing source' : a.unverified ? 'Unverified example path' : 'Sample available', a.missing ? 'rl-missing' : 'rl-help'));
        tr.append(checkCell,title,state); body.append(tr);
      });
      table.append(caption,head,body); list.append(table);
    }
    function renderInspector() {
      inspector.replaceChildren();
      const a = m.asset(assetId);
      if (!a) {inspector.append(el('h2','Inspector'),p('Select an illustrative asset to inspect. No media is loaded.')); return;}
      const meta = m.view(a.id,'metadata');
      inspector.append(p('INSPECT / ' + a.id,'rl-eyebrow'),el('h2',a.name,{id:'asset-title',tabindex:'-1'}));
      inspector.append(p(a.path,'rl-path'));
      if (a.missing) {
        const missing = el('div',null,{class:'rl-warning'}); missing.append(el('h3','Missing source'),p('Identity, raw health, recipes and cart references remain intact. Relink is a typed-path simulation.'));
        missing.append(button('Relink source (mock)',() => relinkDialog(a),'relink')); inspector.append(missing);
      }
      inspector.append(p('Known raw source: ' + a.health + ' · saved repair / audio ' + a.recipe.audio + '. Cart review and pool readiness are separate.', 'rl-health-summary'));
      const notesBox = el('section',null,{class:'rl-notes-summary','aria-label':'Reviewer notes'});
      notesBox.append(el('h3','Reviewer notes / soft tags'),el('p',meta.notes || 'No human notes.',{id:'notes-summary'}),button('Edit notes',() => {tab = 'properties'; renderInspector(); doc.getElementById('notes')?.focus();},'edit-notes'));
      inspector.append(notesBox);
      const draftBadge = p(m.drafts[a.id] && Object.keys(m.drafts[a.id]).length ? 'Unsaved drafts retained in this tab.' : 'No unsaved draft for this sample.', 'rl-draft'); draftBadge.setAttribute('id','draft-status'); inspector.append(draftBadge);
      const tabs = el('div',null,{class:'rl-tabs',role:'tablist','aria-label':'Inspect sample asset'});
      const names = [['properties','Properties'],['preview','Preview & edit'],['relationships','Relationships'],['used','Used in'],['jobs','Jobs']];
      names.forEach(([key,title],i) => {
        const n = button(title,() => {tab = key; renderInspector(); doc.getElementById('tab-' + key)?.focus();},'tab-' + key);
        n.setAttribute('role','tab'); n.setAttribute('aria-selected',String(tab === key)); n.setAttribute('tabindex',tab === key ? '0' : '-1'); n.setAttribute('aria-controls','inspector-panel');
        n.addEventListener('keydown', e => {
          if (['ArrowRight','ArrowLeft','Home','End'].includes(e.key)) {e.preventDefault(); const index = e.key === 'Home' ? 0 : e.key === 'End' ? names.length - 1 : (i + (e.key === 'ArrowRight' ? 1 : -1) + names.length) % names.length; tab = names[index][0]; renderInspector(); doc.getElementById('tab-' + tab)?.focus();}
        });
        tabs.append(n);
      });
      const panel = el('section',null,{id:'inspector-panel',role:'tabpanel','aria-labelledby':'tab-' + tab,tabindex:'0'});
      inspector.append(tabs,panel);
      const draft = (kind, values) => {m.draft(a.id,kind,values); draftBadge.textContent = 'Unsaved ' + kind + ' draft retained in this tab.'; if (kind === 'metadata' && values.notes !== undefined) doc.getElementById('notes-summary').textContent = values.notes || 'No human notes.';};
      if (tab === 'properties') properties(panel,a,meta,draft);
      if (tab === 'preview') preview(panel,a,draft);
      if (tab === 'relationships') relationships(panel,a,meta,draft);
      if (tab === 'used') usedIn(panel,a);
      if (tab === 'jobs') jobsPanel(panel);
    }
    function properties(panel,a,meta,draft) {
      panel.append(el('h3','Planning properties'),p('Every seeded editorial value is illustrative. Enter structured facts manually; filenames and notes are not parsed.'));
      const change = (key,value) => draft('metadata',{[key]:value});
      field(panel,'Display title','asset-name',meta.name,v => change('name',v));
      const grid = el('div',null,{class:'rl-field-grid'}); panel.append(grid);
      field(grid,'Category','asset-category',meta.category,v => {change('category',v);refresh();},{choices:data.categories});
      field(grid,'Structured subtype','asset-subtype',meta.subtype,v => change('subtype',v),{choices:data.subtypes});
      field(grid,'Network / block','asset-network',meta.network,v => change('network',v),{choices:data.networks,help:'NICK and SNICK are distinct.'});
      field(grid,'Show / series','asset-show',meta.show,v => change('show',v));
      field(panel,'Pool (single membership)','asset-pool',meta.pool,v => change('pool',v),{help:'One Pool value, matching the existing registry; no multi-pool migration proposed here.'});
      const dateGrid = el('div',null,{class:'rl-field-grid'}); panel.append(dateGrid);
      field(dateGrid,'Date precision','year-mode',meta.date.mode,v => {draft('metadata',{date:{mode:v,value:''}}); refresh();},{choices:['Unknown','Year','Range','Exact date']});
      const date = field(dateGrid,'Year / date value','year-value',meta.date.value,v => change('date',{mode:m.view(a.id,'metadata').date.mode,value:v}),{help:'Year: 1997 · Range: 1997–1999 · Exact date: 1997-05-12. No guessed dates.'});
      date.disabled = meta.date.mode === 'Unknown';
      if (['Commercial','Episode/Show'].includes(meta.category)) {
        const availability = el('div',null,{class:'rl-field-grid'}); panel.append(availability);
        const subject=meta.category==='Episode/Show'?'Episode':'Commercial';
        field(availability,subject+' availability from','available-from',meta.availableFrom,v => change('availableFrom',v),{type:'date'});
        field(availability,subject+' availability to','available-to',meta.availableTo,v => change('availableTo',v),{type:'date'});
        panel.append(p('Optional '+subject.toLowerCase()+' availability bounds are separate from canonical content date. They belong to this media role; ad-year rules and branding dates are not silently reused.'));
      }
      field(panel,'Notes / soft tags — human review aids','notes',meta.notes,v => change('notes',v),{multiline:true,help:'Canonical human field proposed to map to UserNotes. Searchable and visible during review; never an eligibility rule.'});
      details(panel,'Imported provenance (read only)','Illustrative imported Notes: sample import record. Historical InferredTags: illustrative, untrusted legacy hints; never authoritative metadata. These are not duplicate editable human-note fields.');
      actions(panel).append(button('Save properties (mock)',() => {if (run(() => m.saveMetadata(a.id),'Properties stored in sample memory only. Other recipe drafts are retained.')) refresh();},'save-metadata','rl-primary'));
      panel.append(el('h3','Source health — separate decision'));
      field(panel,'Raw source health','source-health',meta.health,v => change('health',v),{choices:data.health});
      field(panel,'Reason / review provenance','health-reason',meta.reason,v => change('reason',v),{multiline:true});
      const healthActions = actions(panel);
      healthActions.append(button('Re-review / Mark usable (mock)',() => {
        modal('Explicitly mark raw source usable?', 'There is no real media here. In implementation this is an explicit human source-health review, not automatic GOOD cart approval. Recipes alone never approve a bad raw source.', body => {
          const reason = field(body,'Re-review reason','review-reason',m.view(a.id,'metadata').reason,() => {});
          actions(body).append(button('Mark READY (mock)',() => {if (run(() => m.setHealth(a.id,'READY',reason.value),'Explicit READY decision applied to sample only; cart approvals unchanged.')) {dialog.close(); refresh();}},'confirm-review'));
        });
      },'re-review'));
      details(panel,'Legacy mapping — proposal, not a schema migration','Episode/Show → EPISODE; Commercial → COMMERCIAL; Branding → BRANDING; Other → ARCHIVE_MISC. Existing EPISODE.Subtype often contains a series name: preserve it and propose Show / series explicitly. MAYBE source health is retained, not discarded. Raw registry AssetType/Subtype, CuratedStatus and SourceStatus require an explicit reviewed mapping, not silent rewrites. Human Notes / soft tags → UserNotes; imported Notes remains provenance; historical InferredTags is not authoritative. Single-valued Pool stays single-valued. Canonical date mode is a proposed UI, not an already-migrated Year schema.');
      panel.append(p('Illustrative legacy values: ' + a.legacyType + ' / ' + a.legacySubtype));
    }
    function preview(panel,a,draft) {
      const r = m.view(a.id,'recipe');
      panel.append(el('h3','Non-destructive recipe'),p('Illustrative frame — no media loaded. Playback controls would be enabled only after an approved real-media implementation.'));
      const frame = el('div',null,{class:'rl-frame',role:'img','aria-label':'Illustrative frame — no media loaded. Blue survivor box is a layout guide only.'});
      const svg = doc.createElementNS('http://www.w3.org/2000/svg','svg'); svg.setAttribute('viewBox','0 0 320 200'); svg.setAttribute('aria-hidden','true');
      const box = doc.createElementNS('http://www.w3.org/2000/svg','rect');
      function updateBox() {const c = m.view(a.id,'recipe').crop; box.setAttribute('x',String(c.left * 3.2)); box.setAttribute('y',String(c.top * 2)); box.setAttribute('width',String(320 - (c.left + c.right) * 3.2)); box.setAttribute('height',String(200 - (c.top + c.bottom) * 2));}
      box.setAttribute('class','rl-survivor'); updateBox(); svg.append(box); frame.append(svg,el('span','Illustrative frame — no media loaded')); panel.append(frame);
      const trim = el('div',null,{class:'rl-field-grid'}); panel.append(trim);
      for (const [key,title,id] of [['trimStart','Remove from start (seconds)','trim-start'],['trimEnd','Remove from end (seconds)','trim-end']]) field(trim,title,id,r[key],v => draft('recipe',{[key]:v}),{type:'number',min:0,step:'0.1'});
      panel.append(p('Sample duration ' + a.technical.duration + ' seconds. Trim values describe removed seconds, not timeline endpoints.'));
      const cropActions = actions(panel);
      function setCrop(value) {draft('recipe',{crop:value}); refresh();}
      cropActions.append(button('Fit TV (mock)',() => setCrop({left:4,right:4,top:0,bottom:0}),'crop-fit'),button('Auto Detect (mock)',() => {
        modal('Auto Detect crop (mock)','No pixels are inspected. This design review can insert a clearly illustrative crop proposal; actual detection would require separate implementation approval.',body => actions(body).append(button('Use illustrative proposal',() => {dialog.close(); setCrop({left:6,right:6,top:3,bottom:3});},'use-crop-proposal')));
      },'crop-auto'),button('No Crop',() => setCrop({left:0,right:0,top:0,bottom:0}),'crop-reset'),button('Revert to saved crop',() => setCrop(copy(a.recipe.crop)),'crop-revert'));
      const advanced = details(panel,'Advanced crop edges / visual survivor box','Percentages are an interactive layout proposal only, not proven render geometry. Blue outlines the surviving area.');
      const cropFields = el('div',null,{class:'rl-field-grid'}); advanced.append(cropFields);
      for (const edge of ['left','right','top','bottom']) field(cropFields,edge + ' removed (%)','crop-' + edge,r.crop[edge],v => {const crop = m.view(a.id,'recipe').crop; crop[edge] = v; draft('recipe',{crop}); updateBox();},{type:'number',min:0,max:40});
      const final = el('div',null,{class:'rl-final-fit'}); final.append(el('strong','618 × 480 final fit'),p('Layout illustration only — not a processed or pixel-exact preview.')); panel.append(final);
      field(panel,'Audio repair level','audio-level',r.audio,v => draft('recipe',{audio:v}),{choices:['NONE','RESTORE','STRONG','AGGRESSIVE','MAX'],help:'Each level would reprocess the ORIGINAL; repairs never stack on a repaired copy.'});
      actions(panel).append(button('Save recipe (mock)',() => {if (run(() => m.saveRecipe(a.id),'Recipe stored in sample memory only. No file generated; raw source health and cart review unchanged.')) refresh();},'save-recipe','rl-primary'),button('Prepare processed variant / preview (mock)',() => {
        if (m.drafts[a.id]?.recipe) {say('Save recipe (mock) first. Preparing is a separate simulation; your draft is retained.',true); return;}
        m.prepare(a.id); say('Mock job queued. Use Design Review job controls; no encoding or background work starts.'); refresh();
      },'prepare-variant'));
      details(panel,'Output policy / original protection','Implementation would place generated previews and variants in app-managed folders, never overwrite originals. This mock creates no files. Recipe definition and preparation job are separate. Crop editing stays available during replaceable preview jobs; changed proposals make simulated old results stale.');
      panel.append(p('Sample technical metadata (invented): ' + a.technical.dimensions + ' · ' + a.technical.codec + ' · SAR ' + a.technical.sar + '. Future scans measure these, never infer editorial facts.'));
      if (m.jobs.length) jobsPanel(panel,true);
    }
    function relationships(panel,a,meta,draft) {
      panel.append(el('h3','Explicit source associations'),p('Associations are manual. A generic CN IDENT cannot substitute for a NEXT announcing a different series.'));
      const families=[...new Set(m.assets.map(x=>x.family))];if(!families.includes(meta.family))families.push(meta.family);
      const familyChoices=families.map(value=>({value,label:value.startsWith('demo-family-')?m.assets.filter(x=>x.family===value).map(x=>x.name).join(' / '):value}));
      field(panel,'Source group / original recording','source-family',meta.family,v => draft('metadata',{family:v}),{choices:familyChoices,help:'Choose a named group; no internal identifier needs to be typed.'});
      actions(panel).append(button('Create named source group (mock)',()=>{
        let groupName='';modal('Name a source group (mock)','A human label groups these sample references explicitly. This creates no source file or durable identifier.',body=>{
          field(body,'Source group name','source-group-name','',v=>{groupName=v;});
          actions(body).append(button('Use group name in proposal (mock)',()=>{if(!groupName.trim()){say('Enter a source group name.',true);return;}draft('metadata',{family:groupName.trim()});dialog.close();refresh();say('Named source group is a draft in this mockup only. Save associations separately.');},'use-source-group'));
        });
      },'create-source-group'));
      const sourceChoices=[{value:'',label:'None'},...m.assets.filter(x=>x.id!==a.id).map(x=>({value:x.id,label:x.name}))];
      field(panel,'Original / source asset','source-id',meta.sourceId,v => draft('metadata',{sourceId:v}),{choices:sourceChoices,help:'Choose an asset by name. Legacy OriginalID remains unchanged import provenance; it is not reused as this relationship field. No filename guessing.'});
      field(panel,'Variant of asset','variant-of',meta.variantOf,v => draft('metadata',{variantOf:v}),{choices:sourceChoices});
      details(panel,'Relationship identifiers (read only)',`Diagnostic sample keys: source group ${meta.family}; original/source ${meta.sourceId||'none'}; variant of ${meta.variantOf||'none'}. Actual implementation keeps identifiers behind human-readable selectors.`);
      actions(panel).append(button('Save associations (mock)',() => {if (run(() => m.saveMetadata(a.id),'Explicit associations stored in sample memory; no cart was updated.')) refresh();},'save-associations'));
      const family = m.assets.filter(x => x.family === a.family || x.variantOf === a.id || x.id === a.variantOf || x.sourceId === a.id);
      const ul = el('ul'); family.forEach(x => {const li = el('li'); li.append(button(x.name + ' · ' + x.id,() => {assetId = x.id; refresh();},'family-' + x.id)); ul.append(li);}); panel.append(el('h3','Source-family / variant links'),ul);
      panel.append(p('Different encodes and ordered composite constituents count as underlying source use, not a different cart per revision.'));
      actions(panel).append(button('Group selected episode parts (mock)',() => compositeDialog(),'group-parts'));
      panel.append(el('h3','Ordered episode groups'));
      if (!m.groups.length) panel.append(p('No group definition yet. Select demo-part-1 and demo-part-2 in the results, then Create composite (mock).'));
      m.groups.forEach(g => {
        const section = el('section',null,{class:'rl-group'});
        const stale = g.parts.some(id => m.asset(id).recipe.revision !== g.pins[id] || m.drafts[id]?.recipe);
        section.append(el('h4',g.name),p(g.parts.map((id,i) => (i+1) + '. ' + m.asset(id).name + ' · pinned r' + g.pins[id] + ' / current r' + m.asset(id).recipe.revision).join(' → ')),p(stale ? 'Stale definition / unsaved proposal. Save recipes, then deliberately update the group definition before preparing.' : 'Constituent recipe pins are current in this sample.'));
        actions(section).append(button('Edit order / update pins (mock)',() => compositeDialog(g),'edit-' + g.id),button('Prepare composite (mock)',() => {if (run(() => m.prepareGroup(g.id),'Mock composite job queued for ' + g.parts.length + ' constituents. No file generated.')) refresh();},'prepare-' + g.id));
        panel.append(section);
      });
      usedIn(panel,a);
    }
    function usedIn(panel,a) {
      const dep = el('section',null,{id:'dependency-panel',class:'rl-dependencies'});
      dep.append(el('h3','Used in / change impact'),p('SourceFamily: ' + a.family));
      const uses = m.dependencies(a.id);
      if (!uses.length) dep.append(p('No sample dependencies. Reference removal would remove only this model row.'));
      uses.forEach(u => dep.append(p(u.cart + ' · ' + u.state + ' · pinned recipe r' + u.recipe + ' · via ' + u.via)));
      dep.append(p('Recipe or source changes do not silently apply to reviewed / built carts. Demo Cart A stays pinned to its old recipe until deliberately updated. Demo Cart B is reserved. Resolving a real effective-output change would require explicit cart review in a later module.'));
      dep.append(p('Exclude retains references and history; it does not implicitly archive a cart. Resolver options: Exclude, Relink, or deliberately resolve dependent cart/group usage in the future workspace.'));
      actions(dep).append(button('Exclude source (mock)',() => {if (run(() => m.setHealth(a.id,'EXCLUDED','Explicit mock exclusion; keep references/history'),'Sample excluded; history and dependencies retained.')) refresh();},'exclude-source'),button('Relink (mock)',() => relinkDialog(a),a.missing ? 'dependency-relink' : 'relink'),button('Remove reference (mock)',() => {
        if (m.dependencies(a.id).length) {say('Removal blocked: referenced by sample carts or composites. Exclude or Relink instead; originals are never deleted.',true); return;}
        modal('Remove sample reference only?', 'This removes only a model row. No original file, cart history, or media is deleted.',body => actions(body).append(button('Remove model row (mock)',() => {
          const result = m.removeReference(a.id);
          if (result.blocked) {say('Reference is now used; resolve dependencies or Exclude / Relink.',true); return;}
          dialog.close(); assetId = m.assets[0]?.id; refresh(); say('Sample model row removed only. No original was deleted.');
        },'confirm-remove')));
      },'remove-reference'));
      panel.append(dep);
    }
    function jobsPanel(panel, compact = false) {
      const area = el('section',null,{id:'job-panel',class:'rl-jobs'});
      area.append(el('h3','Processing jobs · MOCK'),p('Design Review controls, not background encoding. No timers, fake percentages, media or generated files.'));
      if (!m.jobs.length) area.append(p('No mock jobs. Save a recipe, then use Prepare processed variant / preview (mock).'));
      const show = compact ? m.jobs.slice(-2) : m.jobs;
      show.forEach(j => {
        const row = el('section',null,{class:'rl-job','data-job-id':j.id});
        row.append(el('h4',j.id + ' · ' + j.state + ' (mock)'),p(j.stage),p('Current item: ' + j.currentItem + ' · sample item count: ' + j.count + ' · input: ORIGINAL'));
        if (j.state === 'Running') {const progress = el('progress',null,{'aria-label':'Indeterminate simulated work; advanced only by Design Review controls'}); row.append(progress);}
        const controls = actions(row);
        const referenceExists = [j.assetId,...(j.sourceIds || [])].every(id => m.asset(id));
        if (!referenceExists) row.append(p('Sample reference was removed after this job ended; retry is unavailable. No recipe or file is recreated.'));
        const map = !referenceExists ? [] : j.state === 'Queued' ? [['run','Simulate stage running'],['cancel','Request cancel (mock)']] : j.state === 'Running' ? [['complete','Simulate success / stale result'],['fail','Simulate failure'],['cancel','Request cancel (mock)']] : j.state === 'Cancel requested' ? [['confirm-cancel','Simulate terminal cancelled']] : ['Failed','Cancelled','Stale ignored'].includes(j.state) ? [['retry','Retry (mock)']] : [];
        map.forEach(([act,title]) => controls.append(button(title,() => {if (run(() => m.stepJob(j.id,act))) {say('Design-review job state: ' + j.state + ' (mock). Recipes and editing retained.'); refresh();}},j.id + '-' + act)));
        area.append(row);
      }); panel.append(area);
    }
    function relinkDialog(a) {
      let path = a.path;
      modal('Relink source (mock)','Typed path only. The same demo AssetID, recipes, source health and cart references stay intact. No filesystem check occurs.',body => {
        field(body,'Illustrative replacement path','replacement-path',path,v => {path = v;});
        actions(body).append(button('Relink in sample memory (mock)',() => {if (run(() => m.relink(a.id,path),'Sample identity relinked in memory only; cart impact remains explicit.')) {dialog.close(); refresh();}},'confirm-relink'));
      });
    }
    function addReferenceDialog(pending) {
      let sourcePath=pending?.path??'D:/Example media/new-reference.mp4',title=pending?.title??'New sample reference',locationId=pending?.locationId??m.locations[0]?.id??'';
      modal('Register media reference (mock)','Typed example only: no file opens or probe runs. This adds an unreviewed sample row; category, network, show and date are not inferred. Technical values are illustrative, not measured.',body=>{
        field(body,'Illustrative media path','asset-reference-path',sourcePath,v=>{sourcePath=v;});
        field(body,'Explicit display name','asset-reference-title',title,v=>{title=v;});
        field(body,'Library location reference','asset-reference-location',locationId,v=>{locationId=v;},{choices:[{value:'',label:'No registered location'},...m.locations.map(l=>({value:l.id,label:l.path}))]});
        actions(body).append(button('Browse media (mock)',()=>modal('Browse media (mock)','The implementation would use the approved Windows Explorer-style picker. This design opens no system dialog and reads no file.',inner=>actions(inner).append(button('Return to reference form',()=>addReferenceDialog({path:sourcePath,title,locationId}),'return-to-reference'))),'browse-asset'),button('Register reference in sample (mock)',()=>{
          let added;if(run(()=>{added=m.addReference(sourcePath,title,locationId);},'Reference added to sample memory only. Path is unverified; editorial classification remains explicit.')){dialog.close();assetId=added.id;tab='properties';refresh();doc.getElementById('asset-title')?.focus();}
        },'register-asset','rl-primary'));
      });
    }
    function addLocationDialog() {
      modal('Register library location (mock)','A typed example path becomes a row in this sample only. No folders or media are read.',body => {
        field(body,'Illustrative location path','location-path',pathDraft,v => {pathDraft = v;});
        actions(body).append(button('Browse (mock)',() => modal('Browse location (mock)','Implementation would use the approved Explorer-style address-bar picker. This design review opens no system dialog, file input or real folder. Type an example path instead.',inner => actions(inner).append(button('Return to typed path',addLocationDialog,'return-to-path'))),'browse-location'),button('Register location (mock)',() => {
          if (run(() => m.addLocation(pathDraft),'Location row registered in sample memory only. No scan started.')) {dialog.close(); refresh();}
        },'register-location','rl-primary'));
      });
    }
    function manageLocations() {
      modal('Manage library locations (mock)','Scan and rescan demonstrations expose technical metadata only. Notes, source-health decisions, and recipes are retained; no year/show/network/category is inferred.',body => {
        actions(body).append(button('Add location (mock)',addLocationDialog,'manage-add-location'));
        if (!m.locations.length) body.append(p('No sample locations. Add a typed example path.'));
        m.locations.forEach((l,i) => {
          const section = el('section',null,{class:'rl-location-row'}); section.append(el('h3',l.path),p(l.scanning ? 'Scan simulation active — no folder reading.' : 'Idle sample location'));
          const controls = actions(section);
          controls.append(button('Scan (mock)',() => {m.scanLocation(l.id); renderLocations(); manageLocations();},i === 0 ? 'scan-location' : 'scan-' + l.id),button('Rescan (mock)',() => {m.scanLocation(l.id); renderLocations(); manageLocations();},i === 0 ? 'rescan-location' : 'rescan-' + l.id));
          if (l.scanning) controls.append(button('Stop scan (mock)',() => {m.finishScan(l.id); renderLocations(); manageLocations(); say('Mock scan stopped; references and editorial work retained.');},'stop-scan-' + l.id),button('Simulate technical-only scan result',() => {m.finishScan(l.id); renderLocations(); manageLocations(); say('Illustrative scan result: filenames, paths, duration, dimensions, codec and SAR only. Existing sample rows unchanged; no editorial inference.');},'finish-scan-' + l.id));
          let path = l.path;
          field(section,'Relink location to example path','location-relink-' + l.id,path,v => {path = v;});
          controls.append(button('Relink location (mock)',() => {if (run(() => m.relinkLocation(l.id,path),'Location paths changed in memory; identity and recipes retained.')) {refresh(); manageLocations();}},'relink-location-' + l.id),button('Remove location reference (mock)',() => {
            modal('Stop scan and remove location reference?', 'Stops future scans but keeps registered asset paths, availability, decisions, recipes and history. Removing a location entry does not make existing files missing or delete originals.',inner => actions(inner).append(button('Stop & keep asset references (mock)',() => {m.removeLocation(l.id);if(filters.locationId===l.id)filters.locationId=''; refresh(); manageLocations();say('Location entry removed in sample only; registered assets and known availability were retained.');},'confirm-remove-location')));
          },'remove-location-' + l.id));
          section.append(p('Future measured fields: filename / SourcePath / DurationSeconds / dimensions / codec / SAR. No parsing into editorial metadata.')); body.append(section);
        });
      });
    }
    function bulkDialog() {
      const ids = [...m.selected];
      if (!ids.length) {say('Select sample rows with checkboxes before Bulk edit (mock).',true); return;}
      let pool = '';
      modal('Bulk edit ' + ids.length + ' sample references','Explicit single-valued pool assignment only; no notes, dates, source health or cart approvals are inferred or overwritten.',body => {
        field(body,'Replace Pool value','bulk-pool','',v => {pool = v;});
        actions(body).append(button('Apply pool to selected (mock)',() => {m.bulk(ids,{pool}); dialog.close(); refresh(); say('Sample pool assignment changed in memory only.');},'apply-bulk'));
      });
    }
    function compositeDialog(existing, pending) {
      const group = pending || {id:existing?.id, name:existing?.name || 'Demo episode composite', parts:existing ? [...existing.parts] : [...m.selected]};
      if (group.parts.length < 2 || !group.parts.every(id => m.asset(id)?.category === 'Episode/Show')) {say('Select two episode parts (demo-part-1 and demo-part-2), then Create composite (mock).',true); return;}
      modal('Ordered composite definition (mock)','Recipe/group definition only, not a new media file. Underlying source use remains linked. Save pins constituent recipe revisions; preparation is a separate optional simulation.',body => {
        field(body,'Group name','group-name',group.name,v => {group.name = v;});
        group.parts.forEach((id,i) => {
          const row = el('div',null,{class:'rl-order-row'}); row.append(p((i+1) + '. ' + m.asset(id).name));
          const move = delta => {const j = i + delta; [group.parts[i],group.parts[j]] = [group.parts[j],group.parts[i]]; compositeDialog(null,group);};
          const up = button('Up',() => move(-1),'part-up-' + id); up.disabled = i === 0;
          const down = button('Down',() => move(1),'part-down-' + id); down.disabled = i === group.parts.length - 1;
          row.append(up,down); body.append(row);
        });
        actions(body).append(button('Save group definition (mock)',() => {
          if (run(() => m.saveGroup(group.name,group.parts,group.id),'Ordered group definition stored in memory only. No preparation job started.')) {dialog.close(); tab = 'relationships'; refresh();}
        },'save-group','rl-primary'));
      });
    }
    refresh();
    return {model:m};
  }
  return {createModel, mount};
}));
