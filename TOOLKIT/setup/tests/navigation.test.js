'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const {createController}=require('../app.js');
const defaults={projectFolder:'C:\\Projects\\New',buildsFolder:'C:\\Builds',compositeFolder:'C:\\Composites',cacheFolder:'C:\\Cache',libraryFolders:[]};
const project={kind:'managed',readOnly:false,name:'Navigation project',projectFolder:'C:\\Projects\\Selected',paths:{dataFolder:'C:\\Projects\\Selected',...defaults},summary:{assets:0,carts:0,drafts:0},warnings:[]};
const bootstrap=active=>({phase:'2',csrfToken:'fixture',capabilities:{folderPicker:true},status:{activeProject:active,recentProjects:[],defaults}});
function savingFixture(options={}) {
  const calls=[],projects=new Map([project,...(options.projects||[])].map(value=>[value.projectFolder,value]));
  let reviewed;
  const app=createController({confirmDiscard:options.confirmDiscard||(()=>true),request:async(url,body)=>{
    calls.push({url,body});
    if(url==='/api/bootstrap')return bootstrap(project);
    if(url==='/api/inspect' || url==='/api/open')return {project:projects.get(body.projectFolder)};
    if(url==='/api/preview'){
      reviewed={...project,name:body.name,projectFolder:body.projectFolder,paths:{...body.paths,dataFolder:body.projectFolder}};
      return {preview:{token:'navigation-review',operation:body.operation,expiresAt:'2099-01-01',project:reviewed,changes:[],warnings:[]}};
    }
    if(url==='/api/confirm'){
      if(options.confirmError)throw options.confirmError;
      projects.set(reviewed.projectFolder,reviewed);return {project:reviewed};
    }
    if(url==='/api/browse')return {path:'D:\\Picked',cancelled:false};
    throw Error(`Unexpected request: ${url}`);
  }});
  const confirm=async()=>{assert.equal(await app.review(),true);app.acknowledge(true);return app.confirmReview();};
  const select=async value=>{app.switchProject();app.setOpenFolder(value.projectFolder);assert.equal(await app.inspect(),true);assert.equal(await app.openExisting(),true);};
  return {app,calls,confirm,select};
}

for(const replace of [false,true])test(`changing a pending import source requires explicit discard (${replace?'accept':'cancel'})`,async()=>{
  let allowLeave=true;const prompts=[];
  const other={...project,name:'Other import source',projectFolder:'C:\\Projects\\Other'};
  const {app}=savingFixture({projects:[other],confirmDiscard:message=>{prompts.push(message);return allowLeave;}});
  await app.start();app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();app.updateField('name','Keep source A import');
  const original=structuredClone(app.state.drafts.import);app.showActive();app.setOpenFolder(other.projectFolder);await app.inspect();allowLeave=replace;
  const outcome=app.beginImport();assert.match(prompts.at(-1),/discard.*import|replace.*import/i);
  if(replace){assert.equal(outcome,true);assert.equal(app.state.drafts.import.sourceFolder,other.projectFolder);assert.equal(app.state.dirty,false);}
  else{assert.equal(outcome,false);assert.deepEqual(app.state.drafts.import,original);assert.equal(app.state.dirty,true);}
});

test('copy-project navigation respects cancellation of replacing a pending import',async()=>{
  let allowLeave=true;const other={...project,name:'Other project',projectFolder:'C:\\Projects\\Other'};
  const {app,select}=savingFixture({projects:[other],confirmDiscard:()=>allowLeave});
  await app.start();app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();app.updateField('name','Keep import A');await select(other);allowLeave=false;
  assert.equal(await app.copyProjectData(),false);assert.equal(app.state.drafts.import.name,'Keep import A');assert.equal(app.state.view,'active');
});

test('saving Settings retains an unrelated Create draft after accepted Hub navigation',async()=>{
  const {app,confirm}=savingFixture();
  await app.start();app.chooseMode('create');app.updateField('name','Unsaved new project');
  app.showActive();assert.equal(app.state.view,'active');
  app.openSettings();app.updateField('name','Saved existing project');assert.equal(await confirm(),true);
  app.chooseMode('create');
  assert.equal(app.state.drafts.create.name,'Unsaved new project');
});

test('retained Create edits still trigger the leave warning after saving Settings',async()=>{
  let allowLeave=true,warnings=0;
  const {app,confirm}=savingFixture({confirmDiscard:()=>{warnings++;return allowLeave;}});
  await app.start();app.chooseMode('create');app.updateField('name','Unsaved new project');app.showActive();
  app.openSettings();app.updateField('name','Saved existing project');assert.equal(await confirm(),true);
  assert.equal(app.state.dirty,true,'retained Create work must still trigger beforeunload');
  app.chooseMode('create');allowLeave=false;
  const previousWarnings=warnings;app.showActive();
  assert.equal(warnings,previousWarnings+1);assert.equal(app.state.view,'editor');
});

