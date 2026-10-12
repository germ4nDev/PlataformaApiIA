/*
    Author: German Valencia
    Service: Bodegas y Silos - Lógica de Negocio y Armado de Estructuras (Sin SQL directo)
*/
const bodegasRepository = require('../../repositories/torre-control/bodegas.repository');

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

    const toneladasMovidas24h = movimientos.reduce((acc, m) => acc + Number(m.toneladas || 0), 0);

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
        subtitulo: `${movimientos.length} Lotes en recibo / despacho`,
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
      } else {
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
}

module.exports = new BodegasBackendService();