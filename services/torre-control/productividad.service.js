// ProductividadService.js (Backend Node.js)
const { db, sequelize } = require('../../database/connection');

class ProductividadService {
  static async obtenerProductividadPorCiudad(ciudad) {
    // Normalizamos la entrada para que coincida con las llaves principales del JSON
    const filtroCiudad = (ciudad || 'BUENAVENTURA').trim().toUpperCase().replace(' ', '_');

    // Retraso simulado de 400ms para apreciar el estado de carga en el UI
    await new Promise(resolve => setTimeout(resolve, 400));

    switch (filtroCiudad) {
      case 'BUENAVENTURA':
        return [
          { id_puerto_terminal: 'TCBUEN', h_06: 44, h_08: 52, h_10: 55, h_12: 50, h_14: 48, h_16: 52, h_18: 49, h_20: 47 },
          { id_puerto_terminal: 'SPRBUN', h_06: 32, h_08: 38, h_10: 42, h_12: 40, h_14: 38, h_16: 41, h_18: 39, h_20: 36 },
          { id_puerto_terminal: 'SPIA', h_06: 24, h_08: 28, h_10: 32, h_12: 30, h_14: 29, h_16: 31, h_18: 28, h_20: 26 },
          { id_puerto_terminal: 'COMPASAGD', h_06: 18, h_08: 22, h_10: 25, h_12: 24, h_14: 21, h_16: 23, h_18: 20, h_20: 19 },
          { id_puerto_terminal: 'COMPASCASCAJAL', h_06: 15, h_08: 18, h_10: 20, h_12: 19, h_14: 17, h_16: 19, h_18: 16, h_20: 15 },
          { id_puerto_terminal: 'GRUPOPORT', h_06: 12, h_08: 15, h_10: 18, h_12: 16, h_14: 15, h_16: 17, h_18: 14, h_20: 13 }
        ];

      case 'CARTAGENA':
        return [
          { id_puerto_terminal: 'CONTECAR', h_06: 42, h_08: 48, h_10: 52, h_12: 49, h_14: 47, h_16: 50, h_18: 46, h_20: 44 },
          { id_puerto_terminal: 'SPRC', h_06: 38, h_08: 42, h_10: 45, h_12: 43, h_14: 40, h_16: 44, h_18: 41, h_20: 39 },
          { id_puerto_terminal: 'COMPAS_BOSQUE', h_06: 22, h_08: 26, h_10: 29, h_12: 27, h_14: 25, h_16: 28, h_18: 24, h_20: 23 },
          { id_puerto_terminal: 'PUERTO_BAHIA', h_06: 18, h_08: 20, h_10: 24, h_12: 22, h_14: 21, h_16: 23, h_18: 19, h_20: 18 }
        ];

      case 'BARRANQUILLA':
        return [
          { id_puerto_terminal: 'SPRB', h_06: 28, h_08: 32, h_10: 35, h_12: 33, h_14: 30, h_16: 34, h_18: 31, h_20: 29 },
          { id_puerto_terminal: 'PALERMO', h_06: 22, h_08: 25, h_10: 28, h_12: 26, h_14: 24, h_16: 27, h_18: 23, h_20: 22 },
          { id_puerto_terminal: 'COMPAS_BARRANQUILLA', h_06: 16, h_08: 19, h_10: 21, h_12: 20, h_14: 18, h_16: 20, h_18: 17, h_20: 16 }
        ];

      case 'SANTA_MARTA':
        return [
          { id_puerto_terminal: 'SPSM', h_06: 30, h_08: 36, h_10: 40, h_12: 38, h_14: 35, h_16: 39, h_18: 34, h_20: 32 }
        ];

      case 'TUMACO':
        return [
          { id_puerto_terminal: 'TUMACO_PORT', h_06: 10, h_08: 12, h_10: 15, h_12: 14, h_14: 12, h_16: 14, h_18: 11, h_20: 10 }
        ];

      case 'TURBO':
        return [
          { id_puerto_terminal: 'PTO_ANTIOQUIA', h_06: 35, h_08: 40, h_10: 44, h_12: 42, h_14: 39, h_16: 43, h_18: 38, h_20: 36 }
        ];

      case 'COVENAS':
        return [
          { id_puerto_terminal: 'ECOPETROL_COV', h_06: 45, h_08: 50, h_10: 55, h_12: 52, h_14: 48, h_16: 53, h_18: 49, h_20: 47 }
        ];

      case 'GUAJIRA':
        return [
          { id_puerto_terminal: 'PUERTO_BOLIVAR', h_06: 48, h_08: 55, h_10: 60, h_12: 58, h_14: 55, h_16: 59, h_18: 54, h_20: 52 },
          { id_puerto_terminal: 'PUERTO_BRISA', h_06: 20, h_08: 24, h_10: 27, h_12: 25, h_14: 23, h_16: 26, h_18: 22, h_20: 21 }
        ];

      default:
        return [];
    }
  }
}

module.exports = ProductividadService;