test('saving Settings retains a pending Import form and its leave warning',async()=>{
  let allowLeave=true;
  const {app,confirm}=savingFixture({confirmDiscard:()=>allowLeave});
  await app.start();app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();
  app.updateField('name','Unsaved imported copy');app.updateField('projectFolder','C:\\Projects\\Copy');
  const pending=structuredClone(app.state.drafts.import);
  app.showActive();app.openSettings();app.updateField('name','Saved existing project');assert.equal(await confirm(),true);
  assert.deepEqual(app.state.drafts.import,pending);assert.equal(app.state.dirty,true);
  app.beginImport();assert.deepEqual(app.state.drafts.import,pending);allowLeave=false;
  app.showActive();assert.equal(app.state.view,'editor');
});

test('saving project B retains project A Settings and its dirty warning',async()=>{
  let allowLeave=true;
  const other={...project,name:'Other project',projectFolder:'C:\\Projects\\Other'};
  const {app,confirm,select}=savingFixture({projects:[other],confirmDiscard:()=>allowLeave});
  await app.start();app.openSettings();app.updateField('name','Unsaved A');
  await select(other);app.openSettings();app.updateField('name','Saved B');assert.equal(await confirm(),true);
  assert.equal(app.state.drafts.settings,undefined,'the confirmed Settings form is cleared');
  assert.equal(app.state.dirty,true,'project A still has pending settings');
  app.openSettings();assert.equal(app.state.drafts.settings.name,'Saved B','B uses its saved baseline, not a stale draft');
  await select(project);app.openSettings();assert.equal(app.state.drafts.settings.name,'Unsaved A');
  allowLeave=false;app.showActive();assert.equal(app.state.view,'editor');
  assert.equal(project.name,'Navigation project');assert.equal(other.name,'Other project');
});

for(const operation of ['create','import'])test(`confirming ${operation} clears only its own form and retains unrelated Settings and copy drafts`,async()=>{
  const {app,confirm,select}=savingFixture();
  await app.start();app.openSettings();app.updateField('name','Unsaved original settings');
  const settings=structuredClone(app.state.drafts.settings);app.showActive();
  app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();app.updateField('name','Unsaved copy');app.showActive();
  app.chooseMode('create');app.updateField('name','Unsaved new project');
  if(operation==='import'){app.showActive();app.beginImport();}
  const unrelated=operation==='create'?'import':'create',pending=structuredClone(app.state.drafts[unrelated]);
  assert.equal(await confirm(),true);
  assert.equal(app.state.drafts[operation],undefined);assert.deepEqual(app.state.drafts[unrelated],pending);
  assert.deepEqual(app.state.drafts.settings,settings);assert.equal(app.state.dirty,true);
  await select(project);app.openSettings();assert.deepEqual(app.state.drafts.settings,settings,'the original project Settings cache entry survives');
});

for(const httpStatus of [400,503,undefined])test(`${httpStatus||'network'} confirmation failure preserves every pending form without replay`,async()=>{
  const error=Object.assign(Error('Fixture confirmation failure'),httpStatus?{httpStatus}:{});
  const {app,confirm,calls}=savingFixture({confirmError:error});
  await app.start();app.openSettings();app.updateField('name','Pending settings');app.showActive();
  app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();app.updateField('name','Pending import');app.showActive();
  app.chooseMode('create');app.updateField('name','Pending create');app.showActive();app.openSettings();
  const pending=structuredClone(app.state.drafts);
  assert.equal(await confirm(),false);assert.deepEqual(app.state.drafts,pending);assert.equal(app.state.dirty,true);
  assert.equal(app.state.preview,null);assert.equal(app.state.uncertain,httpStatus!==400);
  assert.equal(app.state.pendingWrite===null,httpStatus===400);
  await app.confirmReview();assert.equal(calls.filter(call=>call.url==='/api/confirm').length,1);
  app.showActive();app.openSettings();assert.deepEqual(app.state.drafts.settings,pending.settings);
  if(httpStatus!==400){await app.review();assert.equal(calls.filter(call=>call.url==='/api/preview').length,1);}
});

for(const mode of ['create','import','settings'])test(`${mode} names, roots, libraries and native picks remain dirty across another form save`,async()=>{
  const edits=[...['name','buildsFolder','compositeFolder','cacheFolder',...(mode==='settings'?[]:['projectFolder'])].map(field=>[field,app=>app.updateField(field,field==='name'?'Edited name':'D:\\Edited')]),
    ['library reference',app=>app.addLibrary()],['native pick',app=>app.browse('buildsFolder')]];
  for(const [label,edit] of edits){
    const {app,confirm}=savingFixture();await app.start();
    if(mode==='create')app.chooseMode('create');
    else if(mode==='settings')app.openSettings();
    else{app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();}
    assert.equal(app.state.dirty,false,`${label}: unopened defaults are not edits`);
    await edit(app);assert.equal(app.state.dirty,true,`${label}: the edit is dirty`);
    const pending=structuredClone(app.state.drafts[mode]);app.showActive();
    if(mode==='settings'){app.chooseMode('create');app.updateField('name','Saved new project');}
    else{app.openSettings();app.updateField('name','Saved settings');}
    assert.equal(await confirm(),true);assert.deepEqual(app.state.drafts[mode],pending,`${label}: values survive`);
    assert.equal(app.state.dirty,true,`${label}: retained form still warns`);
  }
});

