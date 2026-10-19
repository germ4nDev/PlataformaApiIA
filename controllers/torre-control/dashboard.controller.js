/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Tableros guardados (TLCUserDashboardLayout)
    Description: Lee el tablero guardado del usuario e hidrata cada widget con su resolver de datos.
*/
const LayoutService = require('../../services/torre-control/layout.service');
const WIDGET_RESOLVERS = require('./dashboard/dashboard.resolvers');
const { manejar } = require('../../helpers/controlador.helper');

const getDashboardLayout = manejar('Dashboard.obtener', async (req, res) => {
  const { codigoTablero } = req.params;
  const layout = await LayoutService.tableroGuardado(req.codigoUsuario, codigoTablero);
  const widgets = await Promise.all(layout.map(async (w) => {
    const id = w.widget_id.trim();
    const resolver = WIDGET_RESOLVERS[id];
    return {
      id,
      posicion: { x: w.posicion_x, y: w.posicion_y },
      data: resolver ? await resolver() : (w.config ? JSON.parse(w.config) : {}),
      config: w.config,
    };
  }));
  res.status(200).json({ ok: true, codigoTablero, widgets });
});

const saveDashboardLayout = manejar('Dashboard.guardar', async (req, res) => {
  const { codigoTablero, widgets } = req.body;
  await LayoutService.guardarTableroGuardado(req.codigoUsuario, codigoTablero, widgets);
  res.status(200).json({ ok: true, msg: 'Layout y auditoría sincronizados exitosamente.' });
});

module.exports = { getDashboardLayout, saveDashboardLayout };
