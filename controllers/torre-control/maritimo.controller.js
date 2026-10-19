/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Marítimo Maestro
*/
const MaritimoService = require('../../services/torre-control/maritimo.service');
const GeoreferenciacionService = require('../../services/torre-control/georeferenciacion.service');
const motonavesService = require('../../services/torre-control/motonaves.service');

const { responderError } = require('../../helpers/errores.helper');
const obtenerOperacionesSLA = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const data = await MaritimoService.obtenerOperacionesSLA(puerto);
    return res.status(200).json(data);
  } catch (error) {
    return responderError(res, error, 'maritimo.obtenerOperacionesSLA');
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
    return responderError(res, error, 'maritimo.obtenerPosicionesMapa');
  }
};

const obtenerLineUp = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const data = await MaritimoService.obtenerLineUp(puerto);
    return res.status(200).json(data);
  } catch (error) {
    return responderError(res, error, 'maritimo.obtenerLineUp');
  }
};

const obtenerClima = async (req, res) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const data = await MaritimoService._obtenerClima(puerto);
    return res.status(200).json(data);
  } catch (error) {
    return responderError(res, error, 'maritimo.obtenerClima');
  }
};

/**
 * Método Maestro: Orquesta la sincronización y la entrega de datos
 */
const obtenerResumenOperativo = async (req, res) => {
  try {
    const puerto = (req.query.puerto || req.params.puerto || 'BUENAVENTURA').trim().toUpperCase();
    console.log('🔍 [DEBUG API] Recibiendo consulta resumen-operativo para puerto:', puerto);

    const data = await MaritimoService.obtenerResumenOperativo(puerto);
    console.log('✅ [DEBUG API] Resumen operativo generado con', Object.keys(data || {}).length, 'nodos');

    return res.status(200).json({
      ok: true,
      success: true,
      puerto,
      data
    });
  } catch (error) {
    return responderError(res, error, 'maritimo.obtenerResumenOperativo');
  }
};

const obtenerInfraestructuraMapa = async (req, res) => {
  try {
    const geoJsonData = await GeoreferenciacionService.obtenerCapaInfraestructuraGeoJSON();
    return res.status(200).json({ exito: true, data: geoJsonData });
  } catch (error) {
    return responderError(res, error, 'maritimo.obtenerInfraestructuraMapa');
  }
};

const obtenerPosicionesAis = async (req, res) => {
  try {
    const geojsonData = await motonavesService.getUltimasPosicionesNaves();
    return res.status(200).json({
      success: true,
      data: geojsonData
    });
  } catch (error) {
    return responderError(res, error, 'maritimo.obtenerPosicionesAis');
  }
};

const vincularNave = async (req, res) => {
  try {
    const { mmsi, id_aviso } = req.body;
    if (!mmsi || !id_aviso) {
      return res.status(400).json({
        success: false,
        message: 'Faltan parámetros obligatorios: mmsi y/o id_aviso.'
      });
    }
    const resultado = await motonavesService.vincularMotonave(req.body);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderError(res, error, 'maritimo.vincularNave');
  }
};

const recibirPosicionAis = async (req, res) => {
  try {
    const datosAIS = req.body;
    console.log(`[DEBUG] Datos recibidos en guardarUltimaPosicionAIS: ${JSON.stringify(datosAIS)}`);

    if (!datosAIS.mmsi) {
      return res.status(400).json({ success: false, message: 'El MMSI es obligatorio' });
    }

    const resultado = await motonavesService.guardarUltimaPosicionAIS(datosAIS);
    return res.status(200).json(resultado);
  } catch (error) {
    return responderError(res, error, 'maritimo.recibirPosicionAis');
  }
};

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