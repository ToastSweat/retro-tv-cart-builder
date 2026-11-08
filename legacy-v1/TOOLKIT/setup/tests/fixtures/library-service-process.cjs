'use strict';
// Isolated lifetime proof. Paths/config are written only by the owned test harness.
const fs=require('node:fs');
const {LibraryService}=require('../../library-service');
const config=JSON.parse(fs.readFileSync(process.argv[2],'utf8'));
const actor=new LibraryService({installRoot:config.installRoot,appDataDir:config.appDataDir});
(async()=>{
  const catalog=await actor.read(config.project);
  if(config.mode==='reservations'){
    await actor.recover(config.project,{expectedEtag:catalog.etag,jobId:'lost-owner'});
    const current=await actor.read(config.project);
    const first=await actor.start(config.project,{expectedEtag:current.etag,kind:'scan',locationId:current.locations[0].id});
    await actor.cancel(config.project,first.result.jobId);
    const next=await actor.retry(config.project,{expectedEtag:(await actor.read(config.project)).etag,jobId:first.result.jobId});
    await actor.cancel(config.project,next.result.jobId);
    await actor.close();console.log(JSON.stringify({reserved:true}));
  }else if(config.mode==='scan'){
    const response=await actor.start(config.project,{expectedEtag:catalog.etag,kind:'scan',locationId:catalog.locations[0].id});
    console.log(JSON.stringify({jobId:response.result.jobId}));
    // No timers/close/RPC keepalive: the actor itself must retain active ownership.
  }else console.log(JSON.stringify({idle:true,assets:catalog.assets.length,mainServicesLoaded:Object.keys(require.cache).some(file=>/[\\/](?:library-store|library-jobs|project-store)\.js$/.test(file)),studioLoaded:Object.keys(require.cache).some(file=>/[\\/]studio[\\/]server\.js$/.test(file))}));
})().catch(error=>{console.error(error.message);process.exitCode=1;});
