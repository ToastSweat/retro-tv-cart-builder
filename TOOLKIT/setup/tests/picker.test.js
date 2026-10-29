'use strict';
const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {spawnSync}=require('node:child_process');
const helper=path.resolve(__dirname,'../Select-ProjectFolder.ps1');

test('Explorer-style folder picker compiles on the existing Windows PowerShell runtime',()=>{
  assert.ok(fs.existsSync(helper),'modern Windows Common Item Dialog helper has not been implemented');
  const scratch=process.env.RETRO_TV_TEST_ROOT;
  assert.ok(scratch && path.isAbsolute(scratch),'Set RETRO_TV_TEST_ROOT to an absolute disposable directory.');
  fs.mkdirSync(scratch,{recursive:true});
  const result=spawnSync('powershell.exe',['-NoProfile','-STA','-ExecutionPolicy','Bypass','-File',helper,'-CompileOnly'],{encoding:'utf8',windowsHide:true,timeout:30000,env:{...process.env,TEMP:scratch,TMP:scratch,TMPDIR:scratch}});
  assert.equal(result.status,0,result.stderr || result.stdout);
  const source=fs.readFileSync(helper,'utf8');
  assert.match(source,/42f85136-db7e-439c-85f1-e4075d135fc8/i);
  assert.match(source,/FOS_PICKFOLDERS/);
  assert.match(source,/FOS_FORCEFILESYSTEM/);
  assert.match(source,/FOS_NOCHANGEDIR/);
  assert.match(source,/FOS_DONTADDTORECENT/);
  assert.doesNotMatch(source,/FolderBrowserDialog/);
});

test('all setup Browse requests use the modern helper with the starting path passed as data',()=>{
  const server=fs.readFileSync(path.resolve(__dirname,'../server.js'),'utf8');
  assert.match(server,/Select-ProjectFolder\.ps1/);
  assert.doesNotMatch(server,/FolderBrowserDialog/);
  assert.match(server,/RETROTV_PICKER_START: initialPath/);
});
