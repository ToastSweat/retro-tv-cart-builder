'use strict';
// Protocol fixtures only. Range bytes below are not claimed to be playable media.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {createSetupServer}=require('../server');
const scratch=process.env.RETRO_TV_TEST_ROOT;assert.ok(scratch&&path.isAbsolute(scratch),'Set RETRO_TV_TEST_ROOT to disposable scratch.');fs.mkdirSync(scratch,{recursive:true});
async function fixture(t,extraOptions={}){
 const root=fs.mkdtempSync(path.join(scratch,'library-http-'));const project={projectFolder:path.join(root,'project'),readOnly:false,kind:'managed',name:'Protocol fixture',paths:{}};fs.mkdirSync(project.projectFolder);
 const media=path.join(root,'transport-fixture.mp4');fs.writeFileSync(media,Buffer.from('0123456789abcdef'));
 const calls=[];let blocking=false;
 const store={status:()=>({activeProject:project,recentProjects:[]}),open:p=>{calls.push(['open',p]);return project;},confirm:()=>{calls.push(['confirm']);return project;}};
 const snap=()=>({schemaVersion:1,revision:1,etag:'fixture-etag',projectFolder:project.projectFolder,assets:[],locations:[],networks:[],groups:[],jobs:[]});
 const libraryStore={read:p=>{calls.push(['read',p.projectFolder]);return snap();},apply:(p,input)=>{calls.push(['apply',input]);if(input.expectedEtag!=='fixture-etag')throw Object.assign(Error('Stale catalog.'),{status:409});return{catalog:snap(),result:{saved:true}};},dependencies:(p,id)=>({assetId:id,carts:[]}),planningCandidates:()=>({assets:[]})};
 const libraryJobs={status:()=>({jobs:[]}),start:async(p,input)=>{calls.push(['job',input]);return{catalog:snap(),result:{jobId:'job1'}};},cancel:async(p,id)=>({catalog:snap(),result:{jobId:id,state:'cancel-requested'}}),retry:async(p,input)=>({catalog:snap(),result:{jobId:input.jobId}}),hasBlockingJobs:()=>blocking,resolveMedia:(p,input)=>{calls.push(['media',input]);if(input.assetId!=='asset1')throw Object.assign(Error('Unknown asset.'),{status:404});return{path:media,mime:'video/mp4'};},close:async()=>{calls.push(['close']);}};
 const assetsDir=path.join(root,'static-fixture');fs.mkdirSync(assetsDir);fs.writeFileSync(path.join(assetsDir,'live-workspace.js'),'/* protocol fixture live script */');fs.writeFileSync(path.join(assetsDir,'live-workspace.css'),'/* protocol fixture live style */');
 const server=createSetupServer({store,libraryStore,libraryJobs,assetsDir,pickFolder:async()=>({cancelled:true}),pickFile:async()=>({cancelled:false,path:media}),...extraOptions});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 t.after(async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));fs.rmSync(root,{recursive:true,force:true});});
 const boot=await(await fetch(base+'/api/bootstrap')).json();
 const url=(name,extra={})=>base+'/api/library/'+name+'?'+new URLSearchParams({projectFolder:project.projectFolder,...extra});
 const post=(name,body,token=boot.csrfToken)=>fetch(base+'/api/library/'+name,{method:'POST',headers:{'Content-Type':'application/json','X-RetroTV-Token':token},body:JSON.stringify({projectFolder:project.projectFolder,...body})});
 return{project,calls,base,url,post,boot,server,libraryJobs,libraryStore,projectStore:store,setBlocking:v=>{blocking=v;}};
}
test('catalog reads are bound to the exact active project and reject unexpected query keys',async t=>{
 const f=await fixture(t);let r=await fetch(f.url('catalog'));assert.equal(r.status,200);assert.equal((await r.json()).projectFolder,f.project.projectFolder);
 assert.equal((await fetch(f.base+'/api/library/catalog')).status,400);
 assert.equal((await fetch(f.url('catalog',{projectFolder:f.project.projectFolder+'-other'}))).status,409);
 assert.equal((await fetch(f.url('catalog',{path:'private.json'}))).status,400);
 assert.equal((await fetch(f.url('catalog',{projectFolder:f.project.projectFolder.toUpperCase()}))).status,409);
});
test('catalog mutations require token, etag, known operation and bounded explicit object payload',async t=>{
 const f=await fixture(t);const body={expectedEtag:'fixture-etag',operation:'save-metadata',payload:{assetId:'a',values:{notes:'human'}}};
 assert.equal((await f.post('action',body,'')).status,403);
 assert.equal((await f.post('action',{...body,expectedEtag:undefined})).status,400);
 assert.equal((await f.post('action',{...body,operation:'reset-all'})).status,400);
 assert.equal((await f.post('action',{...body,extra:'unexpected'})).status,400);
 assert.equal((await f.post('action',{...body,payload:[]})).status,400);
 assert.equal((await f.post('action',{...body,payload:{text:'x'.repeat(70000)}})).status,413);
 assert.equal((await f.post('action',{...body,expectedEtag:'stale'})).status,409);
 const response=await f.post('action',body);assert.equal(response.status,200);assert.equal((await response.json()).result.saved,true);
 assert.equal(f.calls.filter(x=>x[0]==='apply').length,2);
});
test('genuine job commands, status, dependencies and planning dispatch without invented results',async t=>{
 const f=await fixture(t);assert.equal((await fetch(f.url('jobs'))).status,200);
 assert.deepEqual(await(await fetch(f.url('dependencies',{assetId:'asset1'}))).json(),{assetId:'asset1',carts:[]});
 assert.equal((await fetch(f.url('planning'))).status,200);
 assert.equal((await f.post('job',{expectedEtag:'fixture-etag',kind:'simulate-success',assetId:'asset1'})).status,400);
 let r=await f.post('job',{expectedEtag:'fixture-etag',kind:'probe',assetId:'asset1'});assert.equal(r.status,200);assert.equal((await r.json()).result.jobId,'job1');
 r=await f.post('cancel',{jobId:'job1'});assert.equal((await r.json()).result.state,'cancel-requested');
 assert.equal((await f.post('retry',{jobId:'job1',expectedEtag:'fixture-etag'})).status,200);
});
test('registered-media transport supports full, HEAD, bounded and suffix ranges, never arbitrary paths',async t=>{
 const f=await fixture(t),url=f.url('media',{assetId:'asset1',kind:'source'});
 let r=await fetch(url);assert.equal(r.status,200);assert.equal(await r.text(),'0123456789abcdef');assert.equal(r.headers.get('accept-ranges'),'bytes');assert.match(r.headers.get('cache-control'),/no-store/);
 r=await fetch(url,{method:'HEAD'});assert.equal(r.status,200);assert.equal(await r.text(),'');assert.equal(r.headers.get('content-length'),'16');
 r=await fetch(url,{headers:{Range:'bytes=2-5'}});assert.equal(r.status,206);assert.equal(await r.text(),'2345');assert.equal(r.headers.get('content-range'),'bytes 2-5/16');
 r=await fetch(url,{headers:{Range:'bytes=-4'}});assert.equal(r.status,206);assert.equal(await r.text(),'cdef');
 for(const range of ['bytes=99-','bytes=5-2','bytes=0-1,3-4','bananas'])assert.equal((await fetch(url,{headers:{Range:range}})).status,416);
 assert.equal((await fetch(f.url('media',{assetId:'missing',kind:'source'}))).status,404);
 assert.equal((await fetch(f.url('media',{assetId:'asset1',kind:'source',path:'C:/private.json'}))).status,400);
});
test('conflicting real processing blocks project changes before open/confirm side effects',async t=>{
 const f=await fixture(t);f.setBlocking(true);
 for(const endpoint of ['open','confirm']){const r=await fetch(f.base+'/api/'+endpoint,{method:'POST',headers:{'Content-Type':'application/json','X-RetroTV-Token':f.boot.csrfToken},body:JSON.stringify({projectFolder:f.project.projectFolder,token:'fixture'})});assert.equal(r.status,409);}
 assert.equal(f.calls.some(x=>['open','confirm'].includes(x[0])),false);
 f.setBlocking(false);const r=await fetch(f.base+'/api/open',{method:'POST',headers:{'Content-Type':'application/json','X-RetroTV-Token':f.boot.csrfToken},body:JSON.stringify({projectFolder:f.project.projectFolder})});assert.equal(r.status,200);
});
test('source picker uses explicit file/folder mode and bound project without changing metadata',async t=>{
 const f=await fixture(t);let r=await f.post('browse',{mode:'file',initialPath:''});assert.equal(r.status,200);assert.equal((await r.json()).cancelled,false);
 r=await f.post('browse',{mode:'folder',initialPath:''});assert.equal(r.status,200);assert.equal((await r.json()).cancelled,true);
 assert.equal((await f.post('browse',{mode:'execute'})).status,400);assert.equal(f.calls.some(x=>x[0]==='apply'),false);
});
test('only fixed live workspace assets are served while private module paths and queries stay inaccessible',async t=>{
 const f=await fixture(t);
 for(const [name,type] of [['live-workspace.js','javascript'],['live-workspace.css','css']]){const r=await fetch(f.base+'/'+name);assert.equal(r.status,200);assert.match(r.headers.get('content-type'),new RegExp(type));assert.match(await r.text(),/protocol fixture live/);}
 for(const name of ['library-store.js','library-jobs.js','library-http.js','STATE/library-catalog.json','live-workspace.js?path=private'])assert.equal((await fetch(f.base+'/'+name)).status,404);
});
test('explicit selection-pool creation reaches the catalog without repairing its supplied identifier',async t=>{
 const f=await fixture(t);const payload={value:'CUSTOM_POOL',label:'Custom selection set'},r=await f.post('action',{expectedEtag:'fixture-etag',operation:'add-pool',payload});assert.equal(r.status,200);assert.deepEqual(f.calls.find(x=>x[0]==='apply')[1].payload,payload);
});
test('hard planning year query is validated and converted to the numeric service contract',async t=>{
 const f=await fixture(t);let seen;f.libraryStore.planningCandidates=(p,filter)=>{seen=filter;return{candidates:[],excluded:[]};};
 let r=await fetch(f.url('planning',{year:'1997',allowUnknown:'false'}));assert.equal(r.status,200);assert.equal(seen.year,1997);assert.equal(seen.allowUnknown,false);
 for(const year of ['0000','year1997','1997.5',' 1997'])assert.equal((await fetch(f.url('planning',{year}))).status,400);
});
test('known job rejection statusCode remains a definite conflict rather than an uncertain write',async t=>{
 const f=await fixture(t);f.libraryJobs.start=async()=>{throw Object.assign(Error('Duplicate active job'),{statusCode:409});};
 const r=await f.post('job',{expectedEtag:'fixture-etag',kind:'probe',assetId:'asset1'});assert.equal(r.status,409);assert.match((await r.json()).error,/Duplicate/);
});
test('explicit interrupted-worker recovery is project and etag bound',async t=>{
 const f=await fixture(t);f.libraryJobs.recover=async(p,input)=>{assert.equal(p.projectFolder,f.project.projectFolder);assert.deepEqual(input,{jobId:'orphan',expectedEtag:'fixture-etag'});return{catalog:f.libraryStore.read(p),result:{jobId:input.jobId,recovered:true}};};
 const r=await f.post('recover',{jobId:'orphan',expectedEtag:'fixture-etag'});assert.equal(r.status,200);assert.equal((await r.json()).result.recovered,true);
 assert.equal((await f.post('recover',{jobId:'orphan'})).status,400);
});
test('job reservation rechecks active identity while holding the same app-preferences transition lock',async t=>{
 const f=await fixture(t),order=[];f.projectStore.withAppLock=fn=>{order.push('lock');try{return fn();}finally{order.push('release');}};
 const start=f.libraryJobs.start;f.libraryJobs.start=(p,input)=>{order.push('reserve');return start(p,input);};
 assert.equal((await f.post('job',{expectedEtag:'fixture-etag',kind:'probe',assetId:'asset1'})).status,200);assert.deepEqual(order,['lock','reserve','release']);
});
test('off-thread service facade owns its reservation lock and is closed exactly once',async t=>{
 const calls=[],snapshot=p=>({schemaVersion:1,revision:0,etag:'actor-etag',projectFolder:p.projectFolder,assets:[],jobs:[]}),service={ownsTransitionLock:true,read:async p=>{calls.push('read');return snapshot(p);},start:async(p,input)=>{calls.push('start');return{catalog:snapshot(p),result:{jobId:'actor-job'}};},close:async()=>{calls.push('close');}};
 const f=await fixture(t,{libraryService:service});f.projectStore.withAppLock=()=>{throw Error('Main thread must not hold app lock while waiting on worker reservation');};assert.equal((await fetch(f.url('catalog'))).status,200);const r=await f.post('job',{expectedEtag:'actor-etag',kind:'probe',assetId:'asset1'});assert.equal(r.status,200);assert.equal((await r.json()).result.jobId,'actor-job');await f.server.shutdown();assert.deepEqual(calls,['read','start','close']);
});
test('plain HTTP server close also releases an initialized off-thread service',async t=>{
 let closed=0;const f=await fixture(t,{libraryService:{read:async p=>({schemaVersion:1,projectFolder:p.projectFolder,assets:[]}),close:async()=>{closed++;}}});assert.equal((await fetch(f.url('catalog'))).status,200);f.server.closeAllConnections();await new Promise(resolve=>f.server.close(resolve));assert.equal(closed,1);
});
test('graceful shutdown closes owned jobs exactly once and stops accepting requests',async t=>{
 const f=await fixture(t);assert.equal(typeof f.server.shutdown,'function');
 await Promise.all([f.server.shutdown(),f.server.shutdown()]);assert.equal(f.calls.filter(x=>x[0]==='close').length,1);assert.equal(f.server.listening,false);
});
