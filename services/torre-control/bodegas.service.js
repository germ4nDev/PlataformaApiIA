/*
    Author: German Valencia
    Service: Bodegas y Silos - Lógica de Negocio y Armado de Estructuras (Sin SQL directo)
*/
const bodegasRepository = require('../../repositories/torre-control/bodegas.repository');
const { MaestroBodegaDTO, ActualizarBodegaDTO, estadoPorOcupacion } = require('../../models/torre-control/bodegas.model');
const { MovimientoBodegaDTO } = require('../../models/torre-control/movimientos-bodega.model');
const { crearError, noEncontrado } = require('../../helpers/errores.helper');
const { armarBodegas, DIAS_FLUJO, serieOcupacionBodegas, movimientosConEstadia } = require('../../utils/bodegas');

const normalizarPuertoBodega = (puerto) => String(puerto || 'BUENAVENTURA').trim().toUpperCase();
const redondear2 = (n) => Math.round(Number(n) * 100) / 100;

/** Efecto de cada operación sobre el inventario de la bodega (toneladas con signo). */
const deltaInventario = (tipoOperacion, toneladas) => {
  if (tipoOperacion === 'INGRESO BUQUE') return toneladas;
  if (tipoOperacion === 'DESPACHO CAMIÓN') return -toneladas;
  return 0; // TRASLADO INTERNO: queda registrado, no cambia el saldo
};

class BodegasBackendService {
  /**
   * Orquesta la consulta al repositorio y construye el payload para los Smart Widgets de Bodegas
   * @param {string} puerto - Ej: 'BUENAVENTURA', 'CARTAGENA', 'BARRANQUILLA', 'SANTA MARTA'
   */
  async obtenerDashboardBodegasPorPuerto(puerto = 'BUENAVENTURA', ahora = new Date()) {
    const puertoNormalizado = String(puerto || 'BUENAVENTURA').trim().toUpperCase();
    // Ventana real de movimientos (Fase 1, 2026-10-23): los del rango del flujo, no los últimos 50 sin fecha
    const desde = new Date(ahora.getTime() - DIAS_FLUJO * 86400000).toISOString();
    const [bodegas, movimientos, resumenCarga] = await Promise.all([
      bodegasRepository.obtenerMaestroBodegasPorPuerto(puertoNormalizado),
      bodegasRepository.obtenerMovimientosBodegaDesde(puertoNormalizado, desde),
      bodegasRepository.obtenerResumenPorTipoCarga(puertoNormalizado)
    ]);
    return armarBodegas({ bodegas, movimientos, resumenCarga, puerto: puertoNormalizado }, ahora);
  }

  // ================================================================
  // DETALLE DE LA VISTA AMPLIADA (Fase 3, 2026-10-25)
  // ================================================================
  /** Serie de ocupación de cada bodega del puerto (fotos de TCL_OcupacionNodos). */
  async ocupacionBodegas(puerto, horas = 24, ahora = new Date()) {
    // require diferido: helpers y repositorio de capacidad solo se usan en este detalle
    const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
    const CapacidadRepository = require('../../repositories/torre-control/capacidad.repository');
    const clave = normalizarPuertoBodega(puerto);
    const ctx = await contextoPuerto(clave);
    const [bodegas, fotos] = await Promise.all([
      bodegasRepository.obtenerMaestroBodegasPorPuerto(clave),
      CapacidadRepository.ocupaciones(ctx.idPuerto, new Date(ahora.getTime() - horas * 3600000).toISOString()),
    ]);
    return serieOcupacionBodegas({ bodegas, fotos: fotos.filter((f) => String(f.id_nodo).startsWith('BOD-')), horas }, ahora);
  }

  /** Movimientos de los últimos `dias` días (hasta 2.000) con la estadía calculada. */
  async movimientosRango(puerto, dias = 30, ahora = new Date()) {
    const desde = new Date(ahora.getTime() - dias * 86400000).toISOString();
    const movimientos = await bodegasRepository.obtenerMovimientosBodegaDesde(normalizarPuertoBodega(puerto), desde, 2000);
    return movimientosConEstadia(movimientos, dias, ahora);
  }

  // ================================================================
  // CRUD (agregado 2026-10-17: el controlador ya los exponía pero no existían → 500)
  // ================================================================

  listarMaestroBodegas(puerto) {
    return bodegasRepository.obtenerMaestroBodegasPorPuerto(normalizarPuertoBodega(puerto));
  }

  listarMovimientosBodega(puerto) {
    return bodegasRepository.obtenerMovimientosBodegaPorPuerto(normalizarPuertoBodega(puerto));
  }

