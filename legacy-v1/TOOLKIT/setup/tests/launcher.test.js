'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const launcher = path.resolve(__dirname, '../../Start-RetroCartSetup.ps1');

test('separate setup launcher parses with isolated startup parameters and its own CMD wrapper', () => {
  assert.ok(fs.existsSync(launcher), 'separate setup PowerShell launcher is not implemented');
  const script = '$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($env:RETRO_TEST_LAUNCHER,[ref]$tokens,[ref]$errors);if($errors.Count){$errors|ForEach-Object{$_.Message};exit 1};@($ast.ParamBlock.Parameters|ForEach-Object{$_.Name.VariablePath.UserPath})|ConvertTo-Json -Compress';
  const result = spawnSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8', timeout: 15000, windowsHide: true, env: { ...process.env, RETRO_TEST_LAUNCHER: launcher } });
  assert.equal(result.status, 0, result.stderr);
  assert.deepEqual(JSON.parse(result.stdout), ['Port', 'AppDataDir', 'NoBrowser']);
  const cmd = fs.readFileSync(launcher.replace(/\.ps1$/, '.cmd'), 'utf8');
  assert.match(cmd, /Start-RetroCartSetup\.ps1/);
  assert.doesNotMatch(cmd, /Start-RetroCartStudio/);
});

test('actual PowerShell launcher starts its own loopback setup server from a bracketed installation path', async t => {
  const scratch=process.env.RETRO_TV_TEST_ROOT;
  assert.ok(scratch && path.isAbsolute(scratch), 'Set RETRO_TV_TEST_ROOT to an absolute disposable directory.');
  fs.mkdirSync(scratch,{recursive:true});
  const work=fs.mkdtempSync(path.join(scratch,'launcher-real-'));
  const prefs=path.join(work,'preferences [test]');
  const net=require('node:net');const reserve=net.createServer();
  await new Promise(resolve=>reserve.listen(0,'127.0.0.1',resolve));const port=reserve.address().port;await new Promise(resolve=>reserve.close(resolve));
  const child=require('node:child_process').spawn('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-File',launcher,'-Port',String(port),'-AppDataDir',prefs,'-NoBrowser'],{stdio:['ignore','pipe','pipe'],windowsHide:true,env:{...process.env,TEMP:work,TMP:work,TMPDIR:work}});
  let output='';child.stdout.on('data',b=>output+=b);child.stderr.on('data',b=>output+=b);
  t.after(async()=>{
    if(child.exitCode===null){spawnSync('taskkill.exe',['/PID',String(child.pid),'/T','/F'],{windowsHide:true,encoding:'utf8'});if(child.exitCode===null)await new Promise(resolve=>child.once('exit',resolve));}
    fs.rmSync(work,{recursive:true,force:true});
  });
  const deadline=Date.now()+20000;let boot;
  while(Date.now()<deadline){
    if(child.exitCode!==null)assert.fail('Launcher exited before readiness: '+output);
    try{const response=await fetch(`http://127.0.0.1:${port}/api/bootstrap`,{signal:AbortSignal.timeout(1000)});if(response.ok){boot=await response.json();break;}}catch(_){}
    await new Promise(resolve=>setTimeout(resolve,100));
  }
  assert.equal(boot?.phase,'3.2',output);assert.equal(boot.status.activeProject,null);assert.equal(fs.existsSync(prefs),false);
  const readyDeadline=Date.now()+5000;while(Date.now()<readyDeadline&&!output.includes('Retro TV - Phase 3.2 Library Manager'))await new Promise(resolve=>setTimeout(resolve,50));
  assert.match(output,/Retro TV - Phase 3\.2 Library Manager/,'launcher must recognize the current bootstrap and announce readiness, not merely spawn a server');
});
test('the exact launcher finally block terminates its entire owned process tree when graceful exit does not occur',async t=>{
 const {spawn}=require('node:child_process');
 const owned=spawn(process.execPath,['-e',"const c=require('node:child_process').spawn(process.execPath,['-e','setInterval(()=>{},1000)'],{stdio:'ignore'});console.log(JSON.stringify({child:c.pid}));setInterval(()=>{},1000)"],{windowsHide:true,stdio:['ignore','pipe','pipe']});
 let childPid;
 t.after(()=>{if(owned.exitCode===null)spawnSync('taskkill.exe',['/PID',String(owned.pid),'/T','/F'],{windowsHide:true});if(childPid){try{process.kill(childPid,0);spawnSync('taskkill.exe',['/PID',String(childPid),'/T','/F'],{windowsHide:true});}catch(_){}}});
 const tree=await new Promise((resolve,reject)=>{owned.stdout.once('data',b=>{try{resolve(JSON.parse(b.toString()));}catch(e){reject(e);}});owned.once('error',reject);});childPid=tree.child;
 const script="$tokens=$null;$errors=$null;$ast=[System.Management.Automation.Language.Parser]::ParseFile($env:RETRO_TEST_LAUNCHER,[ref]$tokens,[ref]$errors);if($errors.Count){exit 2};$try=@($ast.EndBlock.Statements|Where-Object{$_ -is [System.Management.Automation.Language.TryStatementAst]})[-1];$body=($try.Finally.Statements|ForEach-Object{$_.Extent.Text}) -join [Environment]::NewLine;$proc=[Diagnostics.Process]::GetProcessById([int]$env:RETRO_OWNED_PID);& ([scriptblock]::Create($body))";
 const result=spawnSync('powershell.exe',['-NoProfile','-ExecutionPolicy','Bypass','-Command',script],{encoding:'utf8',windowsHide:true,timeout:12000,env:{...process.env,RETRO_TEST_LAUNCHER:launcher,RETRO_OWNED_PID:String(owned.pid)}});
 assert.equal(result.status,0,result.stderr);
 const alive=pid=>{try{process.kill(pid,0);return true;}catch(_){return false;}};const deadline=Date.now()+3000;while(Date.now()<deadline&&(alive(owned.pid)||alive(tree.child)))await new Promise(r=>setTimeout(r,50));
 assert.equal(alive(owned.pid),false,'owned launcher server must terminate');assert.equal(alive(tree.child),false,'owned render descendant must not be orphaned');
});
