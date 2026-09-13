/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection, Error Handling & Socket.io Real-Time Sync
*/
const { response } = require("express");
const WidgetsRolesService = require("../services/widgets-roles.service");

const service = new WidgetsRolesService();

/**
 * Función auxiliar para emitir la señal de socket de forma limpia
 */
const emitirActualizacionPermisos = (req, codigoRole) => {
  const io = req.app.get('socketio');

  if (!io) {
    console.log('❌ URGENTE: io es undefined. Faltó poner app.set("socketio", io) en el Server.');
    return;
  }

  if (codigoRole) {
    io.emit('permisos_actualizados', {
      codigoRole: codigoRole,
      mensaje: 'Se actualizaron los permisos/widgets para este rol'
    });
    console.log(`📡 ÉXITO: Socket emitido para el rol [${codigoRole}]`);
  } else {
    io.emit('permisos_actualizados', {
      mensaje: 'Se asignó un permiso nuevo (Recarga global)'
    });
    console.log('⚠️ ÉXITO: Socket global emitido (no se detectó un codigoRole específico).');
  }
};

const getWidgetsRoles = async (req, res = response) => {
  try {
    const widgetsRoles = await service.getWidgetsRoles();
    console.log('retornar widgetRoles', widgetsRoles);

    return res.status(200).json({ ok: true, widgetsRoles });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || "Error interno al obtener actividades-roles."
    });
  }
};

const getWidgetByCodeWidget = async (req, res = response) => {
  try {
    const { ac } = req.params;
    const data = await service.getWidgetByCodeWidget(ac);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al consultar la actividad por código."
    });
  }
};

const getWidgetByCodeRole = async (req, res = response) => {
  try {
    const { ro } = req.params;
    console.log('consultar el role', ro);

    const data = await service.getWidgetByCodeRole(ro);
    return res.status(200).json({ ok: true, data });
  } catch (error) {
    console.log('🚨 ERROR REAL DE SEQUELIZE:', error);

    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: "Error al consultar la actividad por rol.",
      detalles: error.message || error
    });
  }
};

const createWidgetRole = async (req, res = response) => {
  try {
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    // Guarda en la base de datos
    const nuevaWidget = await service.createWidgetRole(dataDTO);

    const codigoRoleInvolucrado = dataDTO.codigoRole || nuevaWidget?.codigoRole;

    emitirActualizacionPermisos(req, codigoRoleInvolucrado);

    return res.status(201).json({ ok: true, nuevaWidget });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la relación actividad-rol."
    });
  }
};

const createBulkWidgetsRoles = async (req, res = response) => {
  try {
    const { id } = req.params; // Generalmente este 'id' es el código del rol o actividad según tu diseño
    const dataDTO = { ...req.body };
    console.log('codigoWidget / Parámetro:', id);
    console.log('datos insertar:', dataDTO);

    const nuevaWidget = await service.syncWidgetsRoles(id, dataDTO);

    // 🟢 SOCKET.IO: Si el ID o el body contienen el código del rol, lo disparamos
    const codigoRoleInvolucrado = dataDTO.codigoWidget || id;
    emitirActualizacionPermisos(req, codigoRoleInvolucrado);

    return res.status(201).json({ ok: true, nuevaWidget });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear la relación actividad-rol."
    });
  }
};

const updateWidgetRole = async (req, res = response) => {
  try {
    const { id } = req.params;
    const dataDTO = { ...req.body };

    const actividadActualizada = await service.updateWidgetRole(id, dataDTO);

    // 🟢 SOCKET.IO: Emitimos la actualización si viene el rol en el body o la respuesta
    const codigoRoleInvolucrado = dataDTO.codigoRole || actividadActualizada?.codigoRole;
    emitirActualizacionPermisos(req, codigoRoleInvolucrado);

    return res.status(200).json({ ok: true, actividadActualizada });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar la relación actividad-rol."
    });
  }
};

const deleteWidgetRole = async (req, res = response) => {
  try {
    const { id } = req.params;

    // Opcional: Si necesitas el código del rol antes de borrar, 
    // puedes consultar el registro previamente en el servicio.
    const registroAEliminar = await service.getWidgetRoleById ? await service.getWidgetRoleById(id) : null;

    await service.deleteWidgetRole(id);

    // 🟢 SOCKET.IO: Si pudimos obtener el rol asociado al registro borrado, lo notificamos
    if (registroAEliminar?.codigoRole) {
      emitirActualizacionPermisos(req, registroAEliminar.codigoRole);
    } else {
      // Fallback general si no se tiene el rol exacto a la mano
      const io = req.app.get('socketio');
      if (io) io.emit('permisos_actualizados', { mensaje: 'Cambio general de permisos' });
    }

    return res.status(200).json({ ok: true, msg: "Registro eliminado correctamente." });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar la relación actividad-rol."
    });
  }
};

module.exports = {
  getWidgetsRoles,
  getWidgetByCodeWidget,
  createBulkWidgetsRoles,
  getWidgetByCodeRole,
  createWidgetRole,
  updateWidgetRole,
  deleteWidgetRole,
};