const {app,BrowserWindow,ipcMain,dialog,session,protocol}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {pathToFileURL}=require('node:url');
const {validateArtwork}=require('./artwork.cjs');const media=require('./media.cjs');let scanJob=null;
const cartridge=require('./cartridge.cjs'),drives=require('./drives.cjs');let buildJob=null;
const studio=require('./studio.cjs');const cropTools=require('./crop-tools.cjs');
const generation=require('./generation.cjs');let generationPreview=null;
const plans=require('./plans.cjs');const catalog=require('./catalog.cjs');const {randomUUID}=require('node:crypto');let artworkChoice=null;
const projects=require('./projects.cjs');let win,current=null;let busy=false;
const {Playback}=require('./playback.cjs');const playback=new Playback(()=>current);
protocol.registerSchemesAsPrivileged([{scheme:'retro-media',privileges:{standard:true,secure:true,stream:true,supportFetchAPI:true,corsEnabled:true}}]);
const home=pathToFileURL(path.join(__dirname,'index.html')).href;
// Recent-project navigation only: all project records and generated media live in the project.
const recentFile=()=>path.join(app.getPath('userData'),'recent-projects.json');
async function recent(){try{const r=JSON.parse(await fs.readFile(recentFile(),'utf8'));return Array.isArray(r)?r.slice(0,12):[];}catch{return [];}}
async function remember(p){const r=await recent();await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(recentFile(),JSON.stringify([{name:p.project.name,file:p.file},...r.filter(x=>x.file!==p.file)].slice(0,12),null,2));}
function handle(channel,fn){ipcMain.handle(channel,async(e,...args)=>{
 if(e.sender!==win.webContents||e.senderFrame.url!==home)throw Error('Invalid request origin.');
 if(buildJob?.running&&!['studioBuildStatus','studioBuildCancel'].includes(channel))return {error:'A cart build/copy is running. Wait or cancel it before editing or changing projects.'};
 if(scanJob?.running&&!['media','mediaProgress','mediaCancel','catalog','plans','recent','mediaPlayback','mediaPlaybackStatus','mediaPlaybackClose','mediaPlaybackCancel'].includes(channel))return {error:'Wait for the library scan or cancel it first.'};
 const independent=['studioBuildStatus','studioBuildCancel','mediaPlaybackStatus','mediaPlaybackClose','mediaPlaybackCancel','studioCropReference','studioCropDetect','studioCropFinal'].includes(channel);
 if(busy&&!independent)return {error:'Please wait for the current operation.'};if(!independent)busy=true;
 try{return {value:await fn(...args)};}catch(err){return {error:err.message};}finally{if(!independent)busy=false;}
});}
const hasLock=app.requestSingleInstanceLock();
if(!hasLock)app.quit();
else app.whenReady().then(async()=>{
 try{const saved=JSON.parse(await fs.readFile(path.join(app.getPath('userData'),'runtime.json'),'utf8'));if(typeof saved.ffmpeg==='string')playback.executable=saved.ffmpeg;}catch{}
 protocol.handle('retro-media',request=>playback.respond(request));
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
 handle('recent',recent);
 handle('folder',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];});
 handle('open',async(file)=>{
  if(!file){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Retro TV Project',extensions:['json']}]});if(r.canceled)return null;file=r.filePaths[0];}
  else if(!(await recent()).some(x=>x.file===file))throw Error('Use Open Project to select this file.');
  generationPreview=null;playback.reset();artworkChoice=null;current=await projects.open(file);await remember(current);return current;
 });
 handle('create',async(input)=>{generationPreview=null;playback.reset();artworkChoice=null;current=await projects.create(input);await remember(current);return current;});
 handle('update',async(input)=>{if(!current)throw Error('No open project.');current=await projects.update(current.file,input);await remember(current);return current;});
 handle('close',async()=>{generationPreview=null;playback.reset();current=null;artworkChoice=null;return true;});
 function requireProject(){if(!current)throw Error('Open a project first.');return current.root;}
 handle('catalog',async()=>catalog.view(requireProject()));
 handle('plans',async()=>plans.view(requireProject()));
 handle('studioCropReference',async(id)=>{requireProject();return cropTools.reference(current,id,playback.executable);});
 handle('studioCropDetect',async(id)=>{requireProject();return cropTools.detect(current,id,playback.executable);});
 handle('studioCropFinal',async(id,edit)=>{requireProject();return cropTools.final(current,id,edit,playback.executable);});
 handle('studioDrives',async()=>{requireProject();return drives.enumerate(current);});
 handle('studioBuildStart',async(cartId,input={})=>{requireProject();if(buildJob?.running)throw Error('Build already running.');const project=current,executable=playback.executable;let drive=null;if(input.targetId){drive=await drives.requireDrive(project,input.targetId);const answer=await dialog.showMessageBox(win,{type:'warning',buttons:['Cancel','Build and copy'],defaultId:0,cancelId:0,message:'Verify this exact cartridge drive',detail:`Drive: ${drive.root}\nLabel: ${drive.label||'(no label)'}\nType: ${drive.type}\nFree: ${(drive.free/1000000000).toFixed(2)} GB\n\nCart: ${(await studio.view(project,cartId)).code}\nThe drive will be labeled for this cart. Only this app's receipt-owned cartridge files can be replaced. Other MP4 files must be removed manually first. No drive formatting.`});if(answer.response!==1)return {canceled:true};}playback.reset();const controller=new AbortController(),job=buildJob={cartId,running:true,controller,progress:{phase:'Starting build'},result:null,error:null};job.done=(async()=>{const budgetMB=drive?await drives.capacity(project,drive,cartId):Number(input.budgetMB??3600);if(budgetMB<1)throw Error('The selected drive has no usable space.');const onProgress=p=>job.progress={...job.progress,...p};const result=await cartridge.build(project,cartId,{budgetMB,fit:input.fit===true,executable,signal:controller.signal,onProgress});if(input.reviewOnly===true){const fullReview=await cartridge.fullReview(project,result,{signal:controller.signal,executable,onProgress});job.result={dir:result.dir,totalBytes:result.manifest.totalBytes,files:result.manifest.files.length,reused:result.reused,fullReview};}else if(drive){await cartridge.validateUnchanged(project,cartId,result.manifest.signature);const copied=await drives.copy(project,result,drive,{signal:controller.signal,onProgress});job.result={dir:result.dir,totalBytes:result.manifest.totalBytes,files:result.manifest.files.length,reused:result.reused,usb:copied};}else job.result={dir:result.dir,totalBytes:result.manifest.totalBytes,files:result.manifest.files.length,reused:result.reused};job.progress={phase:drive?'Cartridge copied and verified':'Local final build complete',done:true};})().catch(e=>job.error=e.message).finally(()=>job.running=false);return {running:true};});
 handle('studioBuildInfo',async(cartId)=>{requireProject();return cartridge.info(current,cartId);});
 handle('studioOpenFullReview',async(cartId)=>{requireProject();const info=await cartridge.info(current,cartId);if(!info?.fullReview)throw Error('Build the optional full review first.');const url=await playback.buildToken(info.fullReview),viewer=new BrowserWindow({width:1000,height:800,title:'Optional Full Review',backgroundColor:'#000',webPreferences:{nodeIntegration:false,contextIsolation:true,sandbox:true}});viewer.setMenuBarVisibility(false);viewer.webContents.setWindowOpenHandler(()=>({action:'deny'}));viewer.loadURL('data:text/html;charset=utf-8,'+encodeURIComponent('<!doctype html><meta http-equiv="Content-Security-Policy" content="default-src &apos;none&apos;; media-src retro-media:; style-src &apos;unsafe-inline&apos;"><title>Optional full review</title><body style="margin:0;background:black"><video style="width:100vw;height:100vh" controls autoplay src="'+url+'"></video>'));return true;});
 handle('studioBuildStatus',async()=>buildJob?{cartId:buildJob.cartId,running:buildJob.running,progress:buildJob.progress,result:buildJob.result,error:buildJob.error}:null);
 handle('studioBuildCancel',async()=>{buildJob?.controller.abort();return true;});
 handle('studioOpenBuild',async(cartId)=>{requireProject();const info=await cartridge.info(current,cartId);if(!info)throw Error('Build the current cart first.');const error=await require('electron').shell.openPath(info.dir);if(error)throw Error(error);return true;});
 handle('studioView',async(cartId)=>{requireProject();return studio.view(current,cartId);});
 handle('studioMove',async(cartId,slotId)=>{requireProject();playback.reset();return studio.move(current,cartId,slotId);});
 handle('studioSave',async(cartId,slotId,input)=>{requireProject();return studio.save(current,cartId,slotId,input,playback.executable);});
 handle('studioCandidates',async(cartId,slotId,search,page)=>{requireProject();return studio.candidates(current,cartId,slotId,search,page);});
 handle('studioResetReplacement',async(cartId,slotId,etag)=>{requireProject();playback.reset();return studio.resetReplacement(current,cartId,slotId,etag);});
 handle('studioReplace',async(cartId,slotId,assetId,etag)=>{requireProject();playback.reset();return studio.replace(current,cartId,slotId,assetId,etag);});
 handle('generationView',async(cartId)=>{requireProject();return generation.view(current,cartId);});
 handle('generationSetupPreview',async()=>{requireProject();return generation.setup(current);});
 handle('generationSetupApply',async(expected)=>{requireProject();generationPreview=null;return generation.setup(current,true,expected);});
 handle('generationCheck',async(cartId,rules)=>{const root=requireProject();const preview=await generation.preflight(current,cartId,rules);const token=randomUUID();generationPreview={token,root,preview};return {...preview,token};});
 handle('generationSave',async(token)=>{const root=requireProject();if(!generationPreview||generationPreview.root!==root||generationPreview.token!==token)throw Error('Run Check / preview again.');const result=await generation.save(current,generationPreview.preview);generationPreview=null;return result;});
 handle('generationRelease',async(cartId)=>{requireProject();const r=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Discard lineup'],defaultId:0,cancelId:0,message:'Discard this saved lineup?',detail:'This releases its project reservations. Source media and the cart definition remain.'});if(r.response!==1)return false;generationPreview=null;await generation.release(current,cartId);return true;});
 handle('media',async(filters)=>{requireProject();const result=await media.list(current,filters),generated=await generation.read(current.root);for(const a of result.assets){const kk=new Set(generation.keys(a,current));a.usedBy=generated.carts.filter(c=>c.rows.some(r=>r.keys.some(k=>kk.has(k)))).map(c=>c.code);}return result;});
 handle('mediaPlayback',async(id,edit)=>{requireProject();return playback.open(id,edit);});
 handle('mediaPlaybackStart',async(id,edit)=>{requireProject();return playback.start(id,edit);});
 handle('mediaPlaybackStatus',async()=>playback.status());
 handle('mediaPlaybackCancel',async()=>{playback.cancel();return true;});
 handle('mediaPlaybackClose',async()=>{playback.reset();return true;});
 handle('mediaPlaybackTool',async()=>{requireProject();if(playback.job?.running)throw Error('Cancel the current preview first.');const r=await dialog.showOpenDialog(win,{properties:['openFile'],title:'Choose your working FFmpeg executable',filters:[{name:'FFmpeg executable',extensions:process.platform==='win32'?['exe']:['*']}]});if(r.canceled)return false;playback.executable=r.filePaths[0];await fs.writeFile(path.join(app.getPath('userData'),'runtime.json'),JSON.stringify({ffmpeg:playback.executable}));return true;});
 handle('mediaProgress',async()=>scanJob?{running:scanJob.running,progress:scanJob.progress,result:scanJob.result,error:scanJob.error}:null);
 handle('mediaCancel',async()=>{scanJob?.controller.abort();return true;});
 handle('mediaScan',async(libraryId)=>{requireProject();if(scanJob?.running)throw Error('Scan already running.');const project=current;const controller=new AbortController();const job=scanJob={running:true,controller,progress:{found:0,added:0},result:null,error:null};media.scan(project,{libraryIds:libraryId?[libraryId]:undefined,signal:controller.signal,onProgress:p=>{job.progress=p;}}).then(result=>{job.result=result;}).catch(e=>{job.error=e.message;}).finally(()=>{job.running=false;});return true;});
 handle('mediaSelect',async(filters)=>{requireProject();return media.selectIds(current,filters);});
 handle('mediaBulkSave',async(ids,input,modes)=>{return media.update(requireProject(),ids,input,modes);});
 handle('mediaSave',async(ids,input)=>{const root=requireProject();return media.update(root,ids,input);});
 handle('savePlan',async(kind,input)=>{const root=requireProject();let selected=null;if(input.artworkToken){if(artworkChoice?.token!==input.artworkToken||artworkChoice.root!==root)throw Error('Select artwork again.');selected=artworkChoice.info;}await plans.save(root,kind,input,selected);artworkChoice=null;return plans.view(root);});
 handle('removePlan',async(kind,id)=>{const root=requireProject();if(!['carts','templates'].includes(kind))throw Error('Unknown type.');const data=await plans.read(root),row=data[kind].find(x=>x.id===id);if(!row)throw Error('Entry no longer exists.');if(kind==='carts'&&(await generation.read(root)).carts.some(c=>c.cartId===id))throw Error('Discard the saved lineup from Generate / lineup before removing this cart.');if(kind==='templates'&&data.carts.some(c=>c.templateId===id))throw Error('Template is assigned to a cart. Change the cart first.');const r=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Remove'],defaultId:0,cancelId:0,message:`Remove ${row.name}?`,detail:'Source media remains untouched. Previous planning metadata is retained in the project.'});if(r.response!==1)return null;await plans.remove(root,kind,id);return plans.view(root);});
 handle('discard',async()=>{const r=await dialog.showMessageBox(win,{type:'question',buttons:['Keep editing','Discard changes'],defaultId:0,cancelId:0,message:'Discard unsaved changes?'});return r.response===1;});
 handle('pickArtwork',async()=>{
  requireProject();const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Artwork',extensions:['png','jpg','jpeg','webp']}]});
  if(result.canceled)return null;
  const info=await catalog.loadImage(result.filePaths[0]);
  await validateArtwork(info,{
   nativeDecode:buffer=>{const decoded=require('electron').nativeImage.createFromBuffer(buffer);return decoded.isEmpty()?null:decoded.getSize();},
   browserDecode:script=>win.webContents.executeJavaScript(script)
  });
  artworkChoice={token:randomUUID(),root:current.root,info};
  return {token:artworkChoice.token,preview:`data:${info.mime};base64,${info.buffer.toString('base64')}`};
 });
 handle('saveEntry',async(kind,input)=>{
  const root=requireProject();let selected=null;
  if(input.artworkToken){if(artworkChoice?.token!==input.artworkToken||artworkChoice.root!==root)throw Error('Select the artwork again.');selected=artworkChoice.info;}
  const existingPlans=await plans.read(root);
  if(kind==='shows'&&input.id){const linked=existingPlans.carts.filter(c=>c.showIds.includes(input.id));if(linked.some(c=>!input.networkIds.includes(c.networkId)))throw Error('This show is used by a cart on a network you removed. Update that cart first.');}
  await catalog.save(root,kind,input,selected);artworkChoice=null;return catalog.view(root);
 });
 handle('removeEntry',async(kind,id)=>{
  const root=requireProject();const c=await catalog.read(root);if(!['networks','shows'].includes(kind))throw Error('Unknown entry type.');
  const row=c[kind].find(r=>r.id===id);if(!row)throw Error('Entry no longer exists.');
  const mediaData=await media.read(root);if(mediaData.assets.some(a=>(kind==='networks'?a.networkIds:a.showIds).includes(id)))throw Error('This entry is assigned to media. Remove those media associations first.');
  const existingPlans=await plans.read(root);if(existingPlans.carts.some(c=>kind==='networks'?c.networkId===id:c.showIds.includes(id)))throw Error('This entry is used by a cart. Update or remove that cart first.');
  const count=kind==='networks'?c.shows.filter(r=>r.networkIds.includes(id)).length:0;
  const answer=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Remove'],defaultId:0,cancelId:0,message:`Remove ${row.name}?`,detail:kind==='networks'?`This removes its association from ${count} show(s). The shows and source media remain.`:'Source media remains untouched.'});
  if(answer.response!==1)return null;await catalog.remove(root,kind,id);return catalog.view(root);
 });
 win=new BrowserWindow({width:1150,height:850,minWidth:820,minHeight:650,title:'Retro TV Cart Builder',backgroundColor:'#11151b',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.on('close',e=>{if(buildJob?.running){e.preventDefault();dialog.showMessageBox(win,{type:'info',message:'Build/copy is running',detail:'Use Cancel build in Studio and wait for cleanup before closing.'});}});
 win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==home)e.preventDefault();});win.loadURL(home);
});
app.on('before-quit',()=>{scanJob?.controller.abort();buildJob?.controller.abort();playback.reset();});
app.on('window-all-closed',()=>app.quit());
