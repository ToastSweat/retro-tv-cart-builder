const {test}=require('node:test'),fs=require('node:fs/promises'),path=require('node:path'),vm=require('node:vm');
test('all Electron entrypoints, preload and renderer sources parse before packaging',async()=>{const dir=path.join(__dirname,'../src');for(const name of await fs.readdir(dir))if(/\.(?:cjs|js)$/.test(name))new vm.Script(await fs.readFile(path.join(dir,name),'utf8'),{filename:name});});
