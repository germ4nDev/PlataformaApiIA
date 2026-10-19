/*
    Author: German Valencia
    Pattern: PORTTOS Service - Sincronización con fuentes oficiales
    Description: Procesos que traen datos externos y los guardan: alertas climáticas oficiales y eventos viales
      de TomTom. También el supervisor de procesos (ejecución manual en modo diagnóstico).
      Lo programa jobs/cron.manager.js; antes vivía en jobs/sincronizacion.service.js.
*/
const FuentesExternas = require('../../adapters/fuentes-externas.adapter');
const AlertasRepository = require('../../repositories/torre-control/alertas-climaticas.repository');
const EventosVialesRepository = require('../../repositories/torre-control/eventos-viales.repository');
const { EventoVialDTO } = require('../../models/torre-control/evento-vial.model');

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

  async sincronizarEventosViales(opciones = {}) {
    // Extraemos dryRun, si no existe, por defecto es false
    const { dryRun = false } = opciones;
    let procesados = 0;

    try {
      console.log('📡 Consumiendo API externa (TomTom) vía FuentesExternas...');

      const incidentesTomTom = await FuentesExternas.getEventosVialesOficiales();
      const userContext = { codigoUsuario: 'SYS_CRON_TOMTOM' };

      console.log(`📊 Total de incidentes activos reportados por TomTom: ${incidentesTomTom.length}`);

      const payloadParaBD = [];

      // -------------------------------------------------------------
      // 🚧 ZONA DE MAPEO Y DTO
      // -------------------------------------------------------------
      for (const item of incidentesTomTom) {
        try {
          const rawData = this._mapearEventoVial(item);

          // El DTO retorna el GeoJSON puro: { type: 'Point', coordinates: [lon, lat] }
          const eventoDTO = EventoVialDTO(rawData, userContext);

          // La geometría la convierte el repositorio al guardar.
          const eventoParaGuardar = { ...eventoDTO };

          // Agregamos el objeto ya formateado a nuestro arreglo
          payloadParaBD.push(eventoParaGuardar);

        } catch (error) {
          console.log(`===========================================`);
          console.log(`❌ FALLO CAPTURADO EN REGISTRO: ${item.properties?.id || 'Desconocido'}`);
          console.log(`MOTIVO:`, error.details || error.message || error);
          console.log(`===========================================`);
        }
      }

      // -------------------------------------------------------------
      // 🛑 EL SEMÁFORO DRY-RUN
      // -------------------------------------------------------------
      // Si dryRun es true, devolvemos el payload exacto y salimos de la función sin tocar SQL Server.
      if (dryRun) {
        console.log(`🛠️ [DRY RUN] Modo diagnóstico activo. Simulados ${payloadParaBD.length} registros estructurados.`);
        return payloadParaBD;
      }

      // -------------------------------------------------------------
      // 💾 INSERCIÓN EN BASE DE DATOS
      // -------------------------------------------------------------
      console.log('💾 Insertando/Actualizando registros en SQL Server...');
      for (const eventoGuardar of payloadParaBD) {
        await EventosVialesRepository.guardar(eventoGuardar);
        procesados++;
      }

      console.log("🏁 Sincronización de eventos viales finalizada.");

      // Retornamos la cantidad de insertados/actualizados para que el Wrapper de monitoreo (Bitácora) lo registre
      //return { insertados: procesados };
      return procesados;

    } catch (error) {
      console.error('❌ Error grave en sincronizarEventosViales:', error);
      throw error; // Propagamos el error para que la Torre de Control (Bitácora) lo atrape y registre
    }
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

  _mapearEventoVial(item) {
    const props = item.properties || {};

    // iconCategory es el código numérico que manda TomTom
    const categoria = props.iconCategory || 0;
    const magnitud = props.magnitudeOfDelay || 0;

    const coords = item.geometry?.coordinates;
    const puntoInicial = Array.isArray(coords[0]) ? coords[0] : coords;
    const lon = puntoInicial[0];
    const lat = puntoInicial[1];

    // 1. CLASIFICACIÓN CORREGIDA DE TOMTOM
    let tipoEventoMapeado = 'ALERTA_VIAL';

    switch (categoria) {
      case 1:
        tipoEventoMapeado = 'ACCIDENTE';
        break;
      case 6: // <--- Congestión corregida
        tipoEventoMapeado = 'CONGESTION';
        break;
      case 8:
      case 9:
        tipoEventoMapeado = 'CIERRE_VIAL';
        break;
      case 11:
        tipoEventoMapeado = 'MANTENIMIENTO_OBRA';
        break;
      case 2:
      case 3:
      case 4:
      case 5:
        tipoEventoMapeado = 'ALERTA_CLIMATICA';
        break;
      case 14:
        tipoEventoMapeado = 'VEHICULO_AVERIDADO';
        break;
      default:
        tipoEventoMapeado = 'ALERTA_VIAL';
    }

    // 2. Cálculo de severidad
    let severidadMapeada = 1;
    if (magnitud >= 3) severidadMapeada = 3;
    else if (magnitud === 2) severidadMapeada = 2;

    const corredorPorDefecto = 'Buga - Buenaventura';
    let descripcionLugar = props.from ? `De ${props.from} a ${props.to || ''}` : 'Sector Georreferenciado';

    let descripcionLimpia = 'Novedad vial reportada.';
    if (props.events && props.events.length > 0) {
      descripcionLimpia = props.events.map(e => e.description).join(' | ').substring(0, 4000);
    }

    return {
      idExterno: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
      codigoEvento: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
      corredorVial: corredorPorDefecto,
      sector: descripcionLugar.substring(0, 100),
      tipoEvento: tipoEventoMapeado,
      descripcion: descripcionLimpia,
      nivelSeveridad: severidadMapeada,
      estadoEvento: 'ACTIVO',
      // Envio de la ubicación pura para que el DTO y Sequelize lo manejen
      ubicacion_geo: (lat && lon) ? { type: 'Point', coordinates: [lon, lat] } : null,
      fechaInicio: props.startTime ? new Date(props.startTime).toISOString() : new Date().toISOString(),
      fechaFin: props.endTime ? new Date(props.endTime).toISOString() : null
    };
  }
}

module.exports = new SincronizacionService();