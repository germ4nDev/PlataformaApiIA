const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');

class DashboardRepository {

  async getPaquetesPorSuscriptor() {
    return await sequelize.query(`
            SELECT 
                p.nombrePaquete AS label,
                COUNT(s.suscriptorId) AS total
            FROM PTLPaquetes p
            LEFT JOIN PTLSuscriptores s ON s.paqueteId = p.paqueteId AND s.estado = 1
            WHERE p.estado = 1
            GROUP BY p.nombrePaquete
        `, { type: sequelize.QueryTypes.SELECT });
  }

  async getResumenTickets() {
    return await sequelize.query(`
            SELECT 
                a.nombreAplicacion AS aplicacion,
                SUM(CASE WHEN t.estado = 'RESUELTO' THEN 1 ELSE 0 END) AS resueltos,
                SUM(CASE WHEN t.estado = 'EN_PROGRESO' THEN 1 ELSE 0 END) AS enProgreso,
                SUM(CASE WHEN t.estado = 'ABIERTO' THEN 1 ELSE 0 END) AS abiertos
            FROM PTLAplicaciones a
            LEFT JOIN PTLTickets t ON t.aplicacionId = a.aplicacionId
            GROUP BY a.nombreAplicacion
        `, { type: sequelize.QueryTypes.SELECT });
  }

  async getFacturacionMRR() {
    return await sequelize.query(`
            SELECT 
                DATENAME(month, f.fechaCobro) AS mes,
                MONTH(f.fechaCobro) AS numMes,
                SUM(CASE WHEN f.periodo = 'ANUAL' THEN f.monto ELSE 0 END) / 1000 AS anuales,
                SUM(CASE WHEN f.periodo IN ('SEMESTRAL', 'TRIMESTRAL') THEN f.monto ELSE 0 END) / 1000 AS intermedios,
                SUM(CASE WHEN f.periodo = 'MENSUAL' THEN f.monto ELSE 0 END) / 1000 AS mensuales
            FROM PTLFacturacion f
            WHERE YEAR(f.fechaCobro) = YEAR(GETDATE())
            GROUP BY DATENAME(month, f.fechaCobro), MONTH(f.fechaCobro)
            ORDER BY numMes ASC
        `, { type: sequelize.QueryTypes.SELECT });
  }
}

module.exports = new DashboardRepository();