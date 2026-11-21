/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Latido (CC-279). GET /api/salud → { ok, hora, bd: { ok, ms, revisadaEn } }, sin sesión.
*/
const Salud = require('../services/plataforma/salud.service');
const { manejar } = require('../helpers/controlador.helper');

const latido = manejar('Salud.latido', async (req, res) => {
  res.set('Cache-Control', 'no-store');
  res.json({ ok: true, hora: new Date().toISOString(), bd: await Salud.baseDeDatos() });
});

module.exports = { latido };
