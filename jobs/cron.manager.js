/*
    Author: German Valencia
    Manager: Orquestador Central de Tareas Programadas (CRON)
*/
const cron = require('node-cron');
const { sequelize } = require('../database/connection');

// 🟢 Importaciones requeridas para evitar el crash del CRON 10
const db = require('../models');
const MaritimoRepository = require('../repositories/torre-control/maritimo.repository');
const MapaGeneralRepository = require('../repositories/torre-control/mapa-general.repository');

const ClimateIngestionService = require('../services/torre-control/climate-ingestion.service');
const IngestionService = require('../services/torre-control/ingestion.service');
const ReportesService = require('../services/torre-control/reportes.service');
const MapaGeneralService = require('../services/torre-control/mapa-general.service');
const SincronizacionService = require('./sincronizacion.service');
const flotaTerrestreService = require('../services/torre-control/flota-terrestre.service');

const mapaRepository = new MapaGeneralRepository(sequelize);
const mapaGeneralService = new MapaGeneralService(mapaRepository);

const ejecutarConMonitoreo = require('../utils/monitorETL');

const initCronJobs = (sequelizeInstance) => {
  console.log('--- [CRON MANAGER] Inicializando tareas en segundo plano ---');
  let simulacionEnCurso = false;

  // ---------------------------------------------------------
  // CRON 1: NUEVO ETL DE CLIMA Y ALERTAS (Open-Meteo / IDEAM)
  // Frecuencia: Cada 15 minutos (*/15 * * * *)
  // ---------------------------------------------------------
  cron.schedule('*/15 * * * *', async () => {
    console.log('⏰ [CRON 15m] Disparando ETL Nacional de Clima...');
    ejecutarConMonitoreo('🔄 ETL Nacional de Clima', async () => {
      return await ClimateIngestionService.ejecutarIngesta(sequelizeInstance);
    });
  });

  // ---------------------------------------------------------
  // CRON 2: MOTONAVES (VesselFinder/Puertos)
  // Frecuencia: Cada 30 minutos
  // ---------------------------------------------------------
  cron.schedule('*/30 * * * *', async () => {
    console.log('⏰ [CRON 30m] Iniciando escaneo de motonaves...');
    ejecutarConMonitoreo('🔄 Escaneo de motonaves', async () => {
      return await IngestionService.sincronizarMotonavesColombia();
    });
  });

  // ---------------------------------------------------------
  // CRON 3: BOLETINES MARÍTIMOS (DIMAR)
  // Frecuencia: Cada 6 horas
  // ---------------------------------------------------------
  cron.schedule('0 */6 * * *', async () => {
    console.log('⏰ [CRON 6h] Actualizando boletines externos DIMAR...');
    ejecutarConMonitoreo('🔄 Actualizando boletines externos DIMAR', async () => {
      return await ReportesService.escanearBoletinesDIMAR();
    });
  });

  // ---------------------------------------------------------
  // CRON 4a: PRODUCTIVIDAD INTERNA Y CIERRE DE CAJA
  // Frecuencia: Todos los días a las 02:00 AM
  // ---------------------------------------------------------
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ [CRON 02:00 AM] Generando reportes de productividad del día anterior...');
    ejecutarConMonitoreo('🔄 Generando reportes de productividad del día anterior', async () => {
      return await ReportesService.generarReporteProductividadAyer();
    });
  });

  // ---------------------------------------------------------
  // CRON 4b: BOLETINES SEMANALES
  // Frecuencia: Todos los días a las 02:00 AM
  // ---------------------------------------------------------
  cron.schedule('0 2 * * *', async () => {
    console.log('⏰ [CRON 02:00 AM] Generando boletines semanales...');
    ejecutarConMonitoreo('🔄 Boletines semanales', async () => {
      return await ReportesService.generarBoletinSemanal();
    });
  });

  // ---------------------------------------------------------
  // CRON 5: CAPTURA DE PRODUCTIVIDAD (APAGADO)
  // 🟢 CORRECCIÓN: Comentado bloque completo por redundancia con CRON 2
  // ---------------------------------------------------------
  // cron.schedule('0 */2 * * *', async () => {
  //   console.log('⏰ [CRON 2H] Iniciando captura de productividad por terminales...');
  //   ejecutarConMonitoreo('🔄 Iniciando captura de productividad por terminales', async () => {
  //     return await IngestionService.sincronizarTodosLosPuertos();
  //   });
  // });

  // -------------------------------------------------------------------
  // CRON 6: SIMULADOR DE FLOTA TERRESTRE (APAGADO)
  // 🟢 CORRECCIÓN: Desactivado. Delegado al CRON 9 por seguridad anti-deadlocks
  // -------------------------------------------------------------------
  // cron.schedule('*/30 * * * * *', async () => {
  //   console.log('⏰ [CRON 2H] Iniciando captura de posiciones de camiones ...');
  //   ejecutarConMonitoreo('🔄 Iniciando captura de posiciones de camiones', async () => {
  //     return await mapaGeneralService.simularMovimientoFlota();
  //   });
  // });

  // -------------------------------------------------------------------
  // CRON 7: EVENTOS VIALES (Cada 10 minutos)
  // -------------------------------------------------------------------
  cron.schedule('*/10 * * * *', () => {
    console.log('🕒 Iniciando sincronización de eventos viales...');
    ejecutarConMonitoreo('🔄 Eventos Viales TomTom', async () => {
      return await SincronizacionService.sincronizarEventosViales();
    });
  });

  // -------------------------------------------------------------------
  // CRON 8: SIMULADOR AUTOMATICO DE CAPAS (Clima - Cada 15 min)
  // -------------------------------------------------------------------
  cron.schedule('*/15 * * * *', () => {
    console.log('🔄 Iniciando sincronización automática de alertas climáticas...');
    (async () => {
      ejecutarConMonitoreo('🔄 Iniciando sincronización automática de alertas climáticas', async () => {
        return await SincronizacionService.sincronizarAlertasClimaticas();
      });
    })();
  });

  // -------------------------------------------------------------------
  // CRON 9: SIMULADOR DE MOVIMIENTO DE CAMIONES (El Oficial)
  // -------------------------------------------------------------------
  cron.schedule('*/50 * * * * *', () => {
    if (simulacionEnCurso) {
      console.log('⚠️ [Simulación] Saltando ciclo: el anterior aún está procesando.');
      return;
    }

    simulacionEnCurso = true;
    console.log('🔄 Iniciando simulación de movimiento...');

    (async () => {
      try {
        await ejecutarConMonitoreo('🔄 Iniciando simulación de movimiento', async () => {
          return await flotaTerrestreService.simularMovimientoFlota();
        });
      } finally {
        simulacionEnCurso = false;
      }
    })();
  });

  // -------------------------------------------------------------------
  // CRON 10: BUSQUEDA DE NAVES SIN HOMOLOGAR
  // 🟢 CORRECCIÓN: Envuelto todo el proceso para un solo registro en bitácora
  // -------------------------------------------------------------------
  // cron.schedule('0 * * * *', async () => {
  //   console.log('🤖 [Cron] Iniciando búsqueda de naves sin homologar...');

  //   ejecutarConMonitoreo('🔄 Homologación de Naves', async () => {
  //     const pendientes = await MaritimoRepository.getNavesSinHomologar();
  //     console.log(`🔎 Se encontraron ${pendientes.length} naves pendientes.`);

  //     let homologadas = 0;

  //     for (const barco of pendientes) {
  //       const mmsiEncontrado = await buscarMmsiEnTuBaseDeDatos(barco.omi);

  //       if (mmsiEncontrado) {
  //         await MaritimoRepository.registrarHomologacion(barco.id_aviso, mmsiEncontrado);
  //         console.log(`✅ ${barco.motonave} homologada con MMSI: ${mmsiEncontrado}`);
  //         homologadas++;
  //       }
  //     }

  //     // Retornamos la cantidad de registros homologados para que la bitácora lo guarde
  //     return { insertados: homologadas };
  //   });
  // });

  // Función de búsqueda para CRON 10
  async function buscarMmsiEnTuBaseDeDatos(omi) {
    try {
      const query = `
            SELECT mmsi 
            FROM dbo.TCL_Referencia_OMI_MMSI 
            WHERE omi = :omi
        `;

      const resultado = await db.sequelize.query(query, {
        replacements: { omi: omi },
        type: db.sequelize.QueryTypes.SELECT
      });

      return resultado.length > 0 ? resultado[0].mmsi : null;

    } catch (error) {
      console.error(`❌ Error buscando MMSI para OMI ${omi}:`, error);
      return null;
    }
  }

  console.log('--- [CRON MANAGER] Todas las tareas registradas exitosamente ---');
};

module.exports = initCronJobs;