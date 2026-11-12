const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');const catalog=require('./catalog.cjs');const {within}=require('./projects.cjs');
const categories={UNCLASSIFIED:'Unclassified',SHOW:'Show / episode',IDENT:'Ident',PROMO:'Promo',BUMPER_IN:'Bumper in',BUMPER_OUT:'Bumper out',BUMPER_GENERAL:'Bumper general',COMMERCIAL:'Commercial',INTRO:'Show intro',NEXT:'Coming up next',SIGN_OFF:'Sign-off',OTHER:'Other'};
const extensions=new Set(['.mp4','.mkv','.avi','.flv','.webm','.mov','.m4v','.mpg','.mpeg','.wmv','.ts','.m2ts','.vob']);
const empty=()=>({schemaVersion:1,assets:[],updatedAt:null});
function safeRelative(s){return typeof s==='string'&&s.length>0&&!s.includes('\\')&&!path.posix.isAbsolute(s)&&!s.split('/').some(p=>p==='..'||p==='.'||!p);}
function key(libraryId,relativePath){return libraryId+'|'+relativePath;}
function validate(data){
 if(data?.schemaVersion!==1||!Array.isArray(data.assets))throw Error('Unsupported media catalog. Nothing changed.');const ids=new Set(),paths=new Set();
 for(const a of data.assets){if(!a||typeof a.id!=='string'||ids.has(a.id)||typeof a.libraryId!=='string'||!safeRelative(a.relativePath)||!Object.hasOwn(categories,a.category))throw Error('Invalid media record.');if(a.classified===undefined)a.classified=false;if(typeof a.classified!=='boolean')throw Error('Invalid classification status.');ids.add(a.id);const k=key(a.libraryId,a.relativePath);if(paths.has(k))throw Error('Duplicate media reference.');paths.add(k);if(typeof a.title!=='string'||!Array.isArray(a.networkIds)||!Array.isArray(a.showIds)||!Array.isArray(a.tags)||!Array.isArray(a.softTags)||typeof a.notes!=='string'||typeof a.excluded!=='boolean'||typeof a.missing!=='boolean')throw Error('Invalid media metadata.');}
 return data;
}
async function read(root){try{const dir=await catalog.safeDir(root,'data'),file=path.join(dir,'media-library.json');if((await fs.lstat(file)).isSymbolicLink())throw Error('Media catalog must not be a link.');return validate(JSON.parse(await fs.readFile(file,'utf8')));}catch(e){if(e.code==='ENOENT')return empty();throw e;}}
async function write(root,data){validate(data);const dir=await catalog.safeDir(root,'data',true),file=path.join(dir,'media-library.json'),tmp=path.join(dir,randomUUID()+'.tmp');data.updatedAt=new Date().toISOString();try{try{const previous=path.join(dir,'media-library-previous.json');try{if((await fs.lstat(previous)).isSymbolicLink())throw Error('Media backup must not be a link.');}catch(e){if(e.code!=='ENOENT')throw e;}await fs.copyFile(file,previous);}catch(e){if(e.code!=='ENOENT')throw e;}await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
function aborted(signal){if(signal?.aborted)throw Error('Scan canceled. No scan changes were saved.');}
async function scan(project,{libraryIds,signal,onProgress=()=>{}}={}){
 const libs=libraryIds?project.project.libraries.filter(l=>libraryIds.includes(l.id)):project.project.libraries;if(!libs.length)throw Error('Add or select a source library first.');
 const data=await read(project.root);const index=new Map(data.assets.map(a=>[key(a.libraryId,a.relativePath),a]));const summary={found:0,added:0,refreshed:0,missing:0,skippedLinks:0,warnings:[]};
 for(const lib of libs){aborted(signal);const seen=new Set();let clean=true;
  let real;try{real=await fs.realpath(lib.path);if(!(await fs.stat(real)).isDirectory())throw Error('Not a folder');}catch{summary.warnings.push(`${lib.name}: source folder unavailable; previous records preserved.`);continue;}
  if(within(real,project.root)||within(project.root,real))throw Error('Project and source library folders must remain separate. No scan changes saved.');
  const stack=[{dir:real,relative:''}];
  while(stack.length){aborted(signal);const node=stack.pop();let entries;try{entries=await fs.readdir(node.dir,{withFileTypes:true});}catch{clean=false;summary.warnings.push(`${lib.name}: could not read ${node.relative||'root'}; missing-file detection skipped for this library.`);continue;}
   for(const entry of entries){aborted(signal);if(entry.name.startsWith('.')||['node_modules','$RECYCLE.BIN','System Volume Information'].includes(entry.name))continue;const relative=node.relative?node.relative+'/'+entry.name:entry.name,full=path.join(node.dir,entry.name);
    if(entry.isSymbolicLink()){summary.skippedLinks++;continue;}
    if(entry.isDirectory()){stack.push({dir:full,relative});continue;}
    if(!entry.isFile()||!extensions.has(path.extname(entry.name).toLowerCase()))continue;
    // Recheck real path before metadata access: no link/junction escape.
    let stat;try{const actual=await fs.realpath(full);const r=path.relative(real,actual);if(r==='..'||r.startsWith('..'+path.sep)||path.isAbsolute(r)){summary.skippedLinks++;continue;}stat=await fs.stat(full);}catch{clean=false;summary.warnings.push(`${lib.name}: skipped unreadable file ${relative}`);continue;}
    summary.found++;if(summary.found>200000)throw Error('Scan exceeds 200,000 files. Add smaller library folders; no scan changes saved.');seen.add(relative);const existing=index.get(key(lib.id,relative));
    if(existing){existing.sizeBytes=stat.size;existing.modifiedAt=stat.mtime.toISOString();existing.missing=false;summary.refreshed++;}
    else{const row={id:randomUUID(),libraryId:lib.id,relativePath:relative,title:path.parse(entry.name).name,category:'UNCLASSIFIED',classified:false,networkIds:[],showIds:[],year:null,tags:[],softTags:[],notes:'',excluded:false,missing:false,sizeBytes:stat.size,modifiedAt:stat.mtime.toISOString()};data.assets.push(row);index.set(key(lib.id,relative),row);summary.added++;}
    if(summary.found%25===0)onProgress({...summary,library:lib.name});
   }
  }
  if(clean)for(const row of data.assets)if(row.libraryId===lib.id&&!seen.has(row.relativePath)){row.missing=true;summary.missing++;}
  onProgress({...summary,library:lib.name});
 }
 aborted(signal);await write(project.root,data);return summary;
}
function tags(values){if(!Array.isArray(values)||values.length>1000)throw Error('Use at most 100 distinct tags.');const result=[];for(const v of values){if(typeof v!=='string'||v.trim().length>80)throw Error('Each tag must be at most 80 characters.');const value=v.trim();if(value&&!result.some(t=>t.toLowerCase()===value.toLowerCase()))result.push(value);}if(result.length>100)throw Error('Use at most 100 distinct tags.');return result;}
async function update(root,ids,input,modes={}){
 const data=await read(root),org=await catalog.read(root);if(!Array.isArray(ids)||!ids.length||ids.length>50000||new Set(ids).size!==ids.length)throw Error('Select 1–50,000 distinct files.');const selectedIds=new Set(ids);const selected=data.assets.filter(a=>selectedIds.has(a.id));if(selected.length!==ids.length)throw Error('Selected media record no longer exists.');
 const allowed=['title','category','networkIds','showIds','year','tags','softTags','notes','excluded','classified'];if(Object.keys(input).some(k=>!allowed.includes(k)))throw Error('Unknown metadata field.');const patch={};
 if(Object.hasOwn(input,'title')){if(ids.length!==1||typeof input.title!=='string'||!input.title.trim()||input.title.length>300)throw Error('Enter a title of 1–300 characters for one file.');patch.title=input.title.trim();}
 if(Object.hasOwn(input,'category')){if(!Object.hasOwn(categories,input.category))throw Error('Choose a valid category.');patch.category=input.category;}
 for(const [field,records] of [['networkIds',org.networks],['showIds',org.shows]])if(Object.hasOwn(input,field)){if(!Array.isArray(input[field])||input[field].some(id=>!records.some(r=>r.id===id)))throw Error('Choose existing networks and shows.');patch[field]=[...new Set(input[field])];}
 if(Object.hasOwn(input,'year')){if(input.year!==null&&(!Number.isInteger(input.year)||input.year<1900||input.year>2100))throw Error('Year must be blank or between 1900 and 2100.');patch.year=input.year;}
 for(const f of ['tags','softTags'])if(Object.hasOwn(input,f))patch[f]=tags(input[f]);
 if(Object.hasOwn(input,'notes')){if(typeof input.notes!=='string'||input.notes.length>10000)throw Error('Notes must be at most 10,000 characters.');patch.notes=input.notes;}
 if(Object.hasOwn(input,'excluded')){if(typeof input.excluded!=='boolean')throw Error('Invalid exclusion flag.');patch.excluded=input.excluded;}
 if(Object.hasOwn(input,'classified')){if(typeof input.classified!=='boolean')throw Error('Invalid classification status.');patch.classified=input.classified;}
 for(const [field,mode] of Object.entries(modes)){if(!['networkIds','showIds','tags','softTags'].includes(field)||!Object.hasOwn(patch,field)||!['add','replace','remove'].includes(mode))throw Error('Invalid bulk edit mode.');}
 for(const a of selected){for(const [field,value] of Object.entries(patch)){const mode=modes[field]||'replace';if(mode==='replace')a[field]=value;else if(mode==='add')a[field]=['tags','softTags'].includes(field)?tags([...a[field],...value]):[...new Set([...a[field],...value])];else{const key=v=>['tags','softTags'].includes(field)?v.toLowerCase():v;a[field]=a[field].filter(v=>!value.some(x=>key(x)===key(v)));}}}await write(root,data);return selected.length;
}
async function query(project,filters={}){
 const data=await read(project.root),libs=project.project.libraries,org=await catalog.read(project.root);const q=String(filters.search||'').trim().toLowerCase();
 const present=[];for(const l of libs){try{if((await fs.stat(l.path)).isDirectory())present.push([l.id,l]);}catch{}}const available=new Map(present);const assets=data.assets.filter(a=>(!filters.libraryId||a.libraryId===filters.libraryId)&&(!filters.folderPath||a.relativePath.startsWith(filters.folderPath+'/'))&&(filters.includeSubfolders!==false||a.relativePath.slice((filters.folderPath||'').length+(filters.folderPath?1:0)).indexOf('/')===-1)&&(!filters.category||a.category===filters.category)&&(!filters.networkId||a.networkIds.includes(filters.networkId))&&(!filters.showId||a.showIds.includes(filters.showId))&&(!filters.classification||(filters.classification==='classified'?a.classified:!a.classified))&&(!filters.status||(filters.status==='excluded'?a.excluded:filters.status==='missing'?a.missing||!available.has(a.libraryId):filters.status==='included'?!a.excluded&&!a.missing&&available.has(a.libraryId):a.category==='UNCLASSIFIED'))&&(!q||[a.title,a.relativePath,a.year,...a.tags,...a.softTags,a.notes].join(' ').toLowerCase().includes(q))).sort((a,b)=>{
 const field=filters.sort==='path'?'relativePath':filters.sort==='filename'?'filename':'title';
 const value=a=>field==='filename'?a.relativePath.split('/').at(-1):a[field];
 return (filters.sort==='path'?a.libraryId.localeCompare(b.libraryId):0)||value(a).localeCompare(value(b),undefined,{numeric:true})||a.id.localeCompare(b.id);
 });
 return {data,libs,org,available,assets};
}
async function selectIds(project,filters={}){const {assets}=await query(project,filters);if(assets.length>50000)throw Error('More than 50,000 matches. Narrow the filters first.');return assets.map(a=>a.id);}
async function list(project,filters={}){
 const {data,libs,org,available,assets}=await query(project,filters);
 const folderPath=typeof filters.folderPath==='string'?filters.folderPath:'';
 const folderCounts=new Map();
 for(const a of data.assets){if(!filters.libraryId||a.libraryId!==filters.libraryId)continue;const prefix=folderPath?folderPath+'/':'';if(!a.relativePath.startsWith(prefix))continue;const rest=a.relativePath.slice(prefix.length),slash=rest.indexOf('/');if(slash<0)continue;const name=rest.slice(0,slash);folderCounts.set(name,(folderCounts.get(name)||0)+1);}
 const folders=[...folderCounts].map(([name,count])=>({name,count,path:folderPath?folderPath+'/'+name:name})).sort((a,b)=>a.name.localeCompare(b.name,undefined,{numeric:true}));
 const pageSize=50,page=Math.min(Math.max(0,Math.ceil(assets.length/pageSize)-1),Math.max(0,Math.floor(Number(filters.page)||0)));return {folders,total:data.assets.length,matched:assets.length,page,pageSize,assets:assets.slice(page*pageSize,(page+1)*pageSize).map(a=>({...a,libraryName:available.get(a.libraryId)?.name||'Library not configured',sourcePath:available.has(a.libraryId)?path.join(available.get(a.libraryId).path,...a.relativePath.split('/')):null,unavailable:a.missing||!available.has(a.libraryId)})),categories,libraries:libs,organization:org,updatedAt:data.updatedAt};
}
module.exports={read,scan,update,list,selectIds,categories};
