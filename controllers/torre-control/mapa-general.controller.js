/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Mapa general
    Description: Capas del mapa logístico. Cada capa se pide por separado; ?puerto= filtra las capas operativas.
*/
const MapaGeneralService = require('../../services/torre-control/mapa-general.service');
const { manejar } = require('../../helpers/controlador.helper');

const servicio = () => MapaGeneralService.porDefecto();

const obtenerCapaInfraestructura = manejar('Mapa.infraestructura', async (req, res) => {
  const resultado = await servicio().getCapaInfraestructura();
  res.status(200).json({ success: true, CAPA_INFRAESTRUCTURA: resultado.data });
});

const obtenerCapaTerrestre = manejar('Mapa.terrestre', async (req, res) => {
  const resultado = await servicio().getCapaTerrestre();
  res.status(200).json({ success: true, CAPA_TERRESTRE: resultado.data });
});

const obtenerCapaClima = manejar('Mapa.clima', async (req, res) => {
  const resultado = await servicio().getCapaClima();
  res.status(200).json({ success: true, CAPA_CLIMA: resultado.data });
});

const obtenerCapaNaves = manejar('Mapa.naves', async (req, res) => {
  const resultado = await servicio().getCapaNaves(req.query.puerto);
  res.status(200).json({ success: true, data: resultado.data });
});

const diagnosticarEsquemas = manejar('Mapa.diagnostico', async (req, res) => {
  const fuente = req.query.fuente || 'vial';
  await servicio().diagnosticarEsquemaFuente(fuente);
  res.status(200).json({ success: true, message: `Diagnóstico enviado a consola para la fuente: ${fuente}. Revisa los logs.` });
});

module.exports = {
  obtenerCapaInfraestructura,
  obtenerCapaTerrestre,
  obtenerCapaClima,
  obtenerCapaNaves,
  diagnosticarEsquemas,
};
