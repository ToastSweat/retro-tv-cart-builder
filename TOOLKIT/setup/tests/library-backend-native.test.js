'use strict';
// App-local backend acceptance: real native binaries, not opaque pin-transport fixtures.
const test=require('node:test'),assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {execFileSync}=require('node:child_process'),{resolveBackend}=require('../library-backend'),{createSetupServer}=require('../server');
const installRoot=path.resolve(__dirname,'../../..'),backend=resolveBackend(installRoot),scratch=process.env.RETRO_TV_TEST_ROOT;assert.ok(scratch&&path.isAbsolute(scratch),'Explicit disposable scratch required.');assert.equal(backend.mode,'pinned','Prepare the verified app-local runtime before this acceptance suite.');fs.mkdirSync(scratch,{recursive:true});
test('runtime diagnostics identify the selected pinned pair rather than unrelated global codecs',async t=>{
 const server=createSetupServer({store:{status:()=>({activeProject:null,recentProjects:[]})}});await new Promise(r=>server.listen(0,'127.0.0.1',r));t.after(()=>server.shutdown());const data=await(await fetch('http://127.0.0.1:'+server.address().port+'/api/tools')).json();for(const name of ['FFmpeg','ffprobe']){const row=data.tools.find(t=>t.name===name);assert.equal(row.available,true,row.error);assert.equal(row.selectedPath,name==='FFmpeg'?backend.ffmpeg:backend.ffprobe);assert.equal(row.backendMode,'pinned');assert.match(row.version,/8\.1\.3/);}
});
