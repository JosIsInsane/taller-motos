'use strict';
/**
 * Lógica y base de datos del Taller (SQLite vía sql.js).
 * No depende de Electron: recibe un objeto `db` de sql.js y expone las funciones que usa la interfaz.
 */

const ESQUEMA = `
CREATE TABLE IF NOT EXISTS config (clave TEXT PRIMARY KEY, valor TEXT);
CREATE TABLE IF NOT EXISTS empleados (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, puesto TEXT, salario REAL DEFAULT 0, comision REAL DEFAULT 0, activo INTEGER DEFAULT 1);
CREATE TABLE IF NOT EXISTS clientes (id INTEGER PRIMARY KEY AUTOINCREMENT, nombre TEXT NOT NULL, telefono TEXT, direccion TEXT, notas TEXT, creado TEXT);
CREATE TABLE IF NOT EXISTS motos (id INTEGER PRIMARY KEY AUTOINCREMENT, placa TEXT, cliente_id INTEGER, marca TEXT, modelo TEXT, anio TEXT, cc TEXT, color TEXT, vin TEXT, notas TEXT);
CREATE TABLE IF NOT EXISTS trabajos (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, cliente_id INTEGER, moto_id INTEGER, descripcion TEXT, falla TEXT,
  estado_recibe TEXT, km TEXT, mecanico_id INTEGER, estado TEXT DEFAULT 'En taller', mano_obra REAL DEFAULT 0, descuento REAL DEFAULT 0,
  garantia_dias INTEGER DEFAULT 0, garantia_cubre TEXT, entrega TEXT, notas TEXT, garantia_de INTEGER, avisado TEXT, creado TEXT);
CREATE TABLE IF NOT EXISTS trabajo_repuestos (id INTEGER PRIMARY KEY AUTOINCREMENT, trabajo_id INTEGER NOT NULL, inventario_id INTEGER, descripcion TEXT,
  cantidad REAL DEFAULT 1, precio REAL DEFAULT 0, costo REAL DEFAULT 0);
CREATE TABLE IF NOT EXISTS pagos (id INTEGER PRIMARY KEY AUTOINCREMENT, trabajo_id INTEGER NOT NULL, fecha TEXT, monto REAL, metodo TEXT, nota TEXT);
CREATE TABLE IF NOT EXISTS fotos (id INTEGER PRIMARY KEY AUTOINCREMENT, trabajo_id INTEGER, archivo TEXT, etapa TEXT, creado TEXT);
CREATE TABLE IF NOT EXISTS inventario (id INTEGER PRIMARY KEY AUTOINCREMENT, codigo TEXT, descripcion TEXT NOT NULL, categoria TEXT, compatible TEXT,
  proveedor TEXT, costo REAL DEFAULT 0, precio REAL DEFAULT 0, stock_inicial REAL DEFAULT 0, minimo REAL DEFAULT 0, ubicacion TEXT);
CREATE TABLE IF NOT EXISTS compras (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, proveedor TEXT, inventario_id INTEGER, descripcion TEXT,
  cantidad REAL DEFAULT 1, costo REAL DEFAULT 0, metodo TEXT, estado TEXT DEFAULT 'Pagado', fecha_pago TEXT, factura TEXT);
CREATE TABLE IF NOT EXISTS gastos (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, categoria TEXT, descripcion TEXT, monto REAL, metodo TEXT);
CREATE TABLE IF NOT EXISTS vales (id INTEGER PRIMARY KEY AUTOINCREMENT, fecha TEXT, empleado_id INTEGER, monto REAL, metodo TEXT, nota TEXT);
CREATE TABLE IF NOT EXISTS planilla (id INTEGER PRIMARY KEY AUTOINCREMENT, semana TEXT, empleado_id INTEGER, bonos REAL DEFAULT 0, deducciones REAL DEFAULT 0,
  metodo TEXT, estado TEXT DEFAULT 'Pendiente', fecha_pago TEXT, salario_pagado REAL, comision_pagada REAL, vales_pagados REAL, neto_pagado REAL,
  UNIQUE(semana, empleado_id));
CREATE TABLE IF NOT EXISTS cierres (fecha TEXT PRIMARY KEY, tipo TEXT, datos TEXT, efectivo_esperado REAL, efectivo_contado REAL, diferencia REAL, nota TEXT, cerrado_en TEXT);
CREATE TABLE IF NOT EXISTS cierres_semana (semana TEXT PRIMARY KEY, datos TEXT, nota TEXT, cerrado_en TEXT);
CREATE INDEX IF NOT EXISTS ix_pagos_fecha ON pagos(fecha);
CREATE INDEX IF NOT EXISTS ix_pagos_trab ON pagos(trabajo_id);
CREATE INDEX IF NOT EXISTS ix_rep_trab ON trabajo_repuestos(trabajo_id);
CREATE INDEX IF NOT EXISTS ix_gastos_fecha ON gastos(fecha);
CREATE INDEX IF NOT EXISTS ix_vales_fecha ON vales(fecha);
`;

const ESTADOS = ['En taller', 'Esperando repuesto', 'Listo', 'Entregado', 'Cancelado'];
const METODOS = ['Efectivo', 'Transferencia'];

const CONFIG_INICIAL = {
  taller: 'Mi Taller de Motos', telefono: '', direccion: 'San Pedro Sula, Cortés', rtn: '',
  fondo: 1000, prefijo: '504',
  catGastos: ['Luz', 'Agua', 'Alquiler', 'Internet/Teléfono', 'Herramientas', 'Consumibles de taller', 'Transporte/Combustible',
    'Publicidad', 'Mantenimiento local', 'Impuestos/Permisos', 'Comida/Refrigerio', 'Otros'],
  catRepuestos: ['Motor', 'Transmisión/Cadena', 'Frenos', 'Eléctrico', 'Suspensión', 'Llantas', 'Aceites/Lubricantes', 'Filtros', 'Carrocería', 'Accesorios', 'Otros'],
  garantias: [{ dias: 0, nombre: 'Sin garantía' }, { dias: 8, nombre: '8 días' }, { dias: 15, nombre: '15 días' }, { dias: 30, nombre: '30 días' },
    { dias: 90, nombre: '3 meses' }, { dias: 180, nombre: '6 meses' }],
  coberturas: ['Mano de obra', 'Repuestos', 'Mano de obra y repuestos'],
  garantiaDefecto: 30, coberturaDefecto: 'Mano de obra y repuestos',
  terminos: 'La garantía cubre únicamente el trabajo y/o repuestos indicados. No cubre golpes, mal uso, accidentes, falta de mantenimiento ni trabajos realizados por terceros. Presentar este recibo para hacerla válida.',
  pieMensaje: '¡Gracias por su preferencia! 🏍️',
  carpetaRespaldos: '',
};

const pad = (n, w = 4) => String(n).padStart(w, '0');
const num = v => { if (typeof v === 'number') return isFinite(v) ? v : 0; const n = parseFloat(String(v == null ? '' : v).replace(/[,\s]/g, '').replace(/^L/i, '')); return isNaN(n) ? 0 : n; };
const r2 = n => Math.round(num(n) * 100) / 100;
const txt = v => (v === undefined || v === null) ? '' : String(v).trim();
const L = n => 'L ' + r2(n).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

function isoLocal(d) { return d.getFullYear() + '-' + pad(d.getMonth() + 1, 2) + '-' + pad(d.getDate(), 2); }
function parseIso(s) { const [y, m, d] = String(s).split('-').map(Number); return new Date(y, m - 1, d); }
function addDias(s, n) { const d = parseIso(s); d.setDate(d.getDate() + n); return isoLocal(d); }
function lunesDe(s) { const d = parseIso(s); d.setDate(d.getDate() - (d.getDay() + 6) % 7); return isoLocal(d); }
function fmt(s) { if (!s) return ''; const [y, m, d] = s.split('-'); return `${d}/${m}/${y}`; }
const esFecha = s => /^\d{4}-\d{2}-\d{2}$/.test(String(s || ''));

