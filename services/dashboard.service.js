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
const PTL_Paquetes = PaqueteModel(sequelize);
const PTL_Usuarios = UsuarioModel(sequelize);
const PTLTickets = TicketAPModel(sequelize);
const PTL_Aplicaciones = AplicacionModel(sequelize);
const PTL_Suscriptores = SuscriptorModel(sequelize);

class DashboardService {

  async getUsuariosConectados() {
    try {
      const total = await PTL_Usuarios.count({
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
      const totalUsuarios = await PTL_Usuarios.count();
      const totalPaquetes = await PTL_Paquetes.count();
      const totalAplicaciones = await PTL_Aplicaciones.count();
      const totalSuscriptores = await PTL_Suscriptores.count();

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
      const activos = await PTL_Paquetes.findAll({
        attributes: [
          ['nombrePaquete', 'suscriptor'],
          [sequelize.fn('COUNT', sequelize.col('codigoPaquete')), 'cantidad']
        ],
        where: { estadoPaquete: true },
        group: ['nombrePaquete'],
        raw: true
      });

      // 2. Paquetes Inactivos / Vencidos
      const inactivos = await PTL_Paquetes.findAll({
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