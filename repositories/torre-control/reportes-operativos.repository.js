/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Reportes operativos
    Description: Acceso a datos de TCL_ReportesOperativos y conteos de buques despachados para los boletines.
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { ReporteOperativoModel } = require('../../models/torre-control/reporte-operativo.model');

const Reporte = ReporteOperativoModel(sequelize);

module.exports = {
  /** Últimos reportes del puerto, más recientes primero. */
  ultimosDelPuerto: (puerto, limite = 10) => Reporte.findAll({
    raw: true,
    where: { puerto: String(puerto).toUpperCase() },
    order: [['fecha_registro', 'DESC']],
    limit: limite,
  }),

  crear: async (datos) => (await Reporte.create(datos)).get({ plain: true }),

  /** Inserta un reporte generado por un proceso (fecha de registro = ahora en el servidor SQL). */
  registrarAutomatico: ({ puerto, titulo, fecha_evento, descripcion, tipo_color }) => sequelize.query(`
    INSERT INTO dbo.TCL_ReportesOperativos (puerto, titulo, fecha_evento, descripcion, tipo_color, fecha_registro)
    VALUES (:puerto, :titulo, :fecha_evento, :descripcion, :tipo_color, CONVERT(varchar, GETDATE(), 120))`,
  { replacements: { puerto: String(puerto).toUpperCase(), titulo, fecha_evento, descripcion, tipo_color } }),

  /** Buques marcados ZARPADO en los nodos logísticos (sin filtro de fecha: el dato no la tiene). */
  buquesZarpados: async () => {
    const [fila] = await sequelize.query(`
      SELECT COUNT(*) AS total_motonaves, SUM(ocupacionActual) AS total_toneladas
      FROM dbo.TCL_MaestroNodosLogisticos
      WHERE tipoNodo = 'BUQUE' AND estadoOperativo = 'ZARPADO'`, { type: QueryTypes.SELECT });
    return fila || { total_motonaves: 0, total_toneladas: 0 };
  },
};
