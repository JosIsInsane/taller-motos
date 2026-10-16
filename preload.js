'use strict';
const { contextBridge, ipcRenderer } = require('electron');
const limpiar = e => { const m = String((e && e.message) || e).replace(/^Error invoking remote method '\w+': (Error: )?/, ''); return new Error(m); };
contextBridge.exposeInMainWorld('taller', {
  api: (fn, ...args) => ipcRenderer.invoke('api', fn, args).catch(e => { throw limpiar(e); }),
  sys: (fn, ...args) => ipcRenderer.invoke('sys', fn, args).catch(e => { throw limpiar(e); }),
  alRefrescar: cb => ipcRenderer.on('refrescar', () => cb()),
  alActualizar: cb => ipcRenderer.on('actualizacion', (e, d) => cb(d)),
});
