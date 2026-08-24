/*
    Author: German Valencia
    Description: Servicio automatizado para auditoría y control de vencimientos QPLUS
*/
const cron = require('node-cron');
const { Op } = require('sequelize');
const { sequelize } = require('../database/connection');
const { PaqueteSCModel } = require('../models/paquete-sc');
const { io } = require('../index');

class SuscripcionCronService {
  constructor() {
    this.paquetesSCModel = PaqueteSCModel(sequelize);
  }

  iniciarTareasProgramadas() {
    console.log('⏳ [CRON] Servicio de auditoría de suscripciones inicializado.');

    cron.schedule('0 0 * * *', async () => {
      console.log('🔄 [CRON] Ejecutando revisión de paquetes vencidos...');
      await this.auditarPaquetesVencidos();
    });
  }

  async auditarPaquetesVencidos() {
    try {
      const fechaActual = new Date();

      const paquetesVencidos = await this.paquetesSCModel.findAll({
        where: {
          estadoLicencia: true,
          fechaProximoPago: {
            [Op.lt]: fechaActual
          }
        },
        raw: true
      });

      if (paquetesVencidos.length > 0) {

        await this.paquetesSCModel.update(
          {
            estadoLicencia: false,
            observaciones: 'Vencimiento de pago automático',
            fechaCancelacion: fechaActual.toISOString(),
            fechaModificacion: fechaActual.toISOString(),
            codigoUsuarioModificacion: 'SISTEMA_CRON'
          },
          {
            where: {
              estadoLicencia: true,
              fechaProximoPago: {
                [Op.lt]: fechaActual
              }
            }
          }
        );

        console.log(`✅ [CRON] Éxito: Se desactivaron ${paquetesVencidos.length} paquetes vencidos.`);

        io.emit('paquetes-sc-actualizados', {
          action: 'cron_update',
          msg: `Se han desactivado ${paquetesVencidos.length} paquete(s) por vencimiento de pago.`,
          paquetesDesactivados: paquetesVencidos
        });

      } else {
        console.log('✅ [CRON] Revisión terminada: No hay paquetes vencidos hoy.');
      }

    } catch (error) {
      console.error('❌ [CRON] Error al auditar paquetes vencidos:', error);
    }
  }
}

module.exports = SuscripcionCronService;
