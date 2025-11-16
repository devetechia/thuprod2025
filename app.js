import { CONFIG } from './config.js';

import { loadFromStorage, saveToStorage, migrateHistorial } from './storage.js';

import { getJornadaLogica, showPopup, yyyyMmDd, parseDdMmYyyy } from './utils.js';

import { STATE } from './state.js';
import { renderAll, toggleTheme, cambiarVista, cambiarSubVistaHistorial, renderDistribucionHoras, renderGraficas, renderDashboard, renderLog } from './ui.js';

// VALIDACIONES
function validarPuesto(numStr) {
  if (!numStr || numStr.trim() === '') {
    showPopup('⚠️ Ingresa un número de puesto', 'error');
    return false;
  }
  
  const numero = parseInt(numStr.trim());
  console.log('DEBUG: numStr.trim() =', numStr.trim());
  console.log('DEBUG: parseInt(numStr.trim()) =', numero);
  console.log('DEBUG: /^\d+$/.test(numStr.trim()) =', /^\d+$/.test(numStr.trim()));
  if (isNaN(numero) || !/^\d+$/.test(numStr.trim())) {
    showPopup('⚠️ Solo números permitidos', 'error');
    return false;
  }
  
  if (STATE.puestos.includes(numero.toString())) { // Compare as string since STATE.puestos stores strings
    showPopup('⚠️ Puesto ya existe', 'error');
    return false;
  }
  
  return true;
}

// RENDER


// HANDLERS
function addPuesto() {
  const input = document.getElementById('nuevo-puesto-input');
  if (!input) return;
  
  const num = input.value; // Get raw string value
  if (!validarPuesto(num)) return;
  
  STATE.puestos.push(num.trim()); // Store as string
  STATE.puestos.sort((a, b) => parseInt(a) - parseInt(b));
  
  if (saveToStorage('puestos', STATE.puestos)) {
    renderAll();
    showPopup('✓ Puesto añadido');
    input.value = '';
  }
}

function addTarea(puesto, tarea) {
  const now = new Date();
  const newLog = {
    id: Date.now(),
    puesto,
    tarea,
    fecha: STATE.jornadaActual,
    hora: now.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  };
  
  STATE.log.unshift(newLog);
  
  if (saveToStorage(`log-${STATE.jornadaActual}`, STATE.log)) {
    renderDashboard();
    renderLog();
    showPopup('✓ Registro añadido');
  } else {
    STATE.log.shift(); // Revertir si falla
  }
}

function quitarPuesto(puesto) {
  if (!confirm(`¿Seguro que quieres quitar el puesto ${puesto}?`)) return;
  
  STATE.puestos = STATE.puestos.filter(p => p !== puesto);
  
  if (saveToStorage('puestos', STATE.puestos)) {
    renderAll();
    showPopup('✓ Puesto eliminado');
  }
}

function eliminarLog(id) {
  const logId = parseInt(id);
  
  const logHoyInicial = STATE.log.length;
  STATE.log = STATE.log.filter(l => l.id !== logId);
  
  if (logHoyInicial > STATE.log.length) {
    if (saveToStorage(`log-${STATE.jornadaActual}`, STATE.log)) {
      renderDashboard();
      renderLog();
      showPopup('✓ Registro eliminado');
    }
    return;
  }

  // Fallback to search in old logs
  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i);
    if (key.startsWith('log-')) {
      let logDia = loadFromStorage(key, []);
      const logDiaInicial = logDia.length;
      logDia = logDia.filter(l => l.id !== logId);
      if (logDiaInicial > logDia.length) {
        if (saveToStorage(key, logDia)) {
          if (STATE.vistaActual === 'historial') {
            renderHistorialCompleto();
          }
          showPopup('✓ Registro eliminado del historial');
        }
        return;
      }
    }
  }
}

function clearToday() {
  if (!confirm('¿Seguro que quieres borrar todos los registros de hoy?')) return;
  
  STATE.log = [];
  
  if (saveToStorage(`log-${STATE.jornadaActual}`, STATE.log)) {
    renderAll();
    showPopup('✓ Registros de hoy eliminados');
  }
}

function resetColors() {
  if (!confirm('¿Resetear todos los colores?')) return;
  
  STATE.colorPuestos = {};
  
  if (saveToStorage('colorPuestos', STATE.colorPuestos)) {
    renderAll();
    showPopup('✓ Colores reseteados');
  }
}



function finalizarJornada() {
  if (!confirm('¿Finalizar jornada y guardar en historial?')) return;
  
  const logHoy = STATE.log.filter(l => l.fecha === STATE.jornadaActual);
  
  if (logHoy.length === 0) {
    showPopup('⚠️ No hay registros para finalizar', 'error');
    return;
  }
  
  if (!saveToStorage(`log-${STATE.jornadaActual}`, logHoy)) return;
  
  STATE.log = [];
  
  const today = new Date();
  today.setDate(today.getDate() + 1);
  STATE.jornadaActual = yyyyMmDd(today);
  localStorage.setItem('jornadaActual', STATE.jornadaActual);

  // Export to CSV
  const filename = `registros_jornada_${logHoy[0].fecha}.csv`; // Use the date of the finalized log
  exportToCsv(logHoy, filename);
  
  renderAll();
  showPopup('✓ Jornada finalizada correctamente');
}

