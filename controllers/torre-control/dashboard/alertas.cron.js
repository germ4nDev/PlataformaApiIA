const cron = require('node-cron');
const { db } = require('../../../database/connection');

// Recibimos 'io' como parámetro
const iniciarVigilanteSupertransporte = (io) => {

  cron.schedule('0 8 5 * *', async () => {
    try {
      console.log('🔍 [CRON] Verificando disponibilidad de datos Supertransporte...');

      // Calculamos el mes anterior (que es el que se reporta)
      const fechaActual = new Date();
      let mesReporte = fechaActual.getMonth(); // 0-11, así que getMonth() ya es el mes pasado (1-12)
      let anioReporte = fechaActual.getFullYear();

      if (mesReporte === 0) {
        mesReporte = 12;
        anioReporte -= 1;
      }

      // Aquí usamos el 'io' que llegó por parámetro
      if (resultado[0].total === 0) {
        io.emit('alerta-interactiva', {
          tipo: 'SISTEMA',
          nivel: 'warning',
          titulo: '📊 Datos Oficiales Disponibles',
          mensaje: `El boletín de Supertransporte del periodo ${mesReporte}/${anioReporte} ya debería estar publicado. ¿Deseas sincronizar el auditor ahora?`,
          accionRequerida: true,
          endpointAccion: '/api/ingesta/historico-supertransporte/sincronizar'
        });
      }

    } catch (error) {
      console.error('❌ [CRON] Error:', error);
    }
  });
};

module.exports = { iniciarVigilanteSupertransporte };