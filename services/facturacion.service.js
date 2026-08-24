/*
    Author: German Valencia
    Service: Generación dinámica de consecutivos de facturación
*/
const { sequelize } = require('../database/connection');
const { HistorialFacturacionModel } = require('../models/historial-facturacion');
const { ParametrosSuscriptorModel } = require('../models/parametros-suscriptor');

class FacturacionService {
  // 1. Declaración de propiedades para evitar el error en el constructor
  historialModel;
  parametrizacionModel;

  constructor() {
    this.historialModel = HistorialFacturacionModel(sequelize);
    this.parametrizacionModel = ParametrosSuscriptorModel(sequelize);
  }

  // ====================================================================
  // FUNCIÓN 1: El método profesional (Con parámetros)
  // ====================================================================
  /**
   * @param {string} prefijo 
   * @param {number} numeroActual 
   * @param {number} longitudCeros 
   * @returns {string}
   */
  construirParametrizado(prefijo, numeroActual, longitudCeros) {
    const nuevoNumero = numeroActual + 1;
    const numeroFormateado = nuevoNumero.toString().padStart(longitudCeros, '0');
    return `${prefijo}${numeroFormateado}`;
  }

  // ====================================================================
  // FUNCIÓN 2: El método rápido/fallback (Con Regex)
  // ====================================================================
  /**
   * @param {string} consecutivoActual 
   * @returns {string}
   */
  incrementarPorRegex(consecutivoActual) {
    const regex = /^(\D*)(\d+)$/;
    const match = consecutivoActual.match(regex);

    if (!match) throw { statusCode: 500, msg: `Formato de consecutivo inválido: ${consecutivoActual}` };

    const prefijo = match[1];
    const numeroString = match[2];
    const nuevoNumero = parseInt(numeroString, 10) + 1;

    return prefijo + nuevoNumero.toString().padStart(numeroString.length, '0');
  }

  // ====================================================================
  // MÉTODO PRINCIPAL EXPORTABLE
  // ====================================================================
  /**
   * @param {string} codigoSuscriptor 
   * @param {any} transaction 
   * @returns {Promise<string>}
   */
  async obtenerProximoConsecutivo(codigoSuscriptor, transaction = null) {
    try {
      const config = await this.parametrizacionModel.findOne({
        where: { codigoSuscriptor },
        transaction
      });

      const ultimaFactura = await this.historialModel.findOne({
        where: { codigoSuscriptor },
        order: [['fechaCreacion', 'DESC']],
        transaction
      });

      // ESCENARIO A: El cliente tiene configurado su prefijo
      if (config && config.prefijoFactura !== null && config.prefijoFactura !== undefined) {
        let numeroActual = 0;

        if (ultimaFactura && ultimaFactura.numFactura) {
          const regex = /^(\D*)(\d+)$/;
          const match = ultimaFactura.numFactura.match(regex);
          if (match) numeroActual = parseInt(match[2], 10);
        }

        const longitud = config.longitudCeros || 4;
        const prefijo = config.prefijoFactura;

        return this.construirParametrizado(prefijo, numeroActual, longitud);
      }

      // ESCENARIO B: No hay configuración, pero hay facturas anteriores
      if (ultimaFactura && ultimaFactura.numFactura) {
        return this.incrementarPorRegex(ultimaFactura.numFactura);
      }

      // ESCENARIO C: Primera factura de todas
      return 'F0001';

    } catch (error) {
      console.error('❌ Error generando consecutivo:', error);
      throw error;
    }
  }
}

module.exports = FacturacionService;