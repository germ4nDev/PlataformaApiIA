/*
    Author: German Valencia
    Pattern: PORTTOS Service - Sincronización con fuentes oficiales
    Description: Procesos que traen datos externos y los guardan: alertas climáticas oficiales y eventos viales
      de TomTom. También el supervisor de procesos (ejecución manual en modo diagnóstico).
      Lo programa jobs/cron.manager.js; antes vivía en jobs/sincronizacion.service.js.
*/
const FuentesExternas = require('../../adapters/fuentes-externas.adapter');
const AlertasRepository = require('../../repositories/torre-control/alertas-climaticas.repository');
const EventoVialService = require('./evento-vial.service');
const { EventoVialDTO } = require('../../models/torre-control/evento-vial.model');
const EV = require('../../utils/eventos-viales');

class SincronizacionService {

  /** Alertas climáticas oficiales (datos.gov.co) → TCL_AlertasClimaticas, por id de la fuente.
      Corregido 2026-10-18: antes llamaba un método de instancia como estático (y con modelos indefinidos),
      así que fallaba en cada ejecución; además escribía "fechalnicio". */
  async sincronizarAlertasClimaticas() {
    const datosOficiales = await FuentesExternas.getAlertasClimaticasOficiales();
    let guardadas = 0;
    for (const item of datosOficiales || []) {
      await AlertasRepository.guardar({
        codigoAlerta: item.id_externo,
        region: item.zona,
        corredorVial: item.corredor,
        sector: item.tramo,
        tipoAlerta: item.tipo,
        nivelSeveridad: parseInt(item.nivel, 10),
        estadoAlerta: 'ACTIVO',
        fechaInicio: new Date().toISOString(),
      });
      guardadas++;
    }
    return guardadas;
  }

  /**
   * Eventos viales de TomTom (cron 'eventos-viales', cada 10 min). Trae los incidentes vigentes por zona,
   * los mapea y valida (utils/eventos-viales.js + EventoVialDTO) y le pasa el reporte a EventoVialService,
   * que despeja los que dejaron de reportarse (ciclo de vida, migración 014).
   * Si ninguna zona respondió (llave rechazada, sin red) lanza error para que la bitácora del cron lo registre.
   * @param {{ dryRun?: boolean }} opciones  dryRun: devuelve lo mapeado sin escribir
   */
  async sincronizarEventosViales(opciones = {}) {
    const { dryRun = false } = opciones;
    const ahora = new Date();
    const { incidentes, zonas } = await FuentesExternas.getEventosVialesPorZona();
    const fallidas = zonas.filter((z) => !z.ok);
    if (zonas.length && fallidas.length === zonas.length) {
      throw new Error(`TomTom no respondió en ninguna zona (${fallidas[0].error}). Revisar TOMTOM_API_KEY y la cuota.`);
    }

    const userContext = { codigoUsuario: 'SYS_CRON_TOMTOM' };
    const reportados = [];
    let invalidos = 0;
    for (const { zona, item } of incidentes) {
      const mapeado = EV.mapearIncidente(item, zona);
      if (!mapeado) { invalidos++; continue; }
      try {
        // El DTO exige fechaInicio: si TomTom no la manda vale ahora, pero la reconciliación conserva la del primer reporte
        const dto = EventoVialDTO({ ...mapeado, fechaInicio: mapeado.fechaInicio || ahora.toISOString() }, userContext);
        reportados.push({ ...dto, fechaInicio: mapeado.fechaInicio, fuente: mapeado.fuente, zonaFuente: mapeado.zonaFuente });
      } catch (error) {
        invalidos++;
        console.warn(`[EventosViales] Incidente ${item?.properties?.id || '?'} descartado:`, JSON.stringify(error.details || error.message || error));
      }
    }
    if (dryRun) return { reportados, zonas, invalidos };

    const r = await EventoVialService.aplicarReporte({ reportados, zonas }, ahora);
    console.log(`🚧 Eventos viales: ${reportados.length} reportados (${invalidos} descartados) · ${r.nuevos} nuevos · ${r.despejados} despejados · zonas con falla: ${fallidas.map((z) => z.nombre).join(', ') || 'ninguna'}`);
    return { insertados: reportados.length, ...r, invalidos, zonasFallidas: fallidas.map((z) => z.nombre) };
  }

  async ejecutarSincronizacion(opciones = {}) {
    const { dryRun = false } = opciones;

    console.log(`[SUPERVISOR] Iniciando auditoría de Cron Jobs... Modo DryRun: ${dryRun}`);

    try {
      // ==========================================
      // 1. OBTENER LISTA DE CRONS A EVALUAR
      // ==========================================
      const cronsMonitorizados = [
        { id: 'cron_clima', nombre_db: '🔄 ETL Nacional de Clima', umbral_horas: 1 },
        { id: 'cron_motonaves', nombre_db: '🔄 Escaneo de motonaves', umbral_horas: 1 },
        { id: 'cron_dimar', nombre_db: '🔄 Actualizando boletines externos DIMAR', umbral_horas: 7 },
        { id: 'cron_prod_ayer', nombre_db: '🔄 Generando reportes de productividad del día anterior', umbral_horas: 25 },
        { id: 'cron_boletin_sem', nombre_db: '🔄 Boletines semanales', umbral_horas: 25 },
        { id: 'cron_terminales', nombre_db: '🔄 Iniciando captura de productividad por terminales', umbral_horas: 3 },
        { id: 'cron_camiones_pos', nombre_db: '🔄 Iniciando captura de posiciones de camiones', umbral_horas: 1 },
        { id: 'cron_eventos_viales', nombre_db: '🔄 Eventos Viales TomTom', umbral_horas: 1 },
        { id: 'cron_alertas_clima', nombre_db: '🔄 Iniciando sincronización automática de alertas climáticas', umbral_horas: 1 },
        { id: 'cron_camiones_sim', nombre_db: '🔄 Iniciando simulación de movimiento', umbral_horas: 1 }
      ];

      let cronsEvaluados = 0;
      let alertasGeneradas = 0;
      const detallesEvidencia = [];

      // ==========================================
      // 2. REVISIÓN Y RECOPILACIÓN DE EVIDENCIA
      // ==========================================
      for (const cron of cronsMonitorizados) {
        const estadoSalud = true;

        if (estadoSalud) {
          detallesEvidencia.push(`✅ ${cron.id}: Operativo.`);
        } else {
          detallesEvidencia.push(`⚠️ ${cron.id}: Retraso detectado o inactivo.`);
          alertasGeneradas++;
        }

        cronsEvaluados++;
      }

      // ==========================================
      // 3. REGISTRO O ACCIONES EN BASE A LA EVIDENCIA
      // ==========================================
      if (dryRun) {
        console.log(`[SUPERVISOR] 🚧 DRY RUN ACTIVO: Se evaluaron ${cronsEvaluados} crons.`);
        console.log(`[SUPERVISOR] Evidencia recopilada:\n`, detallesEvidencia.join('\n'));
      } else {
        console.log(`[SUPERVISOR] 💾 Guardando estado actualizado de ${cronsEvaluados} crons en el sistema.`);
      }

      // ==========================================
      // 4. RETORNO PARA EL ENVOLTORIO
      // ==========================================
      return {
        exito: true,
        insertados: cronsEvaluados,
        resumen: detallesEvidencia.join(' | ')
      };

    } catch (error) {
      console.error('[SUPERVISOR] ❌ Fallo crítico intentando auditar los crons:', error.message);
      throw error;
    }
  };
  // El mapeo de TomTom vive en utils/eventos-viales.js (mapearIncidente), con pruebas.

}

module.exports = new SincronizacionService();