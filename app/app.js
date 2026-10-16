'use strict';
/* global taller */
// ================================================================ utilidades
let INIT = null, VISTA = 'inicio', SUB = {}, CACHE = {}, SEMANA = null, DIA = null, DLG_RES = null, SYS = null;
let E = null, ACTUAL = null, SUCIO = false;               // editor de trabajo
const $ = id => document.getElementById(id);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const js = s => esc(String(s == null ? '' : s).replace(/['"\\]/g, ''));
const r2 = n => Math.round((Number(n) || 0) * 100) / 100;
const L = n => 'L ' + (Number(n) || 0).toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const F = s => { if (!s) return ''; const [y, m, d] = String(s).slice(0, 10).split('-'); return d ? `${d}/${m}/${y}` : s; };
const num = v => { const n = parseFloat(v); return isNaN(n) ? 0 : n; };
const sumar = (a, k, f) => a.filter(f || (() => true)).reduce((s, x) => s + (Number(x[k]) || 0), 0);
function addDays(iso, n) { const [y, m, d] = iso.split('-').map(Number); const x = new Date(y, m - 1, d + n); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); }
const diaSemana = iso => { const [y, m, d] = iso.split('-').map(Number); return new Date(y, m - 1, d).toLocaleDateString('es-HN', { weekday: 'short' }).replace('.', ''); };
const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
const fechaLarga = iso => { const [y, m, d] = iso.split('-').map(Number); const s = new Date(y, m - 1, d).toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }); return s.charAt(0).toUpperCase() + s.slice(1); };
const opt = (arr, sel, vacio) => (vacio ? `<option value="">${typeof vacio === 'string' ? esc(vacio) : '— Seleccionar —'}</option>` : '') + arr.map(x => { const v = typeof x === 'object' ? x.v : x, t = typeof x === 'object' ? x.t : x; return `<option value="${esc(v)}" ${String(v) === String(sel) ? 'selected' : ''}>${esc(t)}</option>`; }).join('');
const run = (fn, ...a) => taller.api(fn, ...a);
const sys = (fn, ...a) => taller.sys(fn, ...a);
function invalidar(...t) { t.forEach(x => delete CACHE[x]); }

const I = {
  home:'<rect x="3" y="3" width="7" height="9" rx="1.5"/><rect x="14" y="3" width="7" height="5" rx="1.5"/><rect x="14" y="12" width="7" height="9" rx="1.5"/><rect x="3" y="16" width="7" height="5" rx="1.5"/>',
  wrench:'<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
  wallet:'<path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"/><path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"/>',
  users:'<path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M22 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
  box:'<path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><path d="M3.3 7 12 12l8.7-5"/><path d="M12 22V12"/>',
  user:'<path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/>',
  bike:'<circle cx="18.5" cy="17.5" r="3.5"/><circle cx="5.5" cy="17.5" r="3.5"/><circle cx="15" cy="5" r="1"/><path d="M12 17.5V14l-3-3 4-3 2 3h2"/>',
  chart:'<path d="M3 3v18h18"/><path d="M18 17V9"/><path d="M13 17V5"/><path d="M8 17v-3"/>',
  gear:'<path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/>',
  plus:'<path d="M5 12h14"/><path d="M12 5v14"/>',
  search:'<circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/>',
  refresh:'<path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8"/><path d="M21 3v5h-5"/><path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16"/><path d="M8 16H3v5"/>',
  chevL:'<path d="m15 18-6-6 6-6"/>', chevR:'<path d="m9 18 6-6-6-6"/>',
  back:'<path d="m12 19-7-7 7-7"/><path d="M19 12H5"/>',
  x:'<path d="M18 6 6 18"/><path d="m6 6 12 12"/>',
  camera:'<path d="M14.5 4h-5L7 7H4a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2V9a2 2 0 0 0-2-2h-3l-2.5-3z"/><circle cx="12" cy="13" r="3"/>',
  file:'<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="M16 13H8"/><path d="M16 17H8"/><path d="M10 9H8"/>',
  edit:'<path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>',
  trash:'<path d="M3 6h18"/><path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6"/><path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2"/>',
  check:'<path d="M20 6 9 17l-5-5"/>',
  phone:'<path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/>',
  alert:'<path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><path d="M12 9v4"/><path d="M12 17h.01"/>',
  clock:'<circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>',
  cash:'<rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2"/><path d="M6 12h.01M18 12h.01"/>',
  bank:'<path d="M3 22h18"/><path d="M6 18v-7"/><path d="M10 18v-7"/><path d="M14 18v-7"/><path d="M18 18v-7"/><path d="m12 2 8 5H4z"/>',
  cart:'<circle cx="8" cy="21" r="1"/><circle cx="19" cy="21" r="1"/><path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12"/>',
  receipt:'<path d="M4 2v20l2-1 2 1 2-1 2 1 2-1 2 1 2-1 2 1V2l-2 1-2-1-2 1-2-1-2 1-2-1-2 1Z"/><path d="M16 8h-6a2 2 0 1 0 0 4h4a2 2 0 1 1 0 4H8"/><path d="M12 17.5v-11"/>',
  calendar:'<rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4"/><path d="M8 2v4"/><path d="M3 10h18"/>',
  gauge:'<path d="m12 14 4-4"/><path d="M3.34 19a10 10 0 1 1 17.32 0"/>',
  grid:'<rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/>',
  up:'<path d="m22 7-8.5 8.5-5-5L2 17"/><path d="M16 7h6v6"/>',
  down:'<path d="m22 17-8.5-8.5-5 5L2 7"/><path d="M16 17h6v-6"/>',
  link:'<path d="M15 3h6v6"/><path d="M10 14 21 3"/><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/>',
  ban:'<circle cx="12" cy="12" r="10"/><path d="m4.9 4.9 14.2 14.2"/>',
  coins:'<circle cx="8" cy="8" r="6"/><path d="M18.09 10.37A6 6 0 1 1 10.34 18"/><path d="M7 6h1v4"/><path d="m16.71 13.88.7.71-2.82 2.82"/>',
  tag:'<path d="M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"/><circle cx="7.5" cy="7.5" r="1"/>',
  shield:'<path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/>',
  arrowR:'<path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>',
  mapPin:'<path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/>',
};
const ic = (n, s = 18, w = 2) => `<svg class="ic" width="${s}" height="${s}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round">${I[n] || ''}</svg>`;
I.wa = '<path d="M3 21l1.65-3.8a9 9 0 1 1 3.4 2.9L3 21"/><path d="M9 10a.5.5 0 0 0 1 0V9a.5.5 0 0 0-1 0v1a5 5 0 0 0 5 5h1a.5.5 0 0 0 0-1h-1a.5.5 0 0 0 0 1"/>';
I.printer = '<path d="M6 9V2h12v7"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/>';
I.lock = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>';
I.unlock = '<rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 9.9-1"/>';
I.db = '<ellipse cx="12" cy="5" rx="9" ry="3"/><path d="M3 5v14a9 3 0 0 0 18 0V5"/><path d="M3 12a9 3 0 0 0 18 0"/>';
I.save = '<path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><path d="M17 21v-8H7v8"/><path d="M7 3v5h8"/>';
I.folder = '<path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"/>';
I.dots = '<circle cx="12" cy="12" r="1"/><circle cx="19" cy="12" r="1"/><circle cx="5" cy="12" r="1"/>';
I.excel = '<path d="M15 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7Z"/><path d="M14 2v4a2 2 0 0 0 2 2h4"/><path d="m8 13 4 5"/><path d="m12 13-4 5"/>';
I.download = '<path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><path d="m7 10 5 5 5-5"/><path d="M12 15V3"/>';
I.bell = '<path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/>';

