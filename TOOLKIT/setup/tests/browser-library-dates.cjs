'use strict';
// Actual Edge + default persistent LibraryService actor. Disposable metadata and generated media only.
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const scratch=process.env.RETRO_TV_TEST_ROOT;assert.ok(scratch&&path.isAbsolute(scratch),'Explicit disposable RETRO_TV_TEST_ROOT required');fs.mkdirSync(scratch,{recursive:true});
const work=fs.mkdtempSync(path.join(scratch,'library-dates-'));process.env.TEMP=process.env.TMP=process.env.TMPDIR=work;
const evidence=process.env.RETRO_TV_EVIDENCE_DIR||path.join(work,'evidence');fs.mkdirSync(evidence,{recursive:true});
const installRoot=path.resolve(__dirname,'../../..'),{ProjectStore}=require('../project-store'),{createSetupServer}=require('../server'),{resolveBackend,backendEnvironment}=require('../library-backend'),{chromium}=require(process.env.RETRO_TV_PLAYWRIGHT_PATH||'playwright');
const backend=resolveBackend(installRoot),source=path.join(work,'Original [dates] 雪.mp4'),hash=p=>crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
execFileSync(backend.ffmpeg,['-v','error','-nostdin','-n','-f','lavfi','-i','testsrc2=size=160x120:rate=30','-f','lavfi','-i','sine=frequency=440:sample_rate=44100','-t','0.5','-c:v','libx264','-preset','ultrafast','-pix_fmt','yuv420p','-c:a','aac',source],{windowsHide:true,timeout:30000,env:backendEnvironment(backend,{scratchDir:work})});
const before=hash(source),projectFolder=path.join(work,'Project [dates]'),projects=new ProjectStore({installRoot,appDataDir:path.join(work,'preferences')});
projects.confirm(projects.preview({operation:'create',name:'Date regressions',projectFolder,paths:{buildsFolder:path.join(work,'Builds'),compositeFolder:path.join(work,'Composites'),cacheFolder:path.join(projectFolder,'CACHE'),libraryFolders:[]}}).token);
const server=createSetupServer({store:projects});let browser,page,base,availabilityService,releaseAck;const result={passed:false,work,checks:[],writes:[]};
(async()=>{try{
 await new Promise(r=>server.listen(0,'127.0.0.1',r));base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({channel:'msedge',headless:true});page=await browser.newPage({viewport:{width:1680,height:1100}});page.setDefaultTimeout(10000);const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('dialog',d=>d.accept());
 await page.goto(base);const q=id=>page.getByTestId(id);await q('live-workspace').waitFor();await page.getByText(/^0 matching assets/).waitFor();
 const read=async(route,params={})=>{const r=await fetch(base+'/api/library/'+route+'?'+new URLSearchParams({projectFolder,...params}));assert.equal(r.status,200,await r.clone().text());return r.json();};
 const action=async(id,status=200)=>{const pending=page.waitForResponse(r=>r.url().endsWith('/api/library/action'));await q(id).click();const r=await pending,body=r.request().postDataJSON(),data=await r.json();result.writes.push({status:r.status(),body,data});assert.equal(r.status(),status,JSON.stringify({body,data}));await page.waitForFunction(()=>![...document.querySelectorAll('#live-save-metadata,#live-save-recipe')].some(n=>n.disabled));return data;};
 const select=async id=>{await q('live-show-browse').click();await q('live-asset-'+id).click();};
 const disclosure=async()=>{const d=page.locator('details').filter({has:page.getByText('Locations, registration & filters',{exact:true})}).first();if(!await d.evaluate(n=>n.open))await d.locator('summary').click();};
 await disclosure();await q('live-registration-path').fill(source);const id=(await action('live-register-asset')).result.assetId;await select(id);
 await q('live-notes').fill('First saved note; uncertain 1997 is not a date');await action('live-save-metadata');
 await q('live-date-mode').selectOption('Year');await q('live-year').fill('1997');await q('live-show').fill('Explicit series');await q('live-source-health').selectOption('READY');await q('live-health-reason').fill('Explicit synthetic source approval');await action('live-save-metadata');
 let saved=(await read('catalog')).assets.find(a=>a.id===id);assert.deepEqual(saved.date,{mode:'Year',value:'1997'});assert.equal(saved.show,'Explicit series');
 await q('live-category').selectOption('Commercial');await q('live-flag-Food').check();await q('live-date-mode').selectOption('Date');await q('live-year').fill('1997-04-09');await action('live-save-metadata');
 await q('live-flag-Toy').check();await q('live-notes').fill('Second saved note');await action('live-save-metadata');saved=(await read('catalog')).assets.find(a=>a.id===id);assert.deepEqual(saved.classificationByCategory.Commercial,['Food','Toy']);assert.deepEqual(saved.date,{mode:'Date',value:'1997-04-09'});assert.equal(saved.notes,'Second saved note');
 await q('live-tab-Recipe').click();await q('live-audio-repair').selectOption('RESTORE');await action('live-save-recipe');await q('live-audio-repair').selectOption('STRONG');await action('live-save-recipe');saved=(await read('catalog')).assets.find(a=>a.id===id);assert.equal(saved.recipe.audioRepair,'STRONG');assert.equal(saved.recipe.revision,3);
 await q('live-audio-repair').selectOption('NONE');await action('live-save-recipe');await q('live-tab-Properties').click();
 result.checks.push('Repeated same-tab metadata/date/classification and recipe saves submit visible values and persist through the default actor');
 const ranges=[];
 for(const start of ['1990','1990-01-01'])for(const end of ['1999','1999-12-31'])for(const separator of ['-','..','–',' - ']){
  const value=start+separator+end;await q('live-date-mode').selectOption('Range');await q('live-year').fill(value);await action('live-save-metadata');
  const persisted=(await read('catalog')).assets.find(a=>a.id===id);assert.equal(persisted.date.value,value);
  await q('live-show-browse').click();await disclosure();await q('live-filter-year').fill('1997');await q('live-filter-allow-unknown').uncheck();
  assert.equal(await q('live-asset-'+id).count(),1,'Browse must match '+value);const plan=await read('planning',{year:'1997'});assert.ok(plan.candidates.some(a=>a.id===id),value);ranges.push(value);
  await q('live-filter-year').fill('2001');assert.equal(await q('live-asset-'+id).count(),0,value);assert.ok(!(await read('planning',{year:'2001'})).candidates.some(a=>a.id===id));
  await q('live-filter-year').fill('');await select(id);
 }
 result.ranges=ranges;result.checks.push('All 16 accepted year/ISO endpoint and separator combinations persist verbatim and agree in actual Browse/HTTP planning');
 await q('live-date-mode').selectOption('Unknown');await q('live-notes').fill('1997 only in notes');await action('live-save-metadata');
 await q('live-show-browse').click();await disclosure();await q('live-filter-year').fill('1997');
 for(const allow of [false,true]){await q('live-filter-allow-unknown').setChecked(allow);assert.equal(await q('live-asset-'+id).count(),Number(allow));assert.equal((await read('planning',{year:'1997',allowUnknown:String(allow)})).candidates.some(a=>a.id===id),allow);}
 await q('live-filter-year').fill('');await q('live-filter-allow-unknown').uncheck();await select(id);await q('live-year').fill('1997');await action('live-save-metadata',400);assert.deepEqual((await read('catalog')).assets.find(a=>a.id===id).date,{mode:'Unknown',value:''});await q('live-year').fill('');
 result.checks.push('Notes never confer eligibility; both explicit unknown policies agree and Unknown/nonempty remains rejected HTTP 400');
 await q('live-date-mode').selectOption('Date');await q('live-year').fill('1997-04-09');await q('live-notes').fill('Second saved note');await action('live-save-metadata');
 // availableAt is a Store/actor contract, not currently exposed by the HTTP query allowlist.
 // Exercise the real persistent worker against the exact browser-saved project, never a mock projection.
 availabilityService=new (require('../library-service').LibraryService)({installRoot,appDataDir:projects.appDataDir});
 const availabilityPlan=async params=>{const filter={...params};if(filter.year!==undefined)filter.year=Number(filter.year);const plan=await availabilityService.planningCandidates(projects.inspect(projectFolder),filter);(result.availabilityChecks||=[]).push({filter,candidates:plan.candidates.map(a=>a.id),excluded:plan.excluded});return plan;};
 result.availableAtTransport='Actual LibraryService worker against browser-persisted project; HTTP allowlist currently excludes availableAt';
 await q('live-category').selectOption('Episode/Show');await q('live-available-from').fill('2001-01-01');await q('live-available-to').fill('2005-12-31');await action('live-save-metadata');
 assert.ok(!(await availabilityPlan({category:'Episode/Show',availableAt:'1997-01-01'})).candidates.some(a=>a.id===id));
 await q('live-category').selectOption('Branding');assert.equal(await q('live-available-from').count(),0,'Branding must not expose Episode bounds');await q('live-branding-role').selectOption('IDENT');await action('live-save-metadata');
 assert.ok((await availabilityPlan({category:'Branding',availableAt:'1997-01-01',year:'1997'})).candidates.some(a=>a.id===id));
 await q('live-date-mode').selectOption('Year');await q('live-year').fill('2001');await action('live-save-metadata');assert.ok(!(await availabilityPlan({category:'Branding',availableAt:'1997-01-01',year:'1997'})).candidates.some(a=>a.id===id),'Branding structured year remains hard');
 await q('live-date-mode').selectOption('Date');await q('live-year').fill('1997-04-09');await q('live-category').selectOption('Other');assert.equal(await q('live-available-from').count(),0);await action('live-save-metadata');assert.ok((await availabilityPlan({category:'Other',availableAt:'1997-01-01'})).candidates.some(a=>a.id===id));
 await q('live-category').selectOption('Commercial');assert.equal(await q('live-available-from').inputValue(),'');await q('live-available-from').fill('1996-01-01');await q('live-available-to').fill('1998-12-31');await action('live-save-metadata');
 assert.ok((await availabilityPlan({category:'Commercial',availableAt:'1997-01-01'})).candidates.some(a=>a.id===id));assert.ok(!(await availabilityPlan({category:'Commercial',availableAt:'2002-01-01'})).candidates.some(a=>a.id===id));
 await q('live-category').selectOption('Episode/Show');assert.equal(await q('live-available-from').inputValue(),'2001-01-01');await action('live-save-metadata');assert.ok((await availabilityPlan({category:'Episode/Show',availableAt:'2002-01-01'})).candidates.some(a=>a.id===id));assert.ok(!(await availabilityPlan({category:'Episode/Show',availableAt:'1997-01-01'})).candidates.some(a=>a.id===id));
 await q('live-category').selectOption('Commercial');assert.equal(await q('live-available-from').inputValue(),'1996-01-01');await action('live-save-metadata');result.availability=(await read('catalog')).assets.find(a=>a.id===id).availabilityByCategory;
 result.checks.push('Episode→Branding→Other→Commercial→Episode round trips isolate role availability while preserving both proposals and hard Branding content-year eligibility');
 await page.reload();await q('live-workspace').waitFor();await select(id);assert.equal(await q('live-available-from').inputValue(),'1996-01-01');assert.equal(await q('live-notes').inputValue(),'Second saved note');assert.equal(await q('live-date-mode').inputValue(),'Date');assert.equal(await q('live-year').inputValue(),'1997-04-09');
 result.checks.push('Authoritative persisted date, mode and notes survive browser reload');
 // Hold only the acknowledgement after the real HTTP transaction has committed.
 let committed;const committedPromise=new Promise(r=>committed=r),ack=new Promise(r=>releaseAck=r);
 const held=async route=>{const response=await route.fetch();committed();await ack;await route.fulfill({response});};await page.route('**/api/library/action',held);
 await q('live-notes').fill('Submitted before delayed acknowledgement');const delayed=page.waitForResponse(r=>r.url().endsWith('/api/library/action'));await q('live-save-metadata').click();await committedPromise;
 assert.equal((await read('catalog')).assets.find(a=>a.id===id).notes,'Submitted before delayed acknowledgement');
 await q('live-notes').fill('New typing while save is committed');await q('live-date-mode').selectOption('Year');await q('live-year').fill('1998');releaseAck();assert.equal((await delayed).status(),200);await page.waitForFunction(()=>!document.querySelector('#live-save-metadata').disabled);await page.unroute('**/api/library/action',held);
 assert.equal(await q('live-notes').inputValue(),'New typing while save is committed');assert.equal(await q('live-date-mode').inputValue(),'Year');assert.equal(await q('live-year').inputValue(),'1998');await action('live-save-metadata');saved=(await read('catalog')).assets.find(a=>a.id===id);assert.equal(saved.notes,'New typing while save is committed');assert.deepEqual(saved.date,{mode:'Year',value:'1998'});
 result.checks.push('A real committed write with delayed acknowledgement preserves newer metadata typing and the next save persists it');
 await page.screenshot({path:path.join(evidence,'dates-final-desktop.png'),fullPage:true});await q('live-date-mode').scrollIntoViewIfNeeded();await page.screenshot({path:path.join(evidence,'dates-final-structured-date.png'),fullPage:true});assert.deepEqual(errors,[]);assert.equal(hash(source),before);result.passed=true;
}catch(e){result.error=e.stack;process.exitCode=1;if(page)await page.screenshot({path:path.join(evidence,'failure.png'),fullPage:true}).catch(()=>{});}finally{releaseAck?.();if(browser)await browser.close();if(availabilityService)await availabilityService.close();await server.shutdown();fs.writeFileSync(path.join(evidence,'date-results.json'),JSON.stringify(result,null,2));console.log(JSON.stringify({passed:result.passed,checks:result.checks,work,evidence,error:result.error},null,2));}})();
