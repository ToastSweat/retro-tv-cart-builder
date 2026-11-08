'use strict';
const fs=require('fs'),path=require('path');
function findRepeats({cartId,manifest,draft,registry,carts,assignments,readCsv,configDir}){
 const canonical=p=>String(p||'').replace(/\\/g,'/').toLowerCase();
 const assets=new Map(registry.map(a=>[a.AssetID,a]));
 const recipes=new Map();
 const dir=path.join(configDir,'composites');
 if(fs.existsSync(dir))for(const name of fs.readdirSync(dir).filter(n=>n.endsWith('.json'))){
  const r=JSON.parse(fs.readFileSync(path.join(dir,name),'utf8').replace(/^\uFEFF/,''));
  for(const j of r.Jobs||[])if(j.Output)recipes.set(canonical(j.Output),j.Parts||[]);
 }
 function keys(row,seen=new Set()){
  const a=assets.get(row.AssetID)||{};const p=canonical(row.SourcePath||a.SourcePath);
  const out=new Set();if(row.AssetID)out.add('id:'+row.AssetID);if(p)out.add('path:'+p);
  if(p&&!seen.has(p)){seen.add(p);for(const part of recipes.get(p)||[])for(const k of keys({SourcePath:part},seen))out.add(k);}
  return out;
 }
 const uses=[];const warnings=[];
 for(const c of carts){
  if(c.CartID===cartId)continue;
  const active=assignments.some(a=>a.CartID===c.CartID&&Number(a.Revision)===Number(c.CurrentRevision)&&['ACTIVE','RESERVED'].includes(a.AssignmentStatus));
  if(c.Status!=='BUILT'&&!active)continue;
  const finalFile=path.join(path.dirname(c.ManifestPath),'FINAL','cart-final-manifest.csv');
  let rows;
  if(c.Status==='BUILT'&&fs.existsSync(finalFile))rows=readCsv(finalFile);
  else if(fs.existsSync(c.ManifestPath)){rows=readCsv(c.ManifestPath);if(c.Status==='BUILT')warnings.push(`${c.CartID}: FINAL manifest missing; using current manifest.`);}
  else{warnings.push(`${c.CartID}: manifest missing; repeat audit incomplete.`);continue;}
  for(const row of rows)uses.push({row,cartId:c.CartID,revision:Number(c.CurrentRevision),state:c.Status==='BUILT'?'BUILT':'RESERVED'});
 }
 const current=manifest.map(row=>{
  const d=draft.slots[row.SlotID];const a=assets.get(d?.assetId||row.AssetID);
  return {...row,AssetID:d?.assetId||row.AssetID,SourcePath:a?.SourcePath||row.SourcePath};
 });
 for(const row of current)uses.push({row,cartId,revision:null,state:'THIS CART'});
 const index=new Map();
 for(const use of uses)for(const k of keys(use.row)){if(!index.has(k))index.set(k,[]);index.get(k).push(use);}
 const bySlot={};
 for(const row of current){const hits=new Map();
  for(const k of keys(row))for(const u of index.get(k)||[]){
   if(u.cartId===cartId&&u.row.SlotID===row.SlotID)continue;
   hits.set(u.cartId+'|'+u.row.SlotID,{cartId:u.cartId,slotId:u.row.SlotID,position:u.row.Position,revision:u.revision,state:u.state,title:u.row.Title});
  }
  bySlot[row.SlotID]=[...hits.values()];
 }
 return {bySlot,warnings};
}
module.exports={findRepeats};