  async crearBodega(rawData, userContext) {
    const registro = MaestroBodegaDTO(rawData, userContext);
    if (registro.inventario_actual_ton > registro.capacidad_maxima_ton) {
      throw crearError(422, 'El inventario inicial no puede superar la capacidad de la bodega', 'CAPACIDAD_EXCEDIDA');
    }
    return bodegasRepository.enTransaccion(async (t) => {
      if (!(await bodegasRepository.existePuerto(registro.id_puerto, t))) {
        throw crearError(422, `El puerto ${registro.id_puerto} no existe`, 'PUERTO_INEXISTENTE');
      }
      if (await bodegasRepository.buscarPorCodigo(registro.id_puerto, registro.codigo_bodega, t)) {
        throw crearError(409, `Ya existe la bodega ${registro.codigo_bodega} en ${registro.id_puerto}`, 'DUPLICADO');
      }
      const nueva = await bodegasRepository.crearBodega(registro, t);
      return bodegasRepository.obtenerBodegaPorId(nueva.id_bodega, t);
    });
  }

  /** Devuelve null si no existe (el controlador responde 404). */
  async actualizarBodega(idBodega, rawData, userContext) {
    if (!Number.isInteger(idBodega) || idBodega <= 0) {
      throw { type: 'ValidationError', details: [{ campo: 'idBodega', mensaje: 'Debe ser un entero positivo' }] };
    }
    const cambios = ActualizarBodegaDTO(rawData, userContext);
    return bodegasRepository.enTransaccion(async (t) => {
      const actual = await bodegasRepository.bloquearBodega(idBodega, t);
      if (!actual) return null;

      const inventario = Number(actual.inventario_actual_ton);
      const capacidad = cambios.capacidad_maxima_ton !== undefined ? cambios.capacidad_maxima_ton : Number(actual.capacidad_maxima_ton);
      if (capacidad < inventario) {
        throw crearError(422, `La capacidad no puede quedar por debajo del inventario actual (${inventario} t)`, 'CAPACIDAD_INSUFICIENTE');
      }
      if (cambios.codigo_bodega && cambios.codigo_bodega !== actual.codigo_bodega) {
        const otra = await bodegasRepository.buscarPorCodigo(actual.id_puerto, cambios.codigo_bodega, t);
        if (otra && otra.id_bodega !== idBodega) {
          throw crearError(409, `Ya existe la bodega ${cambios.codigo_bodega} en ${actual.id_puerto}`, 'DUPLICADO');
        }
      }
      // Si no se fija el estado a mano, se recalcula con la nueva capacidad
      if (cambios.estado_operativo === undefined && cambios.capacidad_maxima_ton !== undefined && capacidad > 0) {
        cambios.estado_operativo = estadoPorOcupacion(actual.estado_operativo, (inventario / capacidad) * 100);
      }
      await bodegasRepository.actualizarBodega(idBodega, cambios, t);
      return bodegasRepository.obtenerBodegaPorId(idBodega, t);
    });
  }

  /**
   * Registra el movimiento y ajusta el inventario en la MISMA transacción, con la fila de la bodega bloqueada.
   * Si el saldo queda fuera de [0, capacidad] no se guarda nada (422).
   */
  async registrarMovimiento(rawData, userContext) {
    const registro = MovimientoBodegaDTO(rawData, userContext);
    const delta = deltaInventario(registro.tipo_operacion, registro.toneladas);

    return bodegasRepository.enTransaccion(async (t) => {
      let bodega = null;
      if (registro.id_bodega) {
        const fila = await bodegasRepository.bloquearBodega(registro.id_bodega, t);
        if (!fila || !fila.activo) throw noEncontrado(`No existe la bodega ${registro.id_bodega} o está inactiva`);
        if (String(fila.id_puerto).trim().toUpperCase() !== registro.id_puerto) {
          throw crearError(422, `La bodega ${registro.id_bodega} no pertenece al puerto ${registro.id_puerto}`, 'PUERTO_NO_COINCIDE');
        }
        const capacidad = Number(fila.capacidad_maxima_ton);
        const saldoActual = Number(fila.inventario_actual_ton);
        const nuevoSaldo = redondear2(saldoActual + delta);
        if (nuevoSaldo < 0) {
          throw crearError(422, `El despacho deja el inventario en negativo (${saldoActual} t disponibles)`, 'INVENTARIO_INSUFICIENTE');
        }
        if (nuevoSaldo > capacidad) {
          throw crearError(422, `El ingreso supera la capacidad de la bodega (${capacidad} t)`, 'CAPACIDAD_EXCEDIDA');
        }
        if (delta !== 0) {
          await bodegasRepository.actualizarBodega(registro.id_bodega, {
            inventario_actual_ton: nuevoSaldo,
            estado_operativo: capacidad > 0 ? estadoPorOcupacion(fila.estado_operativo, (nuevoSaldo / capacidad) * 100) : fila.estado_operativo,
            codigoUsuarioModificacion: registro.codigoUsuarioCreacion,
            fechaModificacion: registro.fechaCreacion
          }, t);
        }
        registro.nombre_bodega = fila.nombre_bodega; // el nombre real de la bodega, no el que envía el cliente
        bodega = await bodegasRepository.obtenerBodegaPorId(registro.id_bodega, t);
      }
      const movimiento = await bodegasRepository.crearMovimiento(registro, t);
      return { movimiento: movimiento.get({ plain: true }), bodega };
    });
  }
}

module.exports = new BodegasBackendService();