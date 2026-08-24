require('dotenv').config();
const db = require('../database/connection');
const IngestionService = require('../services/torre-control/ingestion.service');
const ReportesService = require('../services/torre-control/reportes.service');
const { NodoLogisticoDTO } = require('../models/torre-control/nodo-logistico.model');

async function iniciarPoblado() {

  // Lista de puertos objetivo
  const puertosColombia = ['BUENAVENTURA', 'CARTAGENA', 'BARRANQUILLA', 'SANTA MARTA'];

  try {
    await db.sequelize.authenticate();

    // Ejecutamos la ingesta de forma secuencial
    for (const puerto of puertosColombia) {
      await IngestionService.sincronizarTodosLosPuertos();
      // await IngestionService.sincronizarMotonaves(puerto);
      // await ReportesService.generarBoletinSemanal(puerto);
      // await ReportesService.generarReporteProductividadAyer(puerto);
      // await ReportesService.escanearBoletinesDIMAR(puerto);
    }


  } catch (error) {
    console.error('❌ Fallo crítico durante el poblado:', error);
  } finally {
    if (db.sequelize) {
      await db.sequelize.close();
    }
    process.exit(0);
  }
}

iniciarPoblado();