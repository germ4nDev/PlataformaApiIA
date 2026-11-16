/*
    Author: German Valencia
    Description: Controlador para los Tipos de Actividad (Endpoints)
*/
const TiposActividadService = require('../services/tipos-actividad.service');
// Socket por el helper (no require('../index'): crea una dependencia circular y deja el controlador vacío)
const { emitir } = require('../helpers/socket.helper');
const EVENTO = 'tipos-actividad-actualizados';

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

    emitir(EVENTO, { action: 'create', msg: 'Nuevo Tipo de Actividad Creado' });

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

    emitir(EVENTO, { action: 'update', msg: 'Tipo de Actividad Modificado' });

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

    emitir(EVENTO, { action: 'delete', msg: 'Tipo de Actividad Eliminado' });

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

// CC-204 (Utilidades › Catálogos): obtener y escribir por capas (services/plataforma/catalogos.service.js: validación, código que no se
// repite ni cambia, no inactiva ni elimina lo que otras tablas usan, socket de siempre y catalogos-actualizados). Mismas rutas y
// permisos; la respuesta trae `registro` y conserva la forma anterior.
const Catalogo = require('./plataforma/catalogos.controller').para('tipos-actividad', (r) => ({ tipoActividad: r }));

module.exports = {
  getTiposActividades,
  getTipoActividad: Catalogo.obtener,
  postTipoActividad: Catalogo.crear,
  putTipoActividad: Catalogo.modificar,
  deleteTipoActividad: Catalogo.eliminar
};
