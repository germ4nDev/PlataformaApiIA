const sql = require('mssql');
const ClimaModel = require('../../models/torre-control/clima.model');

class ClimaEtlService {

  /**
   * Ejecuta el flujo completo: Fetch -> Transform -> Validate -> Load
   */
  async ejecutarSincronizacion(datosExternos) {
    const transaction = new sql.Transaction();

    try {
      await transaction.begin();

      for (const item of datosExternos) {
        // 1. Transformación (Mapeo de la API externa a nuestro DTO)
        const dto = {
          idEstacion: item.station_id,
          temp: item.temperature,
          viento: item.wind_speed,
          presion: item.pressure,
          zona: item.location_name,
          tipoDato: 'OBSERVADO',
          fechaRegistro: new Date()
        };

        // 2. Validación e Inserción usando el Modelo
        // Si esto falla, lanzará una excepción y detendrá el proceso
        await ClimaModel.insertPronostico(transaction, dto);
      }

      await transaction.commit();
    } catch (error) {
      if (transaction) await transaction.rollback();
      console.error('❌ [ETL] Error crítico durante la transacción:', error.message);
      throw error; // Re-lanzamos para que el Cron sepa que falló
    }
  }
}

module.exports = new ClimaEtlService();