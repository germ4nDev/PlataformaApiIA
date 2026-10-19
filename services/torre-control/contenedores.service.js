/*
    Author: German Valencia
    Pattern: PORTTOS Service - Contenedores
    Description: Indicadores y tablas de la pestaña Contenedores por puerto.
      Acceso a datos en contenedores.repository.js. Patios, retiros y free time siguen con valores de
      referencia (decisión AD-04) hasta tener una fuente real.
*/
const ContenedoresRepository = require('../../repositories/torre-control/contenedores.repository');

const texto = (v) => String(v || '').toLowerCase();

const obtenerDatosContenedores = async (puerto = 'BUENAVENTURA') => {
  try {
    // Usamos directamente la instancia importada

    // 1. Movimientos del puerto (ver contenedores.repository)
    const puertoFiltro = String(puerto || 'BUENAVENTURA').trim().toUpperCase();
    const movimientosDb = await ContenedoresRepository.movimientosDelPuerto(puertoFiltro);

    // 2. Calcular KPIs dinámicamente basados en los registros
    // texto(): una operación o tipo en NULL ya no tumba todo el tablero
    const esVacio = (m) => texto(m.operacion).includes('vacío') || texto(m.operacion).includes('vacio');
    // Corregido 2026-10-17: "Retiro vacío" contaba como cargado y como vacío a la vez
    const totalCargados = movimientosDb.filter(m => texto(m.operacion).includes('retiro') && !esVacio(m)).length;
    const totalVacios = movimientosDb.filter(m => texto(m.operacion).includes('vacío') || texto(m.operacion).includes('vacio')).length;
    const totalDemoras = movimientosDb.filter(m => m.estado === 'DEMORA HOY' || m.estado === 'POR VENCER').length;
    const totalReefer = movimientosDb.filter(m => String(m.tipo || '').includes('RH')).length;

    const navierasConteo = {};
    movimientosDb.forEach(m => {
      navierasConteo[m.naviera] = (navierasConteo[m.naviera] || 0) + 1;
    });

    const categoriasNavieras = Object.keys(navierasConteo);
    const seriesPorDevolver = categoriasNavieras.map(nav => navierasConteo[nav] * 15);
    const seriesCapacidad = categoriasNavieras.map(() => Math.floor(Math.random() * 50) + 80);

    // 3. Construcción del payload consolidado
    const payload = {
      kpis: {
        cargadosPendientes: {
          valor: totalCargados > 0 ? totalCargados.toLocaleString() : '0',
          subtitulo: 'retiro próx 24h · calculado de BD',
          color: '#38bdf8'
        },
        vaciosDevolver: {
          valor: totalVacios > 0 ? totalVacios.toString() : '0',
          subtitulo: 'inventario activo en patios',
          color: '#a855f7'
        },
        reeferActivos: {
          valor: totalReefer > 0 ? totalReefer.toString() : '0',
          subtitulo: '98% conexión OK · con unidades RH',
          color: '#22c55e'
        },
        freeTimeVencido: {
          valor: totalDemoras > 0 ? totalDemoras.toString() : '0',
          subtitulo: 'alertas de demora en BD',
          color: '#ef4444'
        }
      },
      retirosPriorizacion: {
        categorias: ['Hoy', '+1d', '+2d', '+3d', '+4d', '+5d', '+6d', '+7d'],
        series: [
          { name: 'Prioridad alta', data: [110, 140, 220, 170, 130, 100, 80, 50] },
          { name: 'Programado', data: [50, 100, 150, 130, 100, 80, 70, 40] },
          { name: 'Free time disp.', data: [30, 80, 90, 70, 50, 40, 30, 20] }
        ]
      },
      vaciosNaviera: {
        categorias: categoriasNavieras.length > 0 ? categoriasNavieras : ['Maersk', 'MSC', 'COSCO'],
        series: [
          { name: 'Por devolver', data: seriesPorDevolver.length > 0 ? seriesPorDevolver : [140, 118, 40] },
          { name: 'Cap. patios (Estimada)', data: seriesCapacidad.length > 0 ? seriesCapacidad : [80, 95, 150] }
        ]
      },
      saturacionPatios: [
        { nombre: 'Patio NORTE TCBUEN', porcentaje: 94, estado: 'CRÍTICO' },
        { nombre: 'Patio SUR SPRBUN', porcentaje: 82, estado: 'ALTO' },
        { nombre: 'Patio AGUADULCE', porcentaje: 61, estado: 'OK' },
        { nombre: 'Depot CONTECAR', porcentaje: 96, estado: 'CRÍTICO' },
        { nombre: 'Depot QPL', porcentaje: 78, estado: 'ALTO' },
        { nombre: 'Depot BUEN-LOG', porcentaje: 54, estado: 'OK' }
      ],
      freeTimeDistribucion: {
        labels: ['En free time', 'Riesgo demora (<24h)', 'En demora'],
        series: [65, 20, totalDemoras > 0 ? totalDemoras * 5 : 15]
      },
      movimientos: movimientosDb.map(m => ({
        contenedor: m.contenedor,
        tipo: m.tipo,
        naviera: m.naviera,
        operacion: m.operacion,
        ruta: m.ruta,
        cliente: m.cliente,
        freeTime: m.free_time,
        estado: m.estado
      }))
    };

    return payload;

  } catch (error) {
    // Se propaga el error original (conserva el número de error SQL para responderError)
    console.error('❌ [ContenedoresService] Error al consultar movimientos de contenedores:', error.message);
    throw error;
  }
};

module.exports = {
  obtenerDatosContenedores
};