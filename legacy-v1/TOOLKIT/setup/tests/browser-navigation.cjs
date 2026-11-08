'use strict';
// Optional real Edge regression. Requires Playwright supplied separately; never an application dependency.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const scratch=process.env.RETRO_TV_TEST_ROOT;
assert.ok(scratch && path.isAbsolute(scratch),'Set RETRO_TV_TEST_ROOT to an absolute disposable directory.');
fs.mkdirSync(scratch,{recursive:true});const work=fs.mkdtempSync(path.join(scratch,'hub-browser-'));
process.env.TEMP=process.env.TMP=process.env.TMPDIR=work;
const evidence=process.env.RETRO_TV_EVIDENCE_DIR || path.join(work,'evidence');fs.mkdirSync(evidence,{recursive:true});
const {chromium}=require(process.env.RETRO_TV_PLAYWRIGHT_PATH || 'playwright');
const {ProjectStore}=require('../project-store');const {createSetupServer}=require('../server');
const projectFolder=path.join(work,'project [navigation]');
const store=new ProjectStore({appDataDir:path.join(work,'preferences'),installRoot:path.resolve(__dirname,'../../..')});
store.confirm(store.preview({operation:'create',name:'Navigation Fixture',projectFolder,paths:{buildsFolder:path.join(work,'builds'),compositeFolder:path.join(work,'composites'),cacheFolder:path.join(projectFolder,'CACHE'),libraryFolders:[]}}).token);
const otherFolder=path.join(work,'other project');
store.confirm(store.preview({operation:'create',name:'Other Navigation Fixture',projectFolder:otherFolder,paths:{buildsFolder:path.join(work,'other-builds'),compositeFolder:path.join(work,'other-composites'),cacheFolder:path.join(otherFolder,'CACHE'),libraryFolders:[]}}).token);
store.open(projectFolder);
const server=createSetupServer({store});let browser;
(async()=>{const result={scope:'Real Edge/HTTP/ProjectStore; all writes are disposable, optional explicitly supplied legacy metadata is opened read-only',checks:[]};
try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;
 browser=await chromium.launch({channel:'msedge',headless:true});const page=await browser.newPage({viewport:{width:1440,height:1050}});page.setDefaultTimeout(3000);
 const errors=[],posts=[];let allowDiscard=false;
 page.on('dialog',dialog=>allowDiscard?dialog.accept():dialog.dismiss());
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(r.method()==='POST')posts.push(r.url());});
 await page.goto(base);await page.getByRole('heading',{name:'Combined workspace',exact:true}).waitFor();
 assert.match(await page.locator('#active-indicator').innerText(),/Navigation Fixture/);assert.ok((await page.locator('#active-indicator').innerText()).includes(projectFolder));
 result.checks.push('Saved project opens live combined workspace with name and full folder');
 const designPageEvent=page.context().waitForEvent('page');await page.getByTestId('open-library').click();const designPage=await designPageEvent;await designPage.waitForLoadState('domcontentloaded');assert.match(designPage.url(),/\/mockups\/library-manager\/$/);assert.equal(await designPage.evaluate(()=>window.opener===null),true);await designPage.close();
 await page.getByRole('heading',{name:'Combined workspace',exact:true}).waitFor();result.checks.push('Library design opens directly from hub in a no-opener tab without an entry page');
 for(const id of ['library','cart-builder','tv-studio']){
  assert.equal(await page.getByTestId('live-area-'+id).isVisible(),true);
  const bounds=await page.getByTestId('live-area-'+id).boundingBox();assert.ok(bounds.y>=0&&bounds.y+bounds.height<=1050&&bounds.x>=0&&bounds.x+bounds.width<=1440,JSON.stringify(bounds));
  await page.getByTestId('live-expand-'+id).click();await page.getByTestId('live-restore').click();
 }
 await page.getByTestId('live-divider-0').focus();await page.keyboard.press('End');assert.equal(await page.getByTestId('live-divider-0').getAttribute('aria-valuenow'),'70');await page.keyboard.press('Home');assert.equal(await page.getByTestId('live-divider-0').getAttribute('aria-valuenow'),'15');
 const divider=await page.getByTestId('live-divider-0').boundingBox();await page.mouse.move(divider.x+5,divider.y+20);await page.mouse.down();await page.mouse.move(divider.x+200,divider.y+20);await page.mouse.up();
 result.checks.push('All three viewport-contained panes, expand/restore and real keyboard/pointer resizing');
 assert.deepEqual(posts,[],'navigation must not invoke writes or media jobs');
 await page.reload();await page.getByRole('heading',{name:'Combined workspace',exact:true}).waitFor();result.checks.push('Reload returns directly to live combined workspace');
 await page.getByTestId('settings').click();await page.getByTestId('project-name').fill('Unsaved A');
 await page.getByTestId('hub').click();await page.getByRole('heading',{name:'Project settings',exact:true}).waitFor();assert.equal(await page.getByTestId('project-name').inputValue(),'Unsaved A');
 allowDiscard=true;await page.getByTestId('hub').click();await page.getByTestId('settings').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Unsaved A');
 await page.getByTestId('hub').click();assert.deepEqual(posts,[],'settings navigation must not write or silently save drafts');
 result.checks.push('Dirty-form navigation can be cancelled and workspace Settings restores unsaved values without writes');
 const selectProject=async folder=>{
  await page.getByTestId('switch-project').click();await page.getByTestId('existing-folder').fill(folder);
  const inspect=page.waitForResponse(r=>r.url().endsWith('/api/inspect'));await page.getByTestId('inspect-existing').click();assert.equal((await inspect).status(),200);
  const opened=page.waitForResponse(r=>r.url().endsWith('/api/open'));await page.getByTestId('open-existing').click();assert.equal((await opened).status(),200);
  await page.getByRole('heading',{name:'Combined workspace',exact:true}).waitFor();
 };
 await selectProject(otherFolder);await page.getByTestId('settings').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Other Navigation Fixture');await page.getByTestId('project-name').fill('Unsaved B');await page.getByTestId('hub').click();
 await selectProject(projectFolder);await page.getByTestId('settings').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Unsaved A');await page.getByTestId('hub').click();
 await selectProject(otherFolder);await page.getByTestId('settings').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Unsaved B');await page.getByTestId('hub').click();
 assert.equal(JSON.parse(fs.readFileSync(path.join(projectFolder,'retro-project.json'),'utf8')).name,'Navigation Fixture');
 assert.equal(JSON.parse(fs.readFileSync(path.join(otherFolder,'retro-project.json'),'utf8')).name,'Other Navigation Fixture');
 result.checks.push('Switching two real projects keeps settings drafts separate and does not apply either draft');
 if(process.env.RETRO_TV_LEGACY_PROJECT){
  await selectProject(process.env.RETRO_TV_LEGACY_PROJECT);await page.getByTestId('settings').click();await page.getByTestId('readonly-settings').waitFor();
  assert.equal(await page.getByTestId('project-name').count(),0);assert.equal(await page.getByTestId('import-copy').isVisible(),true);await page.getByTestId('back-to-hub').click();
  result.checks.push('Explicitly supplied legacy project has accessible read-only workspace Settings and no edit form');
 }
 await selectProject(projectFolder);
 // Confirming one operation must not discard other in-tab forms.
 const pendingCreate=path.join(work,'pending create');
 await page.getByTestId('mode-create').click();
 for(const[id,value]of Object.entries({'project-name':'Retained create wizard','project-folder':pendingCreate,'builds-folder':path.join(work,'pending-create-builds'),'composite-folder':path.join(work,'pending-create-composites'),'cache-folder':path.join(pendingCreate,'CACHE')}))await page.getByTestId(id).fill(value);
 await page.getByTestId('hub').click();await page.getByTestId('settings').click();await page.getByTestId('copy-project-data').click();
 await page.getByTestId('project-name').fill('Retained import wizard');await page.getByTestId('project-folder').fill(path.join(work,'pending import'));await page.getByTestId('hub').click();
 const save=async()=>{
  const reviewed=page.waitForResponse(r=>r.url().endsWith('/api/preview'));await page.getByTestId('review-changes').click();const preview=await reviewed;assert.equal(preview.status(),200,await preview.text());
  await page.getByTestId('review-ack').check();const confirmed=page.waitForResponse(r=>r.url().endsWith('/api/confirm'));await page.getByTestId('confirm-changes').click();const receipt=await confirmed;assert.equal(receipt.status(),200,await receipt.text());await page.getByRole('heading',{name:'Combined workspace',exact:true}).waitFor();
 };
 const unloadWarns=()=>page.evaluate(()=>{const event=new Event('beforeunload',{cancelable:true});window.dispatchEvent(event);return event.defaultPrevented;});
 await page.getByTestId('settings').click();await page.getByTestId('project-name').fill('Saved A during preservation test');await save();assert.equal(await unloadWarns(),true);
 await page.getByTestId('mode-create').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Retained create wizard');await page.getByTestId('hub').click();
 await page.getByTestId('settings').click();await page.getByTestId('copy-project-data').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Retained import wizard');await page.getByTestId('hub').click();
 await selectProject(otherFolder);await page.getByTestId('settings').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Unsaved B');await page.getByTestId('hub').click();
 result.checks.push('Real settings confirmation preserves unrelated create/import forms and another project settings draft, with unload warning');
 await page.getByTestId('mode-create').click();await save();assert.equal(JSON.parse(fs.readFileSync(path.join(pendingCreate,'retro-project.json'),'utf8')).name,'Retained create wizard');
 await page.getByTestId('mode-create').click();assert.equal(await page.getByTestId('project-name').inputValue(),'');await page.getByTestId('hub').click();
 await selectProject(projectFolder);await page.getByTestId('settings').click();await page.getByTestId('copy-project-data').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Retained import wizard');await page.getByTestId('hub').click();
 await selectProject(otherFolder);await page.getByTestId('settings').click();assert.equal(await page.getByTestId('project-name').inputValue(),'Unsaved B');await page.getByTestId('hub').click();assert.equal(await unloadWarns(),true);
 result.checks.push('Real create confirmation clears only its own form and retains pending import/settings drafts');
 await selectProject(projectFolder);
 // Real Library vertical slice: synthetic owned fixture, typed registration, durable metadata,
 // in-tab draft continuity across settings/project switches and independent pane scrolling.
 const mediaFolder=path.join(work,'source media');fs.mkdirSync(mediaFolder);const source=path.join(mediaFolder,'synthetic.mp4');require('node:child_process').execFileSync('ffmpeg',['-hide_banner','-loglevel','error','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','2','-c:v','libx264','-pix_fmt','yuv420p','-c:a','aac','-y',source]);
 const sourceHash=require('node:crypto').createHash('sha256').update(fs.readFileSync(source)).digest('hex');
 const actionResponse=()=>page.waitForResponse(r=>r.url().endsWith('/api/library/action'));
 await page.getByText('Locations, registration & filters',{exact:true}).click();await page.getByTestId('live-registration-path').fill(source);let receipt=actionResponse();await page.getByTestId('live-register-asset').click();let response=await receipt;assert.equal(response.status(),200,await response.text());const registered=await response.json(),assetId=registered.result.assetId;
 await page.getByTestId('live-asset-'+assetId).click();await page.getByTestId('live-category').selectOption('Commercial');await page.getByTestId('live-flag-Food').check();await page.getByTestId('live-notes').fill('Saved human notes · moon');receipt=actionResponse();await page.getByTestId('live-save-metadata').click();response=await receipt;assert.equal(response.status(),200,await response.text());
 await page.getByTestId('live-notes').fill('Unsaved library notes A');await page.getByTestId('settings').click();await page.getByTestId('hub').click();assert.equal(await page.getByTestId('live-notes').inputValue(),'Unsaved library notes A');
 await selectProject(otherFolder);await selectProject(projectFolder);assert.equal(await page.getByTestId('live-notes').inputValue(),'Unsaved library notes A');await page.getByTestId('live-expand-cart-builder').click();await page.getByTestId('live-restore').click();assert.equal(await page.getByTestId('live-notes').inputValue(),'Unsaved library notes A');
 const savedLibrary=JSON.parse(fs.readFileSync(path.join(projectFolder,'STATE','library-catalog.json'),'utf8'));assert.equal(savedLibrary.assets.find(a=>a.id===assetId).notes,'Saved human notes · moon');
 assert.equal(await page.getByTestId('live-area-library').evaluate(n=>n.scrollHeight>n.clientHeight),true);await page.getByTestId('live-area-library').evaluate(n=>n.scrollTop=300);const studioBounds=await page.getByTestId('live-area-tv-studio').boundingBox();assert.ok(studioBounds.y+studioBounds.height<=1050);
 result.checks.push('Real synthetic-source registration and metadata persistence; library drafts survive Settings, switching projects and expansion; independent pane scroll');
 // Real processing uses the checked job service, never fixtures or simulated percentages.
 const startJob=async id=>{const pending=page.waitForResponse(r=>r.url().endsWith('/api/library/job'));await page.getByTestId(id).click();const r=await pending;assert.equal(r.status(),200,await r.text());return (await r.json()).result.jobId;};
 const waitJob=async id=>{await page.waitForFunction(id=>{const rows=[...document.querySelectorAll('.lw-job')];return rows.some(n=>n.textContent.includes('succeeded'))&&document.querySelector('[data-testid="live-cancel-'+id+'"]')===null;},id,{timeout:60000});const data=await page.evaluate(async({folder,id})=>{const r=await fetch('/api/library/jobs?'+new URLSearchParams({projectFolder:folder}));return (await r.json()).jobs.find(j=>j.id===id);},{folder:projectFolder,id});assert.equal(data.state,'succeeded',JSON.stringify(data));return data;};
 await page.getByTestId('live-tab-Source').click();let jobId=await startJob('live-probe');await waitJob(jobId);await page.getByTestId('live-tab-Recipe').click();await page.getByTestId('live-trimStartSeconds').fill('0.1');await page.getByTestId('live-cropLeft').fill('2');receipt=actionResponse();await page.getByTestId('live-save-recipe').click();response=await receipt;assert.equal(response.status(),200,await response.text());jobId=await startJob('live-source-frame');await waitJob(jobId);await page.getByTestId('live-crop-frame').waitFor({timeout:10000});
 jobId=await startJob('live-render-preview');await waitJob(jobId);await page.getByTestId('live-preview-player').waitFor({timeout:10000});const video=page.getByTestId('live-preview-player');await video.evaluate(async n=>{await n.play();});await page.waitForFunction(()=>{const n=document.querySelector('#live-preview-player');return n&&!n.paused&&n.currentTime>0;});await video.evaluate(n=>n.pause());
 jobId=await startJob('live-prepare-variant');await waitJob(jobId);await page.getByTestId('live-read-planning').click();await page.getByTestId('live-planning').waitFor();
 assert.equal(require('node:crypto').createHash('sha256').update(fs.readFileSync(source)).digest('hex'),sourceHash);
 result.checks.push('Real probe, integer crop/removed-second recipe save, SAR-aware source frame, playable rendered preview, prepared variant and planning readback; unchanged synthetic source hash');
 await page.screenshot({path:path.join(evidence,'phase32-workspace-desktop.png'),fullPage:true});await page.setViewportSize({width:400,height:900});await page.screenshot({path:path.join(evidence,'phase32-workspace-mobile.png'),fullPage:true});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);assert.deepEqual(errors,[]);
 result.checks.push('400px layout has no horizontal overflow and no page JavaScript errors');result.passed=true;
}catch(error){result.passed=false;result.error=error.stack;console.error(error);process.exitCode=1;}
finally{if(browser)await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));fs.writeFileSync(path.join(evidence,'phase32-browser-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify(result,null,2));fs.rmSync(work,{recursive:true,force:true});}})();
