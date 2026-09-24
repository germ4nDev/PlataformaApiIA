/*
    Author: German Valencia
    Controller: Dashboard Layout Management
    Pattern: PORTTOS (Model + DTO + Resolver Hydration)
*/

const { sequelize } = require('../../database/connection');
const { DashboardLayoutModel, DashboardLayoutDTO } = require('../../models/torre-control/dashboardLayout');
const WIDGET_RESOLVERS = require('./dashboard/dashboard.resolvers');

const TLCUserDashboardLayout = DashboardLayoutModel(sequelize);

const getDashboardLayout = async (req, res) => {
  const { codigoTablero } = req.params;
  const codigoUsuario = req.codigoUsuario;

  try {
    const layout = await TLCUserDashboardLayout.findAll({
      where: {
        codigoUsuario: codigoUsuario,
        codigoDashboard: codigoTablero
      },
      order: [
        ['posicion_y', 'ASC'],
        ['posicion_x', 'ASC']
      ]
    });

    const widgetsConData = await Promise.all(layout.map(async (w) => {
      // Evitamos errores con espacios en blanco en el ID
      const cleanId = w.widget_id.trim();
      const resolver = WIDGET_RESOLVERS[cleanId];

      const dataHydrated = resolver ? await resolver() : (w.config ? JSON.parse(w.config) : {});

      return {
        id: cleanId,
        posicion: { x: w.posicion_x, y: w.posicion_y },
        data: dataHydrated,
        config: w.config // <--- ¡ÉSTA ES LA LLAVE MÁGICA! Pasamos el string a Angular
      };
    }));

    res.status(200).json({ ok: true, codigoTablero, widgets: widgetsConData });

  } catch (error) {
    console.error('Error en getDashboardLayout:', error);
    res.status(500).json({ ok: false, msg: 'Error al recuperar y procesar el tablero.' });
  }
};

const saveDashboardLayout = async (req, res) => {
  const { codigoTablero, widgets } = req.body;
  const codigoUsuario = req.codigoUsuario;
  const t = await sequelize.transaction();

  try {
    const userContext = { codigoUsuario };
    await TLCUserDashboardLayout.destroy({ where: { codigoTablero: codigoTablero }, transaction: t });

    const widgetsParaInsertar = widgets.map(w => DashboardLayoutDTO({
      codigoUsuario: codigoUsuario,
      codigoTablero: codigoTablero,
      widgetId: w.id,
      config: w.config,
      posX: w.posicion.x,
      posY: w.posicion.y
    }), userContext);

    await TLCUserDashboardLayout.bulkCreate(widgetsParaInsertar, { transaction: t });

    await t.commit();
    res.status(200).json({ ok: true, msg: 'Layout y auditoría sincronizados exitosamente.' });
  } catch (error) {
    await t.rollback();
    if (error.type === 'ValidationError') return res.status(400).json({ ok: false, errors: error.details });
    res.status(500).json({ ok: false, msg: 'Error de integridad en la persistencia.' });
  }
};

module.exports = { getDashboardLayout, saveDashboardLayout };