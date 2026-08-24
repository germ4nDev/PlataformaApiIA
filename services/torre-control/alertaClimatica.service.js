const { AlertaClimaticaModel } = require('./../../models/torre-control/alerta-climatica.model');

const AlertaClimaticaService = {
  // Lógica de negocio para persistir la alerta
  persistirAlerta: async (data, sequelizeInstance) => {
    // Aquí podrías agregar lógica extra, como enviar una notificación push 
    // si el nivelSeveridad es 3 (Alerta Roja)
    return await AlertaClimaticaModel(sequelizeInstance).create(data);
  },

  // Lógica para obtener alertas filtradas
  buscarAlertas: async (sequelizeInstance, filtros) => {
    return await AlertaClimaticaModel(sequelizeInstance).findAll({
      where: filtros
    });
  }
};

module.exports = AlertaClimaticaService;