/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Mapa General
    Update: Desacoplamiento de capas para evitar colisiones en el frontend.
*/
const { sequelize } = require('../../database/connection');
const MapaGeneralRepository = require('../../repositories/torre-control/mapa-general.repository');
const MapaGeneralService = require('../../services/torre-control/mapa-general.service');

// 1. Instanciamos las dependencias
const mapaRepository = new MapaGeneralRepository(sequelize);
const mapaService = new MapaGeneralService(mapaRepository);

// 🟢 NUEVO: Controlador exclusivo para Infraestructura (Puertos, Terminales, Muelles, Bodegas)
const obtenerCapaInfraestructura = async (req, res) => {
  try {
    const resultado = await mapaService.getCapaInfraestructura();

    // Devolvemos exactamente la llave que lee Angular (CAPA_INFRAESTRUCTURA)
    res.status(200).json({
      success: true,
      CAPA_INFRAESTRUCTURA: resultado.data
    });
  } catch (error) {
    console.error('❌ ERROR EN CONTROLLER - CAPA INFRAESTRUCTURA:', error);
    res.status(500).json({ success: false, message: 'Error al generar capa de infraestructura' });
  }
};

// 🟢 MODIFICADO: Controlador exclusivo para Terrestre (Flota)
const obtenerCapaTerrestre = async (req, res) => {
  try {
    // Apuntamos al nuevo nombre del método en el servicio
    const resultado = await mapaService.getCapaTerrestre();

    res.status(200).json({
      success: true,
      CAPA_TERRESTRE: resultado.data
    });
  } catch (error) {
    console.error('❌ ERROR REAL EN CONTROLLER - CAPA TERRESTRE:', error);
    res.status(500).json({ success: false, message: 'Error al generar capa terrestre' });
  }
};

// 🟢 NUEVO: Controlador exclusivo para Clima (IDEAM/OpenWeather)
const obtenerCapaClima = async (req, res) => {
  try {
    const resultado = await mapaService.getCapaClima();

    res.status(200).json({
      success: true,
      CAPA_CLIMA: resultado.data
    });
  } catch (error) {
    console.error('❌ ERROR EN CONTROLLER - CAPA CLIMA:', error);
    res.status(500).json({ success: false, message: 'Error al generar capa de clima' });
  }
};

// 🟢 MODIFICADO: Controlador exclusivo para Naves
const obtenerCapaNaves = async (req, res) => {
  try {
    // Apuntamos al nuevo nombre del método en el servicio
    const resultado = await mapaService.getCapaNaves();

    // Según tu servicio de Angular, naves tiene un Subject separado,
    // por lo que mandamos la 'data' directo.
    res.status(200).json({
      success: true,
      data: resultado.data
    });
  } catch (error) {
    console.error('❌ ERROR EN CONTROLLER - CAPA NAVES:', error);
    res.status(500).json({ success: false, message: 'Error al generar capa de naves' });
  }
};

const diagnosticarEsquemas = async (req, res) => {
  const fuente = req.query.fuente || 'vial';

  try {
    // CAMBIO: Usa 'mapaService' (la instancia) en lugar de 'MapaGeneralService' (la clase)
    await mapaService.diagnosticarEsquemaFuente(fuente);

    res.status(200).json({
      success: true,
      message: `Diagnóstico enviado a consola para la fuente: ${fuente}. Revisa los logs.`
    });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
};

const obtenerGeocercasKPIs = async (req, res) => {
  try {
    // Llamamos al servicio que ya habíamos dejado listo
    const data = await FlotaTerrestreService.obtenerCapaGeocercas();

    // Devolvemos el array dentro de la propiedad "data" que espera Angular
    return res.status(200).json({
      success: true,
      data: data
    });
  } catch (error) {
    console.error('❌ Error en controlador obtenerGeocercasKPIs:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al obtener los KPIs de las geocercas'
    });
  }
}

const getMaritimo = async (req, res) => {
  try {
    const result = await mapaService.obtenerDashboardMaritimo();
    res.status(200).json({
      success: true,
      data: result
    });
  } catch (error) {
    // Regla PORTTOS: Error con trazabilidad en consola
    console.error('Error crítico en MapaLogisticoController.getMaritimo:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar la Torre de Control Marítima',
      detail: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
}

module.exports = {
  obtenerCapaInfraestructura,
  obtenerCapaTerrestre,
  obtenerGeocercasKPIs,
  obtenerCapaClima,
  obtenerCapaNaves,
  diagnosticarEsquemas,
  getMaritimo
};