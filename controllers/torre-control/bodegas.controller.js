/*
    Author: German Valencia
    Controller: Bodegas y Silos - Torre de Control (TLC_BODEGAS_001)
    Location sugerida: controllers/torre-control/bodegas.controller.js
*/
const { response, request } = require('express');
// Ajusta la ruta relativa según donde tengas ubicado bodegas.service.js (ej: ../../services/torre-control/bodegas.service)
const bodegasService = require('../../services/torre-control/bodegas.service');

/**
 * Extrae el usuario de la sesión/token JWT para el estándar de auditoría QPLUS
 */
const obtenerContextoUsuario = (req) => ({
  codigoUsuario:
    req.usuario?.codigoUsuario ||
    req.usuario?.nombre ||
    req.user?.username ||
    req.uid ||
    req.headers['x-usuario'] ||
    'SISTEMA_ADMIN'
});

/**
 * 1. GET /api/torre-control/bodegas?puerto=BUENAVENTURA
 * Endpoint principal consumido por BodegasService (Angular) con shareReplay(1).
 * Retorna en un solo JSON: { kpis, saturacionBodegas, flujoEntradasSalidas, distribucionPorCarga, movimientosBodega }
 */
const obtenerDashboardBodegas = async (req = request, res = response) => {
  try {
    const puerto = req.query.puerto || req.params.puerto || 'BUENAVENTURA';
    const data = await bodegasService.obtenerDashboardBodegasPorPuerto(puerto);

    return res.status(200).json({
      ok: true,
      puerto: data.puerto,
      timestamp: new Date().toISOString(),
      data
    });
  } catch (error) {
    console.error('❌ [BodegasController - obtenerDashboardBodegas]:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al consultar el dashboard de bodegas y silos',
      error: error.message
    });
  }
};

/**
 * 2. GET /api/torre-control/bodegas/maestro?puerto=BUENAVENTURA
 * Lista el catálogo de bodegas y silos activos de un puerto (dbo.TCL_MaestroBodegas)
 */
const obtenerMaestroBodegas = async (req = request, res = response) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const bodegas = await bodegasService.listarMaestroBodegas(puerto);

    return res.status(200).json({
      ok: true,
      total: bodegas.length,
      data: bodegas
    });
  } catch (error) {
    console.error('❌ [BodegasController - obtenerMaestroBodegas]:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error al listar el maestro de bodegas',
      error: error.message
    });
  }
};

/**
 * 3. POST /api/torre-control/bodegas/maestro
 * Crea una nueva bodega/silo validando la entrada con MaestroBodegaDTO (Joi + Auditoría QPLUS)
 */
const crearBodega = async (req = request, res = response) => {
  try {
    const userContext = obtenerContextoUsuario(req);
    const nuevaBodega = await bodegasService.crearBodega(req.body, userContext);

    return res.status(201).json({
      ok: true,
      msg: 'Bodega registrada exitosamente',
      data: nuevaBodega
    });
  } catch (error) {
    if (error.type === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        msg: 'Error de validación en los datos de la bodega (Escudo Joi)',
        errores: error.details
      });
    }

    console.error('❌ [BodegasController - crearBodega]:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al registrar la bodega',
      error: error.message
    });
  }
};

/**
 * 4. PUT /api/torre-control/bodegas/maestro/:idBodega
 * Actualiza capacidad, inventario, temperatura/humedad o estado de una bodega existente
 */
const actualizarBodega = async (req = request, res = response) => {
  try {
    const { idBodega } = req.params;
    const userContext = obtenerContextoUsuario(req);

    const bodegaActualizada = await bodegasService.actualizarBodega(
      Number(idBodega),
      req.body,
      userContext
    );

    if (!bodegaActualizada) {
      return res.status(404).json({
        ok: false,
        msg: `No se encontró la bodega con ID ${idBodega}`
      });
    }

    return res.status(200).json({
      ok: true,
      msg: 'Bodega actualizada correctamente',
      data: bodegaActualizada
    });
  } catch (error) {
    if (error.type === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        msg: 'Error de validación al actualizar la bodega (Escudo Joi)',
        errores: error.details
      });
    }

    console.error('❌ [BodegasController - actualizarBodega]:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al actualizar la bodega',
      error: error.message
    });
  }
};

/**
 * 5. GET /api/torre-control/bodegas/movimientos?puerto=BUENAVENTURA
 * Lista los últimos lotes / BLs en recibo, almacenamiento o despacho (dbo.TCL_MovimientosBodega)
 */
const obtenerMovimientosBodega = async (req = request, res = response) => {
  try {
    const puerto = req.query.puerto || 'BUENAVENTURA';
    const movimientos = await bodegasService.listarMovimientosBodega(puerto);

    return res.status(200).json({
      ok: true,
      total: movimientos.length,
      data: movimientos
    });
  } catch (error) {
    console.error('❌ [BodegasController - obtenerMovimientosBodega]:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error al consultar los movimientos de bodega',
      error: error.message
    });
  }
};

/**
 * 6. POST /api/torre-control/bodegas/movimientos
 * Registra un ingreso de buque o despacho terrestre validando con MovimientoBodegaDTO (Joi)
 * y actualiza transaccionalmente el inventario de la bodega.
 */
const registrarMovimientoBodega = async (req = request, res = response) => {
  try {
    const userContext = obtenerContextoUsuario(req);
    const nuevoMovimiento = await bodegasService.registrarMovimiento(req.body, userContext);

    return res.status(201).json({
      ok: true,
      msg: 'Movimiento de bodega registrado y saldo actualizado',
      data: nuevoMovimiento
    });
  } catch (error) {
    if (error.type === 'ValidationError') {
      return res.status(400).json({
        ok: false,
        msg: 'Error de validación en los datos del movimiento de bodega (Escudo Joi)',
        errores: error.details
      });
    }

    console.error('❌ [BodegasController - registrarMovimientoBodega]:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Error interno al registrar el movimiento en bodega',
      error: error.message
    });
  }
};

module.exports = {
  obtenerDashboardBodegas,
  obtenerMaestroBodegas,
  crearBodega,
  actualizarBodega,
  obtenerMovimientosBodega,
  registrarMovimientoBodega
};