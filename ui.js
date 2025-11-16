// ui.js
import { STATE } from './state.js';
import { CONFIG } from './config.js';
import { loadFromStorage, saveToStorage } from './storage.js';
import { showPopup, yyyyMmDd, parseDdMmYyyy } from './utils.js';

function getLogsForDateRange(start, end) {
  const logs = [];
  const startDate = parseDdMmYyyy(start);
  const endDate = parseDdMmYyyy(end);

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('log-')) {
      const fecha = key.substring(4);
      const logDate = parseDdMmYyyy(fecha);
      if (logDate >= startDate && logDate <= endDate) {
        const dayLogs = loadFromStorage(key, []);
        logs.push(...dayLogs);
      }
    }
  }
  return logs;
}


export function getColorPuesto(puesto) {
  if (STATE.colorPuestos[puesto]) return STATE.colorPuestos[puesto];
  
  if (CONFIG.coloresFijosPuestos[puesto]) {
    STATE.colorPuestos[puesto] = CONFIG.coloresFijosPuestos[puesto];
    saveToStorage('colorPuestos', STATE.colorPuestos);
    return STATE.colorPuestos[puesto];
  }
  
  const puestosNoFijos = STATE.puestos.filter(p => !CONFIG.coloresFijosPuestos[p]);
  const index = puestosNoFijos.indexOf(puesto);
  
  if (index >= 0) {
    let color = CONFIG.paletaSecundaria[index % CONFIG.paletaSecundaria.length];
    if (color === '#FFFFFF' && !document.body.classList.contains('dark-mode')) {
      color = '#000000';
    }
    STATE.colorPuestos[puesto] = color;
    saveToStorage('colorPuestos', STATE.colorPuestos);
    return color;
  }
  
  STATE.colorPuestos[puesto] = '#CCCCCC';
  saveToStorage('colorPuestos', STATE.colorPuestos);
  return '#CCCCCC';
}

export function renderPuestos() {
  const container = document.getElementById('puestos-container');
  if (!container) return;
  
  container.innerHTML = STATE.puestos.map(p => `
    <div class="puesto" style="border-left: 5px solid ${getColorPuesto(p)}">
      <div class="puesto-header">
        <span>Puesto ${p}</span>
        <button class="quitar-puesto-btn" data-puesto="${p}" aria-label="Quitar puesto ${p}">X</button>
      </div>
      <div class="tarea-buttons">
        ${CONFIG.ordenTareas.map(t => 
          `<button class="add-tarea-btn ${CONFIG.abrev[t]}" data-puesto="${p}" data-tarea="${t}" aria-label="Añadir ${t}">${CONFIG.abrev[t]}</button>`
        ).join('')}
      </div>
    </div>
  `).join('');
}

export function renderDashboard() {
  const container = document.getElementById('dashboard-container');
  if (!container) return;
  
  const logHoy = STATE.log;
  const contador = logHoy.reduce((acc, l) => {
    acc[l.puesto] = acc[l.puesto] || { total: 0, ...CONFIG.ordenTareas.reduce((a, t) => ({ ...a, [t]: 0 }), {}) };
    acc[l.puesto][l.tarea]++;
    acc[l.puesto].total++;
    return acc;
  }, {});

  const puestos = Object.keys(contador).sort((a, b) => contador[b].total - contador[a].total);
  if (puestos.length === 0) {
    container.innerHTML = '<p>No hay registros para hoy.</p>';
    return;
  }
  
  let html = '<table class="tabla-resumen"><thead><tr><th>Puesto</th>' +
    CONFIG.ordenTareas.map(t => `<th>${CONFIG.abrev[t]}</th>`).join('') + '<th>Total</th></tr></thead><tbody>';
  
  puestos.forEach(p => {
    html += `<tr><td><span style="color:${getColorPuesto(p)}; font-weight:bold;">Puesto ${p}</span></td>` +
      CONFIG.ordenTareas.map(t => `<td>${contador[p][t] || 0}</td>`).join('') +
      `<td>${contador[p].total}</td></tr>`;
  });
  
  container.innerHTML = html + '</tbody></table>';
}

