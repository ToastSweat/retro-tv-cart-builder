const {test}=require('node:test');const assert=require('node:assert/strict');const fs=require('node:fs/promises');const os=require('node:os');const path=require('node:path');const projects=require('../src/projects.cjs');const catalog=require('../src/catalog.cjs');
const png=Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=','base64');
async function fixture(t){const dir=await fs.mkdtemp(path.join(os.tmpdir(),'retro-org-'));t.after(()=>fs.rm(dir,{recursive:true,force:true}));return {dir,...await projects.create({parent:dir,name:'Collection',libraries:[]})};}
test('network/show CRUD, shared networks, reopen, rename and unlink',async t=>{
 const {root}=await fixture(t);assert.deepEqual(await catalog.read(root),{schemaVersion:1,networks:[],shows:[]});
 let c=await catalog.save(root,'networks',{name:'Nickelodeon',shortName:'NICK'});const nick=c.networks[0];
 c=await catalog.save(root,'networks',{name:'Cartoon Network',shortName:'CN'});const cn=c.networks[1];
 c=await catalog.save(root,'shows',{name:'Rugrats',networkIds:[nick.id,cn.id]});const rugrats=c.shows[0];
 c=await catalog.save(root,'networks',{...nick,name:'Nickelodeon Classic'});assert.equal(c.networks[0].id,nick.id);assert.deepEqual(c.shows[0].networkIds,[nick.id,cn.id]);
 c=await catalog.remove(root,'networks',nick.id);assert.equal(c.shows[0].id,rugrats.id);assert.deepEqual(c.shows[0].networkIds,[cn.id]);
 assert.deepEqual(await catalog.read(root),c);c=await catalog.remove(root,'shows',rugrats.id);assert.equal(c.shows.length,0);
 const backups=(await fs.readdir(path.join(root,'data'))).filter(n=>n.startsWith('organization-backup'));assert.ok(backups.length>=4);
});
test('reject duplicate names/short names and bad associations without modifying data',async t=>{
 const {root}=await fixture(t);let c=await catalog.save(root,'networks',{name:'Nickelodeon',shortName:'NICK'});const before=JSON.stringify(c);
 await assert.rejects(()=>catalog.save(root,'networks',{name:'nickelodeon',shortName:'N2'}),/name/);
 await assert.rejects(()=>catalog.save(root,'networks',{name:'Other',shortName:'nick'}),/short name/);
 await assert.rejects(()=>catalog.save(root,'shows',{name:'Bad',networkIds:['missing']}),/unknown/);
 await assert.rejects(()=>catalog.save(root,'shows',{name:'Bad',networkIds:[c.networks[0].id,c.networks[0].id]}),/duplicate/);
 assert.equal(JSON.stringify(await catalog.read(root)),before);
});
test('artwork copy, relocation, removal, retained recovery and source preservation',async t=>{
 const {root,dir}=await fixture(t);const source=path.join(dir,'source.png');await fs.writeFile(source,png);const info=await catalog.loadImage(source);
 let c=await catalog.save(root,'networks',{name:'Nickelodeon',shortName:'NICK'},info);const n=c.networks[0];assert.ok(n.artwork.startsWith('artwork/networks/'));
 assert.deepEqual(await fs.readFile(source),png);assert.deepEqual(await fs.readFile(path.join(root,n.artwork)),png);
 const moved=path.join(dir,'Moved [Project]');await fs.rename(root,moved);const view=await catalog.view(moved);assert.ok(view.previews[n.id].startsWith('data:image/png;base64,'));
 c=await catalog.save(moved,'networks',{...n,removeArtwork:true});assert.equal(c.networks[0].artwork,null);assert.deepEqual(await fs.readFile(path.join(moved,n.artwork)),png);
});
test('invalid artwork and invalid kind cannot change organization',async t=>{
 const {root}=await fixture(t);await assert.rejects(()=>catalog.save(root,'networks',{name:'Bad',shortName:'BAD'},{buffer:Buffer.from('not an image')}),/PNG/);assert.equal((await catalog.read(root)).networks.length,0);
 await assert.rejects(()=>catalog.save(root,'other',{name:'Bad'}),/Unknown/);
});
test('separate project organization and unsupported file protection',async t=>{
 const {root,dir}=await fixture(t);const other=await projects.create({parent:dir,name:'Other',libraries:[]});await catalog.save(root,'networks',{name:'Nick',shortName:'NICK'});assert.equal((await catalog.read(other.root)).networks.length,0);
 const file=path.join(other.root,'data','organization.json');await fs.writeFile(file,'{"schemaVersion":999}');await assert.rejects(()=>catalog.save(other.root,'networks',{name:'Bad',shortName:'BAD'}),/Unsupported/);assert.equal(await fs.readFile(file,'utf8'),'{"schemaVersion":999}');
});
test('reject managed-folder symlink escape before artwork or records write',async t=>{
 const {root,dir}=await fixture(t);const outside=path.join(dir,'source-library');await fs.mkdir(outside);await fs.rmdir(path.join(root,'artwork'));await fs.symlink(outside,path.join(root,'artwork'),'junction');
 await assert.rejects(()=>catalog.save(root,'networks',{name:'Nick',shortName:'NICK'},{buffer:png}),/outside/);assert.deepEqual(await fs.readdir(outside),[]);assert.equal((await catalog.read(root)).networks.length,0);
});
