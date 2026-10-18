/*
    Author: German Valencia
    Service: Bodegas y Silos - Lógica de Negocio y Armado de Estructuras (Sin SQL directo)
*/
const bodegasRepository = require('../../repositories/torre-control/bodegas.repository');
const { MaestroBodegaDTO, ActualizarBodegaDTO, estadoPorOcupacion } = require('../../models/torre-control/bodegas.model');
const { MovimientoBodegaDTO } = require('../../models/torre-control/movimientos-bodega.model');
const { crearError, noEncontrado } = require('../../helpers/errores.helper');

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
  async obtenerDashboardBodegasPorPuerto(puerto = 'BUENAVENTURA') {
    const puertoNormalizado = String(puerto || 'BUENAVENTURA').trim().toUpperCase();

    // 1. Llamado paralelo al Repositorio de Datos
    const [bodegas, movimientos, resumenCarga] = await Promise.all([
      bodegasRepository.obtenerMaestroBodegasPorPuerto(puertoNormalizado),
      bodegasRepository.obtenerMovimientosBodegaPorPuerto(puertoNormalizado),
      bodegasRepository.obtenerResumenPorTipoCarga(puertoNormalizado)
    ]);

    // 2. Cálculo de los 4 KPIs Superiores
    const kpis = this._calcularKpisBodegas(bodegas, movimientos);

    // 3. Serie para PTT_BOD_CHRT_FLUJO (Barras Agrupadas: Ingresos vs Salidas por Bodega)
    const flujoEntradasSalidas = this._construirSerieFlujo(bodegas, movimientos);

    // 4. Serie para PTT_BOD_CHRT_CARGA (Dona: Inventario por Tipo de Carga)
    const distribucionPorCarga = {
      titulo: '🌾 Inventario por Tipo de Carga',
      subtitulo: 'Participación volumétrica en bodegas y silos (Ton)',
      labels: resumenCarga.map((r) => r.tipo_carga),
      valores: resumenCarga.map((r) => Number(r.total_toneladas || 0))
    };

    return {
      puerto: puertoNormalizado,
      kpis,
      saturacionBodegas: bodegas,
      flujoEntradasSalidas,
      distribucionPorCarga,
      movimientosBodega: movimientos
    };
  }

  /**
   * Regla de negocio para calcular los 4 KPIs de la cabecera de Bodegas
   */
  _calcularKpisBodegas(bodegas = [], movimientos = []) {
    const totalCapacidad = bodegas.reduce((acc, b) => acc + Number(b.capacidad_maxima_ton || 0), 0);
    const totalInventario = bodegas.reduce((acc, b) => acc + Number(b.inventario_actual_ton || 0), 0);
    const pctOcupacion = totalCapacidad > 0 ? Math.round((totalInventario / totalCapacidad) * 100) : 0;

    const bodegasCriticas = bodegas.filter(
      (b) => Number(b.ocupacion_pct) >= 90 || String(b.estado_operativo || '').toUpperCase().includes('CRÍTIC')
    ).length;

    // Corregido 2026-10-17: el KPI dice "24H" pero sumaba los últimos 50 movimientos de cualquier fecha,
    // traslados internos incluidos. Ahora: ingresos y despachos con fechaCreacion en las últimas 24 h.
    const hace24h = Date.now() - 24 * 3600 * 1000;
    const movimientos24h = movimientos.filter((m) => {
      const t = Date.parse(m.fechaCreacion);
      return Number.isFinite(t) && t >= hace24h && !String(m.tipo_operacion || '').toUpperCase().includes('TRASLADO');
    });
    const toneladasMovidas24h = movimientos24h.reduce((acc, m) => acc + Number(m.toneladas || 0), 0);

    return {
      ocupacionGeneral: {
        titulo: 'OCUPACIÓN DE BODEGAS',
        valor: `${pctOcupacion}%`,
        subtitulo: `${bodegas.length} Bodegas y Silos activos`,
        colorBorde: pctOcupacion >= 90 ? 'borde-rojo' : 'borde-cyan'
      },
      inventarioTotal: {
        titulo: 'INVENTARIO ALMACENADO',
        valor: `${totalInventario.toLocaleString('es-CO')} Ton`,
        subtitulo: `Capacidad: ${totalCapacidad.toLocaleString('es-CO')} Ton`,
        colorBorde: 'borde-green'
      },
      tasaDespacho: {
        titulo: 'FLUJO OPERATIVO (24H)',
        valor: `${toneladasMovidas24h.toLocaleString('es-CO')} Ton`,
        subtitulo: `${movimientos24h.length} lotes en recibo / despacho (24 h)`,
        colorBorde: 'borde-amarillo'
      },
      alertasBodega: {
        titulo: 'BODEGAS EN ALERTA',
        valor: String(bodegasCriticas),
        subtitulo:
          bodegasCriticas > 0
            ? `${bodegasCriticas} zonas con saturación ≥ 90%`
            : 'Almacenamiento en rango normal',
        colorBorde: bodegasCriticas > 0 ? 'borde-rojo' : 'borde-purple'
      }
    };
  }

  /**
   * Regla de negocio para cruzar ingresos de buque vs despachos de camión por cada bodega
   */
  _construirSerieFlujo(bodegas = [], movimientos = []) {
    const mapaFlujo = new Map();

    bodegas.forEach((b) => {
      mapaFlujo.set(b.codigo_bodega, {
        etiqueta: b.codigo_bodega,
        entradas: 0,
        salidas: 0
      });
    });

    movimientos.forEach((m) => {
      const bodegaMatch = bodegas.find(
        (b) => b.id_bodega === m.id_bodega || b.nombre_bodega === m.nombre_bodega
      );
      const clave = bodegaMatch ? bodegaMatch.codigo_bodega : m.nombre_bodega || 'GENERAL';

      if (!mapaFlujo.has(clave)) {
        mapaFlujo.set(clave, { etiqueta: clave, entradas: 0, salidas: 0 });
      }

      const item = mapaFlujo.get(clave);
      const op = String(m.tipo_operacion || '').toUpperCase();
      const ton = Number(m.toneladas || 0);

      if (op.includes('INGRESO') || op.includes('DESCARG') || op.includes('BUQUE')) {
        item.entradas = Number((item.entradas + ton).toFixed(1));
      } else if (!op.includes('TRASLADO')) {
        // Corregido 2026-10-17: un traslado interno no es salida de la bodega
        item.salidas = Number((item.salidas + ton).toFixed(1));
      }
    });

    const flujoArray = Array.from(mapaFlujo.values());

    return {
      titulo: '📊 Flujo de Recibo vs. Despacho (Ton)',
      subtitulo: 'Ingreso desde buque frente a evacuación terrestre por bodega',
      categorias: flujoArray.map((f) => f.etiqueta),
      entradas: flujoArray.map((f) => f.entradas),
      salidas: flujoArray.map((f) => f.salidas)
    };
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