export function renderLog() {
  const container = document.getElementById('log-container');
  if (!container) return;
  
  const logHoy = STATE.log.slice(0, 50);
  container.innerHTML = logHoy.map(l => `
    <div class="log-entry">
      <span><strong style="color:${getColorPuesto(l.puesto)};">Puesto ${l.puesto}</strong> | ${l.hora} | ${CONFIG.abrev[l.tarea]}</span>
      <button class="eliminar-log-btn" data-id="${l.id}" aria-label="Eliminar registro">🗑️</button>
    </div>
  `).join('');
}

export function renderAll() {
  renderPuestos();
  renderDashboard();
  renderLog();
}

export function toggleTheme() {
  try {
    document.body.classList.toggle('dark-mode');
    const isDark = document.body.classList.contains('dark-mode');
    const btn = document.getElementById('theme-toggle');
    if (btn) btn.textContent = isDark ? '☀️' : '🌙';
    localStorage.setItem('theme', isDark ? 'dark-mode' : '');
  } catch (e) {
    console.error('Error cambiando tema:', e);
  }
}

export function cambiarVista(vista) {
  STATE.vistaActual = vista;
  
  document.querySelectorAll('.vista-container').forEach(v => v.classList.remove('active'));
  document.querySelectorAll('.modo-toggle button').forEach(b => b.classList.remove('active'));
  
  const vistaEl = document.getElementById(`vista-${vista}`);
  if (vistaEl) vistaEl.classList.add('active');
  
  const boton = document.querySelector(`[data-vista="${vista}"]`);
  if (boton) boton.classList.add('active');
  
  if (vista === 'historial') {
    cambiarSubVistaHistorial('completo');
  }
  if (vista === 'horas') {
    renderDistribucionHoras('hoy');
  }
  if (vista === 'graficas') {
    renderGraficas('daily');
  }
}

export function cambiarSubVistaHistorial(subVista) {
  const completo = document.getElementById('hist-completo');
  const compact = document.getElementById('hist-compact');
  
  if (completo) completo.style.display = 'none';
  if (compact) compact.style.display = 'none';
  
  document.querySelectorAll('.hist-tabs button').forEach(b => b.classList.remove('active'));
  
  const subVistaEl = document.getElementById(`hist-${subVista}`);
  if (subVistaEl) subVistaEl.style.display = 'block';
  
  const botonSubVista = document.querySelector(`.hist-tabs button[data-sub="${subVista}"]`);
  if (botonSubVista) botonSubVista.classList.add('active');
  
  if (subVista === 'completo') {
    renderHistorialCompleto();
  }
}

export function renderHistorialCompleto() {
  const cont = document.getElementById('hist-completo');
  if (!cont) return;
  cont.innerHTML = '<p>Cargando historial...</p>';

  const allLogs = [];
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('log-')) {
      const dayLogs = loadFromStorage(key, []);
      allLogs.push(...dayLogs);
    }
  }

  const porFecha = allLogs.reduce((acc, l) => {
    if (!acc[l.fecha]) acc[l.fecha] = [];
    acc[l.fecha].push(l);
    return acc;
  }, {});
  
  const fechas = Object.keys(porFecha).sort((a, b) => parseDdMmYyyy(b).getTime() - parseDdMmYyyy(a).getTime());
  
  if (fechas.length === 0) {
    cont.innerHTML = '<p>No hay historial.</p>';
    return;
  }
  
  cont.innerHTML = fechas.map(f => {
    const fecha = parseDdMmYyyy(f);
    const titulo = fecha.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    return `
      <div class="puesto">
        <div class="puesto-header">
          <h3 style="margin:0;">${titulo}</h3>
        </div>
        ${porFecha[f].map(l => `
          <div class="log-entry">
            <span><strong style="color:${getColorPuesto(l.puesto)};">Puesto ${l.puesto}</strong> - ${l.hora} - ${CONFIG.abrev[l.tarea]}</span>
            <button class="eliminar-log-btn" data-id="${l.id}" aria-label="Eliminar registro">🗑️</button>
          </div>
        `).join('')}
      </div>
    `;
  }).join('');
}

