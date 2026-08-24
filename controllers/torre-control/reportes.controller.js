// controllers/torre-control/reportes.controller.js
const { ReporteOperativoModel, ReporteOperativoDTO } = require('../../models/torre-control/reporte-operativo.model');
const { sequelize } = require('../../database/connection');
const ExternalIntegrationService = require('../../services/torre-control/external-integration.service');

const ReporteModel = ReporteOperativoModel(sequelize);

const obtenerReportes = async (req, res) => {
  try {
    // 1. Soporte flexible: leer de query (?puerto=X) o params (/reportes/X)
    const { puerto } = req.query || req.params;

    if (!puerto) {
      return res.json([]); // Escudo: si no envían puerto, retornamos vacío
    }

    // 2. Obtener reportes internos (BD)
    const reportesBD = await ReporteModel.findAll({
      where: { puerto: puerto.toUpperCase() },
      order: [['fecha_registro', 'DESC']], // Asegúrate de que esta columna exista en tu modelo
      limit: 10
    });

    // Mapeo seguro para que el frontend reciba exactamente lo que necesita
    const reportesFormateados = reportesBD.map(r => ({
      titulo: r.titulo_reporte || 'Reporte Operativo',
      // Formateamos la fecha al estilo "DD/MM" que espera el diseño
      fecha: r.fecha_registro ? new Date(r.fecha_registro).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }) : 'N/A',
      descripcion: r.descripcion_corta || '',
      color: r.nivel_alerta || 'primary'
    }));

    // 3. Obtener reportes externos con su propio mini-escudo
    let avisosDimar = 'Condiciones normales';
    let noticias = [];

    try {
      // Si estos métodos aún no existen en el servicio externo, no romperán la ejecución principal
      if (ExternalIntegrationService.getAvisosDIMAR) {
        avisosDimar = await ExternalIntegrationService.getAvisosDIMAR();
      }
      if (ExternalIntegrationService.getLogisticsNews) {
        noticias = await ExternalIntegrationService.getLogisticsNews();
      }
    } catch (extErr) {
      console.warn("Aviso: Servicios externos (DIMAR/Noticias) no disponibles temporalmente.");
    }

    // 4. Fusionar y enviar al frontend
    const respuestaConsolidada = [
      ...reportesFormateados,
      {
        titulo: 'Aviso DIMAR',
        fecha: new Date().toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' }),
        descripcion: typeof avisosDimar === 'string' ? avisosDimar : 'Sin avisos',
        color: 'warning'
      },
      ...(Array.isArray(noticias) ? noticias.slice(0, 2) : [])
    ];

    res.json(respuestaConsolidada);

  } catch (error) {
    // console.error("Error crítico consultando reportes operativos:", error);
    // Escudo Maestro: Nunca enviar 500, siempre enviar un array para que Angular no rompa el forkJoin
    res.json([]);
  }
};

const crearReporteOperativo = async (req, res) => {
  try {
    // 1. Contexto del usuario (simulado desde el token o sesión)
    const userContext = { codigoUsuario: req.user?.codigo || 'SYSTEM_TCL' };

    // 2. Ensamblar y validar DTO (Escudo de datos)
    const dataValida = ReporteOperativoDTO(req.body, userContext);

    // 3. Persistencia en base de datos
    const nuevoReporte = await ReporteModel.create(dataValida);

    res.status(201).json({
      status: 'success',
      data: nuevoReporte,
      message: 'Reporte registrado exitosamente en TCL_REPORTES_OPERATIVOS'
    });
  } catch (err) {
    if (err.type === 'ValidationError') {
      return res.status(400).json({ status: 'error', details: err.details });
    }
    // console.error('Error crítico en persistencia TCL:', err);
    res.status(500).json({ status: 'error', message: 'Error interno del servidor' });
  }
};

module.exports = { obtenerReportes, crearReporteOperativo };