test('unedited cached Create and Import defaults do not invent pending work after a save',async()=>{
  const {app,confirm}=savingFixture();await app.start();app.chooseMode('create');app.showActive();
  app.setOpenFolder(project.projectFolder);await app.inspect();app.beginImport();app.showActive();
  assert.equal(app.state.dirty,false);app.openSettings();app.updateField('name','Saved settings');
  assert.equal(await confirm(),true);assert.equal(app.state.dirty,false);
  assert.ok(app.state.drafts.create);assert.ok(app.state.drafts.import);
  app.openSettings();assert.equal(app.state.dirty,false,'confirmed Settings reopen at the saved baseline');app.showActive();
  app.chooseMode('create');app.updateField('name','Saved new project');assert.equal(await confirm(),true);
  assert.equal(app.state.drafts.create,undefined);assert.equal(app.state.dirty,false,'the confirmed form no longer contributes dirty state');
});

test('a restored project opens the hub and all three workspace entries return without processing calls',async()=>{
  const calls=[];
  const app=createController({request:async url=>{calls.push(url);assert.equal(url,'/api/bootstrap');return bootstrap(project);}});
  await app.start();assert.equal(app.state.view,'active');
  assert.equal(typeof app.openWorkspace,'function','workspace navigation is not implemented');
  for(const id of ['library','cart-builder','tv-studio']){
    app.openWorkspace(id);assert.equal(app.state.view,'workspace');assert.equal(app.state.workspace,id);
    assert.equal(app.state.activeProject.projectFolder,project.projectFolder);
    app.showActive();assert.equal(app.state.view,'active');
  }
  assert.deepEqual(calls,['/api/bootstrap']);
});

test('workspace Settings returns to preserved edits and leaving a dirty form can be cancelled',async()=>{
  let allowLeave=false;
  const app=createController({request:async()=>bootstrap(project),confirmDiscard:()=>allowLeave});
  await app.start();app.editSettings();app.updateField('name','Unsaved project name');
  app.openWorkspace('library');assert.equal(app.state.view,'editor');
  allowLeave=true;app.openWorkspace('library');assert.equal(app.state.view,'workspace');
  assert.equal(typeof app.openSettings,'function','workspace-accessible Settings is missing');
  app.openSettings();assert.equal(app.state.view,'editor');assert.equal(app.state.drafts.settings.name,'Unsaved project name');
  allowLeave=false;app.showActive();assert.equal(app.state.view,'editor');
  allowLeave=true;app.showActive();assert.equal(app.state.view,'active');
  app.openSettings();assert.equal(app.state.drafts.settings.name,'Unsaved project name');
  assert.equal(app.state.activeProject.name,'Navigation project','navigation must not save form edits');
});

test('legacy workspace Settings is accessible as read-only without enabling edits or writes',async()=>{
  const calls=[],legacy={...project,kind:'legacy',readOnly:true};
  const app=createController({request:async url=>{calls.push(url);return bootstrap(legacy);}});
  await app.start();app.openWorkspace('tv-studio');app.openSettings();
  assert.equal(app.state.view,'settings-readonly');
  assert.equal(app.state.drafts.settings,undefined);
  app.updateField('name','Must not edit legacy');await app.review();
  assert.equal(app.state.view,'settings-readonly');assert.equal(app.state.activeProject.name,legacy.name);
  app.showActive();assert.equal(app.state.view,'active');assert.deepEqual(calls,['/api/bootstrap']);
});

test('switching projects keeps each project settings draft separate in the current tab',async()=>{
  const other={...project,name:'Other project',projectFolder:'C:\\Projects\\Other'};
  const choose=folder=>folder===other.projectFolder?other:project;
  const calls=[];
  const app=createController({confirmDiscard:()=>true,request:async(url,body)=>{calls.push(url);if(url==='/api/bootstrap')return bootstrap(project);if(['/api/inspect','/api/open'].includes(url))return {project:choose(body.projectFolder)};throw Error('Unexpected request');}});
  const select=async p=>{app.switchProject();app.setOpenFolder(p.projectFolder);await app.inspect();await app.openExisting();app.openSettings();};
  await app.start();app.openSettings();app.updateField('name','Unsaved A');
  await select(other);assert.equal(app.state.drafts.settings.name,'Other project');app.updateField('name','Unsaved B');
  await select(project);assert.equal(app.state.drafts.settings.name,'Unsaved A');
  await select(other);assert.equal(app.state.drafts.settings.name,'Unsaved B');
  assert.equal(calls.includes('/api/confirm'),false);
});

test('refreshing an absent saved selection leaves workspace safely without discarding cached edits',async()=>{
  const app=createController({confirmDiscard:()=>true,request:async url=>url==='/api/bootstrap'?bootstrap(project):{status:bootstrap(null).status}});
  await app.start();app.openSettings();app.updateField('name','Retained draft');app.openWorkspace('library');
  await app.refreshStatus();assert.equal(app.state.activeProject,null);assert.equal(app.state.view,'chooser');
  assert.equal(app.state.drafts.settings.name,'Retained draft');assert.equal(app.state.dirty,true);
});
