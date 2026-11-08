const fs=require('node:fs/promises');const path=require('node:path');const {randomUUID}=require('node:crypto');const catalog=require('./catalog.cjs');const {within}=require('./projects.cjs');
const types={IDENT:'Ident',PROMO:'Promo',BUMPER_IN:'Bumper in',BUMPER_OUT:'Bumper out',BUMPER_GENERAL:'Bumper general',COMMERCIAL:'Commercial',SHOW:'Show',INTRO:'Show intro',NEXT:'Coming up next',SIGN_OFF:'Sign-off'};
const empty=()=>({schemaVersion:2,templates:[],carts:[]});
function choices(slot){return Array.isArray(slot.choices)?slot.choices:[{type:slot.type,...(['SHOW','INTRO','NEXT'].includes(slot.type)?{showIndex:slot.showIndex}:{})}];}
function normalizeSlot(slot){return {id:slot.id||randomUUID(),choices:choices(slot).map(c=>({type:c.type,...(['SHOW','INTRO','NEXT'].includes(c.type)?{showIndex:Number(c.showIndex)}:{})}))};}
function upgrade(data){
 if(data?.schemaVersion===1){if(!Array.isArray(data.templates)||!Array.isArray(data.carts))throw Error('Unsupported cart/template data. Nothing changed.');return {...data,schemaVersion:2,templates:data.templates.map(t=>({...t,slots:t.slots?.map(normalizeSlot)}))};}
 return data;
}
// Policy primitives for future generation/Studio integration. matches handles
// media type/show association; eligible handles usage, exclusions and other rules.
function rankCandidates(slot,candidates,matches,eligible=()=>true){
 const ranked=[];for(const [preferenceIndex,choice] of choices(slot).entries())for(const candidate of candidates){if(!ranked.some(r=>r.candidate===candidate)&&eligible(candidate,choice)&&matches(candidate,choice))ranked.push({candidate,choice,preferenceIndex});}return ranked;
}
function choosePreferred(slot,candidates,matches,eligible){return rankCandidates(slot,candidates,matches,eligible)[0]||null;}

