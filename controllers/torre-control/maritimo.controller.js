/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Marítimo Maestro
*/
const fs = require('fs');
const path = require('path');
const MaritimoService = require('../../services/torre-control/maritimo.service');
const IngestionService = require('../../services/torre-control/ingestion.service');
const GeoreferenciacionService = require('../../services/torre-control/georeferenciacion.service');
const maritimoService = require('../../services/torre-control/maritimo.service');
const motonavesService = require('../../services/torre-control/motonaves.service');

const obtenerOperacionesSLA = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const data = await MaritimoService.obtenerOperacionesSLA(puerto);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[MaritimoController] Error en operaciones-sla:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const obtenerPosicionesMapa = async (req, res) => {
  try {
    const geoJsonData = await GeoreferenciacionService.obtenerCapaMaritimaGeoJSON();

    return res.status(200).json({
      exito: true,
      data: geoJsonData
    });
  } catch (error) {
    return res.status(500).json({
      exito: false,
      mensaje: 'Error interno al procesar la capa geográfica',
      error: error.message
    });
  }
}

const obtenerLineUp = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const data = await MaritimoService.obtenerLineUp(puerto);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[MaritimoController] Error en lineup:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const obtenerClima = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const data = await MaritimoService.obtenerClima(puerto);
    return res.status(200).json(data);
  } catch (error) {
    console.error('[MaritimoController] Error en clima:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Método Maestro: Orquesta la sincronización y la entrega de datos
 */
const obtenerResumenOperativo = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    console.log('🔍 [DEBUG API] Recibiendo consulta para puerto:', puerto);
    await IngestionService.sincronizarMotonaves(puerto);

    const data = await MaritimoService.obtenerResumenOperativo(puerto);
    console.log('🔍 [DEBUG API] Registros encontrados en BD:', data.length);
    return res.status(200).json({ success: true, data });

  } catch (error) {
    console.error('[MaritimoController] Error en resumen maestro:', error);
    return res.status(500).json({ success: false, message: error.message });
  }
};

const obtenerInfraestructuraMapa = async (req, res) => {
  try {
    const geoJsonData = await GeoreferenciacionService.obtenerCapaInfraestructuraGeoJSON();
    return res.status(200).json({ exito: true, data: geoJsonData });
  } catch (error) {
    return res.status(500).json({ exito: false, error: error.message });
  }
}

/**
     * GET /api/motonaves/posiciones
     * Retorna el FeatureCollection (GeoJSON) para la capa de Angular
     */
const obtenerPosicionesAis = async (req, res) => {
  try {
    // Llamamos al servicio (que a su vez llamará al repositorio)
    const geojsonData = await motonavesService.getUltimasPosicionesNaves();

    return res.status(200).json({
      success: true,
      data: geojsonData
    });
  } catch (error) {
    console.error('❌ [MotonavesController] Error en obtenerPosicionesAis:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al obtener posiciones del mapa',
      error: error.message
    });
  }
}

/**
 * POST /api/motonaves/vincular
 * Recibe los datos del popup de Angular para homologar una nave
 */
const vincularNave = async (req, res) => {
  try {
    const { mmsi, id_aviso } = req.body;

    // Validación de la capa de transporte (Controlador)
    if (!mmsi || !id_aviso) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros obligatorios: mmsi y/o id_aviso.'
      });
    }

    // Pasamos los datos validados al servicio
    const resultado = await motonavesService.vincularMotonave(req.body);

    return res.status(200).json(resultado);

  } catch (error) {
    console.error('❌ [MotonavesController] Error en vincularNave:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error al procesar la vinculación de la nave',
      error: error.message
    });
  }
}

/**
 * POST /api/motonaves/posicion-ais 
 * Endpoint interno (webhook) usado para recibir la data en vivo de la antena AIS.
 * Este es el que generó tu log: [DEBUG] Datos recibidos en guardarUltimaPosicionAIS...
 */
const recibirPosicionAis = async (req, res) => {
  try {
    const datosAIS = req.body;

    // Log idéntico al que vimos en tu captura para mantener la trazabilidad
    console.log(`[DEBUG] Datos recibidos en guardarUltimaPosicionAIS: ${JSON.stringify(datosAIS)}`);

    // Validación básica
    if (!datosAIS.mmsi) {
      return res.status(400).json({ success: false, message: 'El MMSI es obligatorio' });
    }

    // Enviamos el payload al servicio (que ya tiene la protección de coordenadas nulas)
    const resultado = await motonavesService.guardarUltimaPosicionAIS(datosAIS);

    return res.status(200).json(resultado);

  } catch (error) {
    console.error('❌ [MotonavesController] Error en recibirPosicionAis:', error.message);
    return res.status(500).json({
      success: false,
      message: 'Error interno al procesar la lectura de la antena AIS',
      error: error.message
    });
  }
}

module.exports = {
  obtenerOperacionesSLA,
  obtenerLineUp,
  obtenerClima,
  obtenerPosicionesMapa,
  obtenerInfraestructuraMapa,
  obtenerResumenOperativo,
  obtenerPosicionesAis,
  recibirPosicionAis,
  vincularNave
};