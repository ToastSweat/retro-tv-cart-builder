const {app,BrowserWindow,ipcMain,dialog,session}=require('electron');
const path=require('node:path');const fs=require('node:fs/promises');const {pathToFileURL}=require('node:url');
const plans=require('./plans.cjs');const catalog=require('./catalog.cjs');const {randomUUID}=require('node:crypto');let artworkChoice=null;
const projects=require('./projects.cjs');let win,current=null;let busy=false;
const home=pathToFileURL(path.join(__dirname,'index.html')).href;
// Recent-project navigation only: all project records and generated media live in the project.
const recentFile=()=>path.join(app.getPath('userData'),'recent-projects.json');
async function recent(){try{const r=JSON.parse(await fs.readFile(recentFile(),'utf8'));return Array.isArray(r)?r.slice(0,12):[];}catch{return [];}}
async function remember(p){const r=await recent();await fs.mkdir(app.getPath('userData'),{recursive:true});await fs.writeFile(recentFile(),JSON.stringify([{name:p.project.name,file:p.file},...r.filter(x=>x.file!==p.file)].slice(0,12),null,2));}
function handle(channel,fn){ipcMain.handle(channel,async(e,...args)=>{
 if(e.sender!==win.webContents||e.senderFrame.url!==home)throw Error('Invalid request origin.');
 if(busy)return {error:'Please wait for the current operation.'};busy=true;
 try{return {value:await fn(...args)};}catch(err){return {error:err.message};}finally{busy=false;}
});}
const hasLock=app.requestSingleInstanceLock();
if(!hasLock)app.quit();
else app.whenReady().then(()=>{
 app.on('second-instance',()=>{if(win){if(win.isMinimized())win.restore();win.show();win.focus();}});
 session.defaultSession.setPermissionRequestHandler((_wc,_permission,cb)=>cb(false));
 handle('recent',recent);
 handle('folder',async()=>{const r=await dialog.showOpenDialog(win,{properties:['openDirectory','createDirectory']});return r.canceled?null:r.filePaths[0];});
 handle('open',async(file)=>{
  if(!file){const r=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Retro TV Project',extensions:['json']}]});if(r.canceled)return null;file=r.filePaths[0];}
  else if(!(await recent()).some(x=>x.file===file))throw Error('Use Open Project to select this file.');
  artworkChoice=null;current=await projects.open(file);await remember(current);return current;
 });
 handle('create',async(input)=>{artworkChoice=null;current=await projects.create(input);await remember(current);return current;});
 handle('update',async(input)=>{if(!current)throw Error('No open project.');current=await projects.update(current.file,input);await remember(current);return current;});
 handle('close',async()=>{current=null;artworkChoice=null;return true;});
 function requireProject(){if(!current)throw Error('Open a project first.');return current.root;}
 handle('catalog',async()=>catalog.view(requireProject()));
 handle('plans',async()=>plans.view(requireProject()));
 handle('savePlan',async(kind,input)=>{const root=requireProject();let selected=null;if(input.artworkToken){if(artworkChoice?.token!==input.artworkToken||artworkChoice.root!==root)throw Error('Select artwork again.');selected=artworkChoice.info;}await plans.save(root,kind,input,selected);artworkChoice=null;return plans.view(root);});
 handle('removePlan',async(kind,id)=>{const root=requireProject();if(!['carts','templates'].includes(kind))throw Error('Unknown type.');const data=await plans.read(root),row=data[kind].find(x=>x.id===id);if(!row)throw Error('Entry no longer exists.');if(kind==='templates'&&data.carts.some(c=>c.templateId===id))throw Error('Template is assigned to a cart. Change the cart first.');const r=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Remove'],defaultId:0,cancelId:0,message:`Remove ${row.name}?`,detail:'Source media remains untouched. Previous planning metadata is retained in the project.'});if(r.response!==1)return null;await plans.remove(root,kind,id);return plans.view(root);});
 handle('discard',async()=>{const r=await dialog.showMessageBox(win,{type:'question',buttons:['Keep editing','Discard changes'],defaultId:0,cancelId:0,message:'Discard unsaved changes?'});return r.response===1;});
 handle('pickArtwork',async()=>{
  requireProject();const result=await dialog.showOpenDialog(win,{properties:['openFile'],filters:[{name:'Artwork',extensions:['png','jpg','jpeg','webp']}]});
  if(result.canceled)return null;
  const info=await catalog.loadImage(result.filePaths[0]);
  const decoded=require('electron').nativeImage.createFromBuffer(info.buffer);if(decoded.isEmpty())throw Error('This image could not be decoded.');
  const size=decoded.getSize();if(size.width>10000||size.height>10000)throw Error('Artwork dimensions must not exceed 10000 pixels.');
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
  const existingPlans=await plans.read(root);if(existingPlans.carts.some(c=>kind==='networks'?c.networkId===id:c.showIds.includes(id)))throw Error('This entry is used by a cart. Update or remove that cart first.');
  const count=kind==='networks'?c.shows.filter(r=>r.networkIds.includes(id)).length:0;
  const answer=await dialog.showMessageBox(win,{type:'question',buttons:['Cancel','Remove'],defaultId:0,cancelId:0,message:`Remove ${row.name}?`,detail:kind==='networks'?`This removes its association from ${count} show(s). The shows and source media remain.`:'Source media remains untouched.'});
  if(answer.response!==1)return null;await catalog.remove(root,kind,id);return catalog.view(root);
 });
 win=new BrowserWindow({width:1150,height:850,minWidth:820,minHeight:650,title:'Retro TV Cart Builder',backgroundColor:'#11151b',webPreferences:{preload:path.join(__dirname,'preload.cjs'),nodeIntegration:false,contextIsolation:true,sandbox:true}});
 win.setMenuBarVisibility(false);win.webContents.setWindowOpenHandler(()=>({action:'deny'}));
 win.webContents.on('will-navigate',(e,url)=>{if(url!==home)e.preventDefault();});win.loadURL(home);
});
app.on('window-all-closed',()=>app.quit());
