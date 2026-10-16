'use strict';
const { app, BrowserWindow, ipcMain, dialog, shell, Menu, nativeImage } = require('electron');
const path = require('path');
const fs = require('fs');
const initSqlJs = require('sql.js');
const XLSX = require('xlsx');
const { crearBackend, utils } = require('./backend');

app.setName('Taller');
const OTRA_INSTANCIA = !app.requestSingleInstanceLock();
if (OTRA_INSTANCIA) app.quit();

let win = null, SQL = null, db = null, B = null, dbPath = '', ultimoGuardado = 0, sucioDesdeRespaldo = false;
const DATA = () => app.getPath('userData');
const FOTOS = () => path.join(DATA(), 'fotos');
const hoy = () => utils.isoLocal(new Date());
const sello = () => { const d = new Date(); return hoy() + '_' + String(d.getHours()).padStart(2, '0') + String(d.getMinutes()).padStart(2, '0'); };
/** ¿La ruta está dentro de la carpeta base? (evita salir con ../) */
const dentroDe = (base, ruta) => { const r = path.relative(path.resolve(base), path.resolve(ruta)); return !!r && !r.startsWith('..') && !path.isAbsolute(r); };
const ESQUEMAS_EXTERNOS = ['https:', 'http:', 'whatsapp:', 'mailto:', 'tel:'];
function abrirExterno(url) {
  let u; try { u = new URL(String(url)); } catch (e) { return false; }
  if (!ESQUEMAS_EXTERNOS.includes(u.protocol)) return false;
  shell.openExternal(u.toString()); return true;
}
const limpioNombre = s => String(s || '').replace(/[\\/:*?"<>|]+/g, ' ').trim().slice(0, 80);

// ------------------------------------------------------------ base de datos
async function abrirBase() {
  SQL = await initSqlJs({ locateFile: f => path.join(__dirname, 'node_modules', 'sql.js', 'dist', f) });
  dbPath = path.join(DATA(), 'taller.db');
  fs.mkdirSync(DATA(), { recursive: true });
  db = fs.existsSync(dbPath) ? new SQL.Database(fs.readFileSync(dbPath)) : new SQL.Database();
  B = crearBackend(db);
  guardar(true);
}
/** Escritura atómica: primero a un temporal y luego se reemplaza, así un apagón no corrompe la base. */
function guardar(forzar) {
  const data = Buffer.from(db.export());
  const tmp = dbPath + '.tmp';
  fs.writeFileSync(tmp, data);
  fs.renameSync(tmp, dbPath);
  ultimoGuardado = Date.now();
  if (!forzar) sucioDesdeRespaldo = true;
}

// ------------------------------------------------------------ respaldos
function carpetaRespaldos() {
  const c = B && B.cfg('carpetaRespaldos');
  return c && fs.existsSync(c) ? c : path.join(app.getPath('documents'), 'Taller Respaldos');
}
function respaldar(tipo) {
  const dir = carpetaRespaldos();
  fs.mkdirSync(dir, { recursive: true });
  const nombre = tipo === 'manual' ? `taller_${sello()}_manual.db` : tipo === 'antes-de-restaurar' ? `taller_${sello()}_antes-de-restaurar.db` : tipo === 'antes-de-actualizar' ? `taller_${sello()}_antes-de-actualizar.db` : `taller_${hoy()}.db`;
  const destino = path.join(dir, nombre);
  fs.copyFileSync(dbPath, destino);
  // conservar los últimos 60 respaldos diarios automáticos
  const diarios = fs.readdirSync(dir).filter(f => /^taller_\d{4}-\d{2}-\d{2}\.db$/.test(f)).sort();
  diarios.slice(0, Math.max(0, diarios.length - 60)).forEach(f => { try { fs.unlinkSync(path.join(dir, f)); } catch (e) { /* ignorar */ } });
  sucioDesdeRespaldo = false;
  return destino;
}
function listarRespaldos() {
  const dir = carpetaRespaldos();
  if (!fs.existsSync(dir)) return { carpeta: dir, archivos: [] };
  const archivos = fs.readdirSync(dir).filter(f => /^taller_.*\.db$/.test(f)).map(f => {
    const st = fs.statSync(path.join(dir, f)); return { nombre: f, ruta: path.join(dir, f), tamano: st.size, fecha: st.mtime.toISOString() };
  }).sort((a, b) => b.fecha.localeCompare(a.fecha));
  return { carpeta: dir, archivos };
}
function validarBase(ruta) {
  const t = new SQL.Database(fs.readFileSync(ruta));
  try { const r = t.exec("SELECT COUNT(*) FROM sqlite_master WHERE name IN ('trabajos','config','cierres')"); if (!r.length || r[0].values[0][0] < 3) throw new Error('El archivo no es un respaldo válido del Taller'); }
  finally { t.close(); }
}
function restaurar(ruta) {
  validarBase(ruta);
  respaldar('antes-de-restaurar');
  db.close();
  fs.copyFileSync(ruta, dbPath);
  db = new SQL.Database(fs.readFileSync(dbPath));
  B = crearBackend(db);
  guardar(true);
  return true;
}

// ------------------------------------------------------------ utilidades del sistema
function telefonoWa(tel) {
  let d = String(tel || '').replace(/\D/g, '');
  const pref = String(B.cfg('prefijo') || '504').replace(/\D/g, '');
  if (!d) return '';
  if (d.length <= 8) d = pref + d;
  return d;
}
async function abrirWhatsApp(tel, texto) {
  const n = telefonoWa(tel);
  if (!n) throw new Error('Este cliente no tiene número de teléfono. Agregalo en el trabajo o en Clientes.');
  const t = encodeURIComponent(texto || '');
  const tieneApp = (() => { try { return !!app.getApplicationNameForProtocol('whatsapp://'); } catch (e) { return false; } })();
  if (tieneApp) { await shell.openExternal(`whatsapp://send?phone=${n}&text=${t}`); return 'app'; }
  await shell.openExternal(`https://wa.me/${n}?text=${t}`); return 'web';
}
async function htmlAPdf(html, archivo) {
  const w = new BrowserWindow({ show: false, webPreferences: { offscreen: true, javascript: false, sandbox: true, contextIsolation: true, nodeIntegration: false } });
  try {
    await w.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(html));
    const pdf = await w.webContents.printToPDF({ pageSize: 'Letter', printBackground: true, margins: { top: 0.3, bottom: 0.3, left: 0.3, right: 0.3 } });
    fs.mkdirSync(path.dirname(archivo), { recursive: true });
    fs.writeFileSync(archivo, pdf);
    return archivo;
  } finally { w.destroy(); }
}
async function reciboPDF(id) {
  const t = B.api.trabajo(id);
  const dir = path.join(app.getPath('documents'), 'Taller Recibos');
  return htmlAPdf(B.api.reciboHTML(id), path.join(dir, limpioNombre(`${t.numero} - ${t.cliente || 'cliente'}`) + '.pdf'));
}
async function exportarExcel() {
  const r = await dialog.showSaveDialog(win, { title: 'Exportar a Excel', defaultPath: path.join(app.getPath('documents'), `Taller_${hoy()}.xlsx`), filters: [{ name: 'Excel', extensions: ['xlsx'] }] });
  if (r.canceled || !r.filePath) return null;
  const datos = B.api.exportarTodo();
  const wb = XLSX.utils.book_new();
  Object.entries(datos).forEach(([hoja, filas]) => {
    const ws = XLSX.utils.json_to_sheet(filas.length ? filas : [{ '(sin datos)': '' }]);
    const cols = Object.keys(filas[0] || { x: 1 }).map(k => ({ wch: Math.min(40, Math.max(10, k.length + 2, ...filas.slice(0, 200).map(f => String(f[k] == null ? '' : f[k]).length + 1))) }));
    ws['!cols'] = cols;
    XLSX.utils.book_append_sheet(wb, ws, hoja.slice(0, 31));
  });
  XLSX.writeFile(wb, r.filePath);
  return r.filePath;
}
function guardarFotos(trabajoId, fotos, etapa) {
  trabajoId = Math.trunc(Number(trabajoId));
  if (!(trabajoId > 0) || !B.api.trabajo(trabajoId)) throw new Error('Trabajo no encontrado');
  etapa = String(etapa || 'foto').toLowerCase().replace(/[^a-z]/g, '').slice(0, 20) || 'foto';
  if (!Array.isArray(fotos) || fotos.length > 30) throw new Error('Demasiadas fotos a la vez (máximo 30)');
  const dir = path.join(FOTOS(), 'T-' + String(trabajoId).padStart(4, '0'));
  fs.mkdirSync(dir, { recursive: true });
  return fotos.map((f, i) => {
    const nombre = `${etapa || 'foto'}_${sello()}_${Date.now() % 100000}_${i + 1}.jpg`;
    const buf = Buffer.from(String((f && f.base64) || ''), 'base64');
    if (!buf.length || buf.length > 15 * 1024 * 1024) throw new Error('Foto vacía o demasiado grande');
    if (!(buf[0] === 0xFF && buf[1] === 0xD8)) throw new Error('Solo se aceptan fotos JPG');
    fs.writeFileSync(path.join(dir, nombre), buf);
    const rel = path.join('T-' + String(trabajoId).padStart(4, '0'), nombre);
    B.api.agregarFoto(trabajoId, rel, etapa);
    return rel;
  });
}

const SISTEMA = {
  info: () => ({ version: app.getVersion(), base: dbPath, tamano: fs.existsSync(dbPath) ? fs.statSync(dbPath).size : 0, fotos: FOTOS(),
    respaldos: listarRespaldos(), ultimoGuardado, whatsappApp: (() => { try { return !!app.getApplicationNameForProtocol('whatsapp://'); } catch (e) { return false; } })() }),
  respaldarAhora: () => respaldar('manual'),
  listarRespaldos,
  abrirCarpetaRespaldos: () => { const d = carpetaRespaldos(); fs.mkdirSync(d, { recursive: true }); shell.openPath(d); return d; },
  elegirCarpetaRespaldos: async () => {
    const r = await dialog.showOpenDialog(win, { title: 'Elegí la carpeta para los respaldos (por ejemplo una USB o tu carpeta de Google Drive)', properties: ['openDirectory', 'createDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    B.setCfg('carpetaRespaldos', r.filePaths[0]); guardar(); respaldar('auto'); return r.filePaths[0];
  },
  restaurarArchivo: async (ruta) => {
    if (!ruta) {
      const r = await dialog.showOpenDialog(win, { title: 'Elegí el respaldo a restaurar', defaultPath: carpetaRespaldos(), filters: [{ name: 'Respaldo del Taller', extensions: ['db'] }], properties: ['openFile'] });
      if (r.canceled || !r.filePaths[0]) return null;
      ruta = r.filePaths[0];
    } else if (!(dentroDe(carpetaRespaldos(), ruta) && /\.db$/i.test(ruta))) {
      throw new Error('Ese archivo no está en la carpeta de respaldos');
    }
    return restaurar(ruta);
  },
  exportarExcel,
  whatsapp: (tel, texto) => abrirWhatsApp(tel, texto),
  reciboPDF: async (id) => { const f = await reciboPDF(id); shell.showItemInFolder(f); return f; },
  guardarFotos: (trabajoId, fotos, etapa) => { const r = guardarFotos(trabajoId, fotos, etapa); guardar(); return r; },
  borrarFoto: (id) => { const f = B.api.borrarFoto(id); guardar(); if (f && dentroDe(FOTOS(), path.join(FOTOS(), f.archivo))) { try { fs.unlinkSync(path.join(FOTOS(), f.archivo)); } catch (e) { /* ya no existe */ } } return true; },
  abrirFoto: (rel) => {
    const ruta = path.join(FOTOS(), String(rel || ''));
    if (!dentroDe(FOTOS(), ruta) || !/\.(jpe?g|png|webp)$/i.test(ruta)) throw new Error('Foto no válida');
    return shell.openPath(ruta);
  },
  abrirCarpetaFotos: (trabajoId) => { const d = path.join(FOTOS(), 'T-' + String(trabajoId).padStart(4, '0')); fs.mkdirSync(d, { recursive: true }); return shell.openPath(d); },
  abrirEnlace: (url) => abrirExterno(url),
  estadoActualizacion: () => Object.assign({ actual: app.getVersion(), empaquetado: app.isPackaged }, estadoAct),
  buscarActualizacion: async () => {
    if (!autoUpdater) return Object.assign({ actual: app.getVersion(), empaquetado: app.isPackaged }, estadoAct);
    await autoUpdater.checkForUpdates().catch(e => avisarAct({ estado: 'error', error: String((e && e.message) || e).split('\n')[0] }));
    return Object.assign({ actual: app.getVersion(), empaquetado: true }, estadoAct);
  },
  instalarActualizacion: () => {
    if (!autoUpdater || estadoAct.estado !== 'lista') throw new Error('Todavía no hay una actualización descargada');
    try { guardar(true); respaldar('antes-de-actualizar'); } catch (e) { /* seguimos igual */ }
    setImmediate(() => autoUpdater.quitAndInstall(true, true));
    return true;
  },
};

// ------------------------------------------------------------ actualizaciones (GitHub Releases)
let autoUpdater = null, estadoAct = { estado: 'inactivo', version: null, error: null };
function avisarAct(cambios) { Object.assign(estadoAct, cambios); if (win) win.webContents.send('actualizacion', estadoAct); }
function iniciarActualizaciones() {
  if (!app.isPackaged) return;
  try { autoUpdater = require('electron-updater').autoUpdater; } catch (e) { return; }
  autoUpdater.autoDownload = true;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.on('checking-for-update', () => avisarAct({ estado: 'buscando', error: null }));
  autoUpdater.on('update-not-available', () => avisarAct({ estado: 'al-dia' }));
  autoUpdater.on('update-available', i => avisarAct({ estado: 'descargando', version: i.version }));
  autoUpdater.on('update-downloaded', i => avisarAct({ estado: 'lista', version: i.version }));
  autoUpdater.on('error', e => avisarAct({ estado: 'error', error: String((e && e.message) || e).split('\n')[0] }));
  const buscar = () => autoUpdater.checkForUpdates().catch(() => { /* sin internet: se intenta luego */ });
  setTimeout(buscar, 15 * 1000);
  setInterval(buscar, 4 * 60 * 60 * 1000);
}

// ------------------------------------------------------------ IPC
const remitenteValido = e => { try { return !!win && e.sender === win.webContents && new URL(e.senderFrame.url).protocol === 'file:'; } catch (er) { return false; } };
ipcMain.handle('api', (e, fn, args) => {
  if (!remitenteValido(e)) throw new Error('Origen no permitido');
  if (!Object.prototype.hasOwnProperty.call(B.api, fn) || typeof B.api[fn] !== 'function') throw new Error('Función desconocida: ' + fn);
  const antes = B.cambios();
  const r = B.api[fn](...(args || []));
  if (B.cambios() !== antes) guardar();
  if (fn === 'borrarTrabajo' && r && r.fotos) r.fotos.forEach(f => { try { fs.unlinkSync(path.join(FOTOS(), f)); } catch (er) { /* nada */ } });
  return r;
});
ipcMain.handle('sys', async (e, fn, args) => {
  if (!remitenteValido(e)) throw new Error('Origen no permitido');
  if (!Object.prototype.hasOwnProperty.call(SISTEMA, fn)) throw new Error('Función desconocida: ' + fn);
  return SISTEMA[fn](...(args || []));
});

// ------------------------------------------------------------ ventana
function crearVentana() {
  const icono = nativeImage.createFromPath(path.join(__dirname, 'app', 'icono.png'));
  win = new BrowserWindow({
    width: 1440, height: 900, minWidth: 1100, minHeight: 680, show: false, backgroundColor: '#F4F5F7', title: 'Taller — Sistema de gestión', icon: icono,
    autoHideMenuBar: true,
    webPreferences: { preload: path.join(__dirname, 'preload.js'), contextIsolation: true, nodeIntegration: false, sandbox: true, webSecurity: true, spellcheck: true },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'app', 'index.html'));
  win.once('ready-to-show', () => { win.maximize(); win.show(); });
  win.webContents.setWindowOpenHandler(({ url }) => { abrirExterno(url); return { action: 'deny' }; });
  win.webContents.on('will-navigate', (ev, url) => { if (url !== win.webContents.getURL()) { ev.preventDefault(); abrirExterno(url); } });
  win.webContents.on('will-attach-webview', ev => ev.preventDefault());
  // la pantalla avisa si hay un trabajo con cambios sin guardar (F5, Ctrl+R o cerrar la ventana)
  win.webContents.on('will-prevent-unload', ev => {
    const r = dialog.showMessageBoxSync(win, { type: 'warning', buttons: ['Salir sin guardar', 'Seguir editando'], defaultId: 1, cancelId: 1,
      title: 'Cambios sin guardar', message: 'El trabajo abierto tiene cambios que no guardaste.', detail: 'Si salís ahora, esos cambios se pierden.' });
    if (r === 0) ev.preventDefault();
  });
  win.webContents.on('before-input-event', (ev, input) => {
    if (input.type === 'keyDown' && (input.key === 'F5' || (input.control && input.key.toLowerCase() === 'r'))) { win.webContents.reload(); ev.preventDefault(); }
    if (input.type === 'keyDown' && input.key === 'F12' && input.control && input.shift) win.webContents.toggleDevTools();
  });
}

app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
app.whenReady().then(async () => {
  if (OTRA_INSTANCIA) return; // ya hay un Taller abierto: no tocar la base desde dos lugares
  try { await abrirBase(); }
  catch (e) { dialog.showErrorBox('No se pudo abrir la base de datos', String(e && e.stack || e)); app.quit(); return; }
  try { if (B.api.autoCierre()) guardar(); } catch (e) { /* nada */ }
  try { respaldar('auto'); } catch (e) { /* carpeta no disponible */ }
  crearVentana();
  iniciarActualizaciones();
  // cierre automático a medianoche y respaldo periódico
  setInterval(() => {
    try { if (B.api.autoCierre()) { guardar(); if (win) win.webContents.send('refrescar'); } } catch (e) { /* nada */ }
  }, 60 * 1000);
  setInterval(() => { try { if (sucioDesdeRespaldo) respaldar('auto'); } catch (e) { /* nada */ } }, 30 * 60 * 1000);
});
app.on('before-quit', () => { try { if (db && !OTRA_INSTANCIA) { guardar(true); respaldar('auto'); } } catch (e) { /* nada */ } });
app.on('window-all-closed', () => app.quit());
