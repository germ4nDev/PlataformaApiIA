/*
    Author: German Valencia
    Monitor ETL: ejecuta un proceso de segundo plano con candado anti-solapamiento,
    timeout, bitácora en TCL_BitacoraSincronizacion y aviso por socket.
*/
const { BitacoraSincronizacion } = require('../models');
const { getIO } = require('../helpers/socket.helper');
const { SALA_OPERACION } = require('../helpers/salas.helper');

const TIMEOUT_POR_DEFECTO_MS = 10 * 60 * 1000; // 10 minutos
const procesosEnCurso = new Set();

/**
 * Normaliza lo que retorna un ETL a un número de registros procesados.
 * Acepta: número, array, { insertados }, { procesados }, { length } o cualquier otro valor (→ 0).
 */
function contarRegistros(resultado) {
  if (typeof resultado === 'number' && Number.isFinite(resultado)) return resultado;
  if (Array.isArray(resultado)) return resultado.length;
  if (resultado && typeof resultado === 'object') {
    const n = resultado.insertados ?? resultado.procesados ?? resultado.length;
    if (typeof n === 'number' && Number.isFinite(n)) return n;
  }
  return 0;
}

function conTimeout(promesa, ms, nombreProceso) {
  let temporizador;
  const limite = new Promise((_, reject) => {
    temporizador = setTimeout(
      () => reject(new Error(`Timeout: ${nombreProceso} superó ${Math.round(ms / 1000)} s`)),
      ms
    );
  });
  return Promise.race([promesa, limite]).finally(() => clearTimeout(temporizador));
}

function emitirEstado(payload) {
  try {
    getIO().to(SALA_OPERACION).emit('crons-actualizados', payload);
  } catch (_) {
    // Socket.io aún no inicializado (por ejemplo, en scripts): no es un error del ETL.
  }
}

/**
 * @param {string} nombreProceso  Nombre legible para la bitácora.
 * @param {Function} funcionETL   Función async que ejecuta el proceso.
 * @param {{ timeoutMs?: number }} [opciones]
 */
async function ejecutarConMonitoreo(nombreProceso, funcionETL, opciones = {}) {
  const timeoutMs = opciones.timeoutMs || TIMEOUT_POR_DEFECTO_MS;

  if (procesosEnCurso.has(nombreProceso)) {
    console.warn(`⏭️ [MONITOR] ${nombreProceso}: la ejecución anterior sigue en curso, se omite este ciclo.`);
    return { omitido: true };
  }
  procesosEnCurso.add(nombreProceso);

  const inicio = Date.now();
  let estado = 'FALLIDO';
  let cantidad = 0;
  let mensajeError = 'Ninguno';
  let resultado;

  try {
    resultado = await conTimeout(Promise.resolve().then(funcionETL), timeoutMs, nombreProceso);
    cantidad = contarRegistros(resultado);
    estado = 'EXITO';
  } catch (error) {
    mensajeError = (error && (error.original?.message || error.message)) || 'Error desconocido';
    console.error(`🚨 [MONITOR] Fallo en ${nombreProceso}: ${mensajeError}`);
  } finally {
    procesosEnCurso.delete(nombreProceso);
  }

  const duracion = Date.now() - inicio;
  const fechaISO = new Date().toISOString();

  try {
    await BitacoraSincronizacion.create({
      proceso: nombreProceso,
      estado,
      registros_procesados: cantidad,
      errores: String(mensajeError).substring(0, 4000),
      duracion_ms: duracion,
      fecha_ejecucion: fechaISO,
      createdAt: fechaISO,
      updatedAt: fechaISO,
    });
  } catch (logError) {
    console.error(`❌ [MONITOR] No se pudo guardar la bitácora de ${nombreProceso}: ${logError.message}`);
  }

  console.log(`📋 [MONITOR] ${nombreProceso} → ${estado} · ${cantidad} registros · ${duracion} ms`);
  emitirEstado({ proceso: nombreProceso, estado, timestamp: fechaISO });

  return resultado;
}

module.exports = ejecutarConMonitoreo;
