// dashboard.service.js
const { sequelize } = require('../database/connection'); // 1. Importamos primero la instancia de sequelize
const dashboardRepository = require('./../repositories/plataforma/dashboard.repository');

// 2. Importamos las funciones factory de los modelos
const { PaqueteModel } = require('./../models/paquete');
const { UsuarioModel } = require('./../models/usuario');
const { TicketAPModel } = require('./../models/ticket-ap');
const { AplicacionModel } = require('./../models/aplicacion'); // Ajusta según el nombre real de tu modelo
const { SuscriptorModel } = require('./../models/suscriptor');

// 3. Inicializamos los modelos pasándoles la instancia de sequelize
const PTLPaquetes = PaqueteModel(sequelize);
const PTLUsuarios = UsuarioModel(sequelize);
const PTLTickets = TicketAPModel(sequelize);
const PTLAplicaciones = AplicacionModel(sequelize);
const PTLSuscriptores = SuscriptorModel(sequelize);

class DashboardService {

  async getUsuariosConectados() {
    try {
      const total = await PTLUsuarios.count({
        where: { isOnline: true }
      });
      console.log('total conectados', total);

      return { total };
    } catch (error) {
      throw new Error(`Error en servicio de usuarios: ${error.message}`);
    }
  }

  async getKpiTotales() {
    try {
      const totalUsuarios = await PTLUsuarios.count();
      const totalPaquetes = await PTLPaquetes.count();
      const totalAplicaciones = await PTLAplicaciones.count();
      const totalSuscriptores = await PTLSuscriptores.count();

      return {
        totalUsuarios,
        totalPaquetes,
        totalAplicaciones,
        totalSuscriptores
      };
    } catch (error) {
      throw new Error(`Error al obtener KPIs totales: ${error.message}`);
    }
  }

  // 2. Obtener paquetes activos agrupados por nombre comercial (mapeado como suscriptor)
  async getPaquetesPorSuscriptor() {
    try {
      // 1. Paquetes Activos
      const activos = await PTLPaquetes.findAll({
        attributes: [
          ['nombrePaquete', 'suscriptor'],
          [sequelize.fn('COUNT', sequelize.col('codigoPaquete')), 'cantidad']
        ],
        where: { estadoPaquete: true },
        group: ['nombrePaquete'],
        raw: true
      });

      // 2. Paquetes Inactivos / Vencidos
      const inactivos = await PTLPaquetes.findAll({
        attributes: [
          ['nombrePaquete', 'suscriptor'],
          [sequelize.fn('COUNT', sequelize.col('codigoPaquete')), 'cantidad']
        ],
        where: { estadoPaquete: false },
        group: ['nombrePaquete'],
        raw: true
      });

      return {
        activos,
        inactivos
      };
    } catch (error) {
      throw new Error(`Error en servicio de paquetes: ${error.message}`);
    }
  }

  // 3. Obtener resumen de tickets por estado usando PTLTickets
  async getResumenTickets() {
    try {
      const abiertos = await PTLTickets.count({ where: { estado: 'abierto' } });
      const enProceso = await PTLTickets.count({ where: { estado: 'en_proceso' } });
      const resueltos = await PTLTickets.count({ where: { estado: 'resuelto' } });

      return {
        abiertos,
        enProceso,
        resueltos
      };
    } catch (error) {
      throw new Error(`Error en servicio de tickets: ${error.message}`);
    }
  }

  async getPaquetesPorSuscriptor() {
    const data = await dashboardRepository.getPaquetesPorSuscriptor();
    // Transformamos para Chart.js
    return {
      labels: data.map(d => d.label),
      values: data.map(d => Number(d.total))
    };
  }

  async getResumenTickets() {
    const data = await dashboardRepository.getResumenTickets();
    // Transformamos para Chart.js
    return {
      labels: data.map(d => d.aplicacion),
      resueltos: data.map(d => Number(d.resueltos)),
      enProgreso: data.map(d => Number(d.enProgreso)),
      abiertos: data.map(d => Number(d.abiertos))
    };
  }

  async getFacturacionMRR() {
    const data = await dashboardRepository.getFacturacionMRR();
    // Transformamos para Chart.js
    return {
      labels: data.map(d => d.mes.substring(0, 3)),
      anuales: data.map(d => Number(d.anuales)),
      intermedios: data.map(d => Number(d.intermedios)),
      mensuales: data.map(d => Number(d.mensuales))
    };
  }

}

module.exports = new DashboardService();