function handleUpdateJornadaMinutos() {
  const input = document.getElementById('jornada-minutos-input');
  if (!input) return;

  const newMinutos = parseInt(input.value.trim());

  if (isNaN(newMinutos) || newMinutos <= 0) {
    showPopup('⚠️ Ingresa un número válido y positivo para los minutos de jornada.', 'error');
    return;
  }

  STATE.jornadaMinutos = newMinutos;
  localStorage.setItem('jornadaMinutos', newMinutos); // Save to localStorage

  // Update the display next to the input
  const display = document.getElementById('jornada-horas-display');
  if (display) {
    const h = Math.floor(newMinutos / 60);
    const m = newMinutos % 60;
    display.textContent = `(${h}h ${m}m)`;
  }

  // Re-render the 'Horas' view if it's active, or just update the calculations
  if (STATE.vistaActual === 'horas') {
    renderDistribucionHoras(document.querySelector('.horas-filtros button.active')?.dataset.rango || 'hoy');
  }
  
  showPopup('✓ Minutos de jornada actualizados.');
}

function exportToCsv(logToExport, filename = 'registros_jornada.csv') {
  if (!logToExport || logToExport.length === 0) {
    showPopup('⚠️ No hay datos para exportar.', 'error');
    return;
  }

  const headers = ['ID', 'Puesto', 'Tarea', 'Fecha', 'Hora'];
  const rows = logToExport.map(l => [
    l.id,
    l.puesto,
    CONFIG.abrev[l.tarea] || l.tarea, // Use abbreviation if available
    l.fecha,
    l.hora
  ]);

  let csvContent = headers.join(',') + '\n';
  rows.forEach(row => {
    csvContent += row.map(item => `"${item}"`).join(',') + '\n'; // Quote items to handle commas
  });

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  if (link.download !== undefined) { // Feature detection for download attribute
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    showPopup('✓ Datos exportados a CSV.');
  } else {
    showPopup('⚠️ Tu navegador no soporta la descarga automática de archivos.', 'error');
  }
}

// SETUP LISTENERS
function setupListeners() {
  const themeBtn = document.getElementById('theme-toggle');
  if (themeBtn) themeBtn.onclick = toggleTheme;
  
  const addBtn = document.getElementById('add-puesto-btn');
  if (addBtn) addBtn.onclick = addPuesto;
  
  const input = document.getElementById('nuevo-puesto-input');
  if (input) {
    input.onkeypress = (e) => {
      if (e.key === 'Enter') addPuesto();
    };
  }
  
  const clearBtn = document.getElementById('clear-today-btn');
  if (clearBtn) clearBtn.onclick = clearToday;
  
  const resetBtn = document.getElementById('reset-colors-btn');
  if (resetBtn) resetBtn.onclick = resetColors;
  
  const finalizarBtn = document.getElementById('finalizar-jornada-btn');
  if (finalizarBtn) finalizarBtn.onclick = finalizarJornada;
  
  const saveJornadaBtn = document.getElementById('save-jornada-btn');
  if (saveJornadaBtn) saveJornadaBtn.onclick = handleUpdateJornadaMinutos;
  
  const modoToggle = document.querySelector('.modo-toggle');
  if (modoToggle) {
    modoToggle.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' && e.target.dataset.vista) {
        cambiarVista(e.target.dataset.vista);
      }
    };
  }

  const histTabs = document.querySelector('.hist-tabs');
  if (histTabs) {
    histTabs.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' && e.target.dataset.sub) {
        cambiarSubVistaHistorial(e.target.dataset.sub);
      }
    };
  }
  
  const horasFiltros = document.querySelector('.horas-filtros');
  if (horasFiltros) {
    horasFiltros.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' && e.target.dataset.rango) {
        document.querySelectorAll('.horas-filtros button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderDistribucionHoras(e.target.dataset.rango);
      }
    };
  }
  
  const graficasFiltros = document.querySelector('.filtros-graficas');
  if (graficasFiltros) {
    graficasFiltros.onclick = (e) => {
      if (e.target.tagName === 'BUTTON' && e.target.dataset.periodo) {
        document.querySelectorAll('.filtros-graficas button').forEach(b => b.classList.remove('active'));
        e.target.classList.add('active');
        renderGraficas(e.target.dataset.periodo);
      }
    };
  }
  
  document.body.onclick = (e) => {
    const target = e.target;
    
    if (target.classList.contains('add-tarea-btn')) {
      addTarea(target.dataset.puesto, target.dataset.tarea);
    }
    
    if (target.classList.contains('quitar-puesto-btn')) {
      quitarPuesto(target.dataset.puesto);
    }
    
    if (target.classList.contains('eliminar-log-btn')) {
      eliminarLog(target.dataset.id);
    }
  };
}

// INIT
function init() {
  try {
    console.log('Initializing app...');

    if (!localStorage.getItem('historialMigrado')) {
      migrateHistorial();
    }
    
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark-mode') {
      document.body.classList.add('dark-mode');
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = '☀️';
    }
    
    const jornadaInput = document.getElementById('jornada-minutos-input');
    if (jornadaInput) {
      jornadaInput.value = STATE.jornadaMinutos;
      const display = document.getElementById('jornada-horas-display');
      if (display) {
        const h = Math.floor(STATE.jornadaMinutos / 60);
        const m = STATE.jornadaMinutos % 60;
        display.textContent = `(${h}h ${m}m)`;
      }
    }
    
    renderAll();
    setupListeners();
    


    console.log('=== APP INITIALIZED ===');
  } catch (e) {
    console.error('Error crítico inicializando:', e);
    alert('Error iniciando la aplicación. Recarga la página.');
  }
}

// EJECUTAR
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
