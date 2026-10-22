/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Alertas del mapa
*/
const AlertasMapaService = require('../../services/torre-control/alertas-mapa.service');
const { manejar, contextoUsuario } = require('../../helpers/controlador.helper');

/** GET ?puerto=&limite= — últimas alertas del puerto; las nuevas llegan por socket. */
const obtenerBitacora = manejar('AlertasMapa.bitacora', async (req, res) => {
  res.json(await AlertasMapaService.bitacora(req.query.puerto, req.query.limite));
});

/** GET /reglas — catálogo, configuración y si la migración 011 está aplicada. */
const listarReglas = manejar('AlertasMapa.reglas', async (req, res) => {
  res.json(await AlertasMapaService.listarReglas());
});

/** PUT /reglas — crea o actualiza la configuración de una regla (global '*' o por puerto). */
const guardarRegla = manejar('AlertasMapa.guardarRegla', async (req, res) => {
  res.json(await AlertasMapaService.guardarRegla(req.body, contextoUsuario(req)));
});

/** DELETE /reglas/:codigo/:puerto — quita la configuración propia de un puerto. */
const eliminarRegla = manejar('AlertasMapa.eliminarRegla', async (req, res) => {
  res.json(await AlertasMapaService.eliminarRegla(req.params.codigo, req.params.puerto));
});

module.exports = { obtenerBitacora, listarReglas, guardarRegla, eliminarRegla };
