const { Op } = require('sequelize');

// 🚨 LA SOLUCIÓN: Agregamos las llaves de destructuración { sequelize }
const { sequelize } = require('../../database/connection');

const { LineUpMaritimoModel } = require('../../models/torre-control/Line-up-maritimo');

// Ahora sí le estamos pasando la instancia real a la función constructora
const TLCLineUpMaritimo = LineUpMaritimoModel(sequelize);

class TLCLineUpMaritimoService {

  // Obtener el Line Up activo, opcionalmente filtrado por terminal
  async obtenerLineUp(terminalFilter = null) {
    const queryOptions = {
      where: {
        estadoRegistro: true // Solo registros activos (Auditoría)
      },
      order: [['eta', 'ASC']] // Orden cronológico para las gráficas
    };

    if (terminalFilter) {
      queryOptions.where.puerto = terminalFilter;
    }

    return await TLCLineUpMaritimo.findAll(queryOptions);
  }

  // Ingesta masiva desde el archivo procesado
  // Corregido 2026-10-17: inactivar + insertar van en UNA transacción. Antes, si el bulkCreate fallaba
  // (un registro inválido, la BD caída a mitad), el line-up de esas terminales quedaba inactivo y el tablero vacío.
  async registrarIngestaMasiva(dtoDataArray, usuarioModificacion) {
    return sequelize.transaction(async (transaction) => {

    // 1. Extraemos dinámicamente las terminales únicas que vienen en este Excel
    // Mapeamos todas las terminales y usamos Set para eliminar duplicados
    const terminalesAfectadas = [...new Set(dtoDataArray.map(item => item.terminal))];

    if (terminalesAfectadas.length > 0) {
      // 2. Borrado Lógico Selectivo (Soft Delete transaccional)
      // Solo inactivamos las terminales que vienen en el archivo
      await TLCLineUpMaritimo.update(
        {
          estadoRegistro: false,
          codigoUsuarioModificacion: usuarioModificacion,

          // 🚨 LA SOLUCIÓN: Enviamos el string ISO estándar de PORTTOS
          fechaModificacion: new Date().toISOString()
        },
        {
          where: {
            terminal: { [Op.in]: terminalesAfectadas },
            estadoRegistro: true
          },
          transaction
        }
      );
    }

    return TLCLineUpMaritimo.bulkCreate(dtoDataArray, { transaction });
    });
  }
}

module.exports = new TLCLineUpMaritimoService();