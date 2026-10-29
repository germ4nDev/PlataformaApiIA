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

const HomologacionMmsiService = require('../services/torre-control/homologacion-mmsi.service');
const ClimateIngestionService = require('../services/torre-control/climate-ingestion.service');
const ReportesService = require('../services/torre-control/reportes.service');
const SincronizacionService = require('../services/torre-control/sincronizacion.service');
const gnlService = require('../services/torre-control/gnl-telemetria.service');
const AlertasMapaService = require('../services/torre-control/alertas-mapa.service');
const RecorridoMapaService = require('../services/torre-control/recorrido-mapa.service');
const SimuladorFlotaService = require('../services/torre-control/simulador-flota.service');
const SimuladorOperacionService = require('../services/torre-control/simulador-operacion.service');
const NoticiasService = require('../services/torre-control/noticias.service');
const FotoOperativaService = require('../services/ia/foto-operativa.service');
const AnalistaService = require('../services/ia/analista.service');
const ResumenesIAService = require('../services/ia/resumenes-ia.service');
const { configIA } = require('../config/ia.config');
const ejecutarConMonitoreo = require('../utils/monitorETL');

const MINUTO = 60 * 1000;
const esProduccion = process.env.NODE_ENV === 'production';


/**
 * Catálogo de jobs. `activo` es el valor por defecto; se sobreescribe con CRON_JOBS_ON / CRON_JOBS_OFF.
 */
