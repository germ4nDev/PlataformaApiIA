/*
    Author: German Valencia
    Description: Controlador para los Tipos de Actividad (Endpoints)
*/
const TiposActividadService = require('../services/tipos-actividad.service');
const { io } = require('../index'); // Asegúrate de que la ruta a tu index.js sea correcta

const getTiposActividades = async (req, res) => {
  try {
    const tiposActividades = await TiposActividadService.obtenerTodos();
    res.json({
      ok: true,
      tiposActividades
    });
  } catch (error) {
    console.error('Error en getTiposActividades:', error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

const getTipoActividad = async (req, res) => {
  const { id } = req.params;
  try {
    const tipoActividad = await TiposActividadService.obtenerPorId(id);
    if (!tipoActividad) {
      return res.status(404).json({ ok: false, msg: 'Tipo de actividad no encontrado' });
    }
    res.json({
      ok: true,
      tipoActividad
    });
  } catch (error) {
    console.error('Error en getTipoActividad:', error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

const postTipoActividad = async (req, res) => {
  try {
    const tipoActividad = await TiposActividadService.crear(req.body);

    // 🟢 Emitimos el evento al frontend para actualizar la tabla reactivamente
    io.emit('tipos-actividad-actualizados', { action: 'create', msg: 'Nuevo Tipo de Actividad Creado' });

    res.json({
      ok: true,
      tipoActividad
    });
  } catch (error) {
    if (error.type === 'ValidationError' || error.type === 'DuplicationError') {
      return res.status(400).json({ ok: false, msg: error.msg || error.details });
    }
    console.error('Error en postTipoActividad:', error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

const putTipoActividad = async (req, res) => {
  const { id } = req.params;
  try {
    const tipoActividad = await TiposActividadService.actualizar(id, req.body);

    // 🟢 Emitimos evento de actualización
    io.emit('tipos-actividad-actualizados', { action: 'update', msg: 'Tipo de Actividad Modificado' });

    res.json({
      ok: true,
      tipoActividad
    });
  } catch (error) {
    if (error.type === 'ValidationError') {
      return res.status(400).json({ ok: false, msg: error.details });
    }
    if (error.type === 'NotFoundError') {
      return res.status(404).json({ ok: false, msg: error.msg });
    }
    console.error('Error en putTipoActividad:', error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

const deleteTipoActividad = async (req, res) => {
  const { id } = req.params;
  try {
    const tipoActividad = await TiposActividadService.eliminar(id);

    // 🟢 Emitimos evento de eliminación
    io.emit('tipos-actividad-actualizados', { action: 'delete', msg: 'Tipo de Actividad Eliminado' });

    res.json({
      ok: true,
      tipoActividad
    });
  } catch (error) {
    if (error.type === 'NotFoundError') {
      return res.status(404).json({ ok: false, msg: error.msg });
    }
    console.error('Error en deleteTipoActividad:', error);
    res.status(500).json({ ok: false, msg: 'Hable con el administrador' });
  }
};

module.exports = {
  getTiposActividades,
  getTipoActividad,
  postTipoActividad,
  putTipoActividad,
  deleteTipoActividad
};