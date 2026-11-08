const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const {randomUUID}=require('node:crypto');const projects=require('../src/projects.cjs'),plans=require('../src/plans.cjs');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'retro-choices-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return projects.create({parent:dir,name:'Preferred Choices',libraries:[]});}
test('legacy template upgrades in memory, preserves IDs, only writes on save',async t=>{
 const p=await fixture(t),id=randomUUID(),slotId=randomUUID();const legacy={schemaVersion:1,templates:[{id,name:'Old rotation',slots:[{id:slotId,type:'NEXT',showIndex:2}]}],carts:[]};const file=path.join(p.root,'data/cart-plans.json'),bytes=JSON.stringify(legacy);await fs.writeFile(file,bytes);
 const read=await plans.read(p.root);assert.equal(read.schemaVersion,2);assert.equal(read.templates[0].id,id);assert.equal(read.templates[0].slots[0].id,slotId);assert.deepEqual(read.templates[0].slots[0].choices,[{type:'NEXT',showIndex:2}]);assert.equal(await fs.readFile(file,'utf8'),bytes);
 await plans.save(p.root,'templates',read.templates[0]);assert.equal(JSON.parse(await fs.readFile(file,'utf8')).schemaVersion,2);const backups=(await fs.readdir(path.join(p.root,'data'))).filter(f=>f.startsWith('cart-plans-backup'));assert.equal(await fs.readFile(path.join(p.root,'data',backups[0]),'utf8'),bytes);
});
test('ordered choices, independent show matching and reordered fallback survive reopen',async t=>{
 const p=await fixture(t);let data=await plans.save(p.root,'templates',{name:'Alternatives',slots:[{choices:[{type:'NEXT',showIndex:2},{type:'BUMPER_IN'}]},{choices:[{type:'PROMO'},{type:'COMMERCIAL'}]}]});
 const template=data.templates[0];assert.deepEqual(template.slots[0].choices,[{type:'NEXT',showIndex:2},{type:'BUMPER_IN'}]);template.slots[1].choices.reverse();data=await plans.save(p.root,'templates',template);assert.deepEqual((await plans.read(p.root)).templates[0],data.templates[0]);assert.equal(data.templates[0].slots[1].choices[0].type,'COMMERCIAL');
});
test('preference wins, eligible fallback chosen, replacement pool includes all allowed choices',()=>{
 const slot={choices:[{type:'NEXT',showIndex:2},{type:'BUMPER_IN'}]};const candidates=[{type:'BUMPER_IN',id:'fallback'},{type:'NEXT',showIndex:1,id:'wrong-show'},{type:'NEXT',showIndex:2,id:'preferred'}];const matches=(a,c)=>a.type===c.type&&(!c.showIndex||a.showIndex===c.showIndex);
 assert.equal(plans.choosePreferred(slot,candidates,matches).candidate.id,'preferred');const unused=a=>a.id!=='preferred';assert.equal(plans.choosePreferred(slot,candidates,matches,unused).candidate.id,'fallback');assert.deepEqual(plans.rankCandidates(slot,candidates,matches).map(r=>r.candidate.id),['preferred','fallback']);assert.equal(plans.choosePreferred(slot,candidates,matches,()=>false),null);
});
test('promo/commercial alternatives respect exclusion callback and do not admit other types',()=>{
 const slot={choices:[{type:'PROMO'},{type:'COMMERCIAL'}]};const candidates=[{type:'COMMERCIAL',ready:true},{type:'PROMO',ready:false},{type:'IDENT',ready:true}];assert.equal(plans.choosePreferred(slot,candidates,(a,c)=>a.type===c.type,a=>a.ready).candidate.type,'COMMERCIAL');assert.equal(plans.rankCandidates(slot,candidates,(a,c)=>a.type===c.type,a=>a.ready).length,1);
});
test('empty, duplicate, unknown and out-of-range choices rejected without writes',async t=>{
 const p=await fixture(t);await plans.save(p.root,'templates',{name:'Valid',slots:[{choices:[{type:'IDENT'}]}]});const file=path.join(p.root,'data/cart-plans.json'),before=await fs.readFile(file,'utf8');for(const choices of [[],[{type:'PROMO'},{type:'PROMO'}],[{type:'NOPE'}],[{type:'NEXT',showIndex:0}],Array.from({length:11},(_,i)=>({type:'SHOW',showIndex:i+1}))])await assert.rejects(()=>plans.save(p.root,'templates',{name:'Bad',slots:[{choices}]}));assert.equal(await fs.readFile(file,'utf8'),before);
});