export function renderDistribucionHoras(rango) {
  const cont = document.getElementById('horas-container');
  if (!cont) return;
  cont.innerHTML = '<p>Cargando datos...</p>';
  
  const hoy = new Date();
  let start, end;

  switch (rango) {
    case 'hoy':
      start = end = STATE.jornadaActual;
      break;
    case 'ayer':
      const ayer = new Date(hoy);
      ayer.setDate(hoy.getDate() - 1);
      start = end = yyyyMmDd(ayer);
      break;
    case '7dias':
      const sieteDiasAtras = new Date(hoy);
      sieteDiasAtras.setDate(hoy.getDate() - 6);
      start = yyyyMmDd(sieteDiasAtras);
      end = yyyyMmDd(hoy);
      break;
    case 'mes':
      const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      start = yyyyMmDd(primerDiaMes);
      end = yyyyMmDd(hoy);
      break;
    default:
      start = end = STATE.jornadaActual;
  }

  const logFiltrado = getLogsForDateRange(start, end);

  if (logFiltrado.length === 0) {
    cont.innerHTML = '<p>No hay datos para este rango.</p>';
    return;
  }

  const esfuerzo = logFiltrado.reduce((acc, l) => {
    acc[l.puesto] = (acc[l.puesto] || 0) + (CONFIG.tiempos[l.tarea] || 0);
    return acc;
  }, {});

  const totalEsfuerzo = Object.values(esfuerzo).reduce((s, v) => s + v, 0);

  if (totalEsfuerzo === 0) {
    cont.innerHTML = '<p>No hay tareas con tiempo.</p>';
    return;
  }

  const asignacion = {};
  Object.keys(esfuerzo).forEach(p => {
    const minutos = (esfuerzo[p] / totalEsfuerzo) * STATE.jornadaMinutos;
    asignacion[p] = { minutos, horas: minutos / 60 };
  });

  let html = `<h3>Distribución de Horas - ${rango}</h3><table class="tabla-resumen"><thead><tr><th>Puesto</th><th>Tiempo</th><th>Decimal</th></tr></thead><tbody>`;
  Object.keys(asignacion)
    .sort((a, b) => asignacion[b].minutos - asignacion[a].minutos)
    .forEach(p => {
      const h = Math.floor(asignacion[p].minutos / 60);
      const m = Math.round(asignacion[p].minutos % 60);
      html += `<tr><td><strong style="color:${getColorPuesto(p)};">P${p}</strong></td><td>${h}h ${m}min</td><td>${asignacion[p].horas.toFixed(2)}</td></tr>`;
    });
  html += '</tbody></table>';

  cont.innerHTML = html;
}

export function renderGraficas(periodo) {
  if (STATE.chartInstance) {
    STATE.chartInstance.destroy();
    STATE.chartInstance = null;
  }
  
  let fechaInicio = new Date();
  if (periodo === 'weekly') fechaInicio.setDate(fechaInicio.getDate() - 6);
  if (periodo === 'biweekly') fechaInicio.setDate(fechaInicio.getDate() - 14);
  if (periodo === 'monthly') fechaInicio.setDate(fechaInicio.getDate() - 29);
  
  const fechaInicioStr = yyyyMmDd(fechaInicio);
  const hoyStr = yyyyMmDd(new Date());
  
  const logParaGraficar = getLogsForDateRange(fechaInicioStr, hoyStr);
  
  const contador = logParaGraficar.reduce((acc, l) => {
    acc[l.puesto] = acc[l.puesto] || { ...CONFIG.ordenTareas.reduce((a, t) => ({ ...a, [t]: 0 }), {}), total: 0 };
    acc[l.puesto][l.tarea]++;
    acc[l.puesto].total++;
    return acc;
  }, {});
  
  const puestos = Object.keys(contador).sort((a, b) => contador[b].total - contador[a].total);
  
  const datasets = CONFIG.ordenTareas.map(t => ({
    label: CONFIG.abrev[t],
    data: puestos.map(p => contador[p][t]),
    backgroundColor: CONFIG.coloresTareas[t],
  }));
  
  const ctx = document.getElementById('grafico-puestos');
  if (!ctx) return;
  
  STATE.chartInstance = new Chart(ctx.getContext('2d'), {
    type: 'bar',
    data: { labels: puestos.map(p => `Puesto ${p}`), datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      scales: { x: { stacked: true }, y: { stacked: true, beginAtZero: true } },
    },
  });
}