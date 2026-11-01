'use strict';
const fs=require('node:fs');
const path=require('node:path');
const crypto=require('node:crypto');
const {ProjectStore}=require('./project-store');
const hash=data=>crypto.createHash('sha256').update(data).digest('hex');
const encode=x=>JSON.stringify(x,null,2)+'\n';
function fail(message,status=400) {const e=new Error(message);e.status=status;e.statusCode=status;throw e;}
// Only synchronous observation phases may share ancestor/leaf checks. Never retain
// this map across a commit/freshness boundary or use it while writing/opening media.
let pathObservations=null;
function observe(callback,observations=new Map()){const previous=pathObservations;pathObservations=observations;try{return callback();}finally{pathObservations=previous;}}
function lstat(p){if(pathObservations?.has(p))return pathObservations.get(p);let st;try{st=fs.lstatSync(p);}catch(e){if(e.code!=='ENOENT')throw e;}pathObservations?.set(p,st);return st;}
function checked(value,{directory=false,required=false}={}) {
 if(typeof value!=='string'||!value||!path.isAbsolute(value)||/[\x00-\x1f\x7f]/.test(value)||/^[\\/]{2}/.test(value))fail('Unsafe absolute local path');
 const parts=value.slice(path.parse(value).root.length).split(/[\\/]/);
 if(parts.some(p=>p && (p==='..'||/[<>:"|?*]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(\.|$)/i.test(p))))fail('Unsafe Windows path component');
 const result=path.resolve(value);
 for(let p=result;;p=path.dirname(p)) {
  const st=lstat(p);
  if(st){if(st.isSymbolicLink())fail('Unsafe symlink/junction path: '+p);if((p!==result||directory)&&!st.isDirectory())fail('Expected directory: '+p);if(st.isFile()&&st.nlink!==1)fail('Unsafe hardlink file: '+p);}
  else if(p===result&&required)fail('Required path missing: '+p);
  if(p===path.dirname(p))break;
 }
 return result;
}
const within=(a,b)=>{const r=path.relative(a,b);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));};
const overlap=(a,b)=>within(a,b)||within(b,a);
const exists=p=>{checked(p);return fs.existsSync(p);};
function bytes(p){checked(p,{required:true});const st=fs.statSync(p);if(!st.isFile()||st.size>64*1024*1024)fail('Metadata must be a regular file within 64 MiB');return fs.readFileSync(p);}
function parseJson(data,p){try{return JSON.parse(data.toString('utf8').replace(/^\uFEFF/,''));}catch(e){fail('Cannot read JSON '+p+': '+e.message);}}
function json(p){return parseJson(bytes(p),p);}
function csv(text,source='CSV') {
 text=text.replace(/^\uFEFF/,'');const rows=[];let row=[],field='',quoted=false,closed=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(quoted){if(c==='"'){if(text[i+1]==='"'){field+='"';i++;}else{quoted=false;closed=true;}}else field+=c;}else if(c==='"'&&!field&&!closed)quoted=true;else if(c===','||c==='\n'||c==='\r'){row.push(field);field='';closed=false;if(c!==','){if(c==='\r'&&text[i+1]==='\n')i++;if(row.some(x=>x!==''))rows.push(row);row=[];}}else{if(closed||c==='"')fail('Malformed CSV '+source);field+=c;}}
 if(quoted)fail('Unterminated CSV '+source);if(field||row.length||closed){row.push(field);rows.push(row);}if(!rows.length)return [];
 const keys=rows.shift();if(new Set(keys).size!==keys.length||keys.some(k=>!k))fail('Malformed CSV header '+source);
 return rows.map(r=>{if(r.length!==keys.length)fail('Malformed CSV row '+source);return Object.fromEntries(keys.map((k,i)=>[k,r[i]]));});
}
function context(project,installRoot) {
 if(!project||typeof project.projectFolder!=='string')fail('Exact current project required',409);
 const root=checked(project.projectFolder,{directory:true,required:true});
 const fresh=new ProjectStore({installRoot,appDataDir:root}).inspect(root,{includeSummary:false,includeCatalog:false,includeDrafts:false});
 if(project.projectFolder!==fresh.projectFolder||project.kind!==fresh.kind||project.readOnly!==fresh.readOnly||JSON.stringify(project.paths)!==JSON.stringify(fresh.paths))fail('Wrong or stale project context',409);
 const settings=json(path.join(root,'STATE/settings.json'));
 if(!fresh.readOnly){
  const outputs=['buildsFolder','compositeFolder','cacheFolder'].map(k=>checked(fresh.paths[k],{directory:true}));
  if(overlap(root,installRoot))fail('Project overlaps install');
  for(let i=0;i<outputs.length;i++){if(overlap(outputs[i],installRoot)||outputs.slice(0,i).some(o=>overlap(o,outputs[i])))fail('Unsafe output overlap');if(overlap(root,outputs[i])&&!(i===2&&within(path.join(root,'CACHE'),outputs[i])))fail('Unsafe project/output overlap');}
  for(const lib of [...fresh.paths.libraryFolders,...(settings.CommercialRoot?[settings.CommercialRoot]:[])]){checked(lib,{directory:true});if([root,installRoot,...outputs].some(o=>overlap(lib,o)))fail('Source library overlaps project/install/output');}
 }
 return {root,project:fresh,settings};
}
function external(ctx) {
 const files=[],seen=new Set();let total=0;
 function add(p,kind,optional=false){p=checked(p);const key=p.toLowerCase();if(seen.has(key))return;seen.add(key);
  if(!exists(p)){if(!optional)fail('Required metadata missing '+p);files.push({path:p,kind,missing:true});return;}
  const data=bytes(p);if(++total>2000||files.reduce((n,f)=>n+(f.data?.length||0),0)+data.length>64*1024*1024)fail('Metadata exceeds bounded file/byte limit');
  const value=/\.csv$/i.test(p)?csv(data.toString('utf8'),p):parseJson(data,p);files.push({path:p,kind,data,value,sha256:hash(data)});
 }
 function scan(dir,kind,depth=0){checked(dir,{directory:true});if(!exists(dir))return;if(depth>8)fail('Metadata depth limit');const entries=fs.readdirSync(dir,{withFileTypes:true});if(entries.length>2000)fail('Metadata entry limit');for(const e of entries.sort((a,b)=>a.name.localeCompare(b.name))){if(e.isSymbolicLink())fail('Unsafe symlink metadata entry');const p=path.join(dir,e.name);if(e.isDirectory())scan(p,kind,depth+1);else if(/\.(json|csv)$/i.test(e.name))add(p,kind);}}
 const {root,settings:s}=ctx;
 add(path.join(root,'retro-project.json'),'descriptor',true);add(path.join(root,'STATE/settings.json'),'settings');
 add(s.RegistryPath,'registry');add(s.AssignmentPath,'assignment');add(s.CartRegistryPath,'cart');
 scan(path.join(root,'STATE/studio-drafts'),'draft');scan(s.ConfigDir,'config');scan(s.CurationDir,'curation');
 for(const file of [...files])if(file.kind==='cart')for(const row of file.value){if(row.ManifestPath)add(row.ManifestPath,'manifest',true);else files.push({path:file.path+'#'+row.CartID,kind:'manifest',missing:true});}
 for(const file of [...files])if(file.kind==='draft'){if(file.value.baseManifestPath)add(file.value.baseManifestPath,'manifest',true);else files.push({path:file.path+'#baseManifestPath',kind:'manifest',missing:true});}
 return {files,fingerprint:hash(encode(files.map(f=>[f.path,f.sha256||'missing'])))};
}
function lock(lockPath,callback) {
 checked(lockPath);const owner=crypto.randomUUID();let fd;
 try{fd=fs.openSync(lockPath,'wx');}catch(e){if(e.code==='EEXIST')fail('Project setup lock held; inspect manually, never auto-expire',409);throw e;}
 try{fs.writeFileSync(fd,encode({owner,pid:process.pid,createdAt:new Date().toISOString()}));}finally{fs.closeSync(fd);}
 const verify=()=>{if(json(lockPath).owner!==owner)fail('Project lock ownership changed; inspect manually',409);};
 try{return callback(verify);}finally{verify();fs.unlinkSync(lockPath);}
}
function publish(file,document,verify,expectedBeforeHash) {
 checked(file);const before=exists(file)?bytes(file):null,data=Buffer.from(encode(document));
 if(expectedBeforeHash!==undefined&&(before?hash(before):null)!==expectedBeforeHash)fail('Stale catalog changed since transaction load',409);
 const backups=checked(path.join(path.dirname(path.dirname(file)),'backups'),{directory:true});if(!exists(backups))fs.mkdirSync(backups);
 const dir=checked(path.join(backups,'library-'+crypto.randomUUID()),{directory:true});fs.mkdirSync(dir);
 function put(name,b){const p=checked(path.join(dir,name));fs.writeFileSync(p,b,{flag:'wx'});if(hash(bytes(p))!==hash(b))fail('Backup/staging verification failed');return p;}
 if(before)put('before.json',before);
 put('receipt.json',encode({schemaVersion:1,target:file,existed:!!before,sha256:before?hash(before):null}));
 const stage=put('staged.json',data);verify();checked(file);
 if((exists(file)?hash(bytes(file)):null)!==(before?hash(before):null))fail('Stale catalog before publication',409);
 fs.renameSync(stage,file);
 try{if(hash(bytes(file))!==hash(data))fail('Catalog readback mismatch');JSON.parse(bytes(file).toString('utf8'));}
 catch(e){
  try{verify();if(hash(bytes(file))!==hash(data))fail('Published target changed; rollback unsafe');if(before){const rollback=put('rollback.json',before);fs.renameSync(rollback,file);}else fs.unlinkSync(file);}
  catch(r){fail('Publication uncertain; inspect backup, do not replay: '+r.message,500);}
  throw e;
 }
}
module.exports={fs,path,crypto,hash,encode,fail,checked,within,overlap,exists,bytes,json,csv,context,external,lock,publish,observe};
