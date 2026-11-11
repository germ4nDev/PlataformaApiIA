const { sequelize } = require('../database/connection');
const { PTL_UsuarioWidgets } = require('../models'); // Ajusta la ruta a tu carpeta models si es distinta
const { UsuarioWidgetDTO } = require('../models/usuario-widget.model');

class UsuariosWidgetsService {
  constructor() {
    this.model = PTL_UsuarioWidgets;
  }

  async getLayoutUsuario(codigoUsuario) {
    if (!this.model) throw new Error("Modelo PTL_UsuarioWidgets no instanciado en Sequelize.");
    return await this.model.findAll({ where: { codigoUsuario } });
  }

  async guardarLayout(codigoUsuario, itemsLayout) {
    if (!codigoUsuario || !Array.isArray(itemsLayout)) {
      throw { statusCode: 400, msg: "Datos de layout inválidos o incompletos." };
    }

    return await sequelize.transaction(async (t) => {
      await this.model.destroy({
        where: { codigoUsuario },
        transaction: t
      });

      const registrosNuevos = itemsLayout.map(item => {
        return UsuarioWidgetDTO({
          codigoUsuario: codigoUsuario,
          codigoWidget: item.codigoWidget || item.type,
          pestana: item.pestana,
          cols: item.cols,
          rows: item.rows,
          x: item.x,
          y: item.y,
          visible: item.visible,
          codigoUsuarioCreacion: item.codigoUsuarioCreacion || codigoUsuario,
          fechaCreacion: item.fechaCreacion || new Date().toISOString()
        });
      });

      if (registrosNuevos.length > 0) {
        await this.model.bulkCreate(registrosNuevos, { transaction: t });
      }

      return {
        ok: true,
        msg: "Layout guardado y sincronizado correctamente.",
        totalWidgets: registrosNuevos.length
      };
    });
  }
}

module.exports = UsuariosWidgetsService;