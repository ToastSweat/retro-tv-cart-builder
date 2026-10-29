'use strict';
(function () {
  const WORKSPACES = {
    library: {title:'Library Manager',description:'Organize and prepare registered media.',next:'Open the separate Phase 3.1 design mockup below. It uses illustrative sample data; real tools still require Phase 3.2 approval.'},
    'cart-builder': {title:'Cart Builder',description:'Plan carts, templates and broadcast sequences.',next:'Cart Builder layout and implementation remain gated by Phases 4.1 and 4.2.'},
    'tv-studio': {title:'TV Studio',description:'Review clips, repair media and prepare exports.',next:'The new TV Studio layout and implementation remain gated by Phases 5.1 and 5.2. The original Studio is still launched separately and remains unchanged.'}
  };
  // The controller is shared by the browser and dependency-free node contract tests.
  function createController({ request, render = () => {}, confirmDiscard = () => true, now = () => Date.now() }) {
    const state = { initialized: false, csrfToken: '', defaults: {}, capabilities: {}, recentProjects: [], activeProject: null,
      view: 'chooser', workspace: '', mode: 'open', busy: false, message: '', error: '', uncertain: false,
      openFolder: '', inspected: null, drafts: {}, preview: null, acknowledged: false, dirty: false, tools: null, pendingWrite: null };
    const settingsDrafts=new Map();
    // Create/import edits belong to their form; settings edits belong to a project baseline.
    const dirtyForms=new Set();
    const hasPendingSettings=()=>[...settingsDrafts.values()].some(entry=>JSON.stringify(entry.draft)!==entry.baseline);
    const updateDirty=()=>{state.dirty=dirtyForms.size>0 || hasPendingSettings();};
    function markDirty() {
      if (state.mode === 'create' || state.mode === 'import') dirtyForms.add(state.mode);
      updateDirty();
    }
    const emit = () => render(state);
    const call = (url, body) => request(url, body, state.csrfToken);
    async function run(message, task) {
      if (state.busy) return false;
      state.busy = true; state.error = ''; state.message = message; emit();
      try { await task(); return true; }
      catch (error) { state.error = error.message || String(error); state.message = ''; return false; }
      finally { state.busy = false; emit(); }
    }
    function applyStatus(status) {
      state.activeProject = status.activeProject || null;
      state.recentProjects = status.recentProjects || [];
      state.defaults = status.defaults || state.defaults;
      state.error = status.loadError || '';
    }
    async function start() {
      return run('Loading project preferences…', async () => {
        const data = await call('/api/bootstrap');
        state.csrfToken = data.csrfToken; state.capabilities = data.capabilities || {};
        applyStatus(data.status); state.initialized = true;
        state.view = state.activeProject ? 'active' : 'chooser';
        state.message = state.activeProject ? 'Saved project preferences restored.' : 'Choose an existing project or create a new one.';
      });
    }
    function setOpenFolder(value) {
      if (state.busy) return;
      if (value !== state.openFolder) state.inspected = null;
      state.openFolder = value; state.error = ''; emit();
    }
    function canLeave() {
      return !state.busy && (!(['editor', 'review'].includes(state.view) && state.dirty) || confirmDiscard('Leave this form? Unsaved values will stay in this tab, but this review will be discarded. Nothing will be saved.'));
    }
    function switchProject() {
      if (!canLeave()) return;
      invalidateReview();
      state.view = 'chooser'; state.mode = 'open'; state.message = 'Choose a project. The active project stays unchanged until you open or confirm another.'; emit();
    }
    async function inspect() {
      if (!state.openFolder.trim()) { state.error = 'Enter the existing project data folder first.'; emit(); return false; }
      const folder = state.openFolder;
      return run('Inspecting metadata only; no media scan…', async () => {
        state.inspected = null;
        const data = await call('/api/inspect', { projectFolder: folder });
        state.inspected = data.project;
        state.message = 'Inspection complete. Review the locations before opening or importing a copy.';
      });
    }
    async function openExisting() {
      if (!state.inspected || state.busy || state.uncertain) return false;
      const folder = state.openFolder;
      return run('Opening project preferences…', async () => {
        state.pendingWrite = clone(state.inspected);
        try {
          const data = await call('/api/open', { projectFolder: folder });
          state.activeProject = data.project; state.view = 'active'; state.uncertain = false; state.pendingWrite = null;
          state.message = 'Project opened. Original files were not moved or deleted.';
        } catch (error) {
          if (!error.httpStatus || error.httpStatus >= 500) { state.uncertain = true; throw Error(`${error.message} The open result is unknown. Refresh status before opening another project.`); }
          state.pendingWrite = null;
          throw error;
        }
      });
    }
    const clone = value => JSON.parse(JSON.stringify(value));
    function freeze(value) {
      if (value && typeof value === 'object') { Object.values(value).forEach(freeze); Object.freeze(value); }
      return value;
    }
    function invalidateReview() { state.preview = null; state.acknowledged = false; }
    function chooseMode(mode) {
      if (!state.initialized || !['open', 'create'].includes(mode) || !canLeave()) return;
      invalidateReview(); state.mode = mode; state.error = '';
      if (mode === 'open') { state.view = 'chooser'; }
      else {
        if (!state.drafts.create) state.drafts.create = { operation: 'create', name: '', projectFolder: state.defaults.projectFolder || '', paths: {
          buildsFolder: state.defaults.buildsFolder || '', compositeFolder: state.defaults.compositeFolder || '',
          cacheFolder: state.defaults.cacheFolder || '', libraryFolders: [...(state.defaults.libraryFolders || [])] } };
        state.view = 'editor';
      }
      state.message = ''; emit();
    }
    function updateField(field, value) {
      if (state.busy || !state.drafts[state.mode] || (state.mode === 'settings' && field === 'projectFolder')) return;
      const draft = state.drafts[state.mode];
      if (['name', 'projectFolder'].includes(field)) draft[field] = value;
      else if (['buildsFolder', 'compositeFolder', 'cacheFolder'].includes(field)) draft.paths[field] = value;
      else return;
      invalidateReview(); state.view = 'editor'; markDirty(); state.error = ''; emit();
    }
    async function review() {
      if (state.busy || state.uncertain || !state.drafts[state.mode]) return false;
      const input = clone(state.drafts[state.mode]);
      if (![input.name, input.projectFolder, input.paths.buildsFolder, input.paths.compositeFolder, input.paths.cacheFolder].every(value => typeof value === 'string' && value.trim())) {
        state.error = 'Enter a project name and each required folder before reviewing.'; emit(); return false;
      }
      return run('Validating folders and preparing a read-only review…', async () => {
        invalidateReview();
        const data = await call('/api/preview', input);
        state.preview = freeze(clone(data.preview)); state.view = 'review';
        state.message = 'Review only. No project changes have been written.';
      });
    }
    function acknowledge(value) { if (!state.busy && state.preview) { state.acknowledged = value === true; emit(); } }
    function expireReview() {
      if (!state.preview || state.busy || Date.parse(state.preview.expiresAt) > now()) return false;
      invalidateReview(); state.view = 'editor'; state.error = 'This review expired. Review changes again; nothing was submitted.'; state.message = ''; emit(); return true;
    }
    async function confirmReview() {
      if (state.busy || state.uncertain || !state.preview || !state.acknowledged || expireReview()) return false;
      const token = state.preview.token;
      const operation = state.preview.operation;
      const expectedProject = clone(state.preview.project);
      return run('Applying the reviewed changes…', async () => {
        state.pendingWrite = expectedProject;
        invalidateReview();
        try {
          const data = await call('/api/confirm', { token });
          state.activeProject = data.project; state.view = 'active'; state.uncertain = false;
          if (operation === 'settings') settingsDrafts.delete(expectedProject.projectFolder);
          delete state.drafts[operation]; dirtyForms.delete(operation); updateDirty();
          state.pendingWrite = null; state.message = 'Project preferences saved.';
        } catch (error) {
          state.view = 'editor'; state.uncertain = !error.httpStatus || error.httpStatus >= 500;
          if (!state.uncertain) state.pendingWrite = null;
          throw Error(state.uncertain
            ? `${error.message} The save result is unknown. Refresh status before trying anything else; do not repeat confirmation.`
            : `${error.message} Your values are preserved. Review again to obtain a new confirmation.`);
        }
      });
    }
    function beginImport() {
      if (state.busy || !state.inspected) return false;
      const source = state.inspected;
      if (!state.drafts.import || state.drafts.import.sourceFolder !== source.projectFolder) {
        if(state.drafts.import && dirtyForms.has('import') && !confirmDiscard('Starting from a different source will discard the unsaved import form currently kept in this tab. Replace that import form?')) {
          state.message='The existing unsaved import form was kept. Nothing was saved.';emit();return false;
        }
        state.drafts.import = { operation: 'import', name: source.name || '', sourceFolder: source.projectFolder,
          projectFolder: state.defaults.projectFolder || '', paths: {
            buildsFolder: source.paths?.buildsFolder || '', compositeFolder: state.defaults.compositeFolder || '',
            cacheFolder: state.defaults.cacheFolder || '', libraryFolders: [...(source.paths?.libraryFolders || [])] } };
        dirtyForms.delete('import');updateDirty();
      }
      invalidateReview(); state.mode = 'import'; state.view = 'editor'; state.error = '';
      state.message = 'Import a copy into a new empty project data folder. The source stays unchanged.'; emit();return true;
    }
    async function copyProjectData() {
      if (!state.activeProject || state.activeProject.kind !== 'managed' || !canLeave()) return false;
      setOpenFolder(state.activeProject.projectFolder);
      if (!await inspect()) return false;
      if(!beginImport())return false;
      state.message = 'Choose a new project data folder. Review and confirm a metadata copy; the original stays available for rollback. Existing video/build references are retained.';
      emit(); return true;
    }
    function editSettings() {
      const active = state.activeProject;
      if (!active || active.kind !== 'managed' || active.readOnly || !canLeave()) return;
      const saved={ operation: 'settings', name: active.name || '', projectFolder: active.projectFolder,
        paths: { buildsFolder: active.paths?.buildsFolder || '', compositeFolder: active.paths?.compositeFolder || '',
          cacheFolder: active.paths?.cacheFolder || '', libraryFolders: [...(active.paths?.libraryFolders || [])] } };
      let entry=settingsDrafts.get(active.projectFolder);
      if(!entry || JSON.stringify(entry.draft)===entry.baseline) entry={draft:saved,baseline:JSON.stringify(saved)};
      settingsDrafts.set(active.projectFolder,entry);state.drafts.settings=entry.draft;
      updateDirty();
      invalidateReview(); state.mode = 'settings'; state.view = 'editor'; state.error = '';
      state.message = 'Locations apply to future defaults only. No files are moved and existing references are not relinked.';
      if(entry.baseline!==JSON.stringify(saved))state.message+=' Saved settings changed since this draft was opened; review all changes before saving.';
      emit();
    }
    function openSettings() {
      const active=state.activeProject;
      if(!active)return;
      if(active.kind==='managed' && !active.readOnly) { editSettings(); return; }
      if(!canLeave())return;
      invalidateReview();state.mode='readonly';state.view='settings-readonly';state.error='';
      state.message='Read-only project settings. Import a copy to change locations; no original project files will be edited.';emit();
    }
    function changeLibraries(change) {
      if (state.busy || !state.drafts[state.mode]) return;
      change(state.drafts[state.mode].paths.libraryFolders);
      invalidateReview(); state.view = 'editor'; markDirty(); state.error = ''; emit();
    }
    const addLibrary = () => changeLibraries(rows => rows.push(''));
    const updateLibrary = (index, value) => changeLibraries(rows => { if (index >= 0 && index < rows.length) rows[index] = value; });
    const removeLibrary = index => changeLibraries(rows => { if (index >= 0 && index < rows.length) rows.splice(index, 1); });
    function cancelReview() {
      if (state.busy) return;
      invalidateReview(); state.view = 'editor'; state.message = 'Review discarded. No changes were written.'; emit();
    }
    function matchesPendingProject(project) {
      const expected = state.pendingWrite;
      if (!expected || !project) return false;
      const fields = value => ({kind:value.kind,name:value.name,projectFolder:value.projectFolder,
        paths:Object.fromEntries(['dataFolder','buildsFolder','compositeFolder','cacheFolder','libraryFolders'].map(key=>[key,value.paths?.[key]]))});
      return JSON.stringify(fields(project)) === JSON.stringify(fields(expected));
    }
    async function recoverPendingResult() {
      if (!state.uncertain || !state.pendingWrite || state.busy) return false;
      const target = state.pendingWrite.projectFolder;
      return run('Inspecting the exact last-save target; no save will be repeated…', async () => {
        const data = await call('/api/inspect', {projectFolder:target});
        if (!matchesPendingProject(data.project)) throw Error('The target does not match the reviewed settings. The save outcome remains unresolved; do not repeat it automatically.');
        state.openFolder = target; state.inspected = data.project; state.pendingWrite = null;
        state.uncertain = false; state.view = 'chooser'; state.mode = 'open';
        state.message = 'The target settings match your reviewed choices. No save was repeated. Choose Open existing project to remember this selection, or keep the current selection.';
      });
    }
    async function refreshStatus() {
      return run('Reading saved project status; no confirmation will be repeated…', async () => {
        const data = await call('/api/status');
        if (data.status.loadError) throw Error(data.status.loadError);
        applyStatus(data.status); invalidateReview();
        if(!state.activeProject) { state.view='chooser'; state.mode='open'; state.workspace=''; }
        if (state.uncertain && state.pendingWrite && !matchesPendingProject(state.activeProject)) {
          state.error = `The saved selection does not establish the last write outcome at ${state.pendingWrite.projectFolder}. Inspect the last-save target; do not repeat confirmation.`;
          state.message = 'Saved selection refreshed. The last write remains unresolved.'; return;
        }
        state.uncertain = false; state.pendingWrite = null;
        if (state.activeProject) state.view = 'active';
        state.message = 'Saved status refreshed. Any unsaved form values remain in this tab.';
      });
    }
    async function browse(field, index) {
      if (state.busy || !state.capabilities.folderPicker || (state.mode === 'settings' && field === 'projectFolder')) return false;
      const draft = state.drafts[state.mode];
      const initialPath = field === 'openFolder' ? state.openFolder : field === 'libraryFolders' ? draft?.paths.libraryFolders[index] : draft?.[field] ?? draft?.paths[field];
      if (initialPath === undefined) return false;
      return run('Choose a folder in the Windows dialog…', async () => {
        const result = await call('/api/browse', { initialPath });
        if (result.cancelled || !result.path) { state.message = 'Folder selection cancelled. Nothing changed.'; return; }
        if (field === 'openFolder') { state.openFolder = result.path; state.inspected = null; }
        else {
          if (field === 'libraryFolders') draft.paths.libraryFolders[index] = result.path;
          else if (field === 'projectFolder') draft.projectFolder = result.path;
          else draft.paths[field] = result.path;
          invalidateReview(); state.view = 'editor'; markDirty();
        }
        state.message = 'Folder selected. Review changes before saving.';
      });
    }
    async function checkTools() {
      return run('Checking local prerequisites…', async () => {
        const data = await call('/api/tools'); state.tools = data.tools;
        state.message = 'Prerequisite check complete. These results do not install or configure any tools.';
      });
    }
    function openWorkspace(id) {
      if (!state.activeProject || state.uncertain || !Object.hasOwn(WORKSPACES, id) || !canLeave()) return;
      invalidateReview(); state.workspace = id; state.view = 'workspace'; state.message = ''; state.error = ''; emit();
    }
    function showActive() {
      if (!state.activeProject || !canLeave()) return;
      invalidateReview(); state.workspace = ''; state.view = 'active'; state.message = 'Main hub. Unsaved form values remain in this tab.'; emit();
    }
    return { state, start, setOpenFolder, switchProject, inspect, openExisting, chooseMode, updateField, review, acknowledge, confirmReview, beginImport, copyProjectData, editSettings, openSettings, addLibrary, updateLibrary, removeLibrary, cancelReview, refreshStatus, recoverPendingResult, browse, checkTools, expireReview, openWorkspace, showActive };
  }
  function mount(doc, options = {}) {
    const get = id => doc.getElementById(id);
    const make = (tag, text, className) => {
      const node = doc.createElement(tag);
      if (text !== undefined && text !== null) node.textContent = text;
      if (className) node.className = className;
      return node;
    };
    let app, previousView = '', timer, requestFocus = null;
    const schedule = options.schedule || setTimeout;
    const locations = [
      ['projectFolder', 'project-folder', 'Project data folder', 'User-owned project root containing STATE and config: settings, metadata, tags, recipes, assignments, cart definitions, drafts and history. Not the application install folder.'],
      ['compositeFolder', 'composite-folder', 'Composite video folder', 'Generated show blocks assembled from multiple source files. Existing recipe outputs can stay at their original paths.'],
      ['buildsFolder', 'builds-folder', 'Builds folder', 'Cart build outputs and export-ready files. Existing manifests and drafts remain pinned to their original builds.'],
      ['cacheFolder', 'cache-folder', 'Cache folder', 'Disposable previews and temporary processing files. Manual cleanup only; setup never wipes the cache.']
    ];
    function button(text, action, id, primary = false, disabled = false) {
      const node = make('button', text, primary ? 'primary' : ''); node.type = 'button';
      if (id) {
        node.id = id;
        const hooks = { 'open-mode-button': 'mode-open', 'create-button': 'mode-create', 'inspect-button': 'inspect-existing',
          'open-button': 'open-existing', 'import-button': 'import-copy', 'active-import-button': 'import-copy', 'readonly-import-button':'import-copy',
          'review-button': 'review-changes', 'confirm-button': 'confirm-changes', 'settings-button': 'settings', 'switch-button': 'switch-project' };
        node.setAttribute('data-testid', hooks[id] || id);
      }
      node.disabled = disabled || app.state.busy; node.onclick = action; return node;
    }
    function heading(text, description) {
      const group = make('div', null, 'section-heading');
      const title = make('h2', text); title.id = 'view-heading'; title.tabIndex = -1; group.append(title);
      if (description) group.append(make('p', description, 'muted'));
      return group;
    }
    function list(items, className) {
      const node = make('ul', null, className);
      for (const text of items || []) node.append(make('li', text));
      return node;
    }
    function pathList(project) {
      const dl = make('dl', null, 'path-list');
      for (const [key, , label] of locations) {
        dl.append(make('dt', label), make('dd', key === 'projectFolder' ? project.projectFolder : project.paths?.[key] || 'Not configured in this project'));
      }
      if (project.paths?.dataFolder && project.paths.dataFolder !== project.projectFolder) {
        dl.append(make('dt', 'Metadata location'), make('dd', project.paths.dataFolder));
      }
      dl.append(make('dt', 'Library folders'));
      const libraries = make('dd');
      if (project.paths?.libraryFolders?.length) libraries.append(list(project.paths.libraryFolders));
      else libraries.textContent = 'No library folders registered. You can add references later in settings.';
      dl.append(libraries); return dl;
    }
    function projectSummary(project, title) {
      const section = make('section', null, 'project-summary');
      section.append(make('h3', title || project.name || 'Project summary'));
      section.append(make('p', `${project.name || 'Unnamed project'} · ${project.kind === 'legacy' ? 'Legacy · read-only' : project.readOnly ? 'Managed · read-only' : 'Managed project'}`, 'project-kind'));
      const counts = make('dl', null, 'counts');
      for (const [key, label] of [['assets', 'Assets'], ['carts', 'Carts'], ['drafts', 'Drafts']]) {
        const pair = make('div'); pair.append(make('dt', label), make('dd', Number.isFinite(project.summary?.[key]) ? String(project.summary[key]) : 'Not reported')); counts.append(pair);
      }
      section.append(counts, pathList(project));
      if (project.warnings?.length) section.append(list(project.warnings, 'warnings'));
      return section;
    }
    function field({ id, label, value, help, change, folder, index, readOnly = false, required = true }) {
      const wrap = make('div', null, 'field'); const labelNode = make('label', label); labelNode.htmlFor = id;
      const helpNode = make('p', help, 'field-help'); helpNode.id = `${id}-help`;
      const row = make('div', null, 'path-input');
      const input = make('input'); input.type = 'text'; input.id = id; input.name = id; input.value = value || '';
      input.required = required; input.readOnly = readOnly; input.autocomplete = 'off'; input.spellcheck = false;
      input.setAttribute('data-testid', folder === 'libraryFolders' ? 'library-folder' : id === 'existing-folder' ? 'existing-folder' : id);
      input.setAttribute('aria-describedby', helpNode.id); input.oninput = () => change(input.value);
      row.append(input);
      if (folder && !readOnly) {
        const browse = button('Browse…', () => app.browse(folder, index), `${id}-browse`, false, !app.state.capabilities.folderPicker);
        browse.setAttribute('aria-label', `Browse for ${label.toLowerCase()}`);
        if (!app.state.capabilities.folderPicker) browse.title = 'Native picker unavailable. Type an absolute Windows folder path.';
        row.append(browse);
      }
      wrap.append(labelNode, row, helpNode); return wrap;
    }
    function renderChooser(root, state) {
      root.append(heading('Choose your project', 'Open an existing project in place, or start with a new empty project. No media is scanned during setup.'));
      const split = make('div', null, 'chooser-split');
      const open = make('section', null, 'card'); open.append(make('h3', 'Open existing project'));
      const form = make('form'); form.id = 'open-form';
      form.append(field({ id: 'existing-folder', label: 'Existing project data folder', value: state.openFolder,
        help: 'Choose the project root containing retro-project.json (managed) or STATE/settings.json (legacy). Inspection reads metadata only.',
        folder: 'openFolder', change: value => app.setOpenFolder(value) }));
      const inspect = button('Inspect project', null, 'inspect-button', true); inspect.type = 'submit'; form.append(inspect);
      form.onsubmit = event => { event.preventDefault(); return app.inspect(); };
      open.append(form); split.append(open);
      const create = make('section', null, 'card create-card');
      create.append(make('h3', 'Create new project'), make('p', 'Choose separate folders for project data, composites, builds and cache. Register existing media locations without copying their contents.', 'muted'),
        button('Create new project', () => app.chooseMode('create'), 'create-card-button'), make('p', 'No existing library is required. You can start with zero library folders.', 'small'));
      split.append(create); root.append(split);
      if (state.inspected) {
        const inspected = make('section', null, 'card inspected'); inspected.append(projectSummary(state.inspected, 'Inspected project'));
        if (state.inspected.readOnly) inspected.append(make('p', 'Opening this legacy project is read-only. Preferences are saved outside the project. Import a copy into a new empty target to change settings.', 'notice-inline'));
        const actions = make('div', null, 'actions');
        actions.append(button('Open existing project', () => app.openExisting(), 'open-button', true, state.uncertain), button('Import a copy', () => app.beginImport(), 'import-button'));
        inspected.append(actions); root.append(inspected);
      }
      const recent = make('section', null, 'recent'); recent.append(make('h3', 'Recent projects'));
      if (!state.recentProjects.length) recent.append(make('p', 'No recent projects yet. Nothing will open automatically.', 'muted'));
      else {
        const rows = make('ul', null, 'recent-list');
        state.recentProjects.forEach((project, index) => {
          const row = make('li'); const details = make('div'); details.append(make('strong', project.name || 'Unnamed project'), make('p', project.projectFolder, 'path-text'), make('span', project.kind === 'legacy' ? 'Legacy · read-only' : 'Managed', 'small'));
          row.append(details, button('Inspect', () => { app.setOpenFolder(project.projectFolder); return app.inspect(); }, `recent-${index}`)); rows.append(row);
        }); recent.append(rows);
      }
      root.append(recent);
    }
    function renderEditor(root, state) {
      const operation = state.mode; const draft = state.drafts[operation];
      const titles = { create: 'Create a new project', import: 'Import a copy', settings: 'Project settings' };
      root.append(heading(titles[operation], 'Type absolute Windows folder paths or use Browse. The server validates permissions, overlaps and existing content before you can confirm.'));
      if (operation === 'import') {
        const source = make('section', null, 'card source-summary'); source.append(make('h3', 'Source project · unchanged'), make('p', draft.sourceFolder, 'path-text'));
        if (state.inspected) source.append(projectSummary(state.inspected, 'Source metadata'));
        source.append(make('p', 'Copies metadata, configuration and curation with a backup. It never copies source media or built MP4s. Keep original builds accessible: existing manifests and drafts stay pinned to them.', 'notice-inline')); root.append(source);
      }
      const form = make('form', null, 'card'); form.id = 'project-form';
      form.append(field({ id: 'project-name', label: 'Project name', value: draft.name, help: 'A name to identify this project on this computer.', change: value => app.updateField('name', value) }));
      for (const [key, id, label, help] of locations) {
        const isRoot = key === 'projectFolder';
        form.append(field({ id, label: operation === 'import' && isRoot ? 'New project data folder' : label,
          value: isRoot ? draft.projectFolder : draft.paths[key], help: operation === 'settings' && isRoot ? `${help} To change this location, use Copy project data to another folder below. The original is retained for rollback.` : operation !== 'settings' && isRoot ? `${help} Use a new empty folder; existing project data will not be overwritten.` : help,
          folder: key, readOnly: operation === 'settings' && isRoot, change: value => app.updateField(key, value) }));
      }
      if (operation === 'settings') form.append(button('Copy project data to another folder', () => app.copyProjectData(), 'copy-project-data'));
      const libraries = make('section', null, 'library-section'); libraries.append(make('h3', 'Library folders'), make('p', 'Existing source-media folders registered in place. Add or remove references only; no scanning, copying or source deletion.', 'muted'));
      if (!draft.paths.libraryFolders.length) libraries.append(make('p', 'No library folders registered. This is allowed; add them later in settings.', 'empty-state'));
      draft.paths.libraryFolders.forEach((value, index) => {
        const row = make('div', null, 'library-row');
        row.append(field({ id: `library-${index}`, label: `Library folder ${index + 1}`, value, help: 'Reference to existing media. Removing this row does not delete files.', folder: 'libraryFolders', index, change: value => app.updateLibrary(index, value) }));
        const remove = button('Remove reference', () => app.removeLibrary(index), `remove-library-${index}`); remove.setAttribute('aria-label', `Remove library folder ${index + 1} reference`); row.append(remove); libraries.append(row);
      });
      libraries.append(button('Add library folder', () => app.addLibrary(), 'add-library')); form.append(libraries);
      const warning = operation === 'settings'
        ? 'Changing roots changes future defaults only. Existing cart, source, draft, manifest and composite recipe references stay at their saved paths. Nothing is moved or silently relinked. A backup precedes a confirmed settings save.'
        : 'Setup only prepares the chosen project and output locations. Original files stay in place. Composite recipes can still refer to their original output paths.';
      form.append(make('p', warning, 'notice-inline'));
      const actions = make('div', null, 'actions'); const review = button('Review changes', null, 'review-button', true, state.uncertain); review.type = 'submit';
      actions.append(review, button('Back to project chooser', () => app.switchProject(), 'back-button'));
      form.append(actions); form.onsubmit = event => { event.preventDefault(); return app.review(); }; root.append(form);
    }
    function renderReview(root, state) {
      const preview = state.preview;
      const action = { create: 'Create project', import: 'Import a copy', settings: 'Save settings' }[preview.operation];
      root.append(heading('Review changes', 'This is a locked snapshot from the server. Nothing has been written. Go back to edit any value; a new review will be required.'));
      const panel = make('section', null, 'card review-panel');
      panel.append(make('p', `Operation: ${action}`, 'eyebrow'), projectSummary(preview.project, 'Exact reviewed locations'));
      const draft = state.drafts[state.mode];
      if (draft.sourceFolder) panel.append(make('h3', 'Source retained unchanged'), make('p', draft.sourceFolder, 'path-text'));
      panel.append(make('h3', 'Intended changes'), list(preview.changes, 'changes'));
      if (preview.backup) panel.append(make('h3', 'Backup before confirmed changes'), make('p', typeof preview.backup === 'string' ? preview.backup : JSON.stringify(preview.backup, null, 2), 'path-text'));
      panel.append(make('h3', 'References and safety'), make('p', 'Original media and existing outputs are never moved or deleted. Existing manifests and drafts stay pinned to original builds. Location changes set future defaults only; composite recipe outputs can remain at their old paths.', 'muted'));
      if (preview.warnings?.length) panel.append(list(preview.warnings, 'warnings'));
      panel.append(make('p', `Review expires: ${new Date(preview.expiresAt).toLocaleString()}. The server rechecks before applying changes.`, 'small'));
      const ackLabel = make('label', null, 'check-row'); const ack = make('input'); ack.type = 'checkbox'; ack.id = 'review-ack'; ack.checked = state.acknowledged;
      ack.setAttribute('data-testid', 'review-ack');
      ack.onchange = () => app.acknowledge(ack.checked);
      ackLabel.append(ack, make('span', 'I reviewed these exact locations, changes and warnings. Apply this operation without moving, deleting or relinking original files.'));
      panel.append(ackLabel);
      const actions = make('div', null, 'actions'); actions.append(button(action, () => app.confirmReview(), 'confirm-button', true, !state.acknowledged || state.uncertain), button('Back to edit · discard review', () => app.cancelReview(), 'cancel-review'));
      panel.append(actions); root.append(panel);
    }
    function renderActive(root, state) {
      root.append(heading('Main hub', 'Choose a workspace. This checkpoint adds navigation only; the tools inside each workspace are not built yet.'));
      const destinations = make('section', null, 'hub-workspaces'); destinations.setAttribute('aria-label','Workspaces'); destinations.setAttribute('data-testid','main-hub');
      const rows = make('ul', null, 'workspace-list');
      for (const [id, workspace] of Object.entries(WORKSPACES)) {
        const row = make('li', null, 'workspace-row'); const text = make('div');
        text.append(make('h3',workspace.title), make('p',workspace.description,'muted'), make('span','Navigation available · tools pending approval','small'));
        row.append(text, button(`Open ${workspace.title}`,()=>app.openWorkspace(id),`open-${id}`,true,false)); rows.append(row);
      }
      destinations.append(rows); root.append(destinations);
      const panel = make('section', null, 'card active-project'); panel.id = 'active-project'; panel.setAttribute('data-testid', 'active-project');
      panel.append(make('h3','Active project'),make('p',state.activeProject.name,'project-kind'),make('p',state.activeProject.projectFolder,'path-text'));
      const details = make('details'); details.append(make('summary','Project locations and recorded counts'),projectSummary(state.activeProject,'Saved project locations')); panel.append(details);
      if (state.activeProject.readOnly) {
        panel.append(make('p', 'Read-only legacy project. Opening it changes only local preferences, not project files. Import a copy to edit settings.', 'notice-inline'));
        panel.append(button('Import a copy', async () => {
          app.setOpenFolder(state.activeProject.projectFolder);
          if (await app.inspect()) app.beginImport();
        }, 'active-import-button'));
      }
      const actions = make('div', null, 'actions'); actions.append(button('Switch project', () => app.switchProject(), 'switch-button'));
      panel.append(actions); root.append(panel);
    }
    function renderReadOnlySettings(root,state) {
      root.append(heading('Project settings','Read-only project. Saved locations are shown here; import a copy to make editable settings.'));
      const panel=make('section',null,'card');panel.setAttribute('data-testid','readonly-settings');panel.append(projectSummary(state.activeProject,'Saved project locations'));
      panel.append(button('Import a copy to edit settings',async()=>{app.setOpenFolder(state.activeProject.projectFolder);if(await app.inspect())app.beginImport();},'readonly-import-button',true),button('Back to hub',()=>app.showActive(),'back-to-hub'));
      root.append(panel);
    }
    function renderWorkspace(root, state) {
      const workspace = WORKSPACES[state.workspace];
      root.append(heading(workspace.title,workspace.description));
      const panel = make('section',null,'card workspace-entry'); panel.setAttribute('data-testid','workspace-entry');
      panel.append(make('h3','Workspace entry only'),make('p','Tools are not implemented yet. This page verifies entry and return navigation; it does not scan, plan, review, render or export anything.','muted'),make('p',workspace.next,'notice-inline'));
      if(state.workspace==='library') {
        const link=make('a','Open Library Manager mockup · sample data only','mockup-link');link.id='library-design-link';link.setAttribute('data-testid','library-design-link');link.setAttribute('href','/mockups/library-manager/');link.setAttribute('target','_blank');link.setAttribute('rel','noopener noreferrer');panel.append(link);
      }
      panel.append(make('p',`Project: ${state.activeProject.name}`,'project-kind'),make('p',state.activeProject.projectFolder,'path-text'),button('Back to hub',()=>app.showActive(),'back-to-hub',true));
      root.append(panel);
    }
    function render(state) {
      const active = doc.activeElement;
      if (state.busy && active?.id && get(active.id)) requestFocus = { id: active.id, selection: [active.selectionStart, active.selectionEnd] };
      const focus = active?.id || requestFocus?.id;
      const selection = active?.id ? [active.selectionStart, active.selectionEnd] : requestFocus?.selection || [];
      const sameView = previousView === state.view;
      const content = get('setup-content');
      get('active-indicator').textContent = state.activeProject ? `Active project · ${state.activeProject.name}${state.activeProject.readOnly ? ' · read-only' : ''}\n${state.activeProject.projectFolder}` : 'No project selected';
      get('error').textContent = state.error; get('error').hidden = !state.error;
      get('notice').textContent = state.message; get('notice').hidden = !state.message;
      content.setAttribute('aria-busy', String(state.busy));
      ['choose', 'review', 'ready'].forEach(step => get(`step-${step}`).removeAttribute('aria-current'));
      get(`step-${state.view === 'active' ? 'ready' : ['editor', 'review'].includes(state.view) ? 'review' : 'choose'}`).setAttribute('aria-current', 'step');
      const steps=get('setup-steps'); if(steps) steps.hidden=['active','workspace','settings-readonly'].includes(state.view);
      const controls = make('fieldset', null, 'setup-controls'); controls.disabled = state.busy;
      controls.append(make('legend', 'Project setup controls', 'sr-only'));
      if (!state.initialized) {
        controls.append(heading('Connect to local setup', 'The local setup service supplies your saved preferences and default folders.'));
        if (!state.busy) controls.append(button('Retry connection', () => app.start(), 'retry-button', true));
      } else {
        const nav = make('nav', null, 'mode-nav'); nav.setAttribute('aria-label', 'Application navigation');
        if(state.activeProject) { const hub=button('Hub',()=>app.showActive(),'hub'); if(state.view==='active')hub.setAttribute('aria-current','page'); nav.append(hub); }
        const open = button('Open existing', () => app.chooseMode('open'), 'open-mode-button');
        const create = button('Create new', () => app.chooseMode('create'), 'create-button');
        const settingsDisabled = !state.activeProject;
        const settings = button('Settings', () => app.openSettings(), 'settings-button', false, settingsDisabled);
        settings.setAttribute('aria-describedby', 'settings-help');
        const current = ['active','workspace'].includes(state.view) ? null : state.view==='settings-readonly' ? settings : state.mode === 'open' ? open : state.mode === 'create' ? create : state.mode === 'settings' ? settings : null;
        if (current) current.setAttribute('aria-current', 'page');
        nav.append(open, create, settings);

        controls.append(nav);
        const readOnlySettings=state.activeProject && (state.activeProject.kind!=='managed' || state.activeProject.readOnly);
        const help = make('p', settingsDisabled ? 'Open a project to view its settings.' : readOnlySettings ? 'Legacy settings are view-only. Import a copy to change them.' : 'Settings apply to the active managed project.', 'small settings-help'); help.id = 'settings-help'; controls.append(help);
        if (!state.capabilities.folderPicker) controls.append(make('p', 'Native folder picker is unavailable. Type absolute Windows paths in the folder fields.', 'notice-inline'));
        if (state.uncertain) {
          const recovery = make('section', null, 'recovery'); recovery.append(make('h3', 'Check the saved result before continuing'), make('p', 'The last write may have completed. Setup will not retry it automatically.'), button('Refresh status', () => app.refreshStatus(), 'refresh-status-button', true));
          if (state.pendingWrite) recovery.append(button('Inspect last-save target', () => app.recoverPendingResult(), 'inspect-pending-button'));
          controls.append(recovery);
        }
        if (state.view === 'chooser') renderChooser(controls, state);
        else if (state.view === 'editor') renderEditor(controls, state);
        else if (state.view === 'review' && state.preview) renderReview(controls, state);
        else if (state.view === 'active') renderActive(controls, state);
        else if (state.view === 'workspace') renderWorkspace(controls, state);
        else if (state.view === 'settings-readonly') renderReadOnlySettings(controls,state);
        const tools = make('section', null, 'tools-section'); tools.append(make('h3', 'Local prerequisites'), make('p', 'Check installed tools without installing anything. This is not a media scan or a runtime packaging check.', 'muted'), button('Check prerequisites', () => app.checkTools(), 'check-tools-button'));
        if (state.tools) {
          if (!state.tools.length) tools.append(make('p', 'The server reported no tool checks.', 'muted'));
          else { const rows = make('ul', null, 'tool-results'); state.tools.forEach(tool => rows.append(make('li', `${tool.name}: ${tool.available ? 'Available' : 'Unavailable'}${tool.version ? ` · ${tool.version}` : ''}${tool.error ? ` · ${tool.error}` : ''}`, tool.available ? 'tool-ok' : 'tool-missing'))); tools.append(rows); }
        }
        tools.append(button('Refresh saved status', () => app.refreshStatus(), 'read-status-button')); controls.append(tools);
      }
      content.replaceChildren(controls);
      if (sameView && focus && get(focus) && !get(focus).disabled) {
        get(focus).focus({ preventScroll: true });
        if (typeof selection[0] === 'number' && get(focus).type === 'text') get(focus).setSelectionRange(...selection);
      } else if (!sameView && !state.busy) get('view-heading')?.focus({ preventScroll: true });
      previousView = state.view;
      if (!state.busy) requestFocus = null;
      if (timer) clearTimeout(timer);
      if (state.preview && !state.busy) timer = schedule(() => app.expireReview(), Math.max(0, Math.min(2147483647, Date.parse(state.preview.expiresAt) - Date.now())));
    }
    app = createController({ ...options, render, confirmDiscard: options.confirmDiscard || (message => globalThis.confirm(message)) });
    app.ready = app.start();
    return app;
  }
  function createRequest(fetcher) {
    return async (url, body, csrfToken) => {
      const options = { method: body === undefined ? 'GET' : 'POST', cache: 'no-store', credentials: 'same-origin', headers: { Accept: 'application/json' } };
      if (body !== undefined) { options.headers['Content-Type'] = 'application/json'; options.headers['X-RetroTV-Token'] = csrfToken; options.body = JSON.stringify(body); }
      let response;
      try { response = await fetcher(url, options); }
      catch (error) { throw Error(`Local setup connection failed: ${error.message}`); }
      let data;
      try { data = await response.json(); }
      catch (_) { throw Error('The local setup response could not be read. Check the saved status before repeating a write.'); }
      if (!response.ok) { const error = Error(data.error || `Setup request failed (HTTP ${response.status}).`); error.httpStatus = response.status; throw error; }
      return data;
    };
  }
  if (typeof module !== 'undefined' && module.exports) module.exports = { createController, mount, createRequest };
  else if (typeof document !== 'undefined') {
    const app = mount(document, { request: createRequest(globalThis.fetch.bind(globalThis)) });
    globalThis.addEventListener('beforeunload', event => {
      if (app.state.dirty || app.state.uncertain || app.state.busy) { event.preventDefault(); event.returnValue = ''; }
    });
  }
})();