// ---------------------------------------------------------------- piezas visuales
const EST_C = { 'En taller': 'orange', 'Esperando repuesto': 'violet', 'Listo': 'teal', 'Entregado': 'green', 'Cancelado': 'gray' };
const pill = (t, c) => `<span class="pill p-${c || 'slate'}"><i></i>${esc(t)}</span>`;
const pEst = e => pill(e || '—', EST_C[e] || 'slate');
const pPago = (e, saldo) => (Number(saldo) > 0.004 && e !== 'Cancelado') ? pill('Debe ' + L(saldo), 'red') : pill(e || '—', { Pagado: 'green', Pendiente: 'red', 'Sin cobro': 'slate', Cancelado: 'gray' }[e]);
const pAlerta = a => pill(a === 'OK' ? 'En stock' : a === 'REPONER' ? 'Reponer' : 'Agotado', { OK: 'green', REPONER: 'amber', AGOTADO: 'red' }[a]);
const met = m => m ? `<span class="tag">${ic(m === 'Transferencia' ? 'bank' : 'cash', 13)}${esc(m)}</span>` : '<span class="mut">—</span>';
const plate = p => p ? `<span class="plate">${esc(p)}</span>` : '<span class="mut">—</span>';
const AVC = [['#FFEDD5', '#C2410C'], ['#DBEAFE', '#1D4ED8'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FCE7F3', '#BE185D'], ['#CCFBF1', '#0F766E'], ['#FEF3C7', '#B45309'], ['#E0E7FF', '#4338CA']];
function av(n, cls) { const s = String(n || '?').trim() || '?'; const ini = s.split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase(); let h = 0; for (const ch of s) h = (h * 31 + ch.charCodeAt(0)) >>> 0; const [b, f] = AVC[h % AVC.length]; return `<span class="av ${cls || ''}" style="background:${b};color:${f}">${esc(ini)}</span>`; }
const who = (n, sub, cls) => `<div class="who">${av(n, cls)}<div style="min-width:0"><b>${esc(n || 'Sin nombre')}</b>${sub ? `<small>${sub}</small>` : ''}</div></div>`;
const kpi = (lab, val, icon, tone, hint, vcls) => `<div class="kpi"><div class="ico t-${tone}">${ic(icon, 19)}</div><div><div class="lab">${lab}</div><div class="val num ${vcls || ''}">${val}</div>${hint ? `<div class="hint">${hint}</div>` : ''}</div></div>`;
const vacio = (t, icon, sub) => `<div class="card"><div class="empty"><div class="ei">${ic(icon || 'search', 24)}</div><b>${t}</b>${sub ? `<div>${sub}</div>` : ''}</div></div>`;
const cardH = (t, icon, right, sub) => `<div class="card-h"><div><h3>${icon ? ic(icon, 17) : ''}${t}</h3>${sub ? `<div class="sub">${sub}</div>` : ''}</div>${right || ''}</div>`;
const neto = n => `<span class="${Number(n) < 0 ? 'neg' : ''}">${L(n)}</span>`;
function tabla(rows, cols, o = {}) {
  if (!rows.length) return o.head ? `<div class="card">${o.head}<div class="empty" style="padding:22px"><div class="ei">${ic(o.icono || 'search', 22)}</div><b>${o.vacio || 'Sin registros'}</b>${o.vsub ? `<div>${o.vsub}</div>` : ''}</div></div>` : vacio(o.vacio || 'Sin registros', o.icono || 'search', o.vsub);
  const at = x => o.click ? ` class="tap" onclick="${o.click(x)}"` : '';
  return `<div class="card p0">${o.head ? `<div style="padding:16px 18px 0">${o.head}</div>` : ''}<div class="tscroll"><table class="tbl"><thead><tr>${cols.map(c => `<th class="${c.c || ''}">${c.h}</th>`).join('')}</tr></thead><tbody>${rows.map(x => `<tr${at(x)}>${cols.map(c => `<td class="${c.c || ''}">${c.v(x)}</td>`).join('')}</tr>`).join('')}</tbody>${o.foot ? `<tfoot><tr>${o.foot}</tr></tfoot>` : ''}</table></div></div>`;
}
function tablaIn(rows, cols, click) {
  return `<div class="tscroll"><table class="tbl tbl-in"><thead><tr>${cols.map(c => `<th class="${c.c || ''}">${c.h}</th>`).join('')}</tr></thead><tbody>${rows.map(x => `<tr${click ? ` class="tap" onclick="${click(x)}"` : ''}${x._cls ? ` class="${x._cls}"` : ''}>${cols.map(c => `<td class="${c.c || ''}">${c.v(x)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}
function semanaPick(fn) {
  return `<div class="week"><button title="Semana anterior" onclick="SEMANA=addDays(SEMANA,-7);${fn}()">${ic('chevL', 16)}</button><span>${ic('calendar', 15)}${F(SEMANA).slice(0, 5)} – ${F(addDays(SEMANA, 6))}</span><button title="Semana siguiente" onclick="SEMANA=addDays(SEMANA,7);${fn}()">${ic('chevR', 16)}</button></div>${SEMANA !== INIT.lunes ? `<button class="btn btn-g btn-sm" onclick="SEMANA=INIT.lunes;${fn}()">Ir a esta semana</button>` : ''}`;
}
function buscador(id, ph, key, fn) {
  return `<div class="search">${ic('search', 17)}<input id="${id}" class="buscar" placeholder="${ph}" value="${esc(SUB[key] || '')}" oninput="SUB['${key}']=this.value;clearTimeout(window._t);window._t=setTimeout(()=>{${fn}();const e=$('${id}');if(e){e.focus();e.setSelectionRange(e.value.length,e.value.length)}},150)"></div>`;
}

// ---------------------------------------------------------------- avisos y diálogos
let NCARGA = 0;
async function carga(p) {
  NCARGA++; const t = setTimeout(() => { if (NCARGA) { $('bar').style.display = 'block'; } }, 120); $('block').style.display = 'block';
  try { return await p; }
  catch (e) { toast((e && e.message) || String(e), true); throw e; }
  finally { clearTimeout(t); if (--NCARGA <= 0) { NCARGA = 0; $('bar').style.display = $('block').style.display = 'none'; } }
}
function toast(m, err) { const t = $('toast'); t.innerHTML = ic(err ? 'alert' : 'check', 18, 2.4) + '<span>' + esc(m) + '</span>'; t.className = err ? 'err' : ''; t.style.display = 'flex'; clearTimeout(t._t); t._t = setTimeout(() => t.style.display = 'none', err ? 6000 : 3000); }
function elegir(titulo, msg, botones) {
  return new Promise(res => {
    DLG_RES = res;
    $('dlg2').innerHTML = `<div class="sheet sm"><div class="sheet-h"><div><h2>${esc(titulo)}</h2></div></div><div class="sheet-b" style="padding-bottom:18px;color:var(--ink2)">${msg}</div><div class="sheet-f"><span class="sp"></span>${botones.map((b, i) => `<button class="btn ${b.cls || 'btn-s'}" data-i="${i}">${b.t}</button>`).join('')}</div></div>`;
    $('dlg2').style.display = 'flex';
    $('dlg2').querySelectorAll('[data-i]').forEach(b => b.onclick = () => cerrarDlg(botones[b.dataset.i].v));
    $('dlg2').onclick = e => { if (e.target === $('dlg2')) cerrarDlg(null); };
    const p = $('dlg2').querySelector('.btn-p,.btn-dr,.wa'); if (p) p.focus();
  });
}
function cerrarDlg(v) { $('dlg2').style.display = 'none'; const r = DLG_RES; DLG_RES = null; if (r) r(v); }
const confirmar = (t, m, ok, peligro) => elegir(t, m, [{ t: 'Cancelar', v: false }, { t: ok || 'Confirmar', v: true, cls: peligro ? 'btn-dr' : 'btn-p' }]);
const elegirMetodo = (t, m) => elegir(t, m, [{ t: 'Cancelar', v: null, cls: 'btn-g' }, { t: ic('cash', 16) + 'Efectivo', v: 'Efectivo' }, { t: ic('bank', 16) + 'Transferencia', v: 'Transferencia' }]);

// ================================================================ navegación
const VIEWS = {
  inicio: { t: 'Inicio', i: 'home', f: () => vInicio() },
  trabajos: { t: 'Trabajos', i: 'wrench', s: 'Motos en el taller, entregas y cobros', f: () => vTrabajos() },
  trabajo: { nav: 'trabajos', f: () => vTrabajo() },
  inventario: { t: 'Inventario', i: 'box', s: 'Repuestos, existencias y precios', f: () => vInventario() },
  caja: { t: 'Caja del día', i: 'lock', s: 'Cierre diario y cierre oficial de la semana', f: () => vCaja() },
  movimientos: { t: 'Movimientos', i: 'wallet', s: 'Gastos, vales, compras y cobros', f: () => vMovimientos() },
  planilla: { t: 'Planilla', i: 'users', s: 'Pagos semanales del personal', f: () => vPlanilla() },
  reportes: { t: 'Reportes', i: 'chart', s: 'Semanas oficiales y meses', f: () => vReportes() },
  clientes: { t: 'Clientes', i: 'user', s: 'Directorio de clientes', f: () => vClientes() },
  motos: { t: 'Motos', i: 'bike', s: 'Motos registradas e historial', f: () => vMotos() },
  garantias: { t: 'Garantías', i: 'shield', s: 'Garantías vigentes, vencidas y reclamos', f: () => vGarantias() },
  config: { t: 'Configuración', i: 'gear', s: 'Datos del taller, empleados, garantías y WhatsApp', f: () => vConfig() },
  respaldos: { t: 'Respaldos', i: 'db', s: 'Base de datos local, copias de seguridad y Excel', f: () => vRespaldos() },
};
document.querySelectorAll('.nav').forEach(b => { const V = VIEWS[b.dataset.v]; b.innerHTML = ic(V.i, 18) + `<span>${V.t}</span>`; b.onclick = () => ir(b.dataset.v); });
$('s-logo').innerHTML = ic('wrench', 20, 2.2);

/** Si hay un trabajo con cambios sin guardar, pregunta qué hacer. Devuelve false si el usuario decide seguir editando. */
async function puedeSalirDelTrabajo() {
  if (VISTA !== 'trabajo' || !SUCIO) return true;
  const r = await elegir('Cambios sin guardar', 'Este trabajo tiene cambios que no guardaste.', [{ t: 'Descartar', v: 'no', cls: 'btn-d' }, { t: 'Seguir editando', v: null }, { t: ic('save', 16) + 'Guardar', v: 'si', cls: 'btn-p' }]);
  if (!r) return false;
  if (r === 'si') { const ok = await guardarTrabajo(true); if (!ok) return false; }
  SUCIO = false; return true;
}
async function ir(v, forzar) {
  if (!forzar && v !== 'trabajo' && !await puedeSalirDelTrabajo()) return;
  VISTA = v; const V = VIEWS[v];
  document.querySelectorAll('.nav').forEach(b => b.classList.toggle('on', b.dataset.v === (V.nav || v)));
  head(V.t || '', V.s || ''); accion(); cerrarModal(); $('h-extra').innerHTML = ''; window.scrollTo(0, 0);
  try { await V.f(); } catch (e) { console.error(e); }
}
function head(t, s) { $('h-t').textContent = t; $('h-s').textContent = s || ''; }
function accion(txt, icon, fn, kbd) {
  const a = $('h-act');
  if (!txt) { a.innerHTML = ''; return; }
  a.innerHTML = `<button class="btn btn-p">${ic(icon || 'plus', 17, 2.2)}<span>${txt}</span>${kbd ? `<span class="kbd">${kbd}</span>` : ''}</button>`; a.firstChild.onclick = fn;
}
async function iniciar() {
  INIT = await carga(run('init'));
  $('b-name').textContent = INIT.config.taller || 'Taller'; document.title = INIT.config.taller || 'Taller';
  if (!SEMANA) SEMANA = INIT.lunes; if (!DIA) DIA = INIT.hoy;
  try { SYS = await sys('info'); pieRespaldo(); } catch (e) { /* modo navegador */ }
}
function pieRespaldo() {
  if (!SYS) return;
  const u = SYS.respaldos.archivos[0];
  $('s-foot').innerHTML = `Base de datos local · sin internet<br><span style="color:#64748B">${u ? 'Último respaldo: ' + new Date(u.fecha).toLocaleString('es-HN', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) : 'Sin respaldos aún'}</span>`;
}
const EMPS = () => INIT.empleados.filter(e => e.activo).map(e => ({ v: e.id, t: e.nombre }));
const METODOS = () => INIT.metodos;

// ================================================================ formulario genérico (modal)
const CAMPOS = {
  cliente: [['nombre', 'Nombre completo'], ['telefono', 'Teléfono / WhatsApp', 'tel'], ['direccion', 'Dirección'], ['notas', 'Notas', 'area']],
  moto: [['placa', 'Placa'], ['cliente_id', 'Dueño', 'sel', () => (CACHE.clientes || []).map(c => ({ v: c.id, t: c.nombre + (c.telefono ? ' · ' + c.telefono : '') }))],
    ['marca', 'Marca'], ['modelo', 'Modelo'], ['anio', 'Año', 'num'], ['cc', 'Cilindraje (cc)', 'num'], ['color', 'Color'], ['vin', 'Chasis / VIN'], ['notas', 'Notas', 'area']],
  inventario: [['codigo', 'Código (opcional)'], ['descripcion', 'Descripción'], ['categoria', 'Categoría', 'sel', () => INIT.config.catRepuestos], ['compatible', 'Compatible con'],
    ['proveedor', 'Proveedor'], ['ubicacion', 'Ubicación en bodega'], ['costo', 'Costo unitario (L)', 'num'], ['precio', 'Precio de venta (L)', 'num'], ['stock_inicial', 'Existencia inicial (al registrarlo; las compras y ventas se suman solas)', 'num'], ['minimo', 'Stock mínimo', 'num']],
  gasto: [['fecha', 'Fecha', 'date'], ['categoria', 'Categoría', 'sel', () => INIT.config.catGastos], ['monto', 'Monto (L)', 'num'], ['metodo', 'Método de pago', 'sel', METODOS], ['descripcion', 'Descripción', 'area']],
  vale: [['fecha', 'Fecha', 'date'], ['empleado_id', 'Empleado', 'sel', EMPS], ['monto', 'Monto (L)', 'num'], ['metodo', 'Método', 'sel', METODOS], ['nota', 'Nota', 'area']],
  compra: [['fecha', 'Fecha de compra', 'date'], ['inventario_id', 'Repuesto del inventario (opcional)', 'sel', () => (CACHE.inventario || []).map(i => ({ v: i.id, t: (i.codigo ? i.codigo + ' · ' : '') + i.descripcion }))],
    ['descripcion', 'Descripción (si no está en inventario)'], ['cantidad', 'Cantidad', 'num'], ['costo', 'Costo unitario (L)', 'num'], ['proveedor', 'Proveedor'], ['factura', 'N.º de factura'],
    ['estado', 'Estado', 'sel', () => ['Pagado', 'Pendiente']], ['metodo', 'Método de pago', 'sel', METODOS], ['fecha_pago', 'Fecha de pago (si fue otro día)', 'date']],
  pago: [['fecha', 'Fecha', 'date'], ['monto', 'Monto (L)', 'num'], ['metodo', 'Método', 'sel', METODOS], ['nota', 'Nota (anticipo, abono, liquidación)']],
  planilla: [['bonos', 'Bonos / extras (L)', 'num'], ['deducciones', 'Deducciones (L)', 'num']],
};
function campoHTML([k, lab, tipo, ops], val) {
  const v = val == null ? '' : val; let inp;
  if (tipo === 'sel') inp = `<select id="fm-${k}">${opt(ops(), v, true)}</select>`;
  else if (tipo === 'area') inp = `<textarea id="fm-${k}">${esc(v)}</textarea>`;
  else { const t = tipo === 'date' ? 'date' : 'text', im = tipo === 'num' ? 'inputmode="decimal"' : tipo === 'tel' ? 'inputmode="tel"' : ''; inp = `<input id="fm-${k}" type="${t}" ${im} value="${esc(v)}">`; }
  return `<div class="fld ${tipo === 'area' ? 'full' : ''}"><label for="fm-${k}">${lab}</label>${inp}</div>`;
}
/** o = {campos, titulo, sub, datos, guardar(datos), borrar?(), extra, alGuardar} */
function formulario(o) {
  const campos = CAMPOS[o.campos]; const d = o.datos || {};
  $('modal').innerHTML = `<div class="sheet"><div class="sheet-h"><div><h2>${esc(o.titulo)}</h2>${o.sub ? `<div class="sub">${esc(o.sub)}</div>` : ''}</div><button class="btn btn-g btn-ic" onclick="cerrarModal()" title="Cerrar (Esc)">${ic('x', 18)}</button></div>
    <div class="sheet-b">${o.extra || ''}<div class="fgrid">${campos.map(c => campoHTML(c, d[c[0]])).join('')}</div></div>
    <div class="sheet-f">${o.borrar ? `<button class="btn btn-d" id="fm-del">${ic('trash', 16)}Eliminar</button>` : ''}<span class="sp"></span><button class="btn btn-s" onclick="cerrarModal()">Cancelar</button><button class="btn btn-p" id="fm-ok">${ic('check', 16, 2.4)}Guardar</button></div></div>`;
  $('modal').style.display = 'flex';
  $('modal').onclick = e => { if (e.target === $('modal')) cerrarModal(); };
  const f = $('modal').querySelector('.sheet-b input,.sheet-b select,.sheet-b textarea'); if (f) f.focus();
  $('fm-ok').onclick = async () => {
    const datos = Object.assign({}, d.id ? { id: d.id } : {});
    campos.forEach(([k]) => datos[k] = $('fm-' + k).value.trim());
    const r = await carga(o.guardar(datos));
    cerrarModal(); toast('Cambios guardados'); if (o.alGuardar) o.alGuardar(r);
  };
  if ($('fm-del')) $('fm-del').onclick = async () => {
    if (!await confirmar('Eliminar registro', 'Este registro se eliminará definitivamente. Esta acción no se puede deshacer.', 'Eliminar', true)) return;
    await carga(o.borrar()); cerrarModal(); toast('Registro eliminado'); if (o.alGuardar) o.alGuardar(null);
  };
}
function cerrarModal() { $('modal').style.display = 'none'; }
document.addEventListener('keydown', e => {
  const k = e.key.toLowerCase();
  if (e.key === 'Escape') { if ($('dlg2').style.display === 'flex') return cerrarDlg(null); if ($('modal').style.display === 'flex') return cerrarModal(); document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); }
  if (e.key === 'Enter' && $('modal').style.display === 'flex' && $('dlg2').style.display !== 'flex' && e.target.tagName === 'INPUT' && $('fm-ok')) { e.preventDefault(); $('fm-ok').click(); }
  if (e.ctrlKey && k === 'n') { e.preventDefault(); nuevoTrabajo(); }
  if (e.ctrlKey && k === 's' && VISTA === 'trabajo') { e.preventDefault(); guardarTrabajo(); }
  if (e.ctrlKey && k === 'f') { const b = document.querySelector('.buscar'); if (b) { e.preventDefault(); b.focus(); b.select(); } }
});
document.addEventListener('click', e => { if (!e.target.closest('.menu-wrap')) document.querySelectorAll('.menu.open').forEach(m => m.classList.remove('open')); if (!e.target.closest('.rel')) document.querySelectorAll('.sugg').forEach(s => s.remove()); });
async function cargarInv(forzar) { if (!CACHE.inventario || forzar) CACHE.inventario = await carga(run('listarInventario')); $('dl-inv').innerHTML = CACHE.inventario.map(i => `<option value="${esc(i.descripcion)}">${esc((i.codigo ? i.codigo + ' · ' : '') + 'stock ' + i.stock + ' · ' + L(i.precio))}</option>`).join(''); return CACHE.inventario; }

// ================================================================ INICIO
async function vInicio() {
  head('Inicio', fechaLarga(INIT.hoy));
  if (INIT.vacio) {
    $('main').innerHTML = `<div class="welcome"><div class="logo">${ic('wrench', 30, 2.2)}</div><div style="flex:1"><h2>Bienvenido al sistema del taller</h2>
      <p>Todo se guarda en esta PC, sin internet, con respaldos automáticos todos los días. Empezá configurando los datos del taller y los empleados, o cargá datos de ejemplo para conocer el programa.</p></div>
      <div class="flex"><button class="btn btn-s" onclick="cargarEjemplo()">${ic('file', 16)}Cargar datos de ejemplo</button><button class="btn btn-p" onclick="ir('config')">${ic('gear', 16)}Configurar el taller</button></div></div>
      <div class="cards">
        <div class="card"><h3 class="mt0">${ic('wrench', 17)} 1. Registrá trabajos</h3><p class="hint">Cliente, moto, qué se le hizo, repuestos y cobro, todo en una sola pantalla. <span class="kbd">Ctrl</span><span class="kbd">N</span></p></div>
        <div class="card"><h3 class="mt0">${ic('lock', 17)} 2. Cerrá la caja cada día</h3><p class="hint">Contás el efectivo y queda el cierre. Si se te olvida, se cierra solo a medianoche.</p></div>
        <div class="card"><h3 class="mt0">${ic('chart', 17)} 3. Cierre oficial de la semana</h3><p class="hint">Con los 7 días cerrados sale la cuenta oficial de la semana y lo que hay que retirar.</p></div>
      </div>`;
    accion('Nuevo trabajo', 'plus', nuevoTrabajo, 'Ctrl+N');
    return;
  }
  const p = await carga(run('inicioPanel'));
  const s = p.semana, c = p.caja;
  const hora = new Date().getHours(), saludo = hora < 12 ? 'Buenos días' : hora < 18 ? 'Buenas tardes' : 'Buenas noches';
  const al = [];
  if (p.semanaAnteriorSinCierre) al.push({ i: 'lock', t: 'orange', x: `La semana del ${F(p.semanaAnteriorSinCierre)} no tiene <b>cierre oficial</b>`, a: `SEMANA='${p.semanaAnteriorSinCierre}';DIA='${p.semanaAnteriorSinCierre}';ir('caja')` });
  if (p.listosSinAviso) al.push({ i: 'bell', t: 'teal', x: `${p.listosSinAviso} moto(s) listas sin avisar al cliente`, a: "SUB.trab='Listo';ir('trabajos')" });
  if (p.bajo.length) al.push({ i: 'box', t: 'red', x: `${p.bajo.length} repuesto(s) por reponer o agotados`, a: "SUB.inv='bajo';ir('inventario')" });
  if (p.planillaPendAnterior > 0) al.push({ i: 'users', t: 'amber', x: `Planilla de la semana pasada pendiente: <b>${L(p.planillaPendAnterior)}</b>`, a: "SEMANA=addDays(INIT.lunes,-7);ir('planilla')" });
  if (p.comprasPend > 0) al.push({ i: 'cart', t: 'violet', x: `Compras pendientes con proveedores: <b>${L(p.comprasPend)}</b>`, a: "SUB.mov='compras';ir('movimientos')" });
  if (p.garantiasPorVencer) al.push({ i: 'shield', t: 'blue', x: `${p.garantiasPorVencer} garantía(s) vencen en los próximos 7 días`, a: "ir('garantias')" });
  const est = Object.entries(p.porEstado); const mx = Math.max(1, ...est.map(e => e[1]));
  $('main').innerHTML = `
    <div class="hello"><div><h2>${saludo}</h2><p>Así va ${esc(INIT.config.taller)} hoy.</p></div></div>
    <div class="kpis">
      ${kpi('Cobrado hoy', L(c.numeros.ing), 'cash', 'green', `Efectivo ${L(c.numeros.ingEf)} · Transf. ${L(c.numeros.ingTr)}`)}
      ${kpi('Neto de la semana', L(s.neto), 'wallet', 'orange', `Ingresos ${L(s.ing)} · Egresos ${L(s.egr)}`, s.neto < 0 ? 'neg' : '')}
      ${kpi('Por cobrar', L(p.porCobrar), 'receipt', 'red', `${p.nConSaldo} trabajo(s) con saldo`)}
      ${kpi('Motos en el taller', p.nActivos, 'bike', 'blue', `${p.listos} lista(s) para entregar`)}
    </div>
    <div class="cols">
      <div>
        ${tabla(p.activos, [
          { h: 'Trabajo', v: t => `<b class="ficha">${esc(t.numero)}</b><div class="mut small">${F(t.fecha)} · ${t.dias} día(s)</div>` },
          { h: 'Cliente', v: t => esc(t.cliente || '—') }, { h: 'Moto', v: t => plate(t.placa) + (t.moto ? `<div class="mut small">${esc(t.moto)}</div>` : '') },
          { h: 'Estado', v: t => pEst(t.estado) }, { h: 'Saldo', c: 'r', v: t => t.saldo > 0.004 ? `<span class="neg">${L(t.saldo)}</span>` : `<span class="mut">${L(0)}</span>` },
        ], { click: t => `abrirTrabajo(${t.id})`, vacio: 'No hay motos en el taller', icono: 'bike', vsub: 'Tocá "Nuevo trabajo" para registrar una.',
             head: cardH('Motos en el taller', 'wrench', `<button class="btn btn-s btn-sm" onclick="SUB.trab='activos';ir('trabajos')">Ver todos ${ic('arrowR', 14)}</button>`) })}
        <div class="kpis" style="grid-template-columns:repeat(3,1fr)">
          ${kpi('Neto del mes', L(p.mes.neto), 'chart', 'violet', `Ingresos ${L(p.mes.ing)}`, p.mes.neto < 0 ? 'neg' : '')}
          ${kpi('Entregados esta semana', s.entregados, 'check', 'green', `Mano de obra ${L(s.manoObra)}`)}
          ${kpi('Valor en bodega', L(p.valorInv), 'box', 'slate')}
        </div>
      </div>
      <div>
        <div class="card ${c.cerrado ? 'cierre-box ok' : ''}">${cardH('Caja de hoy', 'lock', c.cerrado ? pill('Cerrada', 'green') : pill('Abierta', 'orange'))}
          <div class="flex"><div class="grow"><div class="hint">Neto del día</div><div class="big-num">${neto(c.numeros.neto)}</div></div>
          <button class="btn ${c.cerrado ? 'btn-s' : 'btn-p'}" onclick="DIA=INIT.hoy;SEMANA=INIT.lunes;ir('caja')">${ic(c.cerrado ? 'file' : 'lock', 16)}${c.cerrado ? 'Ver cierre' : 'Cerrar caja'}</button></div></div>
        <div class="card">${cardH('Accesos rápidos', 'grid')}
          <div class="quick">
            <button class="qa" onclick="nuevoTrabajo()"><span class="ico t-orange">${ic('plus', 18)}</span>Nuevo trabajo</button>
            <button class="qa" onclick="nuevoMov('gastos')"><span class="ico t-red">${ic('receipt', 18)}</span>Registrar gasto</button>
            <button class="qa" onclick="nuevoMov('vales')"><span class="ico t-amber">${ic('coins', 18)}</span>Registrar vale</button>
            <button class="qa" onclick="nuevoMov('compras')"><span class="ico t-violet">${ic('cart', 18)}</span>Registrar compra</button>
          </div></div>
        <div class="card">${cardH('Pendientes', 'alert', '', al.length ? '' : 'Todo al día')}
          ${al.map(x => `<div class="alert" onclick="${x.a}"><span class="ico t-${x.t}">${ic(x.i, 17)}</span><span class="t">${x.x}</span>${ic('chevR', 16)}</div>`).join('') || `<div class="empty" style="padding:14px"><div class="ei" style="background:#F0FDF4;color:#16A34A">${ic('check', 24)}</div>Sin pendientes por ahora</div>`}</div>
        ${est.length ? `<div class="card">${cardH('Taller por estado', 'gauge')}${est.map(([k, v]) => `<div class="bar-row"><span>${esc(k)}</span><div class="track"><div class="fill" style="width:${v / mx * 100}%"></div></div><b class="num" style="text-align:right">${v}</b></div>`).join('')}</div>` : ''}
      </div>
    </div>`;
  accion('Nuevo trabajo', 'plus', nuevoTrabajo, 'Ctrl+N');
}
async function cargarEjemplo() {
  if (!await confirmar('Cargar datos de ejemplo', 'Se van a crear clientes, motos, trabajos y movimientos de ejemplo para que conozcás el programa. Después los podés borrar restaurando un respaldo o empezando de cero.', 'Cargar ejemplo')) return;
  await carga(run('cargarEjemplo')); CACHE = {}; await iniciar(); toast('Datos de ejemplo cargados'); ir('inicio', true);
}

// ================================================================ TRABAJOS (lista)
async function vTrabajos() { CACHE.trabajos = await carga(run('listarTrabajos')); pTrabajos(); accion('Nuevo trabajo', 'plus', nuevoTrabajo, 'Ctrl+N'); }
function pTrabajos() {
  const ts = CACHE.trabajos, f = SUB.trab || 'activos', q = (SUB.tq || '').toLowerCase();
  const FI = { activos: t => !['Entregado', 'Cancelado'].includes(t.estado), Listo: t => t.estado === 'Listo', saldo: t => t.estado_pago === 'Pendiente', Entregado: t => t.estado === 'Entregado', todos: () => true };
  const l = ts.filter(FI[f]).filter(t => !q || [t.numero, t.cliente, t.telefono, t.placa, t.moto, t.descripcion, t.mecanicos].join(' ').toLowerCase().includes(q));
  const n = k => ts.filter(FI[k]).length;
  $('main').innerHTML = `
    <div class="kpis">
      ${kpi('En el taller', n('activos'), 'wrench', 'orange')}
      ${kpi('Listos para entregar', n('Listo'), 'check', 'teal')}
      ${kpi('Por cobrar', L(sumar(ts, 'saldo', FI.saldo)), 'receipt', 'red', `${n('saldo')} trabajo(s)`)}
      ${kpi('Total de trabajos', ts.length, 'file', 'slate')}
    </div>
    <div class="toolbar">${buscador('tq', 'Buscar por cliente, teléfono, placa, moto, trabajo o número…', 'tq', 'pTrabajos')}
      <div class="chips">${[['activos', 'En taller'], ['Listo', 'Listos'], ['saldo', 'Con saldo'], ['Entregado', 'Entregados'], ['todos', 'Todos']].map(([k, t]) => `<span class="chip ${k === f ? 'on' : ''}" onclick="SUB.trab='${k}';pTrabajos()">${t} <b>${n(k)}</b></span>`).join('')}</div></div>
    ${tabla(l, [
      { h: 'Trabajo', v: t => `<b class="ficha">${esc(t.numero)}</b><div class="mut small">${F(t.fecha)}</div>` },
      { h: 'Cliente', v: t => `<b style="font-weight:600">${esc(t.cliente || '—')}</b>${t.telefono ? `<div class="mut small">${esc(t.telefono)}</div>` : ''}` },
      { h: 'Moto', v: t => plate(t.placa) + (t.moto ? `<div class="mut small">${esc(t.moto)}</div>` : '') },
      { h: 'Qué se hace', v: t => `<div class="small" style="max-width:280px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(t.descripcion || '—')}</div>${t.garantia_de ? `<div class="small" style="color:#1D4ED8">${ic('shield', 12)} Reclamo de garantía</div>` : ''}` },
      { h: 'Estado', v: t => pEst(t.estado) },
      { h: 'Total', c: 'r', v: t => `<b>${L(t.total)}</b>` },
      { h: 'Pago', v: t => pPago(t.estado_pago, t.saldo) },
    ], { click: t => `abrirTrabajo(${t.id})`, vacio: 'No hay trabajos aquí', icono: 'wrench', vsub: q ? 'Probá con otra búsqueda.' : 'Tocá "Nuevo trabajo" para registrar uno.' })}`;
}

// ================================================================ TRABAJO (editor único: nuevo y existente)
async function nuevoTrabajo() {
  if (!await puedeSalirDelTrabajo()) return;
  ACTUAL = null;
  E = { id: null, fecha: INIT.hoy, cliente_id: null, cliente_nombre: '', cliente_tel: '', placa: '', marca: '', modelo: '', anio: '', color: '', km: '',
    descripcion: '', falla: '', estado_recibe: '', mecanico_id: '', mecanico2_id: '', reparto: 50, mano_obra: '', descuento: '', garantia_dias: INIT.config.garantiaDefecto, garantia_cubre: INIT.config.coberturaDefecto,
    notas: '', repuestos: [], pagoInicial: { monto: '', metodo: 'Efectivo' } };
  SUCIO = false; ir('trabajo', true);
}
async function abrirTrabajo(id) {
  if (ACTUAL && ACTUAL.id === id && VISTA === 'trabajo') return;
  if (!await puedeSalirDelTrabajo()) return;
  const t = await carga(run('trabajo', id)); ACTUAL = t; cargarEditor(t); SUCIO = false; ir('trabajo', true);
}
function cargarEditor(t) {
  E = { id: t.id, fecha: t.fecha, cliente_id: t.cliente_id, cliente_nombre: t.cliente || '', cliente_tel: t.telefono || '', placa: t.placa || '', marca: t.marca || '', modelo: t.modelo || '',
    anio: t.anio || '', color: t.color || '', km: t.km || '', descripcion: t.descripcion || '', falla: t.falla || '', estado_recibe: t.estado_recibe || '', mecanico_id: t.mecanico_id || '', mecanico2_id: t.mecanico2_id || '', reparto: t.mecanico2_id ? t.reparto : 50,
    mano_obra: t.mano_obra || '', descuento: t.descuento || '', garantia_dias: t.garantia_dias || 0, garantia_cubre: t.garantia_cubre || '', notas: t.notas || '',
    repuestos: t.repuestosLista.map(r => ({ inventario_id: r.inventario_id, descripcion: r.descripcion, cantidad: r.cantidad, precio: r.precio, costo: r.costo })) };
}
const marcarSucio = () => { if (!SUCIO) { SUCIO = true; const b = document.querySelector('.savebar'); if (b) b.classList.add('is-dirty'); } };
function setE(k, v) { E[k] = v; marcarSucio(); if (['mano_obra', 'descuento'].includes(k)) pintarTotales(); if (k === 'mano_obra') pintarRepartoTexto(); }
const totRep = () => r2(E.repuestos.reduce((s, r) => s + num(r.cantidad) * num(r.precio), 0));
const totalE = () => r2(num(E.mano_obra) + totRep() - num(E.descuento));
const inp = (k, ph, extra) => `<input value="${esc(E[k])}" placeholder="${esc(ph || '')}" oninput="setE('${k}',this.value)" ${extra || ''}>`;

async function vTrabajo() {
  await cargarInv();
  const t = ACTUAL, nuevo = !E.id;
  head(nuevo ? 'Nuevo trabajo' : `Trabajo ${t.numero}`, nuevo ? 'Recepción de la moto' : [t.cliente, t.placa, t.moto].filter(Boolean).join(' · '));
  const estados = ['En taller', 'Esperando repuesto', 'Listo', 'Entregado'];
  if (!nuevo) {
    $('h-extra').innerHTML = `
      <button class="btn btn-sm wa" onclick="enviarWA('recibo')" title="Enviar el recibo por WhatsApp">${ic('wa', 16)}Enviar recibo</button>
      <div class="menu-wrap"><button class="btn btn-s btn-sm" onclick="this.nextElementSibling.classList.toggle('open')">${ic('dots', 16)}Más</button>
        <div class="menu">
          <button onclick="enviarWA('listo')">${ic('bell', 16)}Avisar por WhatsApp que está lista</button>
          <button onclick="imprimirRecibo()">${ic('printer', 16)}Imprimir recibo</button>
          <button onclick="pdfRecibo()">${ic('file', 16)}Guardar recibo en PDF</button>
          ${t.vence ? `<button onclick="reclamo()">${ic('shield', 16)}Registrar reclamo de garantía</button>` : ''}
          <hr>${t.estado !== 'Cancelado' ? `<button onclick="cancelarTrabajo()">${ic('ban', 16)}Cancelar trabajo</button>` : `<button onclick="cambiarEstado('En taller')">${ic('refresh', 16)}Reactivar trabajo</button>`}
          <button class="danger" onclick="eliminarTrabajo()">${ic('trash', 16)}Eliminar trabajo</button>
        </div></div>`;
  }
  const g = INIT.config.garantias;
  $('main').innerHTML = `
  <div class="flex" style="margin-bottom:14px"><button class="btn btn-g btn-sm" onclick="ir('trabajos')">${ic('back', 16)}Trabajos</button><span class="sp"></span>
    ${nuevo ? '' : `<div class="estados">${estados.map(e => `<button class="${t.estado === e ? 'on' : ''} e-${EST_C[e]}" onclick="cambiarEstado('${e}')"><i></i>${e}</button>`).join('')}</div>`}</div>
  ${!nuevo && t.estado === 'Cancelado' ? `<div class="card" style="background:#F4F4F5;display:flex;gap:10px;align-items:center">${ic('ban', 18)}<b>Trabajo cancelado.</b><span class="hint">No cuenta como venta. Usá "Más → Reactivar" para volver a abrirlo.</span></div>` : ''}
  ${!nuevo && t.garantia_de ? `<div class="card" style="background:#EFF6FF;border-color:#BFDBFE;display:flex;gap:10px;align-items:center;color:#1E3A8A">${ic('shield', 18)}<span>Este trabajo es un <b>reclamo de garantía</b> de <a href="#" onclick="abrirTrabajo(${t.garantia_de});return false">${t.garantia_de_numero}</a>.</span></div>` : ''}
  <div class="ed">
    <div>
      <div class="card">${cardH('Cliente y moto', 'user')}
        <div class="fgrid">
          <div class="fld rel"><label>Cliente</label><input id="e-cli" value="${esc(E.cliente_nombre)}" placeholder="Nombre del cliente" autocomplete="off" oninput="clienteInput(this.value)"></div>
          <div class="fld"><label>Teléfono / WhatsApp</label><input value="${esc(E.cliente_tel)}" placeholder="Ej: 9876-5432" inputmode="tel" oninput="setE('cliente_tel',this.value)"></div>
          <div class="fld"><label>Placa</label><input id="e-placa" value="${esc(E.placa)}" placeholder="Ej: MAB1234" style="text-transform:uppercase" oninput="setE('placa',this.value)" onchange="placaCambio(this.value)"></div>
          <div class="fld"><label>Kilometraje</label>${inp('km', 'Ej: 18500', 'inputmode="numeric"')}</div>
        </div>
        <div class="fgrid c3"><div class="fld"><label>Marca</label>${inp('marca', 'Honda, Yamaha…')}</div><div class="fld"><label>Modelo</label>${inp('modelo', 'XR150L, FZ…')}</div><div class="fld"><label>Año / color</label><div class="flex">${inp('anio', 'Año', 'style="width:90px"')}${inp('color', 'Color')}</div></div></div>
        <div id="e-cli-info"></div>
      </div>
      <div class="card">${cardH('Trabajo', 'wrench')}
        <div class="fld"><label>¿Qué se le hace a la moto?</label><textarea placeholder="Ej: Cambio de aceite, filtro y bujía; ajuste de carburador" oninput="setE('descripcion',this.value)">${esc(E.descripcion)}</textarea></div>
        <div class="fgrid">
          <div class="fld"><label>Falla que reporta el cliente</label><textarea style="min-height:64px" placeholder="Opcional" oninput="setE('falla',this.value)">${esc(E.falla)}</textarea></div>
          <div class="fld"><label>Estado de la moto al recibirla</label><textarea style="min-height:64px" placeholder="Golpes, rayones, faltantes… (opcional)" oninput="setE('estado_recibe',this.value)">${esc(E.estado_recibe)}</textarea></div>
          <div class="fld"><label>Mecánico</label><select onchange="setE('mecanico_id',this.value);pintarReparto()">${opt(EMPS(), E.mecanico_id, 'Sin asignar')}</select></div>
          <div class="fld"><label>Fecha de ingreso</label><input type="date" value="${esc(E.fecha)}" onchange="setE('fecha',this.value)"></div>
        </div>
        <div id="e-reparto"></div>
      </div>
      <div class="card">${cardH('Repuestos', 'box', `<span class="hint">Escribí el repuesto; si está en inventario se descuenta solo del stock</span>`)}
        <div id="e-reps"></div>
        <button class="btn btn-s" style="margin-top:10px" onclick="agregarFila()">${ic('plus', 16)}Agregar repuesto</button>
      </div>
      <div class="card">${cardH('Notas internas', 'file')}<textarea placeholder="Solo para el taller, no sale en el recibo" oninput="setE('notas',this.value)">${esc(E.notas)}</textarea></div>
    </div>
    <div class="sticky">
      <div class="card" id="e-cobro"></div>
      <div class="card">${cardH('Garantía', 'shield', !nuevo && t.vence ? pill((t.vence >= INIT.hoy ? 'Vigente hasta ' : 'Venció el ') + F(t.vence), t.vence >= INIT.hoy ? 'green' : 'gray') : '')}
        <div class="fgrid"><div class="fld"><label>Tiempo</label><select onchange="setE('garantia_dias',this.value)">${opt(g.map(x => ({ v: x.dias, t: x.nombre })), E.garantia_dias)}</select></div>
        <div class="fld"><label>Cubre</label><select onchange="setE('garantia_cubre',this.value)">${opt(INIT.config.coberturas, E.garantia_cubre, '—')}</select></div></div>
        <div class="hint">${nuevo || !t.entrega ? 'Empieza a contar cuando la moto se marca como entregada.' : 'Entregada el ' + F(t.entrega) + '.'}${!nuevo && t.reclamos.length ? ` Reclamos: ${t.reclamos.map(r => `<a href="#" onclick="abrirTrabajo(${r.id});return false">${r.numero}</a>`).join(', ')}` : ''}</div>
      </div>
      ${nuevo ? '' : `<div class="card">${cardH('Fotos', 'camera', `<label class="btn btn-s btn-sm" style="cursor:pointer">${ic('plus', 14)}Agregar<input type="file" accept="image/*" multiple style="display:none" onchange="subirFotos(this)"></label>`)}<div id="e-fotos"></div></div>`}
    </div>
  </div>
  <div class="savebar ${SUCIO ? 'is-dirty' : ''}"><span class="dirty">${ic('alert', 15)}Cambios sin guardar</span><span class="sp"></span>
    ${nuevo ? '' : `<span class="hint">Creado el ${F(t.fecha)}${t.mecanicos ? ' · ' + esc(t.mecanicos) : ''}</span>`}
    <button class="btn btn-s" onclick="ir('trabajos')">Cerrar</button>
    <button class="btn btn-p" onclick="guardarTrabajo()">${ic('save', 16)}${nuevo ? 'Crear trabajo' : 'Guardar cambios'}<span class="kbd">Ctrl+S</span></button></div>`;
  pintarReps(); pintarCobro(); pintarReparto(); if (!nuevo) pintarFotos();
  if (nuevo) $('e-cli').focus();
}
// --- cliente: sugerencias
function clienteInput(v) {
  setE('cliente_nombre', v); E.cliente_id = null; $('e-cli-info').innerHTML = '';
  clearTimeout(window._c);
  window._c = setTimeout(async () => {
    document.querySelectorAll('.sugg').forEach(s => s.remove());
    if (v.trim().length < 2) return;
    const r = await run('buscarClientes', v);
    if (!r.length) return;
    $('e-cli').insertAdjacentHTML('afterend', `<div class="sugg">${r.map(c => `<div data-id="${c.id}" onclick="elegirCliente(${c.id})">${av(c.nombre)}<div><b>${esc(c.nombre)}</b><div class="mut small">${esc(c.telefono || 'Sin teléfono')} · ${c.trabajos} trabajo(s)</div></div></div>`).join('')}</div>`);
  }, 200);
}
async function elegirCliente(id) {
  document.querySelectorAll('.sugg').forEach(s => s.remove());
  const c = await run('cliente', id);
  E.cliente_id = c.id; E.cliente_nombre = c.nombre; E.cliente_tel = c.telefono || ''; marcarSucio();
  const motos = c.motos;
  if (motos.length === 1 && !E.placa) usarMoto(motos[0]);
  vTrabajoRefrescarCampos();
  $('e-cli-info').innerHTML = `<div class="info-line">${ic('check', 14)}Cliente registrado · ${c.trabajosLista.length} trabajo(s) anteriores</div>${motos.length > 1 ? `<div class="chips-motos">${motos.map(m => `<span class="chip" onclick='usarMoto(${JSON.stringify(m).replace(/'/g, '&#39;')});vTrabajoRefrescarCampos()'>${ic('bike', 13)}${esc(m.placa || '')} ${esc(m.marca || '')} ${esc(m.modelo || '')}</span>`).join('')}</div>` : ''}`;
}
function usarMoto(m) { Object.assign(E, { placa: m.placa || '', marca: m.marca || '', modelo: m.modelo || '', anio: m.anio || '', color: m.color || '' }); marcarSucio(); }
function vTrabajoRefrescarCampos() {
  const ins = document.querySelectorAll('.ed .card:first-child input');
  const map = ['cliente_nombre', 'cliente_tel', 'placa', 'km', 'marca', 'modelo', 'anio', 'color'];
  ins.forEach((el, i) => { if (map[i] !== undefined) el.value = E[map[i]] || ''; });
}
async function placaCambio(v) {
  if (!v.trim()) return;
  const m = await run('buscarPlaca', v);
  if (!m || m.nueva) { $('e-cli-info').innerHTML = `<div class="info-line">${ic('plus', 14)}Placa nueva: se registra al guardar.</div>`; return; }
  E.placa = m.placa; if (!E.marca) E.marca = m.marca || ''; if (!E.modelo) E.modelo = m.modelo || ''; if (!E.anio) E.anio = m.anio || ''; if (!E.color) E.color = m.color || '';
  if (!E.cliente_nombre && m.cliente) { E.cliente_id = m.cliente_id; E.cliente_nombre = m.cliente; E.cliente_tel = m.telefono || ''; }
  vTrabajoRefrescarCampos();
  const otros = m.historial.filter(h => h.id !== E.id);
  $('e-cli-info').innerHTML = `<div class="info-line">${ic('bike', 14)}Moto registrada${m.cliente ? ' de <b>' + esc(m.cliente) + '</b>' : ''} · ${otros.length} visita(s) anterior(es)${otros[0] ? ` · última: ${F(otros[0].fecha)} (${esc(otros[0].descripcion || '').slice(0, 50)})` : ''}</div>`;
}
// --- comisión compartida
function pintarReparto() {
  const el = $('e-reparto'); if (!el) return;
  if (!E.mecanico_id) { el.innerHTML = ''; return; }
  const otros = EMPS().filter(x => String(x.v) !== String(E.mecanico_id));
  if (String(E.mecanico2_id) === String(E.mecanico_id)) E.mecanico2_id = '';
  const n1 = (EMPS().find(x => String(x.v) === String(E.mecanico_id)) || {}).t || 'Mecánico 1';
  const n2 = (otros.find(x => String(x.v) === String(E.mecanico2_id)) || {}).t || '';
  const r = num(E.reparto) || 50, mo = num(E.mano_obra);
  const chip = (a, b) => `<button type="button" class="chip ${Math.abs(r - a) < 0.05 ? 'on' : ''}" onclick="setE('reparto',${a});pintarReparto()">${a}/${b}</button>`;
  el.innerHTML = `<div class="reparto">
    <div class="fld" style="margin:0"><label>Comparte la comisión con (opcional)</label><select onchange="setE('mecanico2_id',this.value);pintarReparto()">${opt(otros, E.mecanico2_id, 'Nadie, es solo de ' + n1)}</select></div>
    ${E.mecanico2_id ? `<div class="reparto-ops"><label>Reparto de la mano de obra</label>
      <div class="flex wrap">${chip(50, 50)}${chip(60, 40)}${chip(70, 30)}
        <span class="hint" style="margin-left:4px">o</span><input class="pct" inputmode="decimal" value="${esc(r)}" oninput="setE('reparto',this.value);pintarRepartoTexto()" aria-label="Porcentaje de ${esc(n1)}"><span class="hint">% para ${esc(n1)}</span></div>
      <div class="hint" id="e-reparto-txt" style="margin-top:6px"></div></div>` : ''}
  </div>`;
  pintarRepartoTexto();
}
function pintarRepartoTexto() {
  const el = $('e-reparto-txt'); if (!el) return;
  const r = num(E.reparto), mo = num(E.mano_obra);
  const n1 = (EMPS().find(x => String(x.v) === String(E.mecanico_id)) || {}).t || 'Mecánico 1';
  const n2 = (EMPS().find(x => String(x.v) === String(E.mecanico2_id)) || {}).t || 'Mecánico 2';
  if (!(r > 0 && r < 100)) { el.innerHTML = '<span style="color:var(--bad)">El porcentaje tiene que estar entre 1 y 99.</span>'; return; }
  el.innerHTML = `${esc(n1)}: <b>${r}%</b>${mo ? ' (' + L(mo * r / 100) + ' de mano de obra)' : ''} · ${esc(n2)}: <b>${r2(100 - r)}%</b>${mo ? ' (' + L(mo * (100 - r) / 100) + ')' : ''}. A cada uno se le aplica su % de comisión en la planilla.`;
}
// --- repuestos
function agregarFila() { E.repuestos.push({ inventario_id: null, descripcion: '', cantidad: 1, precio: '', costo: '' }); marcarSucio(); pintarReps(); const ins = document.querySelectorAll('#e-reps .c-desc input'); if (ins.length) ins[ins.length - 1].focus(); }
function quitarFila(i) { E.repuestos.splice(i, 1); marcarSucio(); pintarReps(); pintarCobro(); }
function repCampo(i, k, v) {
  const r = E.repuestos[i]; r[k] = v; marcarSucio();
  if (k === 'descripcion') {
    const s = v.trim().toLowerCase();
    const it = (CACHE.inventario || []).find(x => x.descripcion.toLowerCase() === s || (x.codigo && x.codigo.toLowerCase() === s));
    const antes = r.inventario_id;
    r.inventario_id = it ? it.id : null;
    if (it && it.id !== antes) { r.descripcion = it.descripcion; if (r.precio === '' || r.precio == null || num(r.precio) === 0) r.precio = it.precio; if (r.costo === '' || r.costo == null || num(r.costo) === 0) r.costo = it.costo; pintarReps(); }
    else { const tag = document.querySelector(`#e-reps tr[data-i="${i}"] .inv`); if (tag) tag.outerHTML = invTag(r); }
  }
  const sub = document.querySelector(`#e-reps tr[data-i="${i}"] .c-sub`); if (sub) sub.textContent = L(num(r.cantidad) * num(r.precio));
  pintarTotales();
}
function invTag(r) {
  const it = r.inventario_id ? (CACHE.inventario || []).find(x => x.id === r.inventario_id) : null;
  return it ? `<div class="inv">${ic('box', 12)}Del inventario${it.codigo ? ' · ' + esc(it.codigo) : ''} · stock ${it.stock}</div>` : `<div class="inv no">${r.descripcion ? 'Repuesto externo (no descuenta inventario)' : ''}</div>`;
}
function pintarReps() {
  const el = $('e-reps'); if (!el) return;
  if (!E.repuestos.length) { el.innerHTML = `<div class="hint">Sin repuestos. Si el trabajo solo es mano de obra, dejalo así.</div>`; return; }
  el.innerHTML = `<table class="reps"><thead><tr><th>Repuesto</th><th class="c-cant">Cant.</th><th class="c-pre">Precio venta</th><th class="c-cos">Costo</th><th class="c-sub" style="padding-top:0">Subtotal</th><th class="c-x"></th></tr></thead><tbody>
    ${E.repuestos.map((r, i) => `<tr data-i="${i}">
      <td class="c-desc"><input list="dl-inv" value="${esc(r.descripcion)}" placeholder="Escribí o elegí del inventario" oninput="repCampo(${i},'descripcion',this.value)">${invTag(r)}</td>
      <td class="c-cant"><input inputmode="decimal" value="${esc(r.cantidad)}" oninput="repCampo(${i},'cantidad',this.value)"></td>
      <td class="c-pre"><input inputmode="decimal" value="${esc(r.precio)}" placeholder="0.00" oninput="repCampo(${i},'precio',this.value)"></td>
      <td class="c-cos"><input inputmode="decimal" value="${esc(r.costo)}" placeholder="opcional" title="Lo que le costó al taller (para calcular la ganancia)" oninput="repCampo(${i},'costo',this.value)"></td>
      <td class="c-sub">${L(num(r.cantidad) * num(r.precio))}</td>
      <td class="c-x"><button class="btn btn-g btn-ic" title="Quitar" onclick="quitarFila(${i})">${ic('trash', 15)}</button></td></tr>`).join('')}</tbody></table>`;
}
// --- cobro
function pintarTotales() {
  const set = (id, v) => { const e = $(id); if (e) e.textContent = v; };
  const tot = totalE(), pag = ACTUAL ? num(ACTUAL.pagado) : num(E.pagoInicial && E.pagoInicial.monto);
  set('c-rep', L(totRep())); set('c-tot', L(tot)); set('c-saldo', L(tot - pag));
  const sb = $('c-saldo-box'); if (sb) sb.className = 'saldo ' + (tot - pag > 0.004 ? 'debe' : 'ok');
}
function pintarCobro() {
  const t = ACTUAL, nuevo = !E.id, el = $('e-cobro'); if (!el) return;
  const pag = nuevo ? 0 : num(t.pagado), tot = totalE();
  el.innerHTML = `${cardH('Cobro', 'receipt')}
    <div class="sumrow"><span>Mano de obra</span><input inputmode="decimal" value="${esc(E.mano_obra)}" placeholder="0.00" oninput="setE('mano_obra',this.value)"></div>
    <div class="sumrow"><span>Repuestos</span><b id="c-rep">${L(totRep())}</b></div>
    <div class="sumrow"><span>Descuento</span><input inputmode="decimal" value="${esc(E.descuento)}" placeholder="0.00" oninput="setE('descuento',this.value)"></div>
    <div class="total-big"><span>Total</span><span id="c-tot">${L(tot)}</span></div>
    ${nuevo ? `<div style="border-top:1px solid var(--line2);margin-top:12px;padding-top:12px"><div class="lbl">Anticipo / pago al recibir (opcional)</div>
        <div class="fgrid"><div class="fld"><input inputmode="decimal" placeholder="Monto L" value="${esc(E.pagoInicial.monto)}" oninput="E.pagoInicial.monto=this.value;pintarTotales()"></div>
        <div class="fld"><select onchange="E.pagoInicial.metodo=this.value">${opt(METODOS(), E.pagoInicial.metodo)}</select></div></div></div>`
      : `<div class="sumrow" style="margin-top:6px"><span>Pagado</span><b class="pos">${L(pag)}</b></div>
        <div class="saldo ${tot - pag > 0.004 ? 'debe' : 'ok'}" id="c-saldo-box"><span class="l">Saldo</span><span class="v num" id="c-saldo">${L(tot - pag)}</span></div>
        <div class="lbl" style="margin-top:14px">Pagos</div>
        ${t.pagosLista.map(p => `<div class="li tap" onclick="editarPago(${p.id})"><div>${met(p.metodo)} <span class="small mut">${F(p.fecha)}</span>${p.nota ? `<div class="small mut" style="margin-top:3px">${esc(p.nota)}</div>` : ''}</div><b class="num">${L(p.monto)}</b></div>`).join('') || '<div class="hint" style="margin-bottom:6px">Todavía no hay pagos.</div>'}
        <div style="border-top:1px solid var(--line2);margin-top:8px;padding-top:12px"><div class="fgrid">
          <div class="fld"><label>Monto (L)</label><input id="pg-monto" inputmode="decimal" value="${t.saldo > 0.004 ? r2(t.saldo) : ''}"></div>
          <div class="fld"><label>Método</label><select id="pg-met">${opt(METODOS(), 'Efectivo')}</select></div>
          <div class="fld"><label>Fecha</label><input type="date" id="pg-fecha" value="${INIT.hoy}"></div>
          <div class="fld"><label>Nota</label><input id="pg-nota" placeholder="Anticipo / liquidación"></div></div>
          <button class="btn btn-p w" onclick="cobrar()">${ic('cash', 17)}Registrar pago</button></div>
        <div class="small mut" style="margin-top:10px;display:flex;justify-content:space-between"><span>Ganancia estimada</span><b class="num" style="color:var(--ink2)">${L(t.utilidad)}</b></div>`}`;
}
let GUARDANDO = false;
async function guardarTrabajo(silencioso) {
  if (GUARDANDO) return false;
  const d = Object.assign({}, E);
  if (!d.descripcion.trim() && !d.repuestos.some(r => r.descripcion) && !num(d.mano_obra)) { toast('Escribí qué se le hace a la moto', true); return false; }
  const nuevo = !d.id;
  GUARDANDO = true;
  try {
    const id = await carga(run('guardarTrabajo', d));
    SUCIO = false; invalidar('inventario', 'trabajos');
    const t = await run('trabajo', id); ACTUAL = t; cargarEditor(t);
    if (!silencioso) { toast(nuevo ? `Trabajo ${t.numero} creado` : 'Cambios guardados'); ir('trabajo', true); }
    return true;
  } catch (e) { return false; } finally { GUARDANDO = false; }
}
async function asegurarGuardado() { if (!E.id || SUCIO) return guardarTrabajo(true); return true; }
async function cambiarEstado(e) {
  if (!await asegurarGuardado()) return;
  const t = ACTUAL;
  if (e === t.estado) return;
  if (e === 'Entregado' && t.saldo > 0.004 && !await confirmar('Entregar con saldo pendiente', `Este trabajo todavía debe <b>${L(t.saldo)}</b>. ¿Marcarlo como entregado de todos modos?`, 'Sí, entregar')) return;
  ACTUAL = await carga(run('cambiarEstado', t.id, e)); cargarEditor(ACTUAL); invalidar('trabajos'); toast('Estado: ' + e); ir('trabajo', true);
  if (e === 'Listo' && ACTUAL.telefono) { if (await confirmar('Moto lista', `¿Avisarle a <b>${esc(ACTUAL.cliente)}</b> por WhatsApp que ya puede pasar a retirarla?`, ic('wa', 16) + 'Avisar por WhatsApp')) enviarWA('listo'); }
  if (e === 'Entregado' && ACTUAL.telefono) { if (await confirmar('Moto entregada', `¿Enviarle el recibo a <b>${esc(ACTUAL.cliente)}</b> por WhatsApp?${ACTUAL.vence ? ' Incluye la garantía hasta el ' + F(ACTUAL.vence) + '.' : ''}`, ic('wa', 16) + 'Enviar recibo')) enviarWA('recibo'); }
}
async function cancelarTrabajo() {
  if (!await asegurarGuardado()) return;
  if (!await confirmar('Cancelar trabajo', 'El trabajo queda registrado pero <b>no cuenta como venta</b>. Si el cliente dejó un anticipo, devolvelo y borrá ese pago. Podés reactivarlo después.', 'Cancelar trabajo', true)) return;
  cambiarEstado('Cancelado');
}
async function eliminarTrabajo() {
  if (!await confirmar('Eliminar ' + ACTUAL.numero, 'Se eliminará el trabajo con sus repuestos, pagos y fotos. <b>No se puede deshacer.</b><br><br>Si el trabajo no se hizo, es mejor <b>cancelarlo</b>.', 'Eliminar definitivamente', true)) return;
  await carga(run('borrarTrabajo', ACTUAL.id)); invalidar('trabajos', 'inventario'); SUCIO = false; toast('Trabajo eliminado'); ir('trabajos', true);
}
async function cobrar() {
  const p = { monto: $('pg-monto').value, metodo: $('pg-met').value, fecha: $('pg-fecha').value, nota: $('pg-nota').value };
  if (!(num(p.monto) > 0)) return toast('Escribí el monto', true);
  if (SUCIO && !await guardarTrabajo(true)) return;
  ACTUAL = await carga(run('agregarPago', ACTUAL.id, p)); invalidar('trabajos'); toast('Pago registrado'); pintarCobro();
  if (ACTUAL.saldo <= 0.004 && ACTUAL.estado !== 'Entregado' && ACTUAL.estado !== 'Cancelado') {
    if (await confirmar('Trabajo pagado', '¿Marcar la moto como <b>entregada</b>?', 'Marcar entregada')) cambiarEstado('Entregado');
  }
}
function editarPago(id) {
  const p = ACTUAL.pagosLista.find(x => x.id === id);
  formulario({ campos: 'pago', titulo: 'Editar pago', sub: ACTUAL.numero + ' · ' + (ACTUAL.cliente || ''), datos: p,
    guardar: d => run('editarPago', id, d), borrar: () => run('borrarPago', id), alGuardar: async () => { ACTUAL = await run('trabajo', ACTUAL.id); pintarCobro(); invalidar('trabajos'); } });
}
async function reclamo() {
  const r = await elegir('Reclamo de garantía', `Se va a crear un trabajo nuevo, sin costo de mano de obra, ligado a <b>${ACTUAL.numero}</b>.<br><br><label class="hint">¿Qué reporta el cliente?</label><input id="rec-nota" placeholder="Ej: la cadena volvió a sonar" style="margin-top:6px">`,
    [{ t: 'Cancelar', v: null }, { t: ic('shield', 16) + 'Crear reclamo', v: 'ok', cls: 'btn-p' }]);
  if (!r) return;
  const nota = (document.getElementById('rec-nota') || {}).value || '';
  const id = await carga(run('reclamoGarantia', ACTUAL.id, nota)); toast('Reclamo creado'); abrirTrabajo(id);
}
// --- recibos y WhatsApp
async function enviarWA(tipo) {
  if (!await asegurarGuardado()) return;
  if (!ACTUAL.telefono) {
    const r = await elegir('Falta el teléfono', `<label class="hint">Escribí el número de WhatsApp de ${esc(ACTUAL.cliente || 'el cliente')}</label><input id="wa-tel" inputmode="tel" placeholder="Ej: 9876-5432" style="margin-top:6px">`, [{ t: 'Cancelar', v: null }, { t: 'Guardar y enviar', v: 'ok', cls: 'btn-p' }]);
    const tel = r && (document.getElementById('wa-tel') || {}).value; if (!tel) return;
    E.cliente_tel = tel; await guardarTrabajo(true);
  }
  const texto = await run('reciboTexto', ACTUAL.id, tipo);
  try {
    const modo = await sys('whatsapp', ACTUAL.telefono, texto);
    if (tipo === 'listo') await run('marcarAvisado', ACTUAL.id);
    toast(modo === 'app' ? 'Se abrió WhatsApp con el mensaje listo para enviar' : 'Se abrió WhatsApp Web con el mensaje listo para enviar');
  } catch (e) { toast(e.message, true); }
}
async function imprimirRecibo() {
  if (!await asegurarGuardado()) return;
  const html = await run('reciboHTML', ACTUAL.id);
  const f = $('print'); f.srcdoc = html; f.onload = () => { f.contentWindow.focus(); f.contentWindow.print(); f.onload = null; };
}
async function pdfRecibo() { if (!await asegurarGuardado()) return; const f = await carga(sys('reciboPDF', ACTUAL.id)); toast('Recibo guardado: ' + f.split(/[\\/]/).pop() + ' (podés arrastrarlo a WhatsApp)'); }
// --- fotos
function reducir(file) { return new Promise((ok, no) => { const img = new Image(); img.onload = () => { const k = Math.min(1, 1600 / Math.max(img.width, img.height)); const c = document.createElement('canvas'); c.width = img.width * k; c.height = img.height * k; c.getContext('2d').drawImage(img, 0, 0, c.width, c.height); ok(c.toDataURL('image/jpeg', .82).split(',')[1]); URL.revokeObjectURL(img.src); }; img.onerror = no; img.src = URL.createObjectURL(file); }); }
async function subirFotos(input) {
  const files = [...input.files]; if (!files.length) return;
  const etapa = await elegir('¿De qué son las fotos?', `${files.length} foto(s) seleccionada(s).`, [{ t: 'Al recibir', v: 'recibida' }, { t: 'Pieza cambiada', v: 'pieza' }, { t: 'Al entregar', v: 'entrega', cls: 'btn-p' }]);
  if (!etapa) return;
  const fotos = []; for (const f of files) fotos.push({ base64: await reducir(f) });
  await carga(sys('guardarFotos', ACTUAL.id, fotos, etapa));
  ACTUAL = await run('trabajo', ACTUAL.id); pintarFotos(); toast(files.length + ' foto(s) guardadas');
}
function urlFoto(rel) { const base = (SYS && SYS.fotos || '').replace(/\\/g, '/'); return 'file:///' + (base + '/' + rel.replace(/\\/g, '/')).replace(/^\/+/, ''); }
function pintarFotos() {
  const el = $('e-fotos'); if (!el) return;
  const fs = ACTUAL.fotosLista;
  el.innerHTML = fs.length ? `<div class="fotos">${fs.map(f => `<div class="f" onclick="sys('abrirFoto','${js(f.archivo.replace(/\\/g, '/'))}')"><img src="${esc(urlFoto(f.archivo))}" loading="lazy"><small>${esc({ recibida: 'Al recibir', pieza: 'Pieza cambiada', entrega: 'Al entregar' }[f.etapa] || f.etapa || '')}</small><button title="Borrar" onclick="event.stopPropagation();borrarFoto(${f.id})">${ic('x', 14)}</button></div>`).join('')}</div>`
    : '<div class="hint">Sin fotos. Tomá fotos del estado de la moto al recibirla: es tu respaldo ante cualquier reclamo.</div>';
}
async function borrarFoto(id) { if (!await confirmar('Borrar foto', '¿Borrar esta foto?', 'Borrar', true)) return; await carga(sys('borrarFoto', id)); ACTUAL = await run('trabajo', ACTUAL.id); pintarFotos(); }

// ================================================================ CAJA DEL DÍA
async function vCaja() {
  if (!DIA) DIA = INIT.hoy;
  const [c, s] = await Promise.all([carga(run('cajaDia', DIA)), carga(run('semanaCaja', DIA))]);
  const n = c.numeros, futuro = DIA > INIT.hoy;
  const filas = [['Cobros de trabajos', n.ingEf, n.ingTr, '+'], ['Gastos', n.gasEf, n.gasTr, '-'], ['Compras de repuestos', n.comEf, n.comTr, '-'], ['Vales', n.valEf, n.valTr, '-'], ['Planilla pagada', n.plaEf, n.plaTr, '-']];
  const cerrado = c.cerrado, ci = c.cierre;
  const estadoDia = d => d.cerrado ? (d.tipo === 'automático' ? `<span class="st st-a">${ic('clock', 11)}Auto</span>` : `<span class="st st-m">${ic('check', 11)}Cerrado</span>`) : d.futuro ? '<span class="st st-f">—</span>' : `<span class="st st-o">${ic('unlock', 11)}Abierto</span>`;
  head('Caja del día', fechaLarga(DIA));
  $('main').innerHTML = `
  <div class="toolbar">
    <div class="daypick"><button onclick="DIA=addDays(DIA,-1);vCaja()" title="Día anterior">${ic('chevL', 16)}</button><input type="date" value="${DIA}" onchange="if(this.value){DIA=this.value;vCaja()}"><button onclick="DIA=addDays(DIA,1);vCaja()" title="Día siguiente">${ic('chevR', 16)}</button></div>
    ${DIA !== INIT.hoy ? `<button class="btn btn-g btn-sm" onclick="DIA=INIT.hoy;vCaja()">Hoy</button>` : ''}
    <span class="sp"></span>${cerrado ? pill(ci.tipo === 'automático' ? 'Cerrado automáticamente' : 'Caja cerrada', ci.tipo === 'automático' ? 'blue' : 'green') : futuro ? pill('Día futuro', 'slate') : pill('Caja abierta', 'orange')}
  </div>
  <div class="semana-strip">${s.dias.map(d => `<div class="dia ${d.fecha === DIA ? 'sel' : ''}" onclick="DIA='${d.fecha}';vCaja()"><b>${diaSemana(d.fecha)}</b><div class="d">${d.fecha.slice(8)}</div>${estadoDia(d)}</div>`).join('')}</div>
  <div class="cols even">
    <div class="card">${cardH('Resumen del día', 'wallet', '', cerrado ? `Números congelados al cerrar · ${new Date(ci.cerrado_en).toLocaleString('es-HN', { dateStyle: 'short', timeStyle: 'short' })}` : 'Se actualiza con cada movimiento')}
      ${tablaIn(filas.concat([['Neto del día', n.netoEf, n.netoTr, '=']]).map(f => ({ f, _cls: f[3] === '=' ? 'tot' : '' })), [
        { h: 'Concepto', v: x => (x.f[3] === '-' ? '<span class="mut">−</span> ' : x.f[3] === '+' ? '<span class="pos">+</span> ' : '') + esc(x.f[0]) },
        { h: 'Efectivo', c: 'r', v: x => x.f[3] === '=' ? neto(x.f[1]) : L(x.f[1]) }, { h: 'Transferencia', c: 'r', v: x => x.f[3] === '=' ? neto(x.f[2]) : L(x.f[2]) },
        { h: 'Total', c: 'r', v: x => x.f[3] === '=' ? `<b>${neto(r2(x.f[1] + x.f[2]))}</b>` : L(r2(x.f[1] + x.f[2])) }])}
      <div class="hint" style="margin-top:10px">Trabajos recibidos: <b>${n.recibidos}</b> · Entregados: <b>${n.entregados}</b> · Mano de obra entregada: <b>${L(n.manoObra)}</b></div>
    </div>
    <div class="card">${cardH(cerrado ? 'Cierre del día' : 'Cerrar caja', 'lock')}
      <div class="flex" style="align-items:flex-start;margin-bottom:14px"><div class="grow"><div class="hint">Efectivo que debería haber en caja</div><div class="big-num">${L(c.esperado)}</div>
        <div class="hint">Fondo fijo ${L(c.fondo)} + efectivo neto acumulado de la semana hasta este día</div></div></div>
      ${cerrado ? `<div class="cierre-box ${ci.tipo === 'automático' ? 'auto' : 'ok'}">
          <div class="flex"><div class="grow"><b>${ci.tipo === 'automático' ? 'Cerrado automáticamente a medianoche' : 'Cerrado manualmente'}</b><div class="hint">${new Date(ci.cerrado_en).toLocaleString('es-HN')}</div></div>${ic(ci.tipo === 'automático' ? 'clock' : 'check', 22)}</div>
          ${ci.efectivo_contado != null ? `<div class="sumrow" style="margin-top:10px"><span>Efectivo contado</span><b>${L(ci.efectivo_contado)}</b></div><div class="sumrow"><span>Diferencia</span><b class="difer ${ci.diferencia < 0 ? 'neg' : ci.diferencia > 0 ? 'pos' : ''}">${ci.diferencia > 0 ? '+' : ''}${L(ci.diferencia)}</b></div>` : '<div class="hint" style="margin-top:8px">Sin conteo de efectivo (cierre automático con los números del sistema).</div>'}
          ${ci.nota ? `<div class="hint" style="margin-top:6px">Nota: ${esc(ci.nota)}</div>` : ''}</div>
          <div class="flex" style="margin-top:12px">${c.semanaCerrada ? `<span class="hint">${ic('lock', 14)} La semana ya tiene cierre oficial.</span>` : `<button class="btn btn-s" onclick="reabrirDia()">${ic('unlock', 16)}Reabrir día</button><span class="hint">Reabrir permite corregir movimientos de este día.</span>`}</div>`
      : futuro ? '<div class="hint">Este día todavía no llega.</div>'
        : `<div class="fgrid"><div class="fld"><label>Efectivo contado en caja (L)</label><input id="cj-contado" inputmode="decimal" placeholder="Contá los billetes y monedas" oninput="difCaja(${c.esperado})"></div>
          <div class="fld"><label>Diferencia</label><div class="big-num" id="cj-dif" style="font-size:22px;padding-top:6px">—</div></div>
          <div class="fld full"><label>Nota (opcional)</label><input id="cj-nota" placeholder="Ej: faltaron L 20 de cambio"></div></div>
          <button class="btn btn-p w" onclick="cerrarDia()">${ic('lock', 16)}Cerrar caja del ${F(DIA)}</button>
          <div class="hint" style="margin-top:8px">Al cerrar, los movimientos de este día quedan bloqueados. Si nadie cierra, el sistema lo cierra solo a medianoche con sus números.</div>`}
    </div>
  </div>
  ${tabla(c.movimientos, [{ h: 'Tipo', v: m => `<span class="tag">${esc(m.tipo)}</span>` }, { h: 'Detalle', v: m => esc(m.detalle) }, { h: 'Método', v: m => met(m.metodo) },
      { h: 'Entrada', c: 'r', v: m => m.entrada ? `<span class="pos">${L(m.entrada)}</span>` : '' }, { h: 'Salida', c: 'r', v: m => m.salida ? `<span class="neg">${L(m.salida)}</span>` : '' }],
    { head: cardH('Movimientos del día', 'file', '', `${c.movimientos.length} movimiento(s)`), vacio: 'Sin movimientos este día', icono: 'file' })}
  <div class="card">${cardH(`Semana del ${F(s.semana)} al ${F(s.domingo)}`, 'calendar', s.oficial ? pill('Cierre oficial', 'green') : pill(`${s.dias.filter(d => d.cerrado).length} de 7 días cerrados`, s.todosCerrados ? 'teal' : 'orange'))}
    ${s.oficial ? `<div class="oficial" style="margin-bottom:14px"><div class="ico">${ic('check', 22, 2.6)}</div><div class="grow"><b>Semana cerrada oficialmente</b><div class="hint">${new Date(s.oficial.cerrado_en).toLocaleString('es-HN')}${s.oficial.nota ? ' · ' + esc(s.oficial.nota) : ''}</div></div>
        <div class="right"><div class="hint">Efectivo a retirar</div><div class="big-num" style="font-size:22px">${L(s.oficial.datos.efectivoRetirar)}</div></div></div>` : ''}
    ${tablaIn([['Ingresos', 'ingEf', 'ingTr'], ['Gastos', 'gasEf', 'gasTr'], ['Compras', 'comEf', 'comTr'], ['Vales', 'valEf', 'valTr'], ['Planilla', 'plaEf', 'plaTr'], ['NETO DE LA SEMANA', 'netoEf', 'netoTr']].map(f => ({ f, _cls: f[0].startsWith('NETO') ? 'tot' : '' })), [
      { h: 'Concepto', v: x => esc(x.f[0]) }, { h: 'Efectivo', c: 'r', v: x => x.f[0].startsWith('NETO') ? neto(s.totales[x.f[1]]) : L(s.totales[x.f[1]]) },
      { h: 'Transferencia', c: 'r', v: x => x.f[0].startsWith('NETO') ? neto(s.totales[x.f[2]]) : L(s.totales[x.f[2]]) },
      { h: 'Total', c: 'r', v: x => `<b>${neto(r2(num(s.totales[x.f[1]]) + num(s.totales[x.f[2]])))}</b>` }])}
    <div class="flex" style="margin-top:14px">
      <div class="hint grow">${s.oficial ? 'Para corregir algo de esta semana, primero reabrí el cierre oficial.' : s.todosCerrados ? 'Los 7 días están cerrados: ya podés hacer el cierre oficial. El efectivo neto de la semana es lo que se retira; en caja queda el fondo fijo.' : 'El cierre oficial se habilita cuando los 7 días estén cerrados (el domingo a medianoche se cierra solo si nadie lo hizo).'}</div>
      ${s.oficial ? `<button class="btn btn-s" onclick="reabrirSemana('${s.semana}')">${ic('unlock', 16)}Reabrir semana</button>` : `<button class="btn btn-p" ${s.todosCerrados ? '' : 'disabled'} onclick="cerrarSemana('${s.semana}')">${ic('lock', 16)}Cierre oficial de la semana</button>`}
    </div></div>`;
  accion(cerrado || futuro ? '' : 'Cerrar caja del día', 'lock', () => { const i = $('cj-contado'); if (i) i.focus(); });
}
function difCaja(esp) { const v = $('cj-contado').value, el = $('cj-dif'); if (v === '') { el.textContent = '—'; el.className = 'big-num'; return; } const d = r2(num(v) - esp); el.textContent = (d > 0 ? '+' : '') + L(d) + (d === 0 ? ' ✓' : ''); el.className = 'big-num ' + (d < 0 ? 'neg' : d > 0 ? 'pos' : ''); }
async function cerrarDia() {
  const v = $('cj-contado').value.trim(), nota = $('cj-nota').value;
  if (v === '' && !await confirmar('Cerrar sin contar', 'No escribiste el efectivo contado. ¿Cerrar la caja con los números del sistema?', 'Cerrar sin conteo')) return;
  if (v !== '' && !await confirmar('Cerrar caja', `Se cerrará la caja del <b>${F(DIA)}</b>. Los movimientos de ese día quedan bloqueados.`, 'Cerrar caja')) return;
  await carga(run('cerrarDia', DIA, v === '' ? null : num(v), nota)); toast('Caja del ' + F(DIA) + ' cerrada'); vCaja();
}
async function reabrirDia() { if (!await confirmar('Reabrir día', `Se va a reabrir la caja del <b>${F(DIA)}</b> para poder corregir movimientos. Después volvé a cerrarla.`, 'Reabrir')) return; await carga(run('reabrirDia', DIA)); toast('Día reabierto'); vCaja(); }
async function cerrarSemana(s) {
  const r = await elegir('Cierre oficial de la semana', `Se cerrará oficialmente la semana del <b>${F(s)}</b>. Ese es el número final de la semana y queda bloqueado.<br><br><label class="hint">Nota (opcional)</label><input id="cs-nota" style="margin-top:6px" placeholder="Ej: retirado por el dueño">`, [{ t: 'Cancelar', v: null }, { t: ic('lock', 16) + 'Cerrar semana', v: 'ok', cls: 'btn-p' }]);
  if (!r) return; const nota = (document.getElementById('cs-nota') || {}).value || '';
  await carga(run('cerrarSemana', s, nota)); toast('Semana cerrada oficialmente'); vCaja();
}
async function reabrirSemana(s) { if (!await confirmar('Reabrir semana', 'Se quita el cierre oficial de la semana para poder corregir días. Después volvé a cerrarla.', 'Reabrir semana', true)) return; await carga(run('reabrirSemana', s)); toast('Semana reabierta'); vCaja(); }

// ================================================================ MOVIMIENTOS
async function vMovimientos() {
  const s = SUB.mov || 'gastos';
  const hasta = addDays(SEMANA, 6);
  if (s === 'compras') await cargarInv();
  const [l, pend] = await Promise.all([carga(run('listarMov', s, SEMANA, hasta)), s === 'compras' ? carga(run('comprasPendientes')) : Promise.resolve([])]);
  CACHE['mov_' + s] = l;
  const k = s === 'compras' ? 'total' : 'monto', pagada = x => s !== 'compras' || x.estado === 'Pagado';
  const enSemana = x => s !== 'compras' || ((x.estado === 'Pagado' ? (x.fecha_pago || x.fecha) : x.fecha) >= SEMANA && (x.estado === 'Pagado' ? (x.fecha_pago || x.fecha) : x.fecha) <= hasta);
  const ls = l.filter(enSemana);
  const ef = sumar(ls, k, x => x.metodo === 'Efectivo' && pagada(x)), tr = sumar(ls, k, x => x.metodo === 'Transferencia' && pagada(x));
  const TABS = [['gastos', 'Gastos', 'receipt'], ['vales', 'Vales', 'coins'], ['compras', 'Compras', 'cart'], ['pagos', 'Cobros', 'cash']];
  const COLS = {
    gastos: [{ h: 'Fecha', v: x => F(x.fecha) }, { h: 'Categoría', v: x => `<span class="tag">${ic('tag', 12)}${esc(x.categoria || '—')}</span>` }, { h: 'Descripción', v: x => esc(x.descripcion) || '<span class="mut">—</span>' }, { h: 'Método', v: x => met(x.metodo) }, { h: 'Monto', c: 'r', v: x => `<b>${L(x.monto)}</b>` }],
    vales: [{ h: 'Fecha', v: x => F(x.fecha) }, { h: 'Empleado', v: x => who(x.empleado) }, { h: 'Nota', v: x => esc(x.nota) || '<span class="mut">—</span>' }, { h: 'Método', v: x => met(x.metodo) }, { h: 'Monto', c: 'r', v: x => `<b>${L(x.monto)}</b>` }],
    compras: [{ h: 'Fecha', v: x => F(x.fecha) }, { h: 'Repuesto', v: x => `<b style="font-weight:600">${esc(x.descripcion)}</b>${x.codigo ? `<div class="small mut code">${esc(x.codigo)}</div>` : ''}` }, { h: 'Proveedor', v: x => esc(x.proveedor) || '<span class="mut">—</span>' }, { h: 'Cantidad', c: 'r', v: x => `${x.cantidad} × ${L(x.costo)}` }, { h: 'Método', v: x => met(x.metodo) }, { h: 'Estado', v: x => pill(x.estado, x.estado === 'Pagado' ? 'green' : 'red') }, { h: 'Total', c: 'r', v: x => `<b>${L(x.total)}</b>` }],
    pagos: [{ h: 'Fecha', v: x => F(x.fecha) }, { h: 'Trabajo', v: x => `<b class="ficha">${esc(x.numero)}</b>` }, { h: 'Cliente', v: x => esc(x.cliente || '—') }, { h: 'Nota', v: x => esc(x.nota) || '<span class="mut">—</span>' }, { h: 'Método', v: x => met(x.metodo) }, { h: 'Monto', c: 'r', v: x => `<b>${L(x.monto)}</b>` }],
  };
  $('main').innerHTML = `
    <div class="tabs">${TABS.map(([kk, t, i]) => `<button class="${kk === s ? 'on' : ''}" onclick="SUB.mov='${kk}';vMovimientos()">${ic(i, 16)}${t}</button>`).join('')}</div>
    <div class="toolbar">${semanaPick('vMovimientos')}</div>
    <div class="kpis">
      ${kpi('Efectivo' + (s === 'compras' ? ' (pagado)' : ''), L(ef), 'cash', 'green')}
      ${kpi('Transferencia' + (s === 'compras' ? ' (pagado)' : ''), L(tr), 'bank', 'blue')}
      ${kpi('Total de la semana', L(ef + tr), s === 'pagos' ? 'up' : 'down', s === 'pagos' ? 'green' : 'orange')}
      ${s === 'compras' ? kpi('Pendiente con proveedores', L(sumar(pend, 'total')), 'alert', 'red', `${pend.length} compra(s)`) : kpi('Registros', ls.length, 'file', 'slate')}
    </div>
    ${pend.length ? `<div class="card" style="border-color:#FECACA">${cardH('Compras pendientes de pagar', 'alert', `<b class="num neg">${L(sumar(pend, 'total'))}</b>`)}
      ${pend.map(c => `<div class="li"><div><b style="font-weight:600">${esc(c.descripcion)}</b><div class="small mut">${F(c.fecha)} · ${esc(c.proveedor || 'Sin proveedor')} · ${L(c.total)}</div></div><button class="btn btn-p btn-sm" onclick="pagarCompra(${c.id})">${ic('check', 14, 2.4)}Marcar pagada</button></div>`).join('')}</div>` : ''}
    ${tabla(ls, COLS[s], { click: x => `editarMov('${s}',${x.id})`, vacio: 'Nada registrado esta semana', icono: TABS.find(t => t[0] === s)[2],
         vsub: s === 'pagos' ? 'Los cobros se registran dentro de cada trabajo.' : 'Usá el botón de arriba para agregar uno.',
         foot: ls.length ? COLS[s].map((c, i) => i === 0 ? '<td>Total</td>' : i === COLS[s].length - 1 ? `<td class="r">${L(sumar(ls, k))}</td>` : '<td></td>').join('') : '' })}`;
  if (s !== 'pagos') accion({ gastos: 'Nuevo gasto', vales: 'Nuevo vale', compras: 'Nueva compra' }[s], 'plus', () => nuevoMov(s));
}
const FORM_MOV = { gastos: ['gasto', 'guardarGasto', 'borrarGasto', 'Gasto', 'Gastos del taller (no incluye planilla ni repuestos)'], vales: ['vale', 'guardarVale', 'borrarVale', 'Vale', 'Adelanto a un empleado (se descuenta de la planilla)'], compras: ['compra', 'guardarCompra', 'borrarCompra', 'Compra', 'Compra de repuestos a proveedor'] };
async function nuevoMov(s, datos) {
  if (s === 'compras') await cargarInv();
  const [campos, fn, , nom, sub] = FORM_MOV[s];
  formulario({ campos, titulo: (s === 'compras' ? 'Nueva ' : 'Nuevo ') + nom.toLowerCase(), sub, datos: Object.assign({ fecha: INIT.hoy, estado: 'Pagado', metodo: 'Efectivo', cantidad: 1 }, datos || {}),
    guardar: d => run(fn, d), alGuardar: () => { invalidar('inventario'); refrescarVista(); } });
}
async function editarMov(s, id) {
  if (s === 'pagos') { const p = CACHE.mov_pagos.find(x => x.id === id); return abrirTrabajo(p.trabajo_id); }
  if (s === 'compras') await cargarInv();
  const [campos, fn, fnB, nom] = FORM_MOV[s];
  const x = CACHE['mov_' + s].find(y => y.id === id);
  formulario({ campos, titulo: 'Editar ' + nom.toLowerCase(), datos: x, guardar: d => run(fn, d), borrar: () => run(fnB, id), alGuardar: () => { invalidar('inventario'); refrescarVista(); } });
}
function refrescarVista() { const f = { movimientos: vMovimientos, inventario: vInventario, planilla: vPlanilla, inicio: vInicio, caja: vCaja }[VISTA]; if (f) f(); }
async function pagarCompra(id) {
  const m = await elegirMetodo('Marcar compra como pagada', '¿Cómo la pagaste? Se registra con fecha de hoy.'); if (!m) return;
  await carga(run('pagarCompra', id, m, INIT.hoy)); toast('Compra marcada como pagada'); vMovimientos();
}

// ================================================================ PLANILLA
async function vPlanilla() {
  const p = await carga(run('planillaSemana', SEMANA)); CACHE.planilla = p.filas; CACHE.mov_vales = p.vales;
  $('main').innerHTML = `
    <div class="toolbar">${semanaPick('vPlanilla')}</div>
    <div class="kpis">
      ${kpi('Total neto de la semana', L(p.tot.neto), 'users', 'orange', `${p.filas.length} empleado(s)`)}
      ${kpi('Pendiente de pagar', L(p.tot.pendiente), 'clock', p.tot.pendiente > 0 ? 'red' : 'green', '', p.tot.pendiente > 0 ? 'neg' : '')}
      ${kpi('Pagado en efectivo', L(p.tot.pagadoEf), 'cash', 'green')}
      ${kpi('Pagado por transferencia', L(p.tot.pagadoTr), 'bank', 'blue')}
    </div>
    ${p.filas.length ? `<div class="cards" style="margin-bottom:18px">${p.filas.map(r => `<div class="card emp">
      <div class="head">${who(r.empleado, esc(r.puesto || 'Empleado'), 'lg')}${pill(r.estado, r.estado === 'Pagado' ? 'green' : 'red')}</div>
      <div class="sum"><div><span>Salario base</span><span>${L(r.salario)}</span></div><div><span>Comisión <span class="mut small">(${L(r.mano_obra)} de mano de obra)</span></span><span>${L(r.comision)}</span></div>
        <div><span>Bonos / extras</span><span>${L(r.bonos)}</span></div><div><span>Deducciones</span><span>− ${L(r.deducciones)}</span></div><div><span>Vales</span><span>− ${L(r.vales)}</span></div></div>
      <div class="neto"><span>Pago neto</span><span class="num">${L(r.neto)}</span></div>
      ${r.estado === 'Pagado' ? `<div class="small mut" style="margin-bottom:10px;display:flex;gap:8px;align-items:center">${ic('check', 14)}Pagado el ${F(r.fecha_pago)} · ${met(r.metodo)}</div>
        <div class="btns"><button class="btn btn-s" onclick="anularPlanilla(${r.id})">${ic('unlock', 15)}Anular pago</button></div>`
      : `<div class="btns"><button class="btn btn-s" onclick="editarPlanilla(${r.id})">${ic('edit', 15)}Bonos / deducciones</button><button class="btn btn-p" onclick="pagarPlanilla(${r.id})">${ic('cash', 16)}Pagar</button></div>`}</div>`).join('')}</div>`
      : vacio('No hay empleados activos', 'users', 'Agregalos en Configuración.')}
    ${tabla(p.vales, [{ h: 'Fecha', v: v => F(v.fecha) }, { h: 'Empleado', v: v => who(v.empleado) }, { h: 'Nota', v: v => esc(v.nota) || '<span class="mut">—</span>' }, { h: 'Método', v: v => met(v.metodo) }, { h: 'Monto', c: 'r', v: v => `<b>${L(v.monto)}</b>` }],
      { click: v => `editarMov('vales',${v.id})`, vacio: 'Sin vales esta semana', icono: 'coins',
        head: cardH('Vales de la semana', 'coins', `<button class="btn btn-s btn-sm" onclick="nuevoMov('vales',{fecha:INIT.hoy>=SEMANA&&INIT.hoy<=addDays(SEMANA,6)?INIT.hoy:SEMANA})">${ic('plus', 14)}Vale</button>`, `Se descuentan solos del pago neto · ${L(p.tot.vales)}`) })}
    <p class="hint" style="text-align:center;margin-top:16px">La comisión se calcula sobre la mano de obra de los trabajos entregados esa semana por cada mecánico. Si dos mecánicos comparten un trabajo, la mano de obra se reparte según el porcentaje del trabajo.</p>`;
}
function editarPlanilla(id) { const r = CACHE.planilla.find(x => x.id === id);
  formulario({ campos: 'planilla', titulo: r.empleado, sub: 'Semana del ' + F(r.semana) + ' al ' + F(addDays(r.semana, 6)), datos: r, guardar: d => run('guardarPlanilla', id, d), alGuardar: vPlanilla,
    extra: `<div class="minis"><div class="mini"><span>Salario base</span><b class="num">${L(r.salario)}</b></div><div class="mini"><span>Comisión</span><b class="num">${L(r.comision)}</b></div><div class="mini"><span>Vales</span><b class="num">${L(r.vales)}</b></div><div class="mini"><span>Neto actual</span><b class="num">${L(r.neto)}</b></div></div>` }); }
async function pagarPlanilla(id) {
  const r = CACHE.planilla.find(x => x.id === id);
  const m = await elegirMetodo('Pagar planilla', `Vas a registrar el pago de <b>${L(r.neto)}</b> a <b>${esc(r.empleado)}</b> por la semana del ${F(r.semana)}, con fecha de hoy.<br><br>¿Cómo le pagaste?`); if (!m) return;
  await carga(run('pagarPlanilla', id, m, INIT.hoy)); toast('Pago registrado'); vPlanilla();
}
async function anularPlanilla(id) { if (!await confirmar('Anular pago de planilla', 'El pago vuelve a quedar pendiente y sale de la caja del día en que se registró.', 'Anular pago', true)) return; await carga(run('anularPagoPlanilla', id)); toast('Pago anulado'); vPlanilla(); }

// ================================================================ INVENTARIO
async function vInventario() { await cargarInv(true); pInventario(); accion('Nuevo repuesto', 'plus', () => formulario({ campos: 'inventario', titulo: 'Nuevo repuesto', sub: 'Agregar al inventario', datos: { stock_inicial: 0, minimo: 0 }, guardar: d => run('guardarInventario', d), alGuardar: vInventario })); }
function pInventario() {
  const inv = CACHE.inventario, q = (SUB.iq || '').toLowerCase(), f = SUB.inv || 'todos';
  const l = inv.filter(i => (f === 'todos' || i.alerta !== 'OK') && (!q || [i.codigo, i.descripcion, i.compatible, i.categoria, i.proveedor].join(' ').toLowerCase().includes(q)));
  $('main').innerHTML = `
    <div class="kpis">${kpi('Valor en bodega', L(sumar(inv, 'valor')), 'box', 'orange', 'A costo')}${kpi('Artículos', inv.length, 'tag', 'slate')}${kpi('Por reponer', inv.filter(i => i.alerta === 'REPONER').length, 'alert', 'amber')}${kpi('Agotados', inv.filter(i => i.alerta === 'AGOTADO').length, 'ban', 'red')}</div>
    <div class="toolbar">${buscador('iq', 'Buscar código, nombre, modelo o proveedor…', 'iq', 'pInventario')}
      <div class="chips"><span class="chip ${f === 'todos' ? 'on' : ''}" onclick="SUB.inv='todos';pInventario()">Todos <b>${inv.length}</b></span><span class="chip ${f === 'bajo' ? 'on' : ''}" onclick="SUB.inv='bajo';pInventario()">Reponer / agotados <b>${inv.filter(i => i.alerta !== 'OK').length}</b></span></div></div>
    ${tabla(l, [
      { h: 'Código', v: i => i.codigo ? `<span class="code">${esc(i.codigo)}</span>` : '<span class="mut">—</span>' },
      { h: 'Descripción', v: i => `<b style="font-weight:600">${esc(i.descripcion)}</b>${i.compatible ? `<div class="small mut">${esc(i.compatible)}</div>` : ''}` },
      { h: 'Categoría', v: i => esc(i.categoria) || '<span class="mut">—</span>' },
      { h: 'Costo', c: 'r', v: i => L(i.costo) }, { h: 'Precio', c: 'r', v: i => `<b>${L(i.precio)}</b>` },
      { h: 'Margen', c: 'r', v: i => i.margen == null ? '—' : Math.round(i.margen * 100) + '%' },
      { h: 'Stock', c: 'r', v: i => `<b class="${i.stock <= 0 ? 'neg' : ''}">${i.stock}</b><span class="mut small"> / mín ${i.minimo || 0}</span>` },
      { h: 'Estado', v: i => pAlerta(i.alerta) },
    ], { click: i => `verRepuesto(${i.id})`, vacio: inv.length ? 'Sin resultados' : 'El inventario está vacío', icono: 'box', vsub: inv.length ? '' : 'Es opcional: en los trabajos podés escribir repuestos libres. Agregá aquí los que tenés en bodega para llevar el stock.' })}`;
}
async function verRepuesto(id) {
  const i = CACHE.inventario.find(x => x.id === id); const movs = await run('movimientosInventario', id);
  formulario({ campos: 'inventario', titulo: i.descripcion, sub: (i.codigo || 'Sin código') + ' · stock ' + i.stock, datos: i, guardar: d => run('guardarInventario', d), borrar: () => run('borrarInventario', id), alGuardar: vInventario,
    extra: `<div class="minis"><div class="mini"><span>Stock actual</span><b class="num">${i.stock}</b></div><div class="mini"><span>Margen</span><b>${i.margen == null ? '—' : Math.round(i.margen * 100) + '%'}</b></div><div class="mini"><span>Entradas (compras)</span><b class="num">${i.entradas}</b></div><div class="mini"><span>Salidas (trabajos)</span><b class="num">${i.salidas}</b></div></div>
      ${movs.length ? `<div class="lbl">Últimos movimientos</div>${tablaIn(movs.slice(0, 8), [{ h: 'Fecha', v: m => F(m.fecha) }, { h: 'Movimiento', v: m => esc(m.tipo) }, { h: 'Detalle', v: m => esc(m.detalle || '') }, { h: 'Cant.', c: 'r', v: m => `<b class="${m.cantidad < 0 ? 'neg' : 'pos'}">${m.cantidad > 0 ? '+' : ''}${m.cantidad}</b>` }])}` : ''}
      <button class="btn btn-s w" style="margin:12px 0 16px" onclick="cerrarModal();nuevoMov('compras',{inventario_id:${i.id},costo:${num(i.costo)},proveedor:'${js(i.proveedor)}'})">${ic('cart', 16)}Registrar compra de este repuesto</button>` });
}

// ================================================================ REPORTES
async function vReportes() {
  const r = await carga(run('reportes'));
  const cols = esMes => [{ h: esMes ? 'Mes' : 'Semana', v: x => esMes ? `<b>${MESES[Number(x.mes.slice(5, 7)) - 1]} ${x.mes.slice(0, 4)}</b>` : `<b>${F(x.semana)}</b> <span class="mut small">al ${F(addDays(x.semana, 6))}</span>` },
    ...(esMes ? [] : [{ h: 'Cierre', v: x => x.oficial ? pill('Oficial', 'green') : x.semana === INIT.lunes ? pill('En curso', 'orange') : pill('Sin cierre', 'slate') }]),
    { h: 'Ingresos', c: 'r', v: x => L(x.ing) }, { h: 'Egresos', c: 'r', v: x => L(x.egr) }, { h: 'Neto', c: 'r', v: x => `<b>${neto(x.neto)}</b>` },
    { h: 'Neto efectivo', c: 'r', v: x => neto(x.netoEf) }, { h: 'Neto transf.', c: 'r', v: x => neto(x.netoTr) }, { h: 'Entregados', c: 'r', v: x => x.entregados }, { h: 'Ganancia repuestos', c: 'r', v: x => L(x.utilRep) }];
  const s = r.semanas[0] || {}, m = r.meses[0] || {};
  $('main').innerHTML = `
    <div class="kpis">${kpi('Neto de esta semana', L(s.neto), 'wallet', 'orange', 'En curso', s.neto < 0 ? 'neg' : '')}${kpi('Neto del mes', L(m.neto), 'chart', 'violet', `Ingresos ${L(m.ing)}`, m.neto < 0 ? 'neg' : '')}
      ${kpi('Semanas con cierre oficial', r.semanas.filter(x => x.oficial).length, 'lock', 'green')}${kpi('Trabajos entregados (mes)', m.entregados || 0, 'check', 'teal', `Mano de obra ${L(m.manoObra)}`)}</div>
    ${tabla(r.semanas, cols(false), { click: x => `SEMANA='${x.semana}';DIA='${x.semana}';ir('caja')`, head: cardH('Semanas', 'calendar', '', 'Las semanas con cierre oficial muestran los números congelados del cierre. Tocá una para ver su caja.'), vacio: 'Sin semanas' })}
    ${tabla(r.meses, cols(true), { head: cardH('Meses', 'chart'), vacio: 'Sin meses' })}`;
  accion('Exportar a Excel', 'excel', exportarExcel);
}
async function exportarExcel() { try { const f = await carga(sys('exportarExcel')); if (f) toast('Exportado: ' + f.split(/[\\/]/).pop()); } catch (e) { /* ya avisado */ } }

// ================================================================ CLIENTES / MOTOS / GARANTÍAS
async function vClientes() { CACHE.clientes = await carga(run('listarClientes')); pClientes(); accion('Nuevo cliente', 'plus', () => formulario({ campos: 'cliente', titulo: 'Nuevo cliente', guardar: d => run('guardarCliente', d), alGuardar: vClientes })); }
function pClientes() {
  const cl = CACHE.clientes, q = (SUB.cq || '').toLowerCase();
  const l = cl.filter(c => !q || [c.nombre, c.telefono, c.direccion].join(' ').toLowerCase().includes(q));
  $('main').innerHTML = `
    <div class="kpis">${kpi('Clientes', cl.length, 'user', 'orange')}${kpi('Facturado total', L(sumar(cl, 'facturado')), 'up', 'green')}${kpi('Saldo por cobrar', L(sumar(cl, 'saldo')), 'receipt', 'red')}${kpi('Con saldo', cl.filter(c => c.saldo > 0.004).length, 'alert', 'amber')}</div>
    <div class="toolbar">${buscador('cq', 'Buscar por nombre, teléfono o dirección…', 'cq', 'pClientes')}</div>
    ${tabla(l, [
      { h: 'Cliente', v: c => who(c.nombre, 'C-' + String(c.id).padStart(4, '0')) }, { h: 'Teléfono', v: c => c.telefono ? esc(c.telefono) : '<span class="mut">—</span>' },
      { h: 'Dirección', v: c => esc(c.direccion) || '<span class="mut">—</span>' }, { h: 'Última visita', v: c => F(c.ultimo) || '<span class="mut">—</span>' }, { h: 'Trabajos', c: 'r', v: c => c.trabajos },
      { h: 'Facturado', c: 'r', v: c => L(c.facturado) }, { h: 'Saldo', c: 'r', v: c => c.saldo > 0.004 ? `<b class="neg">${L(c.saldo)}</b>` : `<span class="mut">${L(0)}</span>` },
    ], { click: c => `verCliente(${c.id})`, vacio: 'Sin clientes', icono: 'user', vsub: 'Los clientes se crean solos al registrar un trabajo.' })}`;
}
async function verCliente(id) {
  const c = await carga(run('cliente', id));
  formulario({ campos: 'cliente', titulo: c.nombre, sub: 'C-' + String(c.id).padStart(4, '0') + ' · cliente desde ' + F(c.creado), datos: c, guardar: d => run('guardarCliente', d), borrar: () => run('borrarCliente', id), alGuardar: () => { if (VISTA === 'clientes') vClientes(); },
    extra: `${c.telefono ? `<button class="btn wa w" style="margin-bottom:14px" onclick="sys('whatsapp','${js(c.telefono)}','Hola ${js(c.nombre.split(' ')[0])}, le saludamos de ${js(INIT.config.taller)}.').catch(e=>toast(e.message,true))">${ic('wa', 16)}Escribirle por WhatsApp</button>` : ''}
      <div class="lbl">Motos</div>${c.motos.map(m => `<div class="li"><div class="flex">${plate(m.placa)}<span>${esc([m.marca, m.modelo, m.anio].filter(Boolean).join(' '))}</span></div></div>`).join('') || '<div class="hint">Sin motos</div>'}
      <div class="lbl" style="margin-top:14px">Trabajos</div>${c.trabajosLista.slice(0, 8).map(t => `<div class="li tap" onclick="cerrarModal();abrirTrabajo(${t.id})"><div><b>${t.numero}</b> <span class="mut small">${F(t.fecha)}</span><div class="small mut">${esc((t.descripcion || '').slice(0, 70))}</div></div><div class="right">${L(t.total)}<div>${pPago(t.estado_pago, t.saldo)}</div></div></div>`).join('') || '<div class="hint">Sin trabajos</div>'}<div style="height:16px"></div>` });
}
async function vMotos() { CACHE.motos = await carga(run('listarMotos')); if (!CACHE.clientes) CACHE.clientes = await run('listarClientes'); pMotos(); accion('Nueva moto', 'plus', () => formulario({ campos: 'moto', titulo: 'Nueva moto', guardar: d => run('guardarMoto', d), alGuardar: vMotos })); }
function pMotos() {
  const ms = CACHE.motos, q = (SUB.mq || '').toLowerCase();
  const l = ms.filter(m => !q || [m.placa, m.cliente, m.marca, m.modelo, m.color].join(' ').toLowerCase().includes(q));
  $('main').innerHTML = `
    <div class="toolbar">${buscador('mq', 'Buscar placa, dueño, marca o modelo…', 'mq', 'pMotos')}<span class="sp"></span><span class="mut">${ms.length} moto(s) registradas</span></div>
    ${tabla(l, [{ h: 'Placa', v: m => plate(m.placa) }, { h: 'Moto', v: m => `<b style="font-weight:600">${esc([m.marca, m.modelo].filter(Boolean).join(' ') || '—')}</b><div class="small mut">${[m.anio, m.cc ? m.cc + ' cc' : '', m.color].filter(Boolean).map(esc).join(' · ')}</div>` },
      { h: 'Dueño', v: m => m.cliente ? who(m.cliente, esc(m.telefono || '')) : '<span class="mut">—</span>' }, { h: 'Visitas', c: 'r', v: m => m.visitas }, { h: 'Última visita', v: m => F(m.ultima) || '<span class="mut">—</span>' }, { h: 'Último km', c: 'r', v: m => esc(m.ultimo_km || '—') }],
    { click: m => `editarMoto(${m.id})`, vacio: 'Sin motos', icono: 'bike', vsub: 'Las motos se registran solas al crear un trabajo con placa.' })}`;
}
function editarMoto(id) { const m = CACHE.motos.find(x => x.id === id); formulario({ campos: 'moto', titulo: m.placa || 'Moto', sub: [m.marca, m.modelo, m.anio].filter(Boolean).join(' '), datos: m, guardar: d => run('guardarMoto', d), borrar: () => run('borrarMoto', id), alGuardar: vMotos }); }
async function vGarantias() {
  const g = await carga(run('garantias')); const f = SUB.gar || 'vigentes';
  const FI = { vigentes: t => t.restantes >= 0, vencer: t => t.restantes >= 0 && t.restantes <= 7, vencidas: t => t.restantes < 0, todas: () => true };
  const l = g.filter(FI[f]).sort((a, b) => a.restantes - b.restantes);
  $('main').innerHTML = `
    <div class="kpis">${kpi('Garantías vigentes', g.filter(FI.vigentes).length, 'shield', 'green')}${kpi('Vencen en 7 días', g.filter(FI.vencer).length, 'clock', 'amber')}${kpi('Vencidas', g.filter(FI.vencidas).length, 'ban', 'slate')}${kpi('Reclamos registrados', sumar(g, 'reclamosN'), 'alert', 'red')}</div>
    <div class="toolbar"><div class="chips">${[['vigentes', 'Vigentes'], ['vencer', 'Por vencer'], ['vencidas', 'Vencidas'], ['todas', 'Todas']].map(([k, t]) => `<span class="chip ${k === f ? 'on' : ''}" onclick="SUB.gar='${k}';vGarantias()">${t} <b>${g.filter(FI[k]).length}</b></span>`).join('')}</div></div>
    ${tabla(l, [{ h: 'Trabajo', v: t => `<b>${t.numero}</b><div class="small mut">${esc((t.descripcion || '').slice(0, 50))}</div>` }, { h: 'Cliente', v: t => esc(t.cliente || '—') + (t.telefono ? `<div class="small mut">${esc(t.telefono)}</div>` : '') },
      { h: 'Moto', v: t => plate(t.placa) }, { h: 'Cubre', v: t => esc(t.garantia_cubre || '—') }, { h: 'Entregado', v: t => F(t.entrega) }, { h: 'Vence', v: t => `<b>${F(t.vence)}</b>` },
      { h: 'Estado', v: t => t.restantes < 0 ? pill('Vencida', 'gray') : t.restantes <= 7 ? pill(`Quedan ${t.restantes} día(s)`, 'amber') : pill(`Quedan ${t.restantes} días`, 'green') },
      { h: 'Reclamos', c: 'r', v: t => t.reclamosN ? pill(t.reclamosN, 'red') : '<span class="mut">0</span>' }],
    { click: t => `abrirTrabajo(${t.id})`, vacio: 'No hay garantías aquí', icono: 'shield', vsub: 'Las garantías aparecen cuando un trabajo con garantía se marca como entregado.' })}`;
}

// ================================================================ CONFIGURACIÓN
function empRow(e) {
  e = e || {};
  return `<div class="emprow" data-id="${e.id || ''}"><div class="fld" style="margin:0"><label>Nombre</label><input data-e="nombre" value="${esc(e.nombre)}" placeholder="Nombre"></div>
    <div class="fld" style="margin:0"><label>Puesto</label><input data-e="puesto" value="${esc(e.puesto)}" placeholder="Puesto"></div>
    <div class="fld" style="margin:0"><label>Salario semanal (L)</label><input data-e="salario" inputmode="decimal" value="${esc(e.salario)}" placeholder="0.00"></div>
    <div class="fld" style="margin:0"><label>% comisión</label><input data-e="comision" inputmode="decimal" value="${esc(e.comision)}" placeholder="0"></div>
    <div class="fld" style="margin:0"><label>Activo</label><select data-e="activo">${opt(['Sí', 'No'], e.activo === 0 ? 'No' : 'Sí')}</select></div>
    <div class="x"><button class="btn btn-g btn-ic" title="Quitar" onclick="quitarEmpleado(this)">${ic('trash', 16)}</button></div></div>`;
}
function garRow(g) { g = g || {}; return `<div class="garrow"><input data-g="dias" inputmode="numeric" value="${esc(g.dias)}" placeholder="Días"><input data-g="nombre" value="${esc(g.nombre)}" placeholder="Nombre (ej: 3 meses)"><button class="btn btn-g btn-ic" onclick="this.parentElement.remove()">${ic('trash', 16)}</button></div>`; }
function vConfig() {
  const c = INIT.config;
  $('main').innerHTML = `<div style="max-width:1100px">
    <div class="card"><div class="set"><div class="desc"><h3>Datos del taller</h3><p>Aparecen en los recibos impresos, en PDF y en WhatsApp.</p></div>
      <div class="fgrid"><div class="fld full"><label>Nombre del taller</label><input id="cf-taller" value="${esc(c.taller)}"></div>
      <div class="fld"><label>Teléfono</label><input id="cf-tel" value="${esc(c.telefono)}"></div><div class="fld"><label>RTN (opcional)</label><input id="cf-rtn" value="${esc(c.rtn)}"></div>
      <div class="fld full"><label>Dirección</label><input id="cf-dir" value="${esc(c.direccion)}"></div></div></div></div>
    <div class="card"><div class="set"><div class="desc"><h3>Caja</h3><p>El fondo fijo es el efectivo base que siempre se queda en caja. Lo demás se retira en el cierre oficial de la semana.</p></div>
      <div class="fgrid"><div class="fld"><label>Fondo fijo de caja (L)</label><input id="cf-fondo" inputmode="decimal" value="${esc(c.fondo)}"></div></div></div></div>
    <div class="card"><div class="set"><div class="desc"><h3>WhatsApp</h3><p>Para los recibos y avisos. Los números de 8 dígitos se completan con el código de país.</p></div>
      <div class="fgrid"><div class="fld"><label>Código de país</label><input id="cf-pref" value="${esc(c.prefijo)}" placeholder="504"></div>
      <div class="fld"><label>WhatsApp en esta PC</label><div class="hint" style="padding-top:10px">${SYS ? (SYS.whatsappApp ? 'Se abre la aplicación de WhatsApp' : 'Se abre WhatsApp Web en el navegador') : ''}</div></div>
      <div class="fld full"><label>Mensaje al final de los recibos</label><input id="cf-pie" value="${esc(c.pieMensaje)}"></div></div></div></div>
    <div class="card"><div class="set"><div class="desc"><h3>Garantías</h3><p>Opciones que salen al registrar un trabajo, qué cubren y los términos que se imprimen en el recibo.</p></div>
      <div><div class="lbl">Opciones de tiempo</div><div id="cf-gar">${c.garantias.filter(g => g.dias > 0).map(garRow).join('')}</div>
        <button class="btn btn-s btn-sm" onclick="$('cf-gar').insertAdjacentHTML('beforeend',garRow())">${ic('plus', 14)}Agregar opción</button>
        <div class="fgrid" style="margin-top:14px"><div class="fld"><label>Garantía por defecto</label><select id="cf-gdef">${opt(c.garantias.map(g => ({ v: g.dias, t: g.nombre })), c.garantiaDefecto)}</select></div>
        <div class="fld"><label>Cobertura por defecto</label><select id="cf-cdef">${opt(c.coberturas, c.coberturaDefecto)}</select></div>
        <div class="fld full"><label>Qué puede cubrir (una opción por línea)</label><textarea id="cf-cob" style="min-height:76px">${esc(c.coberturas.join('\n'))}</textarea></div>
        <div class="fld full"><label>Términos de la garantía (salen en el recibo)</label><textarea id="cf-term">${esc(c.terminos)}</textarea></div></div></div></div></div>
    <div class="card"><div class="set"><div class="desc"><h3>Empleados</h3><p>Salario base semanal y % de comisión sobre la mano de obra que entregan. Los inactivos no salen en la planilla.</p></div>
      <div><div class="emprow hd"><span>Nombre</span><span>Puesto</span><span>Salario semanal</span><span>% comisión</span><span>Activo</span><span></span></div>
      <div id="cf-emps">${INIT.empleados.map(empRow).join('')}</div>
      <button class="btn btn-s" style="margin-top:12px" onclick="$('cf-emps').insertAdjacentHTML('beforeend',empRow())">${ic('plus', 16)}Agregar empleado</button></div></div></div>
    <div class="card"><div class="set"><div class="desc"><h3>Categorías</h3><p>Opciones de los menús de gastos e inventario. Una por línea.</p></div>
      <div class="fgrid"><div class="fld"><label>Categorías de gasto</label><textarea id="cf-cg" style="min-height:220px">${esc(c.catGastos.join('\n'))}</textarea></div>
      <div class="fld"><label>Categorías de repuesto</label><textarea id="cf-cr" style="min-height:220px">${esc(c.catRepuestos.join('\n'))}</textarea></div></div></div></div>
  </div>`;
  accion('Guardar cambios', 'check', guardarConfig);
}
async function quitarEmpleado(btn) {
  const row = btn.closest('.emprow'), id = row.dataset.id;
  if (id) {
    if (!await confirmar('Quitar empleado', 'Si el empleado ya tiene trabajos, vales o planillas pagadas, se marca como inactivo en lugar de borrarse.', 'Quitar', true)) return;
    const r = await carga(run('borrarEmpleado', Number(id))); INIT = await run('init'); toast(r === 'borrado' ? 'Empleado borrado' : 'Empleado marcado como inactivo');
    return vConfig();
  }
  row.remove();
}
async function guardarConfig() {
  const lineas = id => $(id).value.split('\n').map(s => s.trim()).filter(Boolean);
  const emps = [...document.querySelectorAll('#cf-emps .emprow')].map(li => { const o = { id: Number(li.dataset.id) || null }; li.querySelectorAll('[data-e]').forEach(i => o[i.dataset.e] = i.value.trim()); return o; }).filter(o => o.nombre);
  const gar = [...document.querySelectorAll('#cf-gar .garrow')].map(r => ({ dias: r.querySelector('[data-g=dias]').value, nombre: r.querySelector('[data-g=nombre]').value })).filter(g => num(g.dias) > 0);
  INIT = await carga(run('guardarConfig', { taller: $('cf-taller').value, telefono: $('cf-tel').value, rtn: $('cf-rtn').value, direccion: $('cf-dir').value, fondo: $('cf-fondo').value,
    prefijo: $('cf-pref').value, pieMensaje: $('cf-pie').value, garantias: gar, garantiaDefecto: $('cf-gdef').value, coberturaDefecto: $('cf-cdef').value, coberturas: lineas('cf-cob'),
    terminos: $('cf-term').value, empleados: emps, catGastos: lineas('cf-cg'), catRepuestos: lineas('cf-cr') }));
  $('b-name').textContent = INIT.config.taller; document.title = INIT.config.taller; toast('Configuración guardada'); vConfig();
}

// ================================================================ RESPALDOS
async function vRespaldos() {
  if (!SYS) { $('main').innerHTML = vacio('Respaldos disponibles solo en el programa de escritorio', 'db'); return; }
  SYS = await carga(sys('info')); pieRespaldo();
  const R = SYS.respaldos, u = R.archivos[0];
  const kb = n => n > 1048576 ? (n / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB';
  $('main').innerHTML = `
    <div class="kpis">${kpi('Base de datos', kb(SYS.tamano), 'db', 'orange', 'Archivo SQLite local')}${kpi('Último respaldo', u ? new Date(u.fecha).toLocaleTimeString('es-HN', { hour: '2-digit', minute: '2-digit' }) : 'Ninguno', 'save', 'green', u ? new Date(u.fecha).toLocaleDateString('es-HN', { weekday: 'long', day: 'numeric', month: 'long' }) : '')}
      ${kpi('Respaldos guardados', R.archivos.length, 'folder', 'blue', 'Se guardan los últimos 60 días')}${kpi('Copia automática', 'Diaria', 'clock', 'violet', 'Y cada 30 min si hubo cambios')}</div>
    <div class="cols even">
      <div class="card">${cardH('Copias de seguridad', 'save')}
        <p class="hint" style="margin-top:0">El programa guarda una copia <b>todos los días</b>, cada <b>30 minutos</b> si hubo cambios y <b>al cerrar</b>. Si la PC se daña, instalás el programa en otra y restaurás el último respaldo.</p>
        <div class="lbl">Carpeta de respaldos</div><div class="note" style="margin-bottom:12px;word-break:break-all">${esc(R.carpeta)}</div>
        <div class="btns"><button class="btn btn-p" onclick="respaldarAhora()">${ic('save', 16)}Respaldar ahora</button><button class="btn btn-s" onclick="sys('abrirCarpetaRespaldos')">${ic('folder', 16)}Abrir carpeta</button><button class="btn btn-s" onclick="cambiarCarpeta()">${ic('edit', 16)}Cambiar carpeta</button></div>
        <div class="note warn" style="margin-top:14px">${ic('alert', 15)} <b>Recomendado:</b> poné la carpeta de respaldos en una <b>USB</b> o en tu carpeta de <b>Google Drive para escritorio</b>. Así tenés copia fuera de la PC, y en la nube cuando haya internet.</div>
      </div>
      <div class="card">${cardH('Restaurar y exportar', 'refresh')}
        <p class="hint" style="margin-top:0">Restaurar reemplaza los datos actuales por los del respaldo. Antes de hacerlo, el programa guarda una copia de lo que hay ahora.</p>
        <div class="btns"><button class="btn btn-s" onclick="restaurar()">${ic('refresh', 16)}Restaurar desde un archivo…</button><button class="btn btn-s" onclick="exportarExcel()">${ic('excel', 16)}Exportar todo a Excel</button></div>
        <div class="lbl" style="margin-top:16px">Ubicación de la base de datos</div><div class="note small" style="word-break:break-all">${esc(SYS.base)}</div>
      </div>
    </div>
    ${tabla(R.archivos.slice(0, 40), [{ h: 'Respaldo', v: a => `<b style="font-weight:600">${esc(a.nombre)}</b>` }, { h: 'Tipo', v: a => /manual/.test(a.nombre) ? pill('Manual', 'blue') : /antes-de-actualizar/.test(a.nombre) ? pill('Antes de actualizar', 'violet') : /antes/.test(a.nombre) ? pill('Antes de restaurar', 'amber') : pill('Automático', 'green') },
      { h: 'Fecha', v: a => new Date(a.fecha).toLocaleString('es-HN') }, { h: 'Tamaño', c: 'r', v: a => kb(a.tamano) }, { h: '', c: 'r', v: a => `<button class="btn btn-s btn-sm" onclick="event.stopPropagation();restaurar('${js(a.ruta.replace(/\\/g, '/'))}')">${ic('refresh', 14)}Restaurar</button>` }],
    { head: cardH('Respaldos disponibles', 'folder'), vacio: 'Todavía no hay respaldos', icono: 'save' })}
    <div class="card" id="act-card" style="margin-top:16px"></div>`;
  pintarActCard();
}
// ================================================================ actualizaciones
let ACT = null;
function textoAct(a) {
  if (!a || !a.empaquetado) return 'Modo prueba: las actualizaciones solo funcionan en el programa instalado.';
  return { inactivo: 'Se revisa sola al abrir el programa y cada 4 horas.', buscando: 'Buscando actualizaciones…', 'al-dia': 'Tenés la versión más reciente.',
    descargando: `Descargando la versión ${a.version}…`, lista: `La versión ${a.version} está lista para instalar.`, error: 'No se pudo revisar (¿sin internet?). Se intenta de nuevo más tarde.' }[a.estado] || '';
}
function pintarActCard() {
  const el = $('act-card'); if (!el) return;
  const a = ACT || {};
  el.innerHTML = `${cardH('Actualizaciones', 'download')}
    <div class="flex wrap" style="justify-content:space-between">
      <div><div class="lbl" style="margin:0">Versión instalada</div><div style="font-size:22px;font-weight:800">${esc(a.actual || (SYS && SYS.version) || '')}</div><div class="hint">${esc(textoAct(a))}</div></div>
      <div class="btns">${a.estado === 'lista' ? `<button class="btn btn-p" onclick="instalarAct()">${ic('refresh', 16)}Reiniciar y actualizar</button>` : `<button class="btn btn-s" onclick="buscarAct()">${ic('refresh', 16)}Buscar actualizaciones</button>`}</div>
    </div>`;
}
function pintarAvisoAct() {
  let el = $('act-aviso');
  if (!ACT || ACT.estado !== 'lista') { if (el) el.remove(); return; }
  if (!el) { el = document.createElement('div'); el.id = 'act-aviso'; document.body.appendChild(el); }
  el.innerHTML = `${ic('download', 18)}<div><b>Versión ${esc(ACT.version)} lista</b><small>Se instala en segundos y tus datos se quedan igual.</small></div><button class="btn btn-p btn-sm" onclick="instalarAct()">Actualizar</button><button class="btn btn-g btn-ic" title="Más tarde" onclick="this.parentNode.remove()">${ic('x', 15)}</button>`;
}
function alCambiarAct(a) { ACT = Object.assign(ACT || {}, a); pintarActCard(); pintarAvisoAct(); }
async function buscarAct() { ACT = Object.assign(ACT || {}, { estado: 'buscando' }); pintarActCard(); alCambiarAct(await sys('buscarActualizacion')); if (ACT.estado === 'al-dia') toast('Ya tenés la versión más reciente'); }
async function instalarAct() {
  if (SUCIO && !await confirmar('Cambios sin guardar', 'Hay cambios sin guardar en el trabajo abierto. ¿Actualizar de todos modos?', 'Actualizar')) return;
  SUCIO = false; toast('Guardando respaldo y actualizando…'); await sys('instalarActualizacion');
}
async function respaldarAhora() { const f = await carga(sys('respaldarAhora')); toast('Respaldo guardado: ' + f.split(/[\\/]/).pop()); vRespaldos(); }
async function cambiarCarpeta() { const d = await carga(sys('elegirCarpetaRespaldos')); if (d) { INIT = await run('init'); toast('Carpeta de respaldos cambiada'); vRespaldos(); } }
async function restaurar(ruta) {
  if (!await confirmar('Restaurar respaldo', `Los datos actuales se van a reemplazar por los del respaldo${ruta ? ' <b>' + esc(ruta.split('/').pop()) + '</b>' : ''}. Antes se guarda una copia de lo que hay ahora.`, 'Restaurar', true)) return;
  const r = await carga(sys('restaurarArchivo', ruta || null)); if (!r) return;
  CACHE = {}; await iniciar(); toast('Respaldo restaurado'); ir('inicio', true);
}

// ================================================================ arranque
window.addEventListener('beforeunload', e => { if (VISTA === 'trabajo' && SUCIO) { e.preventDefault(); e.returnValue = ''; } });
if (window.taller && taller.alActualizar) { taller.alActualizar(alCambiarAct); sys('estadoActualizacion').then(alCambiarAct).catch(() => {}); }
if (window.taller && taller.alRefrescar) taller.alRefrescar(async () => { INIT = await run('init'); if (['caja', 'inicio'].includes(VISTA)) refrescarVista(); });
iniciar().then(() => ir('inicio', true)).catch(e => { $('main').innerHTML = vacio('No se pudo abrir la base de datos', 'alert', esc(e.message || e)); });