const JOBS = [
  {
    clave: 'clima-etl', nombre: '🔄 ETL Nacional de Clima', horario: '*/15 * * * *',
    activo: true, timeoutMs: 10 * MINUTO,
    tarea: () => ClimateIngestionService.ejecutarIngesta(),
  },
  {
    clave: 'alertas-climaticas', nombre: '🔄 Sincronización de alertas climáticas', horario: '7-59/15 * * * *',
    activo: true, timeoutMs: 10 * MINUTO,
    tarea: () => SincronizacionService.sincronizarAlertasClimaticas(),
  },
  // 'motonaves' (VesselFinder) se retiró el 2026-10-18: usaba la clave de AISStream contra otro proveedor y
  // escribía con un modelo inexistente, así que fallaba en cada ejecución. Las posiciones AIS las mantiene
  // el motor AIS (services/torre-control/ais-stream.service.js).
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
    // Alertas del mapa por puerto: ocupación de muelles y naves fondeadas mucho tiempo (umbrales en TCL_ConfigAlertas).
    clave: 'alertas-puertos', nombre: '🔔 Alertas del mapa por puerto', horario: '*/2 * * * *',
    activo: true, timeoutMs: 90 * 1000,
    tarea: () => AlertasMapaService.evaluarPuertos(),
  },
  {
    // Retención de la bitácora de alertas (TCL_AlertasMapa): 30 días.
    clave: 'alertas-limpieza', nombre: '🧹 Limpieza de alertas del mapa', horario: '15 3 * * *',
    activo: true, timeoutMs: 5 * MINUTO,
    tarea: () => AlertasMapaService.limpiar(),
  },
  {
    // Modo reproducir del mapa: una muestra por minuto de las naves y camiones que cambiaron (TCL_RecorridoMapa).
    clave: 'recorrido-muestreo', nombre: '🎞️ Muestreo del recorrido del mapa', horario: '* * * * *',
    activo: true, timeoutMs: 50 * 1000, soloFallos: true,
    tarea: () => RecorridoMapaService.muestrear(),
  },
  // Capa de análisis con IA, fase 1 (sin modelo): fotos de KPI y su retención. IA_SNAPSHOTS_ENABLED en el .env.
  {
    clave: 'ia-fotos', nombre: '📸 Fotos de KPI para el análisis IA', horario: '*/15 * * * *',
    activo: configIA.fotosHabilitadas, timeoutMs: 5 * MINUTO, soloFallos: true,
    tarea: () => FotoOperativaService.tomarFotos(),
  },
  // Fase 2: analista de turno en modo sombra. Solo con IA_ENABLED=true; el modelo se llama si hay señales nuevas o por latido.
  {
    clave: 'ia-analista', nombre: '🧠 Analista IA de turno', horario: configIA.intervaloAnalistaMin < 60 ? `*/${configIA.intervaloAnalistaMin} * * * *` : '5 * * * *',
    activo: configIA.habilitada, timeoutMs: 5 * MINUTO,
    tarea: () => AnalistaService.ejecutarTurno(),
  },
  // Fase 3: cierre del ciclo. Al vencer el horizonte de cada alerta revisa con las fotos de KPI si se cumplió (sin modelo).
  {
    clave: 'ia-verificacion', nombre: '✅ Verificación de las alertas tempranas IA', horario: '35 * * * *',
    activo: configIA.fotosHabilitadas, timeoutMs: 5 * MINUTO, soloFallos: true,
    tarea: () => AnalistaService.verificarVencidos(),
  },
  // Fase 4: cierre de turno y resumen diario (IA_TURNOS, hora de Colombia). Sin IA o sin presupuesto: resumen automático.
  {
    clave: 'ia-resumenes', nombre: '📝 Cierre de turno y resumen diario IA', horario: '5 * * * *',
    activo: configIA.resumenesHabilitados && configIA.fotosHabilitadas, timeoutMs: 8 * MINUTO,
    tarea: () => ResumenesIAService.cerrarPeriodos(),
  },
  {
    clave: 'ia-limpieza', nombre: '🧹 Retención de las fotos de KPI', horario: '20 4 * * *',
    activo: configIA.fotosHabilitadas, timeoutMs: 10 * MINUTO,
    tarea: () => FotoOperativaService.limpiar(),
  },
  {
    // Retención del recorrido: RECORRIDO_RETENCION_DIAS (3 por defecto).
    clave: 'recorrido-limpieza', nombre: '🧹 Limpieza del recorrido del mapa', horario: '45 3 * * *',
    activo: true, timeoutMs: 10 * MINUTO,
    tarea: () => RecorridoMapaService.limpiar(),
  },
  {
    // Noticias del sector (Google News RSS y, con GNEWS_API_KEY, GNews) → TCL_Noticias.
    clave: 'noticias', nombre: '📰 Noticias del sector', horario: '5,35 * * * *',
    activo: true, timeoutMs: 3 * MINUTO,
    tarea: () => NoticiasService.sincronizarNoticias(),
  },
  {
    // TRM de datos.gov.co → TCL_IndicadoresMercado.
    clave: 'indicadores-mercado', nombre: '💱 TRM del día', horario: '20 */6 * * *',
    activo: true, timeoutMs: MINUTO,
    tarea: () => NoticiasService.sincronizarTrm(),
  },
  {
    // Retención: noticias 60 días; avance de operación y fotos de capacidad 30 días.
    clave: 'tableros-limpieza', nombre: '🧹 Limpieza de noticias y operación', horario: '55 3 * * *',
    activo: true, timeoutMs: 10 * MINUTO,
    tarea: async () => { await NoticiasService.limpiar(); await SimuladorOperacionService.limpiar(); return 0; },
  },
  {
    // Operación simulada de granel, Ro-Ro, vehículos, carga suelta y capacidad mientras no llegue la ingesta real
    // (SIMULADOR_OPERACION_PUERTOS, por defecto BUENAVENTURA). Apagado en producción por defecto.
    clave: 'simulador-operacion', nombre: '🔄 Simulación de operación portuaria', horario: '*/5 * * * *',
    activo: !esProduccion, timeoutMs: 4 * MINUTO, soloFallos: true,
    tarea: () => SimuladorOperacionService.ciclo(),
  },
  {
    // Simulador de flota (utils/simulador-flota.js): cada 10 s, por distancia, con peajes, cola, cargue y regreso.
    // Apagado en producción por defecto.
    clave: 'simulador-flota', nombre: '🔄 Simulación de movimiento de flota', horario: '*/10 * * * * *',
    activo: !esProduccion, timeoutMs: 30 * 1000, soloFallos: true,
    tarea: () => SimuladorFlotaService.ciclo(),
  },

  {
    // Requerido por AIS: alimenta el MMSI de las naves. Apagado hasta validarlo en BD.
    clave: 'homologacion-mmsi', nombre: '🔄 Homologación de naves (OMI → MMSI)', horario: '0 * * * *',
    activo: false, timeoutMs: 10 * MINUTO,
    tarea: () => HomologacionMmsiService.homologarPendientes(),
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
      () => ejecutarConMonitoreo(job.nombre, job.tarea, { timeoutMs: job.timeoutMs, soloFallos: job.soloFallos }),
      { name: job.clave, timezone }
    );
    programados.push(tarea);
    console.log(`   🟢 ${job.clave} · ${job.horario}`);
  }

  console.log(`✅ [CRON] ${programados.length} de ${JOBS.length} tareas programadas (${timezone}).`);
  return programados;
}

module.exports = { initCronJobs, JOBS };
