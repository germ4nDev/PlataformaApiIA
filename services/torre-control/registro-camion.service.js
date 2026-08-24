/*
    Author: German Valencia
    Pattern: QPLUS Service Pattern - Virtual Gate (Flujo Terrestre)
*/
const { db } = require('../../database/connection');

class RegistroCamionService {

  /**
   * Registra un nuevo ping/evento de un camión en la vía o puerto
   */
  async registrarPingCamion(dtoData) {
    try {
      // Opcional: Si queremos mantener solo el último estado, aquí podríamos 
      // buscar si la placa ya está 'EN_TRANSITO' y actualizarla a 'FINALIZADO'
      // antes de insertar la nueva etapa. Por ahora, insertamos el log puro.
      return await db.TCLRegistroCamiones.create(dtoData);
    } catch (error) {
      c// onsole.error('[SERVICE] Error insertando ping de camión:', error);
      throw error;
    }
  }

  /**
   * Calcula el KPI en tiempo real para el Dashboard
   * Retorna el conteo agrupado por las 4 etapas logísticas
   */
  async obtenerKpiCamiones() {
    try {
      const conteo = await db.TCLRegistroCamiones.findAll({
        attributes: [
          'etapaOperativa',
          [db.sequelize.fn('COUNT', db.sequelize.col('codigoRegistro')), 'cantidad']
        ],
        where: { estadoRegistro: 'EN_TRANSITO' },
        group: ['etapaOperativa']
      });

      // Mapeamos el resultado a un objeto limpio para Angular
      const resumen = { pre_gate: 0, puerto: 0, interior: 0, corredor: 0, total: 0 };

      conteo.forEach(fila => {
        const cantidad = parseInt(fila.get('cantidad'), 10);
        resumen.total += cantidad;

        switch (fila.etapaOperativa) {
          case 1: resumen.pre_gate = cantidad; break;
          case 2: resumen.puerto = cantidad; break;
          case 3: resumen.interior = cantidad; break;
          case 4: resumen.corredor = cantidad; break;
        }
      });

      return resumen;
    } catch (error) {
      c// onsole.error('[SERVICE] Error calculando KPI de camiones:', error);
      throw error;
    }
  }
}

module.exports = new RegistroCamionService();