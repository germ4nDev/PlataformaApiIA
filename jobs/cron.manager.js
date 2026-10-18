/*
    Author: German Valencia
    Manager: Orquestador central de tareas en segundo plano (CRON)

    Variables de entorno:
      CRON_ENABLED=true               Enciende el orquestador (apagado por defecto).
      CRON_JOBS_OFF=clave1,clave2     Apaga jobs puntuales aunque estén activos por defecto.
      CRON_JOBS_ON=clave1,clave2      Enciende jobs que vienen apagados por defecto (simuladores, homologación).
      CRON_TZ=America/Bogota          Zona horaria de los horarios (por defecto America/Bogota).

    Cada job pasa por utils/monitorETL: candado anti-solapamiento, timeout, bitácora y aviso por socket.
*/
const cron = require('node-cron');
const { sequelize } = require('../database/connection');

const MaritimoRepository = require('../repositories/torre-control/maritimo.repository');
const ClimateIngestionService = require('../services/torre-control/climate-ingestion.service');
const IngestionService = require('../services/torre-control/ingestion.service');
const ReportesService = require('../services/torre-control/reportes.service');
const SincronizacionService = require('./sincronizacion.service');
const flotaTerrestreService = require('../services/torre-control/flota-terrestre.service');
const gnlService = require('../services/torre-control/gnl-telemetria.service');
const ejecutarConMonitoreo = require('../utils/monitorETL');

const MINUTO = 60 * 1000;
const esProduccion = process.env.NODE_ENV === 'production';

async function homologarNavesPendientes() {
  const pendientes = await MaritimoRepository.getNavesSinHomologar();
  let homologadas = 0;

  for (const nave of pendientes) {
    const [ref] = await sequelize.query(
      'SELECT TOP 1 mmsi FROM dbo.TCL_Referencia_OMI_MMSI WHERE omi = :omi',
      { replacements: { omi: nave.omi }, type: sequelize.QueryTypes.SELECT }
    );
    if (ref?.mmsi) {
      await MaritimoRepository.registrarHomologacion(nave.id_aviso, ref.mmsi);
      homologadas++;
    }
  }
  return { insertados: homologadas };
}

/**
 * Catálogo de jobs. `activo` es el valor por defecto; se sobreescribe con CRON_JOBS_ON / CRON_JOBS_OFF.
 */
const JOBS = [
  {
    clave: 'clima-etl', nombre: '🔄 ETL Nacional de Clima', horario: '*/15 * * * *',
    activo: true, timeoutMs: 10 * MINUTO,
    tarea: () => ClimateIngestionService.ejecutarIngesta(sequelize),
  },
  {
    clave: 'alertas-climaticas', nombre: '🔄 Sincronización de alertas climáticas', horario: '7-59/15 * * * *',
    activo: true, timeoutMs: 10 * MINUTO,
    tarea: () => SincronizacionService.sincronizarAlertasClimaticas(),
  },
  {
    clave: 'motonaves', nombre: '🔄 Escaneo de motonaves', horario: '*/30 * * * *',
    activo: true, timeoutMs: 20 * MINUTO,
    tarea: () => IngestionService.sincronizarMotonavesColombia(),
  },
  {
    clave: 'eventos-viales', nombre: '🔄 Eventos viales TomTom', horario: '*/10 * * * *',
    activo: true, timeoutMs: 5 * MINUTO,
    tarea: () => SincronizacionService.sincronizarEventosViales(),
  },
  {
    clave: 'boletines-dimar', nombre: '🔄 Boletines externos DIMAR', horario: '0 */6 * * *',
    activo: true, timeoutMs: 15 * MINUTO,
    tarea: () => ReportesService.escanearBoletinesDIMAR(),
  },
  {
    clave: 'productividad-diaria', nombre: '🔄 Reporte de productividad del día anterior', horario: '0 2 * * *',
    activo: true, timeoutMs: 20 * MINUTO,
    tarea: () => ReportesService.generarReporteProductividadAyer(),
  },
  {
    clave: 'boletin-semanal', nombre: '🔄 Boletín semanal', horario: '30 2 * * *',
    activo: true, timeoutMs: 20 * MINUTO,
    tarea: () => ReportesService.generarBoletinSemanal(),
  },
  {
    clave: 'gnl-consolidacion', nombre: '🔄 Consolidación telemetría GNL', horario: '*/5 * * * *',
    activo: true, timeoutMs: 4 * MINUTO,
    tarea: async () => { await gnlService.consolidarTelemetria(); return 0; },
  },
  {
    // Simulador: apagado en producción por defecto.
    clave: 'simulador-flota', nombre: '🔄 Simulación de movimiento de flota', horario: '*/50 * * * * *',
    activo: !esProduccion, timeoutMs: 45 * 1000,
    tarea: () => flotaTerrestreService.simularMovimientoFlota(),
  },
  {
    // Requerido por AIS: alimenta el MMSI de las naves. Apagado hasta validarlo en BD.
    clave: 'homologacion-mmsi', nombre: '🔄 Homologación de naves (OMI → MMSI)', horario: '0 * * * *',
    activo: false, timeoutMs: 10 * MINUTO,
    tarea: homologarNavesPendientes,
  },
];

function listaEnv(nombre) {
  return new Set((process.env[nombre] || '').split(',').map(s => s.trim()).filter(Boolean));
}

function initCronJobs() {
  if (process.env.CRON_ENABLED !== 'true') {
    console.log('⏸️ [CRON] Orquestador apagado (CRON_ENABLED != true).');
    return [];
  }

  const encender = listaEnv('CRON_JOBS_ON');
  const apagar = listaEnv('CRON_JOBS_OFF');
  const timezone = process.env.CRON_TZ || 'America/Bogota';
  const programados = [];

  for (const job of JOBS) {
    const activo = apagar.has(job.clave) ? false : (encender.has(job.clave) || job.activo);
    if (!activo) {
      console.log(`   ⚪ ${job.clave} (apagado)`);
      continue;
    }
    if (!cron.validate(job.horario)) {
      console.error(`   ❌ ${job.clave}: horario inválido "${job.horario}"`);
      continue;
    }

    const tarea = cron.schedule(
      job.horario,
      () => ejecutarConMonitoreo(job.nombre, job.tarea, { timeoutMs: job.timeoutMs }),
      { name: job.clave, timezone }
    );
    programados.push(tarea);
    console.log(`   🟢 ${job.clave} · ${job.horario}`);
  }

  console.log(`✅ [CRON] ${programados.length} de ${JOBS.length} tareas programadas (${timezone}).`);
  return programados;
}

module.exports = { initCronJobs, JOBS };