function crearBackend(db, opciones = {}) {
  const ahora = opciones.ahora || (() => new Date());
  const hoy = () => isoLocal(ahora());
  let cambios = 0;

  // ------------------------------------------------------------ SQL helpers
  function all(sql, p = []) {
    const st = db.prepare(sql); const out = [];
    try { st.bind(p); while (st.step()) out.push(st.getAsObject()); } finally { st.free(); }
    return out;
  }
  const get = (sql, p = []) => all(sql, p)[0] || null;
  const val = (sql, p = []) => { const r = get(sql, p); return r ? Object.values(r)[0] : null; };
  function run(sql, p = []) { db.run(sql, p); cambios++; return val('SELECT last_insert_rowid()'); }
  let nivelTx = 0;
  function tx(fn) {
    if (nivelTx > 0) { nivelTx++; try { return fn(); } finally { nivelTx--; } }
    db.run('BEGIN'); nivelTx = 1;
    try { const r = fn(); db.run('COMMIT'); return r; } catch (e) { db.run('ROLLBACK'); throw e; } finally { nivelTx = 0; }
  }

  // ------------------------------------------------------------ init
  db.run(ESQUEMA);
  // migraciones: columnas nuevas en bases existentes
  (function migrar() {
    const cols = t => db.exec(`PRAGMA table_info(${t})`)[0].values.map(v => v[1]);
    const ct = cols('trabajos');
    if (!ct.includes('mecanico2_id')) db.run('ALTER TABLE trabajos ADD COLUMN mecanico2_id INTEGER');
    if (!ct.includes('reparto')) db.run('ALTER TABLE trabajos ADD COLUMN reparto REAL DEFAULT 100');
    if (!ct.includes('semana_comision')) db.run('ALTER TABLE trabajos ADD COLUMN semana_comision TEXT');
    if (!cols('empleados').includes('alta')) db.run('ALTER TABLE empleados ADD COLUMN alta TEXT');
  })();
  if (!val("SELECT valor FROM config WHERE clave='inicio'")) {
    Object.entries(CONFIG_INICIAL).forEach(([k, v]) => run('INSERT OR IGNORE INTO config(clave, valor) VALUES (?, ?)', [k, JSON.stringify(v)]));
    run('INSERT OR REPLACE INTO config(clave, valor) VALUES (?, ?)', ['inicio', JSON.stringify(hoy())]);
    run('INSERT OR REPLACE INTO config(clave, valor) VALUES (?, ?)', ['esquema', JSON.stringify(1)]);
  }

  function cfg(k) { const v = val('SELECT valor FROM config WHERE clave=?', [k]); if (v === null) return CONFIG_INICIAL[k]; try { return JSON.parse(v); } catch (e) { return v; } }
  function setCfg(k, v) { run('INSERT OR REPLACE INTO config(clave, valor) VALUES (?, ?)', [k, JSON.stringify(v)]); }
  function configCompleta() { const o = {}; Object.keys(CONFIG_INICIAL).forEach(k => o[k] = cfg(k)); o.inicio = cfg('inicio'); return o; }

  // ------------------------------------------------------------ bloqueo por cierre
  const diaCerrado = f => !!val('SELECT 1 FROM cierres WHERE fecha=?', [f]);
  const semanaCerrada = l => !!val('SELECT 1 FROM cierres_semana WHERE semana=?', [l]);
  function abierto(f, que) {
    if (!esFecha(f)) throw new Error('Fecha inválida');
    if (f > hoy()) throw new Error(`No se puede ${que} con fecha futura (${fmt(f)}).`);
    if (diaCerrado(f)) throw new Error(`El día ${fmt(f)} ya tiene la caja cerrada. Para ${que}, reabrí ese día en "Caja del día".`);
  }

  // ------------------------------------------------------------ cálculos de trabajos
  const SQL_TRABAJOS = `
    SELECT t.*, c.nombre AS cliente, c.telefono AS telefono, m.placa, m.marca, m.modelo, m.anio, m.color, e.nombre AS mecanico, e2.nombre AS mecanico2,
      COALESCE((SELECT SUM(cantidad*precio) FROM trabajo_repuestos WHERE trabajo_id=t.id),0) AS repuestos,
      COALESCE((SELECT SUM(cantidad*costo) FROM trabajo_repuestos WHERE trabajo_id=t.id),0) AS costo_rep,
      COALESCE((SELECT SUM(monto) FROM pagos WHERE trabajo_id=t.id),0) AS pagado,
      (SELECT COUNT(*) FROM trabajo_repuestos WHERE trabajo_id=t.id) AS n_rep
    FROM trabajos t LEFT JOIN clientes c ON c.id=t.cliente_id LEFT JOIN motos m ON m.id=t.moto_id LEFT JOIN empleados e ON e.id=t.mecanico_id LEFT JOIN empleados e2 ON e2.id=t.mecanico2_id`;
  const fmtPct = n => (Math.round(n * 10) / 10) + '%';
  function completar(t) {
    if (!t) return t;
    t.numero = 'T-' + pad(t.id);
    t.total = t.estado === 'Cancelado' ? 0 : r2(num(t.mano_obra) + num(t.repuestos) - num(t.descuento));
    t.saldo = r2(t.total - num(t.pagado));
    t.estado_pago = t.estado === 'Cancelado' ? 'Cancelado' : t.total <= 0 ? (num(t.pagado) > 0 ? 'Pagado' : 'Sin cobro') : t.saldo <= 0.004 ? 'Pagado' : 'Pendiente';
    t.utilidad = r2(t.total - num(t.costo_rep));
    const entregado = t.estado === 'Entregado' && t.entrega;
    t.vence = entregado && num(t.garantia_dias) > 0 ? addDias(t.entrega, num(t.garantia_dias)) : '';
    const fin = entregado ? t.entrega : hoy();
    t.dias = Math.max(0, Math.round((parseIso(fin) - parseIso(t.fecha || hoy())) / 86400000));
    t.moto = [t.marca, t.modelo, t.anio].filter(Boolean).join(' ');
    t.reparto = t.mecanico2_id ? num(t.reparto) || 50 : 100;
    t.mecanicos = t.mecanico2_id ? `${t.mecanico || '?'} ${fmtPct(t.reparto)} / ${t.mecanico2 || '?'} ${fmtPct(100 - t.reparto)}` : (t.mecanico || '');
    return t;
  }
  function listarTrabajos() { return all(SQL_TRABAJOS + ' ORDER BY t.id DESC').map(completar); }
  function trabajo(id) {
    const t = completar(get(SQL_TRABAJOS + ' WHERE t.id=?', [id]));
    if (!t) throw new Error('No se encontró el trabajo');
    t.repuestosLista = all(`SELECT r.*, i.codigo, i.descripcion AS inv_desc FROM trabajo_repuestos r LEFT JOIN inventario i ON i.id=r.inventario_id WHERE r.trabajo_id=? ORDER BY r.id`, [id]);
    t.pagosLista = all('SELECT * FROM pagos WHERE trabajo_id=? ORDER BY fecha, id', [id]);
    t.fotosLista = all('SELECT * FROM fotos WHERE trabajo_id=? ORDER BY id', [id]);
    t.reclamos = all('SELECT id, fecha, descripcion, estado FROM trabajos WHERE garantia_de=? ORDER BY id', [id]).map(x => ({ ...x, numero: 'T-' + pad(x.id) }));
    if (t.garantia_de) t.garantia_de_numero = 'T-' + pad(t.garantia_de);
    return t;
  }

  // ------------------------------------------------------------ clientes y motos
  function upsertCliente(d) {
    const nombre = txt(d.cliente_nombre), tel = txt(d.cliente_tel);
    let id = num(d.cliente_id) || null;
    if (id) {
      const c = get('SELECT * FROM clientes WHERE id=?', [id]);
      if (!c) id = null;
      else if ((nombre && nombre !== c.nombre) || tel !== txt(c.telefono)) run('UPDATE clientes SET nombre=?, telefono=? WHERE id=?', [nombre || c.nombre, tel, id]);
    }
    if (!id && nombre) {
      const mismo = tel ? get('SELECT id FROM clientes WHERE telefono=? AND lower(nombre)=lower(?)', [tel, nombre]) : null;
      id = mismo ? mismo.id : run('INSERT INTO clientes(nombre, telefono, creado) VALUES (?, ?, ?)', [nombre, tel, hoy()]);
    }
    return id;
  }
  const normPlaca = p => txt(p).toUpperCase().replace(/[\s-]/g, '');
  function upsertMoto(d, clienteId) {
    const placa = normPlaca(d.placa);
    const datos = { marca: txt(d.marca), modelo: txt(d.modelo), anio: txt(d.anio), color: txt(d.color) };
    if (!placa && !datos.marca && !datos.modelo) return num(d.moto_id) || null;
    let m = placa ? get('SELECT * FROM motos WHERE placa=?', [placa]) : (num(d.moto_id) ? get('SELECT * FROM motos WHERE id=?', [num(d.moto_id)]) : null);
    if (m) {
      run('UPDATE motos SET cliente_id=COALESCE(?, cliente_id), marca=?, modelo=?, anio=?, color=?, placa=? WHERE id=?',
        [clienteId, datos.marca || m.marca, datos.modelo || m.modelo, datos.anio || m.anio, datos.color || m.color, placa || m.placa, m.id]);
      return m.id;
    }
    return run('INSERT INTO motos(placa, cliente_id, marca, modelo, anio, color) VALUES (?,?,?,?,?,?)', [placa, clienteId, datos.marca, datos.modelo, datos.anio, datos.color]);
  }
  function buscarClientes(q) {
    q = txt(q).toLowerCase(); if (q.length < 2) return [];
    return all(`SELECT c.*, (SELECT COUNT(*) FROM trabajos WHERE cliente_id=c.id) AS trabajos FROM clientes c
      WHERE lower(c.nombre) LIKE ? OR c.telefono LIKE ? ORDER BY c.nombre LIMIT 8`, ['%' + q + '%', '%' + q + '%']);
  }
  function buscarPlaca(placa) {
    placa = normPlaca(placa); if (!placa) return null;
    const m = get('SELECT m.*, c.nombre AS cliente, c.telefono FROM motos m LEFT JOIN clientes c ON c.id=m.cliente_id WHERE m.placa=?', [placa]);
    if (!m) return { placa, nueva: true };
    m.historial = all(SQL_TRABAJOS + ' WHERE t.moto_id=? ORDER BY t.id DESC LIMIT 10', [m.id]).map(completar);
    return m;
  }
  function listarClientes() {
    return all(`SELECT c.*, (SELECT COUNT(*) FROM trabajos WHERE cliente_id=c.id AND estado<>'Cancelado') AS trabajos FROM clientes c ORDER BY c.nombre`).map(c => {
      const ts = all(SQL_TRABAJOS + ' WHERE t.cliente_id=?', [c.id]).map(completar);
      c.facturado = r2(ts.reduce((s, t) => s + t.total, 0)); c.saldo = r2(ts.reduce((s, t) => s + Math.max(0, t.saldo), 0));
      c.ultimo = ts.reduce((u, t) => (t.fecha > u ? t.fecha : u), '');
      return c;
    });
  }
  function cliente(id) {
    const c = get('SELECT * FROM clientes WHERE id=?', [id]); if (!c) throw new Error('Cliente no encontrado');
    c.motos = all('SELECT * FROM motos WHERE cliente_id=? ORDER BY placa', [id]);
    c.trabajosLista = all(SQL_TRABAJOS + ' WHERE t.cliente_id=? ORDER BY t.id DESC', [id]).map(completar);
    return c;
  }
  function guardarCliente(d) {
    if (!txt(d.nombre)) throw new Error('Escribí el nombre del cliente');
    if (num(d.id)) { run('UPDATE clientes SET nombre=?, telefono=?, direccion=?, notas=? WHERE id=?', [txt(d.nombre), txt(d.telefono), txt(d.direccion), txt(d.notas), num(d.id)]); return num(d.id); }
    return run('INSERT INTO clientes(nombre, telefono, direccion, notas, creado) VALUES (?,?,?,?,?)', [txt(d.nombre), txt(d.telefono), txt(d.direccion), txt(d.notas), hoy()]);
  }
  function borrarCliente(id) {
    if (val('SELECT COUNT(*) FROM trabajos WHERE cliente_id=?', [id])) throw new Error('Este cliente tiene trabajos registrados; no se puede borrar.');
    run('UPDATE motos SET cliente_id=NULL WHERE cliente_id=?', [id]); run('DELETE FROM clientes WHERE id=?', [id]); return true;
  }
  function listarMotos() {
    return all(`SELECT m.*, c.nombre AS cliente, c.telefono, (SELECT COUNT(*) FROM trabajos WHERE moto_id=m.id) AS visitas,
      (SELECT MAX(fecha) FROM trabajos WHERE moto_id=m.id) AS ultima, (SELECT km FROM trabajos WHERE moto_id=m.id ORDER BY id DESC LIMIT 1) AS ultimo_km
      FROM motos m LEFT JOIN clientes c ON c.id=m.cliente_id ORDER BY m.placa`);
  }
  function guardarMoto(d) {
    const placa = normPlaca(d.placa);
    if (placa && val('SELECT id FROM motos WHERE placa=? AND id<>?', [placa, num(d.id)])) throw new Error('Ya existe una moto con esa placa');
    const p = [placa, num(d.cliente_id) || null, txt(d.marca), txt(d.modelo), txt(d.anio), txt(d.cc), txt(d.color), txt(d.vin), txt(d.notas)];
    if (num(d.id)) { run('UPDATE motos SET placa=?, cliente_id=?, marca=?, modelo=?, anio=?, cc=?, color=?, vin=?, notas=? WHERE id=?', [...p, num(d.id)]); return num(d.id); }
    return run('INSERT INTO motos(placa, cliente_id, marca, modelo, anio, cc, color, vin, notas) VALUES (?,?,?,?,?,?,?,?,?)', p);
  }
  function borrarMoto(id) {
    if (val('SELECT COUNT(*) FROM trabajos WHERE moto_id=?', [id])) throw new Error('Esta moto tiene trabajos registrados; no se puede borrar.');
    run('DELETE FROM motos WHERE id=?', [id]); return true;
  }

  // ------------------------------------------------------------ trabajos: guardar
  /** d = { id?, fecha, cliente_id?, cliente_nombre, cliente_tel, placa, marca, modelo, anio, color, km, descripcion, falla, estado_recibe,
   *        mecanico_id, mano_obra, descuento, garantia_dias, garantia_cubre, notas, estado?, repuestos:[{inventario_id?, descripcion, cantidad, precio, costo}],
   *        pagoInicial?: {monto, metodo, fecha} } */
  function guardarTrabajo(d) {
    return tx(() => {
      const reps = (d.repuestos || []).filter(r => txt(r.descripcion) || num(r.inventario_id));
      if (!txt(d.descripcion) && !reps.length && !num(d.mano_obra)) throw new Error('Escribí qué trabajo se le hace a la moto');
      reps.forEach(r => { if (num(r.cantidad) <= 0) throw new Error(`La cantidad de "${txt(r.descripcion)}" tiene que ser mayor que 0`); });
      const clienteId = upsertCliente(d);
      const motoId = upsertMoto(d, clienteId);
      const mec1 = num(d.mecanico_id) || null;
      let mec2 = num(d.mecanico2_id) || null;
      if (!mec1 || mec2 === mec1) mec2 = null;
      let reparto = 100;
      if (mec2) {
        reparto = d.reparto === '' || d.reparto == null ? 50 : num(d.reparto);
        if (!(reparto > 0 && reparto < 100)) throw new Error('El reparto de la comisión tiene que estar entre 1% y 99%');
        reparto = Math.round(reparto * 10) / 10;
      }
      const campos = [esFecha(d.fecha) ? d.fecha : hoy(), clienteId, motoId, txt(d.descripcion), txt(d.falla), txt(d.estado_recibe), txt(d.km),
        mec1, mec2, reparto, r2(d.mano_obra), r2(d.descuento), Math.max(0, Math.round(num(d.garantia_dias))), txt(d.garantia_cubre), txt(d.notas)];
      let id = num(d.id);
      if (id) {
        if (!get('SELECT id FROM trabajos WHERE id=?', [id])) throw new Error('No se encontró el trabajo');
        run(`UPDATE trabajos SET fecha=?, cliente_id=?, moto_id=?, descripcion=?, falla=?, estado_recibe=?, km=?, mecanico_id=?, mecanico2_id=?, reparto=?, mano_obra=?, descuento=?,
          garantia_dias=?, garantia_cubre=?, notas=? WHERE id=?`, [...campos, id]);
        run('DELETE FROM trabajo_repuestos WHERE trabajo_id=?', [id]);
      } else {
        id = run(`INSERT INTO trabajos(fecha, cliente_id, moto_id, descripcion, falla, estado_recibe, km, mecanico_id, mecanico2_id, reparto, mano_obra, descuento,
          garantia_dias, garantia_cubre, notas, estado, garantia_de, creado) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
          [...campos, ESTADOS.includes(d.estado) ? d.estado : 'En taller', num(d.garantia_de) || null, new Date().toISOString()]);
      }
      reps.forEach(r => {
        const inv = num(r.inventario_id) ? get('SELECT * FROM inventario WHERE id=?', [num(r.inventario_id)]) : null;
        run('INSERT INTO trabajo_repuestos(trabajo_id, inventario_id, descripcion, cantidad, precio, costo) VALUES (?,?,?,?,?,?)',
          [id, inv ? inv.id : null, txt(r.descripcion) || (inv ? inv.descripcion : ''), num(r.cantidad) || 1,
            r.precio === '' || r.precio === undefined || r.precio === null ? (inv ? inv.precio : 0) : r2(r.precio),
            r.costo === '' || r.costo === undefined || r.costo === null ? (inv ? inv.costo : 0) : r2(r.costo)]);
      });
      if (d.pagoInicial && num(d.pagoInicial.monto) > 0) agregarPago(id, d.pagoInicial, true);
      return id;
    });
  }
  function cambiarEstado(id, estado) {
    if (!ESTADOS.includes(estado)) throw new Error('Estado inválido');
    const t = get('SELECT * FROM trabajos WHERE id=?', [id]); if (!t) throw new Error('No se encontró el trabajo');
    if (estado === 'Entregado') {
      const entrega = t.estado === 'Entregado' && t.entrega ? t.entrega : hoy();
      // la comisión cae en la semana de la entrega; si esa planilla ya se pagó, pasa a la siguiente semana sin pagar
      // (si el trabajo ya se había entregado antes, conserva su semana original para no pagarla dos veces)
      let sem = t.semana_comision || lunesDe(entrega);
      if (!t.semana_comision) {
        const mecs = [t.mecanico_id, t.mecanico2_id].filter(Boolean);
        for (let i = 0; i < 60 && mecs.some(m => val("SELECT 1 FROM planilla WHERE semana=? AND empleado_id=? AND estado='Pagado'", [sem, m])); i++) sem = addDias(sem, 7);
      }
      run('UPDATE trabajos SET estado=?, entrega=?, semana_comision=? WHERE id=?', [estado, entrega, sem, id]);
    } else {
      run('UPDATE trabajos SET estado=?, entrega=? WHERE id=?', [estado, estado === 'Cancelado' ? t.entrega : null, id]);
    }
    return trabajo(id);
  }
  function marcarAvisado(id) { run('UPDATE trabajos SET avisado=? WHERE id=?', [new Date().toISOString(), id]); return true; }
  function borrarTrabajo(id) {
    return tx(() => {
      all('SELECT fecha FROM pagos WHERE trabajo_id=?', [id]).forEach(p => abierto(p.fecha, 'borrar este trabajo con sus pagos'));
      if (val('SELECT COUNT(*) FROM trabajos WHERE garantia_de=?', [id])) throw new Error('Este trabajo tiene reclamos de garantía ligados; borrá esos primero.');
      const fotos = all('SELECT archivo FROM fotos WHERE trabajo_id=?', [id]).map(f => f.archivo);
      ['trabajo_repuestos', 'pagos', 'fotos'].forEach(t => run(`DELETE FROM ${t} WHERE trabajo_id=?`, [id]));
      run('DELETE FROM trabajos WHERE id=?', [id]);
      return { fotos };
    });
  }
  function reclamoGarantia(id, nota) {
    const t = trabajo(id);
    if (!t.vence) throw new Error('Este trabajo no tiene garantía activa (no tiene garantía o no se ha entregado).');
    const nuevo = guardarTrabajo({ cliente_id: t.cliente_id, cliente_nombre: t.cliente, cliente_tel: t.telefono, placa: t.placa, marca: t.marca, modelo: t.modelo,
      descripcion: 'Reclamo de garantía de ' + t.numero + (txt(nota) ? ': ' + txt(nota) : ''), mecanico_id: t.mecanico_id, mecanico2_id: t.mecanico2_id, reparto: t.reparto, mano_obra: 0,
      garantia_dias: 0, garantia_de: id, notas: t.vence < hoy() ? 'Atención: la garantía venció el ' + fmt(t.vence) : '' });
    return nuevo;
  }

  // ------------------------------------------------------------ pagos
  function agregarPago(trabajoId, p, interno) {
    const f = esFecha(p.fecha) ? p.fecha : hoy();
    if (num(p.monto) <= 0) throw new Error('El monto tiene que ser mayor que 0');
    if (!METODOS.includes(p.metodo)) throw new Error('Elegí el método de pago');
    abierto(f, 'registrar este pago');
    if (!get('SELECT id FROM trabajos WHERE id=?', [trabajoId])) throw new Error('No se encontró el trabajo');
    const id = run('INSERT INTO pagos(trabajo_id, fecha, monto, metodo, nota) VALUES (?,?,?,?,?)', [trabajoId, f, r2(p.monto), p.metodo, txt(p.nota)]);
    return interno ? id : trabajo(trabajoId);
  }
  function editarPago(id, p) {
    const v = get('SELECT * FROM pagos WHERE id=?', [id]); if (!v) throw new Error('Pago no encontrado');
    const f = esFecha(p.fecha) ? p.fecha : v.fecha;
    abierto(v.fecha, 'editar este pago'); abierto(f, 'mover el pago a esa fecha');
    if (num(p.monto) <= 0) throw new Error('El monto tiene que ser mayor que 0');
    run('UPDATE pagos SET fecha=?, monto=?, metodo=?, nota=? WHERE id=?', [f, r2(p.monto), METODOS.includes(p.metodo) ? p.metodo : v.metodo, txt(p.nota), id]);
    return trabajo(v.trabajo_id);
  }
  function borrarPago(id) {
    const v = get('SELECT * FROM pagos WHERE id=?', [id]); if (!v) throw new Error('Pago no encontrado');
    abierto(v.fecha, 'borrar este pago'); run('DELETE FROM pagos WHERE id=?', [id]); return trabajo(v.trabajo_id);
  }

  // ------------------------------------------------------------ fotos (los archivos los maneja main.js)
  function agregarFoto(trabajoId, archivo, etapa) { return run('INSERT INTO fotos(trabajo_id, archivo, etapa, creado) VALUES (?,?,?,?)', [trabajoId, archivo, txt(etapa), new Date().toISOString()]); }
  function borrarFoto(id) { const f = get('SELECT * FROM fotos WHERE id=?', [id]); run('DELETE FROM fotos WHERE id=?', [id]); return f; }

  // ------------------------------------------------------------ inventario
  function listarInventario() {
    return all(`SELECT i.*,
      COALESCE((SELECT SUM(cantidad) FROM compras WHERE inventario_id=i.id),0) AS entradas,
      COALESCE((SELECT SUM(r.cantidad) FROM trabajo_repuestos r JOIN trabajos t ON t.id=r.trabajo_id WHERE r.inventario_id=i.id AND t.estado<>'Cancelado'),0) AS salidas
      FROM inventario i ORDER BY i.descripcion`).map(i => {
      i.stock = r2(num(i.stock_inicial) + num(i.entradas) - num(i.salidas));
      i.alerta = i.stock <= 0 ? 'AGOTADO' : i.stock <= num(i.minimo) ? 'REPONER' : 'OK';
      i.valor = r2(Math.max(i.stock, 0) * num(i.costo));
      i.margen = num(i.precio) ? (num(i.precio) - num(i.costo)) / num(i.precio) : null;
      return i;
    });
  }
  function guardarInventario(d) {
    if (!txt(d.descripcion)) throw new Error('Escribí la descripción del repuesto');
    const codigo = txt(d.codigo).toUpperCase();
    if (codigo && val('SELECT id FROM inventario WHERE upper(codigo)=? AND id<>?', [codigo, num(d.id)])) throw new Error('Ya existe un repuesto con ese código');
    const p = [codigo, txt(d.descripcion), txt(d.categoria), txt(d.compatible), txt(d.proveedor), r2(d.costo), r2(d.precio), num(d.stock_inicial), num(d.minimo), txt(d.ubicacion)];
    if (num(d.id)) { run('UPDATE inventario SET codigo=?, descripcion=?, categoria=?, compatible=?, proveedor=?, costo=?, precio=?, stock_inicial=?, minimo=?, ubicacion=? WHERE id=?', [...p, num(d.id)]); return num(d.id); }
    return run('INSERT INTO inventario(codigo, descripcion, categoria, compatible, proveedor, costo, precio, stock_inicial, minimo, ubicacion) VALUES (?,?,?,?,?,?,?,?,?,?)', p);
  }
  function borrarInventario(id) {
    if (val('SELECT COUNT(*) FROM compras WHERE inventario_id=?', [id]) || val('SELECT COUNT(*) FROM trabajo_repuestos WHERE inventario_id=?', [id]))
      throw new Error('Este repuesto ya tiene compras o se usó en trabajos. Editalo en vez de borrarlo.');
    run('DELETE FROM inventario WHERE id=?', [id]); return true;
  }
  function movimientosInventario(id) {
    const e = all("SELECT fecha, 'Compra' AS tipo, cantidad, costo AS precio, proveedor AS detalle FROM compras WHERE inventario_id=?", [id]);
    const s = all(`SELECT t.fecha, 'Trabajo T-' || substr('0000' || t.id, -4) AS tipo, -r.cantidad AS cantidad, r.precio, c.nombre AS detalle
      FROM trabajo_repuestos r JOIN trabajos t ON t.id=r.trabajo_id LEFT JOIN clientes c ON c.id=t.cliente_id WHERE r.inventario_id=? AND t.estado<>'Cancelado'`, [id]);
    return e.concat(s).sort((a, b) => (b.fecha || '').localeCompare(a.fecha || ''));
  }

  // ------------------------------------------------------------ movimientos de caja
  const fechaPagoCompra = c => c.estado === 'Pagado' ? (c.fecha_pago || c.fecha) : null;
  function listarMov(tipo, desde, hasta) {
    const D = desde || '0000-00-00', H = hasta || '9999-99-99';
    if (tipo === 'gastos') return all('SELECT * FROM gastos WHERE fecha BETWEEN ? AND ? ORDER BY fecha DESC, id DESC', [D, H]);
    if (tipo === 'vales') return all('SELECT v.*, e.nombre AS empleado FROM vales v LEFT JOIN empleados e ON e.id=v.empleado_id WHERE v.fecha BETWEEN ? AND ? ORDER BY v.fecha DESC, v.id DESC', [D, H]);
    if (tipo === 'compras') return all(`SELECT c.*, i.codigo, c.cantidad*c.costo AS total FROM compras c LEFT JOIN inventario i ON i.id=c.inventario_id
      WHERE c.fecha BETWEEN ? AND ? OR (c.estado='Pagado' AND COALESCE(NULLIF(c.fecha_pago,''), c.fecha) BETWEEN ? AND ?) ORDER BY c.fecha DESC, c.id DESC`, [D, H, D, H]);
    if (tipo === 'pagos') return all(`SELECT p.*, 'T-' || substr('0000' || p.trabajo_id, -4) AS numero, c.nombre AS cliente FROM pagos p
      JOIN trabajos t ON t.id=p.trabajo_id LEFT JOIN clientes c ON c.id=t.cliente_id WHERE p.fecha BETWEEN ? AND ? ORDER BY p.fecha DESC, p.id DESC`, [D, H]);
    throw new Error('Tipo desconocido');
  }
  function comprasPendientes() { return all("SELECT c.*, c.cantidad*c.costo AS total FROM compras c WHERE c.estado='Pendiente' ORDER BY c.fecha"); }
  function guardarGasto(d) {
    const f = esFecha(d.fecha) ? d.fecha : hoy();
    if (num(d.monto) <= 0) throw new Error('El monto tiene que ser mayor que 0');
    if (!METODOS.includes(d.metodo)) throw new Error('Elegí el método de pago');
    abierto(f, 'registrar este gasto');
    if (num(d.id)) {
      const v = get('SELECT * FROM gastos WHERE id=?', [num(d.id)]); if (!v) throw new Error('Gasto no encontrado'); abierto(v.fecha, 'editar este gasto');
      run('UPDATE gastos SET fecha=?, categoria=?, descripcion=?, monto=?, metodo=? WHERE id=?', [f, txt(d.categoria), txt(d.descripcion), r2(d.monto), d.metodo, num(d.id)]); return num(d.id);
    }
    return run('INSERT INTO gastos(fecha, categoria, descripcion, monto, metodo) VALUES (?,?,?,?,?)', [f, txt(d.categoria), txt(d.descripcion), r2(d.monto), d.metodo]);
  }
  function borrarGasto(id) { const v = get('SELECT * FROM gastos WHERE id=?', [id]); if (!v) throw new Error('Gasto no encontrado'); abierto(v.fecha, 'borrar este gasto'); run('DELETE FROM gastos WHERE id=?', [id]); return true; }
  function guardarVale(d) {
    const f = esFecha(d.fecha) ? d.fecha : hoy();
    if (!num(d.empleado_id)) throw new Error('Elegí el empleado');
    if (num(d.monto) <= 0) throw new Error('El monto tiene que ser mayor que 0');
    if (!METODOS.includes(d.metodo)) throw new Error('Elegí el método de pago');
    const sem = lunesDe(f);
    if (val("SELECT 1 FROM planilla WHERE semana=? AND empleado_id=? AND estado='Pagado'", [sem, num(d.empleado_id)]))
      throw new Error('La planilla de ese empleado para esa semana ya está pagada. Registrá el vale en la semana siguiente.');
    abierto(f, 'registrar este vale');
    if (num(d.id)) {
      const v = get('SELECT * FROM vales WHERE id=?', [num(d.id)]); if (!v) throw new Error('Vale no encontrado'); abierto(v.fecha, 'editar este vale');
      if (val("SELECT 1 FROM planilla WHERE semana=? AND empleado_id=? AND estado='Pagado'", [lunesDe(v.fecha), v.empleado_id]))
        throw new Error('Ese vale ya se descontó en una planilla pagada; no se puede cambiar.');
      run('UPDATE vales SET fecha=?, empleado_id=?, monto=?, metodo=?, nota=? WHERE id=?', [f, num(d.empleado_id), r2(d.monto), d.metodo, txt(d.nota), num(d.id)]); return num(d.id);
    }
    return run('INSERT INTO vales(fecha, empleado_id, monto, metodo, nota) VALUES (?,?,?,?,?)', [f, num(d.empleado_id), r2(d.monto), d.metodo, txt(d.nota)]);
  }
  function borrarVale(id) {
    const v = get('SELECT * FROM vales WHERE id=?', [id]); if (!v) throw new Error('Vale no encontrado'); abierto(v.fecha, 'borrar este vale');
    if (val("SELECT 1 FROM planilla WHERE semana=? AND empleado_id=? AND estado='Pagado'", [lunesDe(v.fecha), v.empleado_id])) throw new Error('Ese vale ya se descontó en una planilla pagada.');
    run('DELETE FROM vales WHERE id=?', [id]); return true;
  }
  function guardarCompra(d) {
    const f = esFecha(d.fecha) ? d.fecha : hoy();
    if (num(d.cantidad) <= 0) throw new Error('La cantidad tiene que ser mayor que 0');
    const inv = num(d.inventario_id) ? get('SELECT * FROM inventario WHERE id=?', [num(d.inventario_id)]) : null;
    if (!inv && !txt(d.descripcion)) throw new Error('Elegí el repuesto o escribí qué compraste');
    const estado = d.estado === 'Pendiente' ? 'Pendiente' : 'Pagado';
    const fp = estado === 'Pagado' ? (esFecha(d.fecha_pago) ? d.fecha_pago : '') : '';
    if (estado === 'Pagado' && !METODOS.includes(d.metodo)) throw new Error('Elegí el método de pago');
    if (estado === 'Pagado') abierto(fp || f, 'registrar esta compra pagada');
    const p = [f, txt(d.proveedor), inv ? inv.id : null, txt(d.descripcion) || (inv ? inv.descripcion : ''), num(d.cantidad), r2(d.costo), txt(d.metodo), estado, fp, txt(d.factura)];
    if (num(d.id)) {
      const v = get('SELECT * FROM compras WHERE id=?', [num(d.id)]);
      if (fechaPagoCompra(v)) abierto(fechaPagoCompra(v), 'editar esta compra');
      run('UPDATE compras SET fecha=?, proveedor=?, inventario_id=?, descripcion=?, cantidad=?, costo=?, metodo=?, estado=?, fecha_pago=?, factura=? WHERE id=?', [...p, num(d.id)]);
      return num(d.id);
    }
    return run('INSERT INTO compras(fecha, proveedor, inventario_id, descripcion, cantidad, costo, metodo, estado, fecha_pago, factura) VALUES (?,?,?,?,?,?,?,?,?,?)', p);
  }
  function pagarCompra(id, metodo, fecha) {
    const v = get('SELECT * FROM compras WHERE id=?', [id]); if (!v) throw new Error('Compra no encontrada');
    if (v.estado === 'Pagado') throw new Error('Esta compra ya está pagada.');
    const f = esFecha(fecha) ? fecha : hoy();
    if (!METODOS.includes(metodo)) throw new Error('Elegí el método de pago');
    abierto(f, 'registrar este pago');
    run("UPDATE compras SET estado='Pagado', metodo=?, fecha_pago=? WHERE id=?", [metodo, f, id]); return true;
  }
  function borrarCompra(id) {
    const v = get('SELECT * FROM compras WHERE id=?', [id]);
    if (fechaPagoCompra(v)) abierto(fechaPagoCompra(v), 'borrar esta compra');
    run('DELETE FROM compras WHERE id=?', [id]); return true;
  }

  // ------------------------------------------------------------ planilla
  function empleadosActivos() { return all('SELECT * FROM empleados WHERE activo=1 ORDER BY nombre'); }
  function calcPlanilla(p, emp, lunes) {
    const dom = addDias(lunes, 6);
    const mo = r2(num(val(`SELECT SUM(CASE WHEN mecanico_id=? THEN mano_obra * (CASE WHEN mecanico2_id IS NULL THEN 100 ELSE COALESCE(reparto, 50) END) / 100.0 ELSE 0 END
        + CASE WHEN mecanico2_id=? THEN mano_obra * (100 - COALESCE(reparto, 50)) / 100.0 ELSE 0 END)
      FROM trabajos WHERE (mecanico_id=? OR mecanico2_id=?) AND estado='Entregado' AND (semana_comision=? OR (semana_comision IS NULL AND entrega BETWEEN ? AND ?))`, [emp.id, emp.id, emp.id, emp.id, lunes, lunes, dom])));
    const vales = num(val('SELECT SUM(monto) FROM vales WHERE empleado_id=? AND fecha BETWEEN ? AND ?', [emp.id, lunes, dom]));
    const salario = num(emp.salario), comision = r2(mo * num(emp.comision) / 100);
    if (p.estado === 'Pagado') return { ...p, empleado: emp.nombre, puesto: emp.puesto, salario: num(p.salario_pagado), comision: num(p.comision_pagada), vales: num(p.vales_pagados), neto: num(p.neto_pagado), mano_obra: mo };
    return { ...p, empleado: emp.nombre, puesto: emp.puesto, salario, comision, vales, mano_obra: mo, neto: r2(salario + comision + num(p.bonos) - num(p.deducciones) - vales) };
  }
  function planillaSemana(semana) {
    const lunes = lunesDe(esFecha(semana) ? semana : hoy());
    empleadosActivos().filter(e => !e.alta || lunesDe(e.alta) <= lunes).forEach(e => run('INSERT OR IGNORE INTO planilla(semana, empleado_id) VALUES (?, ?)', [lunes, e.id]));
    const filas = all('SELECT p.* FROM planilla p WHERE p.semana=? ORDER BY p.id', [lunes]).map(p => {
      const emp = get('SELECT * FROM empleados WHERE id=?', [p.empleado_id]) || { id: p.empleado_id, nombre: '(empleado borrado)', salario: 0, comision: 0 };
      return calcPlanilla(p, emp, lunes);
    }).filter(p => p.estado === 'Pagado' || (get('SELECT activo FROM empleados WHERE id=?', [p.empleado_id]) || {}).activo || num(p.mano_obra) > 0 || num(p.vales) > 0);
    const vales = listarMov('vales', lunes, addDias(lunes, 6));
    const sum = (a, k, f) => r2(a.filter(f || (() => true)).reduce((s, x) => s + num(x[k]), 0));
    return { semana: lunes, filas, vales, tot: { neto: sum(filas, 'neto'), pendiente: sum(filas, 'neto', x => x.estado !== 'Pagado'),
      pagadoEf: sum(filas, 'neto', x => x.estado === 'Pagado' && x.metodo === 'Efectivo'), pagadoTr: sum(filas, 'neto', x => x.estado === 'Pagado' && x.metodo === 'Transferencia'),
      vales: sum(vales, 'monto') } };
  }
  function guardarPlanilla(id, d) {
    const p = get('SELECT * FROM planilla WHERE id=?', [id]); if (!p) throw new Error('Fila de planilla no encontrada');
    if (p.estado === 'Pagado') throw new Error('Esta planilla ya está pagada. Si necesitás corregirla, primero marcala como pendiente.');
    run('UPDATE planilla SET bonos=?, deducciones=? WHERE id=?', [r2(d.bonos), r2(d.deducciones), id]); return true;
  }
  function pagarPlanilla(id, metodo, fecha) {
    const p = get('SELECT * FROM planilla WHERE id=?', [id]); if (!p) throw new Error('Fila de planilla no encontrada');
    if (p.estado === 'Pagado') throw new Error('Esta planilla ya está pagada.');
    if (!METODOS.includes(metodo)) throw new Error('Elegí el método de pago');
    const f = esFecha(fecha) ? fecha : hoy(); abierto(f, 'registrar este pago de planilla');
    const emp = get('SELECT * FROM empleados WHERE id=?', [p.empleado_id]);
    const c = calcPlanilla({ ...p, estado: 'Pendiente' }, emp, p.semana);
    run("UPDATE planilla SET estado='Pagado', metodo=?, fecha_pago=?, salario_pagado=?, comision_pagada=?, vales_pagados=?, neto_pagado=? WHERE id=?",
      [metodo, f, c.salario, c.comision, c.vales, c.neto, id]);
    return true;
  }
  function anularPagoPlanilla(id) {
    const p = get('SELECT * FROM planilla WHERE id=?', [id]); if (!p || p.estado !== 'Pagado') return true;
    abierto(p.fecha_pago, 'anular este pago de planilla');
    run("UPDATE planilla SET estado='Pendiente', metodo=NULL, fecha_pago=NULL, salario_pagado=NULL, comision_pagada=NULL, vales_pagados=NULL, neto_pagado=NULL WHERE id=?", [id]);
    return true;
  }

  // ------------------------------------------------------------ caja: números por rango
  function numeros(desde, hasta) {
    const met = (sql, p) => { const o = { ef: 0, tr: 0 }; all(sql, p).forEach(r => { if (r.metodo === 'Efectivo') o.ef = r2(r.s); else if (r.metodo === 'Transferencia') o.tr = r2(r.s); }); return o; };
    const P = [desde, hasta];
    const ing = met('SELECT metodo, SUM(monto) AS s FROM pagos WHERE fecha BETWEEN ? AND ? GROUP BY metodo', P);
    const gas = met('SELECT metodo, SUM(monto) AS s FROM gastos WHERE fecha BETWEEN ? AND ? GROUP BY metodo', P);
    const com = met("SELECT metodo, SUM(cantidad*costo) AS s FROM compras WHERE estado='Pagado' AND COALESCE(NULLIF(fecha_pago,''), fecha) BETWEEN ? AND ? GROUP BY metodo", P);
    const vale = met('SELECT metodo, SUM(monto) AS s FROM vales WHERE fecha BETWEEN ? AND ? GROUP BY metodo', P);
    const pla = met("SELECT metodo, SUM(neto_pagado) AS s FROM planilla WHERE estado='Pagado' AND fecha_pago BETWEEN ? AND ? GROUP BY metodo", P);
    const n = { ingEf: ing.ef, ingTr: ing.tr, gasEf: gas.ef, gasTr: gas.tr, comEf: com.ef, comTr: com.tr, valEf: vale.ef, valTr: vale.tr, plaEf: pla.ef, plaTr: pla.tr };
    n.ing = r2(n.ingEf + n.ingTr);
    n.egrEf = r2(n.gasEf + n.comEf + n.valEf + n.plaEf); n.egrTr = r2(n.gasTr + n.comTr + n.valTr + n.plaTr); n.egr = r2(n.egrEf + n.egrTr);
    n.netoEf = r2(n.ingEf - n.egrEf); n.netoTr = r2(n.ingTr - n.egrTr); n.neto = r2(n.netoEf + n.netoTr);
    const ent = all(SQL_TRABAJOS + " WHERE t.estado='Entregado' AND t.entrega BETWEEN ? AND ?", P).map(completar);
    n.entregados = ent.length; n.manoObra = r2(ent.reduce((s, t) => s + num(t.mano_obra), 0));
    n.utilRep = r2(ent.reduce((s, t) => s + num(t.repuestos) - num(t.costo_rep), 0));
    n.recibidos = num(val("SELECT COUNT(*) FROM trabajos WHERE fecha BETWEEN ? AND ? AND estado<>'Cancelado'", P));
    return n;
  }
  function movimientosDia(f) {
    const out = [];
    listarMov('pagos', f, f).forEach(p => out.push({ tipo: 'Cobro', detalle: `${p.numero} · ${p.cliente || ''}${p.nota ? ' · ' + p.nota : ''}`, metodo: p.metodo, entrada: p.monto, salida: 0 }));
    listarMov('gastos', f, f).forEach(g => out.push({ tipo: 'Gasto', detalle: `${g.categoria || ''}${g.descripcion ? ' · ' + g.descripcion : ''}`, metodo: g.metodo, entrada: 0, salida: g.monto }));
    all("SELECT * FROM compras WHERE estado='Pagado' AND COALESCE(NULLIF(fecha_pago,''), fecha)=?", [f]).forEach(c => out.push({ tipo: 'Compra', detalle: `${c.descripcion} (${c.cantidad} u.)${c.proveedor ? ' · ' + c.proveedor : ''}`, metodo: c.metodo, entrada: 0, salida: r2(c.cantidad * c.costo) }));
    listarMov('vales', f, f).forEach(v => out.push({ tipo: 'Vale', detalle: `${v.empleado || ''}${v.nota ? ' · ' + v.nota : ''}`, metodo: v.metodo, entrada: 0, salida: v.monto }));
    all("SELECT p.*, e.nombre FROM planilla p LEFT JOIN empleados e ON e.id=p.empleado_id WHERE p.estado='Pagado' AND p.fecha_pago=?", [f]).forEach(p => out.push({ tipo: 'Planilla', detalle: `${p.nombre} · semana ${fmt(p.semana)}`, metodo: p.metodo, entrada: 0, salida: p.neto_pagado }));
    return out;
  }

  // ------------------------------------------------------------ cierres
  function esperadoEnCaja(f) {
    // el efectivo se acumula durante la semana y se retira en el cierre semanal: fondo fijo + neto en efectivo desde el lunes
    const n = numeros(lunesDe(f), f);
    return r2(num(cfg('fondo')) + n.netoEf);
  }
  function cajaDia(fecha) {
    const f = esFecha(fecha) ? fecha : hoy();
    const c = get('SELECT * FROM cierres WHERE fecha=?', [f]);
    const actual = numeros(f, f);
    return { fecha: f, hoy: hoy(), cerrado: !!c, cierre: c ? { ...c, datos: JSON.parse(c.datos || '{}') } : null,
      numeros: c ? JSON.parse(c.datos || '{}') : actual, actual, esperado: c ? c.efectivo_esperado : esperadoEnCaja(f), fondo: num(cfg('fondo')),
      movimientos: movimientosDia(f), semanaCerrada: semanaCerrada(lunesDe(f)) };
  }
  function cerrarDia(fecha, contado, nota, tipo) {
    const f = esFecha(fecha) ? fecha : hoy();
    if (f > hoy()) throw new Error('No se puede cerrar un día que todavía no llega');
    if (diaCerrado(f)) throw new Error('Ese día ya está cerrado');
    const datos = numeros(f, f), esperado = esperadoEnCaja(f);
    const tieneConteo = contado !== null && contado !== undefined && contado !== '';
    run('INSERT INTO cierres(fecha, tipo, datos, efectivo_esperado, efectivo_contado, diferencia, nota, cerrado_en) VALUES (?,?,?,?,?,?,?,?)',
      [f, tipo === 'automático' ? 'automático' : 'manual', JSON.stringify(datos), esperado, tieneConteo ? r2(contado) : null,
        tieneConteo ? r2(num(contado) - esperado) : null, txt(nota), new Date().toISOString()]);
    if (tipo !== 'automático') setCfg('reabiertos', (cfg('reabiertos') || []).filter(x => x !== f));
    // si se volvió a cerrar un día ya pasado, los días siguientes de la semana recalculan su efectivo esperado
    const dom = addDias(lunesDe(f), 6);
    all('SELECT * FROM cierres WHERE fecha > ? AND fecha <= ?', [f, dom]).forEach(c => {
      const esp = esperadoEnCaja(c.fecha);
      run('UPDATE cierres SET efectivo_esperado=?, diferencia=? WHERE fecha=?', [esp, c.efectivo_contado === null ? null : r2(num(c.efectivo_contado) - esp), c.fecha]);
    });
    return cajaDia(f);
  }
  function reabrirDia(fecha) {
    if (semanaCerrada(lunesDe(fecha))) throw new Error('La semana de ese día ya tiene cierre oficial. Reabrí primero la semana.');
    run('DELETE FROM cierres WHERE fecha=?', [fecha]);
    if (fecha < hoy()) setCfg('reabiertos', [...new Set([...(cfg('reabiertos') || []), fecha])]);
    return cajaDia(fecha);
  }
  /** Cierra automáticamente todos los días pasados que nadie cerró (corre al abrir el programa y cada minuto). */
  function autoCierre() {
    const ayer = addDias(hoy(), -1);
    const primeros = ['SELECT MIN(fecha) FROM pagos', 'SELECT MIN(fecha) FROM gastos', 'SELECT MIN(fecha) FROM vales', "SELECT MIN(COALESCE(NULLIF(fecha_pago,''), fecha)) FROM compras WHERE estado='Pagado'", "SELECT MIN(fecha_pago) FROM planilla WHERE estado='Pagado'"]
      .map(q => val(q)).filter(Boolean);
    let desde = [cfg('inicio') || hoy(), ...primeros].sort()[0];
    if (desde < addDias(ayer, -400)) desde = addDias(ayer, -400);
    let n = 0;
    const reabiertos = new Set(cfg('reabiertos') || []);
    for (let d = desde; d <= ayer; d = addDias(d, 1)) if (!diaCerrado(d) && !reabiertos.has(d)) { cerrarDia(d, null, 'Cierre automático a medianoche', 'automático'); n++; }
    return n;
  }
  function semanaCaja(semana) {
    const lunes = lunesDe(esFecha(semana) ? semana : hoy()), dom = addDias(lunes, 6);
    const dias = [];
    for (let i = 0; i < 7; i++) {
      const f = addDias(lunes, i), c = get('SELECT * FROM cierres WHERE fecha=?', [f]);
      dias.push({ fecha: f, futuro: f > hoy(), cerrado: !!c, tipo: c ? c.tipo : '', contado: c ? c.efectivo_contado : null, diferencia: c ? c.diferencia : null,
        esperado: c ? c.efectivo_esperado : null, numeros: c ? JSON.parse(c.datos) : numeros(f, f) });
    }
    const oficial = get('SELECT * FROM cierres_semana WHERE semana=?', [lunes]);
    const sumar = () => { const t = {}; dias.forEach(d => Object.entries(d.numeros).forEach(([k, v]) => t[k] = r2((t[k] || 0) + num(v)))); return t; };
    const contados = dias.filter(d => d.contado !== null && d.contado !== undefined);
    return { semana: lunes, domingo: dom, hoy: hoy(), dias, totales: oficial ? JSON.parse(oficial.datos).totales : sumar(), oficial: oficial ? { ...oficial, datos: JSON.parse(oficial.datos) } : null,
      todosCerrados: dias.every(d => d.cerrado), fondo: num(cfg('fondo')), ultimoConteo: contados.length ? contados[contados.length - 1] : null };
  }
  function cerrarSemana(semana, nota) {
    const s = semanaCaja(semana);
    if (s.oficial) throw new Error('Esa semana ya tiene cierre oficial');
    if (!s.todosCerrados) {
      const faltan = s.dias.filter(d => !d.cerrado).map(d => fmt(d.fecha));
      throw new Error('Para el cierre oficial tienen que estar cerrados los 7 días. Faltan: ' + faltan.join(', '));
    }
    const datos = { totales: s.totales, dias: s.dias.map(d => ({ fecha: d.fecha, tipo: d.tipo, contado: d.contado, diferencia: d.diferencia, neto: d.numeros.neto })),
      efectivoRetirar: s.totales.netoEf, ultimoConteo: s.ultimoConteo ? { fecha: s.ultimoConteo.fecha, diferencia: s.ultimoConteo.diferencia } : null };
    run('INSERT INTO cierres_semana(semana, datos, nota, cerrado_en) VALUES (?,?,?,?)', [s.semana, JSON.stringify(datos), txt(nota), new Date().toISOString()]);
    return semanaCaja(s.semana);
  }
  function reabrirSemana(semana) { run('DELETE FROM cierres_semana WHERE semana=?', [lunesDe(semana)]); return semanaCaja(semana); }

  // ------------------------------------------------------------ reportes y dashboard
  function reportes() {
    const semanas = [];
    let l = lunesDe(hoy());
    const inicio = lunesDe([cfg('inicio') || hoy(), val('SELECT MIN(fecha) FROM trabajos') || hoy(), val('SELECT MIN(fecha) FROM pagos') || hoy()].sort()[0]);
    for (let i = 0; i < 26 && l >= inicio; i++, l = addDias(l, -7)) {
      const of = get('SELECT * FROM cierres_semana WHERE semana=?', [l]);
      semanas.push({ semana: l, oficial: !!of, cerrado_en: of ? of.cerrado_en : null, ...(of ? JSON.parse(of.datos).totales : numeros(l, addDias(l, 6))) });
    }
    const meses = [];
    const d = parseIso(hoy()); d.setDate(1);
    for (let i = 0; i < 12; i++) {
      const ini = isoLocal(d), fin = isoLocal(new Date(d.getFullYear(), d.getMonth() + 1, 0));
      if (fin < (cfg('inicio') || hoy()) && i > 0) break;
      meses.push({ mes: ini, ...numeros(ini, fin) });
      d.setMonth(d.getMonth() - 1);
    }
    return { semanas, meses };
  }
  function inicioPanel() {
    const ts = listarTrabajos(), f = hoy(), lunes = lunesDe(f);
    const activos = ts.filter(t => !['Entregado', 'Cancelado'].includes(t.estado));
    const inv = listarInventario();
    const pend = planillaSemana(addDias(lunes, -7));
    const semAnt = semanaCaja(addDias(lunes, -7));
    const porEstado = {}; activos.forEach(t => porEstado[t.estado] = (porEstado[t.estado] || 0) + 1);
    return {
      hoy: f, lunes, caja: cajaDia(f), semana: numeros(lunes, f), mes: numeros(f.slice(0, 8) + '01', f),
      activos: activos.slice(0, 10), nActivos: activos.length, listos: activos.filter(t => t.estado === 'Listo').length,
      porCobrar: r2(ts.filter(t => t.estado_pago === 'Pendiente').reduce((s, t) => s + t.saldo, 0)), nConSaldo: ts.filter(t => t.estado_pago === 'Pendiente').length,
      porEstado, bajo: inv.filter(i => i.alerta !== 'OK'), valorInv: r2(inv.reduce((s, i) => s + i.valor, 0)),
      comprasPend: r2(comprasPendientes().reduce((s, c) => s + num(c.total), 0)),
      planillaPendAnterior: pend.tot.pendiente, semanaAnteriorSinCierre: !semAnt.oficial && semAnt.dias.some(x => x.numeros.ing || x.numeros.egr) ? semAnt.semana : null,
      garantiasPorVencer: ts.filter(t => t.vence && t.vence >= f && t.vence <= addDias(f, 7)).length,
      listosSinAviso: activos.filter(t => t.estado === 'Listo' && !t.avisado).length,
    };
  }
  function garantias() {
    return listarTrabajos().filter(t => num(t.garantia_dias) > 0 && t.estado === 'Entregado').map(t => {
      t.restantes = Math.round((parseIso(t.vence) - parseIso(hoy())) / 86400000);
      t.reclamosN = num(val('SELECT COUNT(*) FROM trabajos WHERE garantia_de=?', [t.id]));
      return t;
    });
  }

  // ------------------------------------------------------------ recibos
  function reciboTexto(id, tipo) {
    const t = trabajo(id), c = configCompleta();
    const nombre = (t.cliente || '').split(' ')[0];
    if (tipo === 'listo') {
      return `Hola ${nombre} 👋, le saludamos de *${c.taller}*.\n\nSu moto${t.moto ? ' *' + t.moto + '*' : ''}${t.placa ? ' (placa ' + t.placa + ')' : ''} ya está *lista para retirar* ✅\n\n` +
        `Trabajo: ${t.descripcion || '-'}\nTotal: *${L(t.total)}*${t.saldo > 0.004 ? `\nSaldo pendiente: *${L(t.saldo)}*` : ''}\n\n` +
        (c.direccion ? `📍 ${c.direccion}\n` : '') + (c.telefono ? `📞 ${c.telefono}\n` : '') + `\n${c.pieMensaje || ''}`;
    }
    const lineas = [];
    lineas.push(`*${c.taller}*`);
    if (c.telefono || c.direccion) lineas.push([c.telefono, c.direccion].filter(Boolean).join(' · '));
    lineas.push('', `🧾 *Recibo ${t.numero}* · ${fmt(t.entrega || t.fecha)}`);
    if (t.cliente) lineas.push(`Cliente: ${t.cliente}`);
    if (t.moto || t.placa) lineas.push(`Moto: ${[t.moto, t.placa ? '(' + t.placa + ')' : ''].filter(Boolean).join(' ')}${t.km ? ' · ' + t.km + ' km' : ''}`);
    lineas.push('', `🔧 *Trabajo:* ${t.descripcion || '-'}`);
    if (t.repuestosLista.length) {
      lineas.push('', '*Repuestos:*');
      t.repuestosLista.forEach(r => lineas.push(`• ${num(r.cantidad)} × ${r.descripcion} — ${L(num(r.cantidad) * num(r.precio))}`));
    }
    lineas.push('');
    if (num(t.mano_obra)) lineas.push(`Mano de obra: ${L(t.mano_obra)}`);
    if (num(t.repuestos)) lineas.push(`Repuestos: ${L(t.repuestos)}`);
    if (num(t.descuento)) lineas.push(`Descuento: −${L(t.descuento)}`);
    lineas.push(`*TOTAL: ${L(t.total)}*`);
    if (num(t.pagado)) lineas.push(`Pagado: ${L(t.pagado)}`);
    lineas.push(t.saldo > 0.004 ? `*Saldo pendiente: ${L(t.saldo)}*` : '✅ Cancelado en su totalidad');
    if (num(t.garantia_dias) > 0) {
      const g = (c.garantias.find(x => num(x.dias) === num(t.garantia_dias)) || {}).nombre || (t.garantia_dias + ' días');
      lineas.push('', `🛡️ *Garantía:* ${g}${t.garantia_cubre ? ' — cubre ' + t.garantia_cubre.toLowerCase() : ''}${t.vence ? ', válida hasta el ' + fmt(t.vence) : ' a partir de la entrega'}.`);
    }
    if (c.pieMensaje) lineas.push('', c.pieMensaje);
    return lineas.join('\n');
  }
  function reciboHTML(id) {
    const t = trabajo(id), c = configCompleta();
    const e = s => String(s == null ? '' : s).replace(/[&<>"]/g, ch => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[ch]));
    const g = num(t.garantia_dias) > 0 ? ((c.garantias.find(x => num(x.dias) === num(t.garantia_dias)) || {}).nombre || t.garantia_dias + ' días') : '';
    const filas = t.repuestosLista.map(r => `<tr><td>${e(r.descripcion)}</td><td class="r">${num(r.cantidad)}</td><td class="r">${L(r.precio)}</td><td class="r">${L(num(r.cantidad) * num(r.precio))}</td></tr>`).join('');
    return `<!doctype html><html><head><meta charset="utf-8"><title>${t.numero}</title><style>
      *{box-sizing:border-box}body{font-family:'Segoe UI',Arial,sans-serif;color:#111827;margin:0;padding:28px 34px;font-size:12.5px}
      .h{display:flex;justify-content:space-between;align-items:flex-start;border-bottom:3px solid #EA580C;padding-bottom:12px}
      .h h1{margin:0;font-size:22px}.h .s{color:#555;margin-top:3px}.n{text-align:right}.n b{font-size:18px;color:#EA580C;display:block}
      .g{display:grid;grid-template-columns:1fr 1fr;gap:6px 24px;margin:16px 0}.g div span{color:#666;display:inline-block;min-width:78px}
      h3{font-size:12px;text-transform:uppercase;letter-spacing:.06em;color:#666;margin:16px 0 6px}
      .box{border:1px solid #E5E7EB;border-radius:8px;padding:10px 12px;white-space:pre-wrap}
      table{width:100%;border-collapse:collapse}th{text-align:left;font-size:11px;color:#666;border-bottom:1px solid #D1D5DB;padding:6px}td{padding:6px;border-bottom:1px solid #F1F5F9}
      .r{text-align:right}.tot{width:260px;margin-left:auto;margin-top:10px}.tot div{display:flex;justify-content:space-between;padding:3px 0}
      .tot .big{font-size:16px;font-weight:800;border-top:2px solid #111;margin-top:4px;padding-top:6px}
      .gar{background:#FFF7ED;border:1px solid #FED7AA;border-radius:8px;padding:10px 12px;margin-top:16px}
      .f{display:flex;justify-content:space-between;margin-top:46px;color:#555}.f div{border-top:1px solid #999;width:42%;padding-top:4px;text-align:center}
      .pie{margin-top:18px;text-align:center;color:#666}
    </style></head><body>
      <div class="h"><div><h1>${e(c.taller)}</h1><div class="s">${e([c.direccion, c.telefono ? 'Tel. ' + c.telefono : '', c.rtn ? 'RTN ' + c.rtn : ''].filter(Boolean).join(' · '))}</div></div>
        <div class="n">RECIBO DE TRABAJO<b>${t.numero}</b>${fmt(t.entrega || t.fecha)}</div></div>
      <div class="g"><div><span>Cliente:</span> <b>${e(t.cliente || '—')}</b></div><div><span>Teléfono:</span> ${e(t.telefono || '—')}</div>
        <div><span>Moto:</span> ${e(t.moto || '—')}</div><div><span>Placa:</span> ${e(t.placa || '—')}${t.km ? ' · ' + e(t.km) + ' km' : ''}</div>
        <div><span>Ingreso:</span> ${fmt(t.fecha)}</div><div><span>Entrega:</span> ${t.entrega ? fmt(t.entrega) : '—'}</div></div>
      ${t.falla ? `<h3>Falla reportada</h3><div class="box">${e(t.falla)}</div>` : ''}
      ${t.estado_recibe ? `<h3>Estado de la moto al recibir</h3><div class="box">${e(t.estado_recibe)}</div>` : ''}
      <h3>Trabajo realizado</h3><div class="box">${e(t.descripcion || '—')}</div>
      ${filas ? `<h3>Repuestos</h3><table><tr><th>Descripción</th><th class="r">Cant.</th><th class="r">Precio</th><th class="r">Subtotal</th></tr>${filas}</table>` : ''}
      <div class="tot">${num(t.mano_obra) ? `<div><span>Mano de obra</span><span>${L(t.mano_obra)}</span></div>` : ''}${num(t.repuestos) ? `<div><span>Repuestos</span><span>${L(t.repuestos)}</span></div>` : ''}
        ${num(t.descuento) ? `<div><span>Descuento</span><span>− ${L(t.descuento)}</span></div>` : ''}<div class="big"><span>TOTAL</span><span>${L(t.total)}</span></div>
        <div><span>Pagado</span><span>${L(t.pagado)}</span></div><div style="font-weight:700"><span>Saldo</span><span>${L(t.saldo)}</span></div></div>
      ${g ? `<div class="gar"><b>Garantía: ${e(g)}</b>${t.garantia_cubre ? ' — cubre ' + e(t.garantia_cubre.toLowerCase()) : ''}${t.vence ? ', válida hasta el <b>' + fmt(t.vence) + '</b>' : ', a partir de la fecha de entrega'}.<div style="margin-top:6px;color:#6B4423;font-size:11.5px">${e(c.terminos || '')}</div></div>` : ''}
      <div class="f"><div>Firma del cliente</div><div>${e(c.taller)}</div></div>
      <div class="pie">${e(c.pieMensaje || '')}</div>
    </body></html>`;
  }

  // ------------------------------------------------------------ configuración
  function init() {
    autoCierre();
    return { config: configCompleta(), empleados: all('SELECT * FROM empleados ORDER BY activo DESC, nombre'), estados: ESTADOS, metodos: METODOS,
      hoy: hoy(), lunes: lunesDe(hoy()), vacio: !val('SELECT COUNT(*) FROM trabajos') && !val('SELECT COUNT(*) FROM clientes') };
  }
  function guardarConfig(c) {
    return tx(() => {
      ['taller', 'telefono', 'direccion', 'rtn', 'prefijo', 'terminos', 'pieMensaje', 'coberturaDefecto'].forEach(k => { if (c[k] !== undefined) setCfg(k, txt(c[k])); });
      if (c.fondo !== undefined) setCfg('fondo', r2(c.fondo));
      if (c.garantiaDefecto !== undefined) setCfg('garantiaDefecto', Math.round(num(c.garantiaDefecto)));
      ['catGastos', 'catRepuestos', 'coberturas'].forEach(k => { if (Array.isArray(c[k])) setCfg(k, c[k].map(txt).filter(Boolean)); });
      if (Array.isArray(c.garantias)) {
        const g = c.garantias.map(x => ({ dias: Math.max(0, Math.round(num(x.dias))), nombre: txt(x.nombre) || (Math.round(num(x.dias)) + ' días') }))
          .filter((x, i, a) => a.findIndex(y => y.dias === x.dias) === i).sort((a, b) => a.dias - b.dias);
        if (!g.length || g[0].dias !== 0) g.unshift({ dias: 0, nombre: 'Sin garantía' });
        setCfg('garantias', g);
      }
      if (c.carpetaRespaldos !== undefined) setCfg('carpetaRespaldos', txt(c.carpetaRespaldos));
      if (Array.isArray(c.empleados)) {
        c.empleados.forEach(e => {
          if (!txt(e.nombre)) return;
          const p = [txt(e.nombre), txt(e.puesto), r2(e.salario), r2(e.comision), e.activo === false || e.activo === 0 || e.activo === 'No' ? 0 : 1];
          if (num(e.id)) run('UPDATE empleados SET nombre=?, puesto=?, salario=?, comision=?, activo=? WHERE id=?', [...p, num(e.id)]);
          else run('INSERT INTO empleados(nombre, puesto, salario, comision, activo, alta) VALUES (?,?,?,?,?,?)', [...p, hoy()]);
        });
      }
      return init();
    });
  }
  function borrarEmpleado(id) {
    if (val('SELECT COUNT(*) FROM trabajos WHERE mecanico_id=? OR mecanico2_id=?', [id, id]) || val('SELECT COUNT(*) FROM vales WHERE empleado_id=?', [id]) || val("SELECT COUNT(*) FROM planilla WHERE empleado_id=? AND estado='Pagado'", [id])) {
      run('UPDATE empleados SET activo=0 WHERE id=?', [id]); return 'desactivado';
    }
    run("DELETE FROM planilla WHERE empleado_id=? AND estado<>'Pagado'", [id]); run('DELETE FROM empleados WHERE id=?', [id]); return 'borrado';
  }

  // ------------------------------------------------------------ exportar todo (Excel)
  function exportarTodo() {
    const ts = listarTrabajos();
    return {
      Trabajos: ts.map(t => ({ 'N.º': t.numero, Fecha: t.fecha, Cliente: t.cliente, Teléfono: t.telefono, Placa: t.placa, Moto: t.moto, Km: t.km, Trabajo: t.descripcion,
        Mecánico: t.mecanicos, Estado: t.estado, 'Mano de obra': num(t.mano_obra), Repuestos: num(t.repuestos), Descuento: num(t.descuento), Total: t.total, Pagado: num(t.pagado),
        Saldo: t.saldo, 'Estado pago': t.estado_pago, Entrega: t.entrega, 'Garantía (días)': num(t.garantia_dias), 'Garantía cubre': t.garantia_cubre, 'Vence garantía': t.vence, Utilidad: t.utilidad })),
      Repuestos: all(`SELECT 'T-' || substr('0000' || r.trabajo_id, -4) AS "Trabajo", t.fecha AS Fecha, r.descripcion AS "Descripción", i.codigo AS "Código inventario",
        r.cantidad AS Cantidad, r.precio AS Precio, r.costo AS Costo, r.cantidad*r.precio AS Subtotal FROM trabajo_repuestos r JOIN trabajos t ON t.id=r.trabajo_id LEFT JOIN inventario i ON i.id=r.inventario_id ORDER BY r.trabajo_id`),
      Cobros: listarMov('pagos').map(p => ({ Fecha: p.fecha, Trabajo: p.numero, Cliente: p.cliente, Monto: p.monto, Método: p.metodo, Nota: p.nota })),
      Gastos: listarMov('gastos').map(g => ({ Fecha: g.fecha, Categoría: g.categoria, Descripción: g.descripcion, Monto: g.monto, Método: g.metodo })),
      Compras: listarMov('compras').map(c => ({ Fecha: c.fecha, Proveedor: c.proveedor, Código: c.codigo, Descripción: c.descripcion, Cantidad: c.cantidad, 'Costo unit.': c.costo, Total: c.total, Método: c.metodo, Estado: c.estado, 'Fecha pago': c.fecha_pago, Factura: c.factura })),
      Vales: listarMov('vales').map(v => ({ Fecha: v.fecha, Empleado: v.empleado, Monto: v.monto, Método: v.metodo, Nota: v.nota })),
      Planilla: all("SELECT p.*, e.nombre FROM planilla p LEFT JOIN empleados e ON e.id=p.empleado_id ORDER BY p.semana DESC").map(p => {
        const c = calcPlanilla(p, get('SELECT * FROM empleados WHERE id=?', [p.empleado_id]) || { id: p.empleado_id, salario: 0, comision: 0 }, p.semana);
        return { Semana: p.semana, Empleado: p.nombre, Salario: c.salario, Comisión: c.comision, Bonos: num(p.bonos), Deducciones: num(p.deducciones), Vales: c.vales, Neto: c.neto, Estado: p.estado, Método: p.metodo, 'Fecha pago': p.fecha_pago };
      }),
      Inventario: listarInventario().map(i => ({ Código: i.codigo, Descripción: i.descripcion, Categoría: i.categoria, 'Compatible con': i.compatible, Proveedor: i.proveedor, Costo: i.costo, Precio: i.precio,
        'Stock inicial': i.stock_inicial, Entradas: i.entradas, Salidas: i.salidas, Stock: i.stock, Mínimo: i.minimo, Alerta: i.alerta, 'Valor (costo)': i.valor })),
      Clientes: listarClientes().map(c => ({ ID: 'C-' + pad(c.id), Nombre: c.nombre, Teléfono: c.telefono, Dirección: c.direccion, Trabajos: c.trabajos, Facturado: c.facturado, Saldo: c.saldo, Notas: c.notas })),
      Motos: listarMotos().map(m => ({ Placa: m.placa, Cliente: m.cliente, Marca: m.marca, Modelo: m.modelo, Año: m.anio, Color: m.color, Visitas: m.visitas, 'Última visita': m.ultima })),
      'Cierres diarios': all('SELECT * FROM cierres ORDER BY fecha DESC').map(c => { const d = JSON.parse(c.datos); return { Fecha: c.fecha, Tipo: c.tipo, 'Ingresos ef.': d.ingEf, 'Ingresos tr.': d.ingTr, 'Egresos ef.': d.egrEf, 'Egresos tr.': d.egrTr, 'Neto ef.': d.netoEf, 'Neto tr.': d.netoTr, Neto: d.neto, 'Efectivo esperado': c.efectivo_esperado, 'Efectivo contado': c.efectivo_contado, Diferencia: c.diferencia, Nota: c.nota }; }),
      'Cierres semanales': all('SELECT * FROM cierres_semana ORDER BY semana DESC').map(c => { const d = JSON.parse(c.datos), t = d.totales; return { Semana: c.semana, 'Ingresos ef.': t.ingEf, 'Ingresos tr.': t.ingTr, 'Total ingresos': t.ing, 'Egresos': t.egr, 'Neto ef.': t.netoEf, 'Neto tr.': t.netoTr, 'NETO': t.neto, 'Efectivo a retirar': d.efectivoRetirar, 'Cerrado el': c.cerrado_en, Nota: c.nota }; }),
    };
  }

  // ------------------------------------------------------------ datos de ejemplo
  function cargarEjemplo() {
    if (val('SELECT COUNT(*) FROM trabajos')) throw new Error('Solo se pueden cargar datos de ejemplo con la base vacía');
    return tx(() => {
      const f = hoy(), d = n => addDias(f, -n);
      setCfg('taller', 'Taller de Motos El Rayo'); setCfg('telefono', '9876-0000');
      const carlos = run("INSERT INTO empleados(nombre, puesto, salario, comision) VALUES ('Carlos','Mecánico',1500,10)");
      const luis = run("INSERT INTO empleados(nombre, puesto, salario, comision) VALUES ('Luis','Ayudante',1000,5)");
      const inv = [['ACE-2040', 'Aceite 20W-40 4T (1 L)', 'Aceites/Lubricantes', 'Universal 4T', 110, 180, 12, 6], ['FIL-AIRE-XR', 'Filtro de aire XR150L', 'Filtros', 'Honda XR150L', 90, 160, 4, 2],
        ['BUJ-CR7', 'Bujía NGK CR7HSA', 'Eléctrico', 'XR150, CG, varios', 60, 125, 10, 5], ['PAS-TRAS-FZ', 'Pastillas traseras FZ', 'Frenos', 'Yamaha FZ', 140, 230, 2, 2],
        ['KIT-ARR-150', 'Kit de arrastre 150cc', 'Transmisión/Cadena', '150cc varias', 520, 850, 1, 1]]
        .map(x => run('INSERT INTO inventario(codigo, descripcion, categoria, compatible, costo, precio, stock_inicial, minimo, proveedor) VALUES (?,?,?,?,?,?,?,?,?)', [...x, 'Distribuidora X']));
      setCfg('inicio', d(10));
      const t1 = guardarTrabajo({ fecha: d(5), cliente_nombre: 'Mario Hernández', cliente_tel: '98765432', placa: 'MAB1234', marca: 'Honda', modelo: 'XR150L', anio: '2021', km: '18500',
        descripcion: 'Cambio de aceite, filtro de aire y bujía; ajuste de carburador', falla: 'Pierde fuerza y humea', estado_recibe: 'Rayón en tanque lado izquierdo',
        mecanico_id: carlos, mano_obra: 350, garantia_dias: 30, garantia_cubre: 'Mano de obra y repuestos',
        repuestos: [{ inventario_id: inv[0], descripcion: 'Aceite 20W-40 4T (1 L)', cantidad: 1 }, { inventario_id: inv[1], descripcion: 'Filtro de aire XR150L', cantidad: 1 }, { inventario_id: inv[2], descripcion: 'Bujía NGK CR7HSA', cantidad: 1 }] });
      run("UPDATE trabajos SET estado='Entregado', entrega=? WHERE id=?", [d(4), t1]);
      run("INSERT INTO pagos(trabajo_id, fecha, monto, metodo, nota) VALUES (?,?,815,'Efectivo','Liquidación')", [t1, d(4)]);
      const t2 = guardarTrabajo({ fecha: d(3), cliente_nombre: 'Andrea López', cliente_tel: '33445566', placa: 'MCD5678', marca: 'Yamaha', modelo: 'FZ 2.0', anio: '2019', km: '32100',
        descripcion: 'Cambio de pastillas traseras y purga de frenos', falla: 'Frenos traseros no agarran', mecanico_id: carlos, mano_obra: 250, descuento: 50, garantia_dias: 15, garantia_cubre: 'Mano de obra',
        repuestos: [{ inventario_id: inv[3], descripcion: 'Pastillas traseras FZ', cantidad: 1 }, { descripcion: 'Líquido de frenos DOT4', cantidad: 1, precio: 120, costo: 90 }] });
      run("UPDATE trabajos SET estado='Entregado', entrega=? WHERE id=?", [d(2), t2]);
      run("INSERT INTO pagos(trabajo_id, fecha, monto, metodo, nota) VALUES (?,?,600,'Transferencia','Liquidación')", [t2, d(2)]);
      const t3 = guardarTrabajo({ fecha: d(1), cliente_nombre: 'José Castillo', cliente_tel: '', placa: 'MEF9012', marca: 'Bajaj', modelo: 'Pulsar 180', anio: '2018', km: '45200',
        descripcion: 'Cambio de kit de arrastre', falla: 'Ruido en cadena', estado_recibe: 'Espejo derecho quebrado (ya venía así)', mecanico_id: luis, mano_obra: 300, garantia_dias: 30,
        garantia_cubre: 'Mano de obra y repuestos', repuestos: [{ inventario_id: inv[4], descripcion: 'Kit de arrastre 150cc', cantidad: 1 }] });
      run("INSERT INTO pagos(trabajo_id, fecha, monto, metodo, nota) VALUES (?,?,500,'Efectivo','Anticipo para el kit')", [t3, d(1)]);
      const t4 = guardarTrabajo({ fecha: f, cliente_nombre: 'Kevin Martínez', cliente_tel: '99112233', placa: 'MGH3344', marca: 'Italika', modelo: 'FT150', anio: '2022', km: '9800',
        descripcion: 'Revisión eléctrica: no enciende la luz delantera', mecanico_id: carlos, mano_obra: 200, garantia_dias: 8, garantia_cubre: 'Mano de obra' });
      run("UPDATE trabajos SET estado='Listo' WHERE id=?", [t4]);
      run("INSERT INTO gastos(fecha, categoria, descripcion, monto, metodo) VALUES (?,?,?,?,?)", [d(4), 'Consumibles de taller', 'Wipe y desengrasante', 85, 'Efectivo']);
      run("INSERT INTO gastos(fecha, categoria, descripcion, monto, metodo) VALUES (?,?,?,?,?)", [d(2), 'Luz', 'Recibo ENEE', 650, 'Transferencia']);
      run("INSERT INTO compras(fecha, proveedor, inventario_id, descripcion, cantidad, costo, metodo, estado, fecha_pago, factura) VALUES (?,?,?,?,?,?,?,?,?,?)", [d(3), 'Distribuidora X', inv[0], 'Aceite 20W-40 4T (1 L)', 6, 110, 'Efectivo', 'Pagado', '', 'F-1203']);
      run("INSERT INTO compras(fecha, proveedor, inventario_id, descripcion, cantidad, costo, metodo, estado, fecha_pago, factura) VALUES (?,?,?,?,?,?,?,?,?,?)", [d(1), 'Repuestos Y', inv[3], 'Pastillas traseras FZ', 4, 140, '', 'Pendiente', '', '0457']);
      run("INSERT INTO vales(fecha, empleado_id, monto, metodo, nota) VALUES (?,?,200,'Efectivo','Adelanto')", [d(2), carlos]);
      return true;
    });
  }

  // ------------------------------------------------------------ API pública
  const api = {
    init, inicioPanel, configCompleta, guardarConfig, borrarEmpleado, cargarEjemplo,
    listarTrabajos, trabajo, guardarTrabajo, cambiarEstado, marcarAvisado, borrarTrabajo, reclamoGarantia,
    agregarPago, editarPago, borrarPago, agregarFoto, borrarFoto,
    buscarClientes, buscarPlaca, listarClientes, cliente, guardarCliente, borrarCliente, listarMotos, guardarMoto, borrarMoto,
    listarInventario, guardarInventario, borrarInventario, movimientosInventario,
    listarMov, comprasPendientes, guardarGasto, borrarGasto, guardarVale, borrarVale, guardarCompra, pagarCompra, borrarCompra,
    planillaSemana, guardarPlanilla, pagarPlanilla, anularPagoPlanilla,
    cajaDia, cerrarDia, reabrirDia, semanaCaja, cerrarSemana, reabrirSemana, autoCierre,
    reportes, garantias, reciboTexto, reciboHTML, exportarTodo,
  };
  return { api, cfg, setCfg, cambios: () => cambios, hoy };
}

module.exports = { crearBackend, ESTADOS, METODOS, utils: { isoLocal, addDias, lunesDe, fmt } };
