const fs=require('node:fs/promises');
const path=require('node:path');
const {randomUUID}=require('node:crypto');
const folders=['data','artwork','composites','cache','builds','exports'];
function within(a,b){const r=path.relative(a,b);return r===''||(!r.startsWith('..'+path.sep)&&r!=='..'&&!path.isAbsolute(r));}
function name(s){if(typeof s!=='string'||!s.trim()||s.length>100)throw Error('Enter a name between 1 and 100 characters.');return s.trim();}
async function libraries(rows,root){
 if(!Array.isArray(rows))throw Error('Library folders must be a list.');
 const result=[];
 for(const row of rows){
  const p=await fs.realpath(row.path);if(!(await fs.stat(p)).isDirectory())throw Error('Library must be a folder.');
  if(within(root,p)||within(p,root))throw Error('Project and media library folders must be separate, with neither inside the other.');
  if(result.some(r=>r.path===p))throw Error('This library folder is already listed.');
  result.push({id:row.id||randomUUID(),name:name(row.name),path:p});
 }return result;
}
function validate(p){
 if(p?.schemaVersion!==1||p?.application!=='Retro TV Cart Builder'||typeof p.id!=='string'||!Array.isArray(p.libraries))throw Error('This is not a supported Retro TV Cart Builder project.');
 name(p.name);
 for(const r of p.libraries){if(typeof r.id!=='string'||typeof r.path!=='string'||!path.isAbsolute(r.path))throw Error('Invalid library reference.');name(r.name);}
 for(const k of folders)if(p.folders?.[k]!==k)throw Error('Unsupported project folder layout.');
 if(typeof p.settings?.crossProjectUsageLock!=='boolean')throw Error('Invalid project settings.');
 return p;
}
async function write(file,value){
 const tmp=file+'.'+randomUUID()+'.tmp';
 try{await fs.writeFile(tmp,JSON.stringify(value,null,2)+'\n',{flag:'wx'});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}
}
async function create(input){
 const title=name(input.name);if(/[<>:"/\\|?*\x00-\x1f]/.test(title)||/[. ]$/.test(title)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(title))throw Error('Choose a project name valid as a Windows folder name.');
 const parent=await fs.realpath(input.parent);const root=path.join(parent,title);
 const refs=await libraries(input.libraries,root);
 const project={application:'Retro TV Cart Builder',schemaVersion:1,id:randomUUID(),name:title,createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),folders:Object.fromEntries(folders.map(k=>[k,k])),libraries:refs,settings:{crossProjectUsageLock:false}};
 await fs.mkdir(root); // Never merge into or overwrite an existing folder.
 try{for(const k of folders)await fs.mkdir(path.join(root,k));await write(path.join(root,'project.json'),project);}catch(e){await fs.rm(root,{recursive:true,force:true});throw e;}
 return open(path.join(root,'project.json'));
}
async function open(file){
 file=await fs.realpath(file);if(path.basename(file)!=='project.json')throw Error('Select project.json inside the project folder.');
 const project=validate(JSON.parse(await fs.readFile(file,'utf8')));const root=path.dirname(file);
 const status=[];
 for(const ref of project.libraries){let available=false;try{available=(await fs.stat(ref.path)).isDirectory();}catch{}status.push({...ref,available});}
 return {file,root,project,libraries:status};
}
async function update(file,input){
 const current=await open(file);const refs=await libraries(input.libraries,current.root);
 const next={...current.project,name:name(input.name),libraries:refs,updatedAt:new Date().toISOString()};
 // Keep one prior settings snapshot in the project, never in a source library.
 await fs.copyFile(file,path.join(current.root,'data','project.previous.json'));
 await write(file,next);return open(file);
}
module.exports={create,open,update,folders,within};
