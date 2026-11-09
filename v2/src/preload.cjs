const {contextBridge,ipcRenderer}=require('electron');
contextBridge.exposeInMainWorld('retro',Object.fromEntries(['recent','folder','open','create','update','close','catalog','pickArtwork','saveEntry','removeEntry','discard','plans','savePlan','removePlan','media','mediaScan','mediaProgress','mediaCancel','mediaSave'].map(key=>[key,(...args)=>ipcRenderer.invoke(key,...args)])));
