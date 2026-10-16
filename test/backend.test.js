const initSqlJs = require('sql.js');
const assert = require('assert');
const { crearBackend, utils } = require('../backend');
let ok = 0; const t = (n, f) => { try { f(); ok++; console.log('✓', n); } catch (e) { console.log('✗', n, '\n   ', e.message); process.exitCode = 1; } };
const throwsMsg = (f, re) => { try { f(); } catch (e) { assert.match(e.message, re); return; } throw new Error('esperaba error ' + re); };
(async () => {
  const SQL = await initSqlJs();
  let fecha = new Date(2026, 9, 7, 10, 0); // miércoles 7-oct-2026
  const db = new SQL.Database();
  const B = crearBackend(db, { ahora: () => fecha }); const A = B.api;
  t('init vacío', () => { const i = A.init(); assert.equal(i.vacio, true); assert.equal(i.lunes, '2026-10-05'); assert.equal(i.config.fondo, 1000); });
  t('cargar ejemplo', () => { A.cargarEjemplo(); assert.equal(A.listarTrabajos().length, 4); });
  t('totales de trabajo', () => {
    const tr = A.trabajo(1); assert.equal(tr.total, 815); assert.equal(tr.saldo, 0); assert.equal(tr.estado_pago, 'Pagado'); assert.equal(tr.numero, 'T-0001');
    const t2 = A.trabajo(2); assert.equal(t2.total, 250 + 230 + 120 - 50); assert.equal(t2.utilidad, 550 - 140 - 90);
    const t3 = A.trabajo(3); assert.equal(t3.saldo, 650); assert.equal(t3.estado_pago, 'Pendiente');
  });
  t('stock inventario', () => { const inv = A.listarInventario(); const ace = inv.find(i => i.codigo === 'ACE-2040'); assert.equal(ace.stock, 12 + 6 - 1); const kit = inv.find(i => i.codigo === 'KIT-ARR-150'); assert.equal(kit.alerta, 'AGOTADO'); });
  t('nuevo trabajo con cliente nuevo, repuesto libre + inventario y pago inicial', () => {
    const id = A.guardarTrabajo({ cliente_nombre: 'Pedro Pérez', cliente_tel: '9999-1111', placa: 'mzz 01', marca: 'Honda', modelo: 'CG', descripcion: 'Cambio de cadena',
      mano_obra: 150, garantia_dias: 15, repuestos: [{ descripcion: 'Cadena 428', cantidad: 1, precio: 300, costo: 200 }, { inventario_id: 3, descripcion: 'Bujía NGK CR7HSA', cantidad: 2 }],
      pagoInicial: { monto: 100, metodo: 'Efectivo' } });
    const tr = A.trabajo(id); assert.equal(tr.placa, 'MZZ01'); assert.equal(tr.total, 150 + 300 + 250); assert.equal(tr.pagado, 100); assert.equal(tr.repuestosLista.length, 2);
    assert.equal(A.listarInventario().find(i => i.codigo === 'BUJ-CR7').stock, 10 - 1 - 2);
  });
  t('buscar placa existente trae cliente e historial', () => { const m = A.buscarPlaca('mab-1234'); assert.equal(m.cliente, 'Mario Hernández'); assert.equal(m.historial.length, 1); });
  t('editar trabajo reemplaza repuestos', () => { const tr = A.trabajo(5); A.guardarTrabajo({ ...tr, cliente_nombre: tr.cliente, cliente_tel: tr.telefono, repuestos: [{ descripcion: 'Cadena 428', cantidad: 1, precio: 320, costo: 200 }] }); assert.equal(A.trabajo(5).total, 150 + 320); });
  t('cambiar estado Entregado pone fecha y vence garantía', () => { const tr = A.cambiarEstado(5, 'Entregado'); assert.equal(tr.entrega, '2026-10-07'); assert.equal(tr.vence, '2026-10-22'); const t2 = A.cambiarEstado(5, 'Listo'); assert.equal(t2.entrega, null); A.cambiarEstado(5, 'Entregado'); });
  t('caja del día y cierre manual con conteo', () => {
    const c = A.cajaDia('2026-10-07'); assert.equal(c.cerrado, false); assert.equal(c.numeros.ingEf, 100);
    const r = A.cerrarDia('2026-10-07', 1500, 'conteo'); assert.equal(r.cerrado, true); assert.ok(typeof r.cierre.diferencia === 'number');
  });
  t('bloqueo de movimientos en día cerrado', () => {
    throwsMsg(() => A.guardarGasto({ fecha: '2026-10-07', categoria: 'Luz', monto: 10, metodo: 'Efectivo' }), /ya tiene la caja cerrada/);
    throwsMsg(() => A.agregarPago(3, { fecha: '2026-10-07', monto: 50, metodo: 'Efectivo' }), /cerrada/);
    A.reabrirDia('2026-10-07'); A.guardarGasto({ fecha: '2026-10-07', categoria: 'Luz', monto: 10, metodo: 'Efectivo' });
  });
  t('auto cierre a medianoche cierra días pasados', () => {
    fecha = new Date(2026, 9, 8, 0, 1); const n = A.autoCierre(); assert.ok(n >= 7, 'cerró ' + n);
    const c = A.cajaDia('2026-10-07'); assert.equal(c.cerrado, true); assert.equal(c.cierre.tipo, 'automático'); assert.equal(A.autoCierre(), 0);
  });
  t('cierre semanal exige 7 días', () => {
    throwsMsg(() => A.cerrarSemana('2026-10-05'), /Faltan/);
    fecha = new Date(2026, 9, 12, 0, 5); A.autoCierre();
    const s = A.cerrarSemana('2026-10-05', 'ok'); assert.ok(s.oficial); assert.equal(s.totales.ingEf, A.semanaCaja('2026-10-05').totales.ingEf);
    throwsMsg(() => A.reabrirDia('2026-10-07'), /Reabrí primero la semana/);
  });
  t('planilla: comisión, vales y pago congelado', () => {
    fecha = new Date(2026, 9, 12, 9, 0);
    const p = A.planillaSemana('2026-09-28'); const carlos = p.filas.find(f => f.empleado === 'Carlos');
    assert.ok(carlos); assert.equal(carlos.salario, 1500);
  });
  t('planilla de la semana actual paga y descuenta vales', () => {
    A.guardarVale({ fecha: '2026-10-12', empleado_id: 1, monto: 100, metodo: 'Efectivo' });
    const p = A.planillaSemana('2026-10-12'); const c = p.filas.find(f => f.empleado === 'Carlos'); assert.equal(c.vales, 100); assert.equal(c.neto, 1400);
    A.pagarPlanilla(c.id, 'Efectivo'); const p2 = A.planillaSemana('2026-10-12'); assert.equal(p2.filas.find(f => f.empleado === 'Carlos').estado, 'Pagado');
    throwsMsg(() => A.guardarVale({ fecha: '2026-10-13', empleado_id: 1, monto: 50, metodo: 'Efectivo' }), /ya está pagada/);
    assert.equal(A.cajaDia('2026-10-12').numeros.plaEf, 1400);
  });
  t('garantía y reclamo', () => { const g = A.garantias(); assert.ok(g.length >= 2); const id = A.reclamoGarantia(5, 'cadena suelta'); const r = A.trabajo(id); assert.equal(r.garantia_de, 5); assert.equal(r.total, 0); });
  t('recibos', () => { const tx = A.reciboTexto(1); assert.match(tx, /TOTAL: L 815.00/); assert.match(tx, /Garantía/); assert.match(A.reciboTexto(4, 'listo'), /lista para retirar/); assert.match(A.reciboHTML(2), /RECIBO DE TRABAJO/); });
  t('compras pendientes y pago', () => { const p = A.comprasPendientes(); assert.equal(p.length, 1); A.pagarCompra(p[0].id, 'Transferencia', '2026-10-12'); assert.equal(A.cajaDia('2026-10-12').numeros.comTr, 560); });
  t('borrar con restricciones', () => { throwsMsg(() => A.borrarCliente(1), /trabajos/); throwsMsg(() => A.borrarInventario(1), /compras|trabajos/); throwsMsg(() => A.borrarTrabajo(1), /cerrada/); });
  t('reportes y panel', () => { const r = A.reportes(); assert.ok(r.semanas.length >= 2); assert.ok(r.semanas.some(s => s.oficial)); const p = A.inicioPanel(); assert.ok(p.nActivos >= 1); });
  t('exportar', () => { const e = A.exportarTodo(); assert.ok(e.Trabajos.length >= 5); assert.ok(e['Cierres semanales'].length === 1); });
  t('persistencia: exportar y reabrir la base', () => { const bin = db.export(); const db2 = new SQL.Database(bin); const B2 = crearBackend(db2, { ahora: () => fecha }); assert.equal(B2.api.listarTrabajos().length, A.listarTrabajos().length); });
  t('config: garantías y empleados', () => { const i = A.guardarConfig({ garantias: [{ dias: 60, nombre: '2 meses' }, { dias: 8, nombre: '8 días' }], empleados: [{ nombre: 'Ana', puesto: 'Caja', salario: 900, comision: 0 }] });
    assert.equal(i.config.garantias[0].dias, 0); assert.equal(i.config.garantias.length, 3); assert.ok(i.empleados.some(e => e.nombre === 'Ana')); });
  t('comisión compartida 50/50 y 70/30', () => {
    const db3 = new SQL.Database(); const C = crearBackend(db3, { ahora: () => fecha }).api;
    C.guardarConfig({ empleados: [{ nombre: 'Pedro', puesto: 'Mecánico', salario: 1000, comision: 10 }, { nombre: 'Juan', puesto: 'Mecánico', salario: 1000, comision: 20 }] });
    const emp = n => C.init().empleados.find(e => e.nombre === n).id, P = emp('Pedro'), J = emp('Juan');
    const a = C.guardarTrabajo({ cliente_nombre: 'X', descripcion: 'Motor', mano_obra: 400, mecanico_id: P, mecanico2_id: J });
    assert.equal(C.trabajo(a).reparto, 50); assert.match(C.trabajo(a).mecanicos, /Pedro 50% \/ Juan 50%/);
    const b = C.guardarTrabajo({ cliente_nombre: 'Y', descripcion: 'Frenos', mano_obra: 100, mecanico_id: P, mecanico2_id: J, reparto: 70 });
    const c = C.guardarTrabajo({ cliente_nombre: 'Z', descripcion: 'Aceite', mano_obra: 50, mecanico_id: J, mecanico2_id: J });
    assert.equal(C.trabajo(c).mecanico2_id, null); assert.equal(C.trabajo(c).reparto, 100);
    [a, b, c].forEach(id => C.cambiarEstado(id, 'Entregado'));
    const pl = C.planillaSemana(C.init().lunes), fila = id => pl.filas.find(f => f.empleado_id === id);
    assert.equal(fila(P).mano_obra, 270); assert.equal(fila(P).comision, 27);   // 200 + 70
    assert.equal(fila(J).mano_obra, 280); assert.equal(fila(J).comision, 56);   // 200 + 30 + 50
    throwsMsg(() => C.guardarTrabajo({ cliente_nombre: 'W', descripcion: 'x', mano_obra: 10, mecanico_id: P, mecanico2_id: J, reparto: 100 }), /entre 1% y 99%/);
    assert.equal(C.borrarEmpleado(J), 'desactivado');
  });
  t('migración: base vieja sin columnas de comisión compartida', () => {
    const db4 = new SQL.Database(); crearBackend(db4, { ahora: () => fecha });
    db4.run('ALTER TABLE trabajos DROP COLUMN mecanico2_id'); db4.run('ALTER TABLE trabajos DROP COLUMN reparto');
    const D = crearBackend(db4, { ahora: () => fecha }).api;
    const id = D.guardarTrabajo({ cliente_nombre: 'Viejo', descripcion: 'x', mano_obra: 100 }); assert.equal(D.trabajo(id).reparto, 100);
  });
  // ---------- regresiones de la auditoría v1.2 ----------
  const nuevoB = d => { const box = { f: d }; const X = crearBackend(new SQL.Database(), { ahora: () => box.f }).api; return { X, set: v => { box.f = v; } }; };
  const emps = X => { X.guardarConfig({ empleados: [{ nombre: 'Pedro', puesto: 'Mecánico', salario: 1000, comision: 10 }] }); return X.init().empleados.find(e => e.nombre === 'Pedro').id; };
  t('montos con coma de miles', () => {
    const { X } = nuevoB(new Date(2026, 9, 7, 10)); const id = X.guardarTrabajo({ cliente_nombre: 'A', descripcion: 'x', mano_obra: '1,500' });
    assert.equal(X.trabajo(id).total, 1500); assert.equal(X.agregarPago(id, { monto: '1,200.50', metodo: 'Efectivo' }).pagado, 1200.5);
  });
  t('no se paga dos veces una planilla ni una compra', () => {
    const { X } = nuevoB(new Date(2026, 9, 7, 10)); emps(X); const f = X.planillaSemana('2026-10-05').filas[0];
    X.pagarPlanilla(f.id, 'Efectivo'); throwsMsg(() => X.pagarPlanilla(f.id, 'Efectivo'), /ya está pagada/);
    const c = X.guardarCompra({ descripcion: 'Tornillos', cantidad: 1, costo: 50, estado: 'Pagado', metodo: 'Efectivo' });
    throwsMsg(() => X.pagarCompra(c, 'Efectivo'), /ya está pagada/);
  });
  t('fechas futuras bloqueadas', () => {
    const { X } = nuevoB(new Date(2026, 9, 7, 10)); const id = X.guardarTrabajo({ cliente_nombre: 'A', descripcion: 'x', mano_obra: 100 });
    throwsMsg(() => X.agregarPago(id, { monto: 50, metodo: 'Efectivo', fecha: '2027-01-01' }), /futura/);
  });
  t('día reabierto no se vuelve a cerrar solo', () => {
    const { X } = nuevoB(new Date(2026, 9, 7, 10)); X.guardarGasto({ fecha: '2026-10-05', monto: 10, metodo: 'Efectivo' });
    X.autoCierre(); assert.ok(X.cajaDia('2026-10-05').cerrado);
    X.reabrirDia('2026-10-05'); X.autoCierre(); assert.equal(X.cajaDia('2026-10-05').cerrado, false);
    X.guardarGasto({ fecha: '2026-10-05', monto: 5, metodo: 'Efectivo' }); X.cerrarDia('2026-10-05', 985, '');
    assert.equal(X.cajaDia('2026-10-06').esperado, 985); // el día siguiente recalcula: 1000 - 15
  });
  t('comisión: no se paga doble al re-entregar, ni se pierde si la planilla ya se pagó', () => {
    const { X, set } = nuevoB(new Date(2026, 9, 5, 10)); const P = emps(X);
    const a = X.guardarTrabajo({ cliente_nombre: 'A', descripcion: 'x', mano_obra: 1000, mecanico_id: P }); X.cambiarEstado(a, 'Entregado');
    const f1 = X.planillaSemana('2026-10-05').filas[0]; assert.equal(f1.comision, 100); X.pagarPlanilla(f1.id, 'Efectivo');
    set(new Date(2026, 9, 13, 10)); X.cambiarEstado(a, 'Listo'); X.cambiarEstado(a, 'Entregado');
    assert.equal(X.planillaSemana('2026-10-12').filas[0].comision, 0);
    const b = X.guardarTrabajo({ cliente_nombre: 'B', descripcion: 'y', mano_obra: 500, mecanico_id: P });
    X.pagarPlanilla(X.planillaSemana('2026-10-12').filas[0].id, 'Efectivo'); X.cambiarEstado(b, 'Entregado');
    assert.equal(X.planillaSemana('2026-10-19').filas[0].comision, 50);
  });
  t('vale de una planilla pagada no se puede mover', () => {
    const { X } = nuevoB(new Date(2026, 9, 7, 10)); const P = emps(X); const v = X.guardarVale({ fecha: '2026-10-06', empleado_id: P, monto: 300, metodo: 'Efectivo' });
    X.pagarPlanilla(X.planillaSemana('2026-10-05').filas[0].id, 'Efectivo');
    throwsMsg(() => X.guardarVale({ id: v, fecha: '2026-10-07', empleado_id: P, monto: 300, metodo: 'Efectivo' }), /pagada/);
  });
  t('empleado nuevo no aparece debiendo semanas anteriores', () => {
    const { X } = nuevoB(new Date(2026, 9, 14, 10)); emps(X);
    assert.equal(X.planillaSemana('2026-10-05').filas.length, 0); assert.equal(X.planillaSemana('2026-10-12').filas.length, 1);
  });
  t('trabajo cancelado no conserva garantía', () => {
    const { X } = nuevoB(new Date(2026, 9, 7, 10)); const id = X.guardarTrabajo({ cliente_nombre: 'A', descripcion: 'x', mano_obra: 100, garantia_dias: 30 });
    X.cambiarEstado(id, 'Entregado'); assert.ok(X.trabajo(id).vence); X.cambiarEstado(id, 'Cancelado'); assert.equal(X.trabajo(id).vence, '');
  });
  t('ids inexistentes dan error claro', () => { const { X } = nuevoB(new Date(2026, 9, 7, 10)); throwsMsg(() => X.borrarGasto(999), /no encontrado/i); throwsMsg(() => X.borrarVale(999), /no encontrado/i); });
  console.log(`\n${ok} pruebas OK`);
})();