function text(v,label,max=100){if(typeof v!=='string'||!v.trim()||v.length>max)throw Error(`${label} must contain 1–${max} characters.`);return v.trim();}
const idok=id=>typeof id==='string'&&/^[0-9a-f-]{36}$/.test(id);
function validate(data,org){
 if(data?.schemaVersion!==2||!Array.isArray(data.templates)||!Array.isArray(data.carts))throw Error('Unsupported cart/template data. Nothing changed.');
 const ids=new Set(),names=new Set(),codes=new Set();
 for(const t of data.templates){if(!idok(t.id)||ids.has(t.id))throw Error('Invalid template ID.');ids.add(t.id);const name=text(t.name,'Template name').toLowerCase();if(names.has(name))throw Error('Template name is already used.');names.add(name);
 if(!Array.isArray(t.slots)||!t.slots.length||t.slots.length>200)throw Error('A template needs 1–200 slots.');const slots=new Set();for(const s of t.slots){if(!idok(s.id)||slots.has(s.id))throw Error('Invalid template slot.');slots.add(s.id);
 if(!Array.isArray(s.choices)||!s.choices.length||s.choices.length>10)throw Error('Each slot needs 1–10 preferred choices.');const unique=new Set();for(const c of s.choices){if(!c||!Object.hasOwn(types,c.type))throw Error('Invalid clip type.');if(['SHOW','INTRO','NEXT'].includes(c.type)&&(!Number.isInteger(c.showIndex)||c.showIndex<1||c.showIndex>50))throw Error('Show choices need a show number from 1 to 50.');const key=c.type+':'+(c.showIndex||'');if(unique.has(key))throw Error('This slot has duplicate choices.');unique.add(key);}}}
 for(const c of data.carts){if(!idok(c.id)||ids.has(c.id))throw Error('Invalid cart ID.');ids.add(c.id);text(c.name,'Cart name');if(typeof c.code!=='string'||!/^[A-Z0-9][A-Z0-9_-]{0,23}$/.test(c.code))throw Error('Cart ID must use 1–24 letters, numbers, hyphens or underscores.');if(codes.has(c.code))throw Error('Cart ID is already used.');codes.add(c.code);
 if(!org.networks.some(n=>n.id===c.networkId))throw Error('Choose an existing network.');
 if(!Array.isArray(c.showIds)||new Set(c.showIds).size!==c.showIds.length||c.showIds.some(id=>!org.shows.some(s=>s.id===id&&s.networkIds.includes(c.networkId))))throw Error('Choose distinct shows assigned to this network.');
 if(c.templateId!==null&&!data.templates.some(t=>t.id===c.templateId))throw Error('Choose an existing template.');
 if(c.artwork!==null&&(typeof c.artwork!=='string'||!/^artwork\/carts\/[0-9a-f-]+\.(png|jpg|webp)$/.test(c.artwork)))throw Error('Invalid cart artwork.');
 }
 return data;
}
async function read(root){const org=await catalog.read(root);try{const dir=await catalog.safeDir(root,'data');const file=path.join(dir,'cart-plans.json');if((await fs.lstat(file)).isSymbolicLink())throw Error('Cart plan file must not be a link.');return validate(upgrade(JSON.parse(await fs.readFile(file,'utf8'))),org);}catch(e){if(e.code==='ENOENT')return empty();throw e;}}
async function write(root,data){validate(data,await catalog.read(root));const dir=await catalog.safeDir(root,'data',true),file=path.join(dir,'cart-plans.json'),tmp=path.join(dir,randomUUID()+'.tmp');try{try{await fs.copyFile(file,path.join(dir,'cart-plans-backup-'+randomUUID()+'.json'),fs.constants.COPYFILE_EXCL);}catch(e){if(e.code!=='ENOENT')throw e;}await fs.writeFile(tmp,JSON.stringify(data,null,2)+'\n',{flag:'wx'});await fs.rename(tmp,file);}finally{await fs.rm(tmp,{force:true});}}
async function save(root,kind,input,image=null){if(!['templates','carts'].includes(kind))throw Error('Unknown planning type.');const data=await read(root),old=data[kind].find(r=>r.id===input.id);if(input.id&&!old)throw Error('This entry no longer exists.');let row;
 if(kind==='templates'){if(!Array.isArray(input.slots))throw Error('Add template slots.');row={id:old?.id||randomUUID(),name:text(input.name,'Template name'),slots:input.slots.map(normalizeSlot)};}
 else{row={id:old?.id||randomUUID(),code:text(input.code,'Cart ID',24).toUpperCase(),name:text(input.name,'Cart name'),networkId:input.networkId,showIds:input.showIds,templateId:input.templateId||null,artwork:input.removeArtwork?null:old?.artwork||null};}
 if(old)data[kind][data[kind].findIndex(r=>r.id===old.id)]=row;else data[kind].push(row);validate(data,await catalog.read(root));let created;
 try{if(image&&kind==='carts'){const dir=await catalog.safeDir(root,'artwork/carts',true),file=randomUUID()+'.'+image.ext;created=path.join(dir,file);await fs.writeFile(created,image.buffer,{flag:'wx'});row.artwork='artwork/carts/'+file;}await write(root,data);}catch(e){if(created)await fs.rm(created,{force:true});throw e;}return data;
}
async function remove(root,kind,id){if(!['carts','templates'].includes(kind))throw Error('Unknown planning type.');const data=await read(root);if(!data[kind].some(r=>r.id===id))throw Error('Entry no longer exists.');if(kind==='templates'&&data.carts.some(c=>c.templateId===id))throw Error('This template is assigned to a cart. Change that cart first.');data[kind]=data[kind].filter(r=>r.id!==id);await write(root,data);return data;}
async function view(root){const data=await read(root),org=await catalog.read(root),previews={};for(const c of data.carts)if(c.artwork){try{const file=await fs.realpath(path.join(root,c.artwork));if(!within(await fs.realpath(root),file))throw Error('Invalid art path');const info=await catalog.loadImage(file);previews[c.id]=`data:${info.mime};base64,${info.buffer.toString('base64')}`;}catch{previews[c.id]=null;}}return {...data,organization:org,types,previews};}
function preview(cart,template,org){
 if(!template)return {slots:[],warnings:['Choose a template to preview the sequence.']};const missing=new Set();
 const slots=template.slots.map(s=>{const mapped=choices(s).map(c=>{const show=org.shows.find(x=>x.id===cart.showIds[c.showIndex-1]);if(['SHOW','INTRO','NEXT'].includes(c.type)&&!show)missing.add(c.showIndex);return {...c,label:types[c.type],showName:show?.name||null};});return {id:s.id,choices:mapped};});
 return {slots,warnings:[...missing].sort((a,b)=>a-b).map(n=>`Show ${n} has no show assigned for a preferred choice on this cart.`)};
}
module.exports={read,save,remove,view,preview,validate,types,choices,rankCandidates,choosePreferred};
