// /*
//     Author: German Valencia
//     Patrón: PORTTOS Service Pattern - Orquestación con Tendencias Dinámicas Calculadas
// */
// const { QueryTypes } = require('sequelize');
// const { db } = require('../../database/connection');
// const { MAPA_PORTUARIO } = require('../../config/puertos.config');
// const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');

// class KpisService {

//   async obtenerResumenOperativo(puerto) {
//     const { anio, mes } = await this.obtenerPeriodoMasReciente();
//     const ciudadKey = puerto ? puerto.toUpperCase() : 'BUENAVENTURA';

//     try {
//       const [kpisOp, terrestres, maritimos, alertas, terminales, tablaMotonaves, graficaEtaAta] = await Promise.all([
//         this._calcularKpisOperativos(anio, mes, ciudadKey),
//         this._calcularKpisTerrestres(anio, mes),
//         this._calcularKpisMaritimos(anio, mes, ciudadKey),
//         this._calcularKpisAlertas(),
//         this._obtenerResumenTerminales(anio, mes, ciudadKey),
//         this._obtenerPronosticoMotonaves(anio, mes, ciudadKey),
//         this._obtenerGraficaEtaVsAta(anio, mes, ciudadKey)
//       ]);

//       return {
//         ...kpisOp,
//         ...terrestres,
//         ...maritimos,
//         ...alertas,
//         KPI_TERMINALES: terminales.KPI_TERMINALES || [],
//         TABLE_REPORTE_MOTONAVES: tablaMotonaves.TABLE_REPORTE_MOTONAVES || { motonaves: [] },
//         CHART_ETA_ATA: graficaEtaAta.CHART_ETA_ATA
//       };
//     } catch (error) {
//       // console.error('[KPI-SERVICE] Error crítico en orquestación:', error);
//       throw new Error('Error al procesar el resumen integral');
//     }
//   }

//   // ====================================================================
//   // LÓGICA DE NEGOCIO: KPIs OPERATIVOS CON TENDENCIAS CALCULADAS
//   // ====================================================================
//   async _calcularKpisOperativos(anio, mes, ciudadKey) {
//     try {
//       const dataCamiones = await MaritimoRepository.getCamionesData(ciudadKey);
//     const c = dataCamiones[0] || { preGate: 0, interior: 0, puerto: 0 };

//     const total = (Number(c.preGate) + Number(c.interior) + Number(c.puerto));

//       // 🚨 FIX 1: Sintaxis SQL corregida y filtro de puerto agregado
//       const camionesQuery = `
//           SELECT 
//               SUM(CASE WHEN estado LIKE '%PRE-GATE%' OR ubicación LIKE '%PRE-GATE%' THEN 1 ELSE 0 END) as preGate,
//               SUM(CASE WHEN estado LIKE '%INTERIOR%' OR ubicación LIKE '%INTERIOR%' THEN 1 ELSE 0 END) as interior,
//               SUM(CASE WHEN estado LIKE '%PUERTO%' OR ubicación LIKE '%PUERTO%' THEN 1 ELSE 0 END) as puerto
//           FROM TCLRegistroCamiones
//           WHERE UPPER(puerto) LIKE '%${ciudadKey}%'
//       `;
//       const dataCamiones = await db.sequelize.query(camionesQuery, { type: QueryTypes.SELECT }).catch((e) => {
//         console.log('Error SQL Camiones:', e.message);
//         return [{}];
//       });
//       const cCamion = dataCamiones[0] || {};

//       // Si la BD devuelve 0 (porque no hay camiones), mostramos 0, no el mock.
//       const totalPreGate = cCamion.preGate || 0;
//       const totalInterior = cCamion.interior || 0;
//       const totalPuerto = cCamion.puerto || 0;
//       const totalCamionesDia = totalPreGate + totalInterior + totalPuerto;

//       // 🚨 FIX 2: Apuntamos a TLCLineUpMaritimo y filtramos por puerto
//       const cargasQuery = `
//           SELECT 
//               'GENERAL' as tipoCarga, -- Temporal mapeado
//               'DESCARGA' as operacionActual,
//               SUM(1500) as volumenTotal -- Temporal mapeado
//           FROM TLCLineUpMaritimo
//           WHERE UPPER(puerto) LIKE '%${ciudadKey}%'
//           GROUP BY puerto
//       `;

//       const dataCargas = await db.sequelize.query(cargasQuery, { type: QueryTypes.SELECT }).catch(() => []);

//       const fcl = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('FCL')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const lcl = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('LCL')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const reefer = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('REEFER')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const totalContenedores = fcl + lcl + reefer;

//       const agricola = dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('AGRICOLA')).reduce((a, b) => a + b.volumenTotal, 0) || 0;
//       const mineral = dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('MINERAL')).reduce((a, b) => a + b.volumenTotal, 0) || 0;
//       const liquido = dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('LIQUIDO')).reduce((a, b) => a + b.volumenTotal, 0) || 0;
//       const totalGranel = agricola + mineral + liquido;

//       const breakBulk = Math.round(dataCargas.filter(x => x.operacionActual?.toUpperCase().includes('BREAK')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const project = Math.round(dataCargas.filter(x => x.operacionActual?.toUpperCase().includes('PROJECT')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const paletizada = Math.round(dataCargas.filter(x => x.operacionActual?.toUpperCase().includes('PALET')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const totalSuelta = breakBulk + project + paletizada;

//       const impVehiculos = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('VEHICULO') && x.operacionActual?.toUpperCase().includes('IMPORT')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const expVehiculos = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('VEHICULO') && x.operacionActual?.toUpperCase().includes('EXPORT')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
//       const totalVehiculos = impVehiculos + expVehiculos;

//       return {
//         KPI_CAMIONES: {
//           titulo: "CAMIONES EN OPERACIÓN",
//           valor: totalCamionesDia.toLocaleString('es-CO'),
//           tendencia: `hoy · pre-gate ${totalPreGate} · interior ${totalInterior} · puerto ${totalPuerto}`,
//           colorBorde: "borde-cyan"
//         },
//         KPI_CONTENEDORES: {
//           titulo: "CONTENEDORES DÍA",
//           valor: totalContenedores.toLocaleString('es-CO'),
//           tendencia: `FCL ${fcl.toLocaleString('es-CO')} · LCL ${lcl.toLocaleString('es-CO')} · Reefer ${reefer.toLocaleString('es-CO')}`,
//           colorBorde: "borde-cyan"
//         },
//         KPI_GRANEL: {
//           titulo: "GRANEL - TONELADAS DÍA",
//           valor: this._formatearNumeroCompacto(totalGranel / 30),
//           tendencia: `Agrícola ${this._formatearNumeroCompacto(agricola)} · Mineral ${this._formatearNumeroCompacto(mineral)} · Líquido ${this._formatearNumeroCompacto(liquido)}`,
//           colorBorde: "borde-naranja"
//         },
//         KPI_CARGA_SUELTA: {
//           titulo: "CARGA SUELTA - TM",
//           valor: totalSuelta.toLocaleString('es-CO'),
//           tendencia: `Break-bulk ${breakBulk} · Project ${project} · Paletizada ${paletizada}`,
//           colorBorde: "borde-amarillo"
//         },
//         KPI_RORO: {
//           titulo: "VEHÍCULOS RO-RO",
//           valor: totalVehiculos.toLocaleString('es-CO'),
//           tendencia: `Imp ${impVehiculos} · Exp ${expVehiculos} · PDI 95% ocupado`,
//           colorBorde: "borde-teal"
//         },
//         KPI_BODEGAS: {
//           titulo: "SATURACIÓN BODEGAS",
//           valor: "72%", // Esto lo conectaremos luego a la tabla de bodegas
//           tendencia: "8 bodegas · 2 críticas · ruteo activo",
//           colorBorde: "borde-fucsia"
//         }
//       };
//     } catch (error) {
//       // console.error("❌ Error calculando sub-métricas de KPIs operativos:", error);
//       throw error;
//     }
//   }

//   // ====================================================================
//   // MÉTODOS DE SOPORTE ADICIONALES
//   // ====================================================================
//   async _calcularKpisTerrestres(anio, mes) {
//     const r = await db.sequelize.query(`SELECT SUM(viajesTotales) as v, SUM(CAST(kilogramos AS FLOAT)) as c, SUM(CAST(valoresPagados AS FLOAT)) as f, SUM(CAST(galones AS FLOAT)) as g FROM TLCRNDCOperacionTerrestre WHERE YEAR(fechaInicioPeriodo)=${anio} AND MONTH(fechaInicioPeriodo)=${mes}`, { type: QueryTypes.SELECT }).catch(() => [{ v: 0, c: 0, f: 0, g: 0 }]);
//     const data = r[0] || {};
//     return {
//       KPI_VIAJES: { titulo: "VIAJES RNDC", valor: this._formatearNumeroCompacto(data.v), colorBorde: "borde-cyan" },
//       KPI_CARGA_TOTAL: { titulo: "CARGA KG", valor: this._formatearNumeroCompacto(data.c), colorBorde: "borde-verde" },
//       KPI_ECONOMICO: { titulo: "COSTO FLETES", valor: `$${this._formatearNumeroCompacto(data.f)}`, colorBorde: "borde-purpura" },
//       KPI_AMBIENTAL: { titulo: "COMBUSTIBLE", valor: `${this._formatearNumeroCompacto(data.g)} Gal`, colorBorde: "borde-esmeralda" }
//     };
//   }

//   async _calcularKpisMaritimos(anio, mes, ciudadKey) {
//     // Apuntamos a la tabla correcta y filtramos por puerto
//     const r = await db.sequelize.query(`
//         SELECT COUNT(*) as n, SUM(1000) as c 
//         FROM TLCLineUpMaritimo 
//         WHERE UPPER(puerto) LIKE '%${ciudadKey}%'
//     `, { type: QueryTypes.SELECT }).catch(() => [{ n: 0, c: 0 }]);
//     const data = r[0] || {};

//     return {
//       KPI_MOTONAVES_ACTIVAS: { titulo: "MOTONAVES", valor: (data.n || 0).toString(), colorBorde: "borde-azul" },
//       KPI_CARGA_MARITIMA: { titulo: "VOLUMEN MARÍTIMO", valor: this._formatearNumeroCompacto(data.c), colorBorde: "borde-verde" }
//     };
//   }

//   async _calcularKpisAlertas() {
//     const r = await db.sequelize.query(`SELECT COUNT(*) as a FROM TCLEventosViales WHERE estadoEvento = 'ACTIVO'`, { type: QueryTypes.SELECT }).catch(() => [{ a: 0 }]);
//     return { KPI_ALERTAS_VIALES: { titulo: "EVENTOS VIALES", valor: (r[0]?.a || 0).toString(), colorBorde: "borde-verde" } };
//   }

//   // ====================================================================
//   // RESUMEN TERMINALES
//   // ====================================================================
//   async _obtenerResumenTerminales(anio, mes, ciudadKey) {
//     const config = MAPA_PORTUARIO[ciudadKey];
//     if (!config) return { KPI_TERMINALES: [] };

//     // 🚨 FIX: Apuntamos a TLCLineUpMaritimo y filtramos obligatoriamente por puerto
//     const sql = `
//       SELECT 
//         terminal as codigoTerminal,
//         muelle, 
//         motonave as barco, 
//         'DESCARGA' as operacion, 
//         1000 as cantidadMovida 
//       FROM TLCLineUpMaritimo
//       WHERE UPPER(puerto) LIKE '%${ciudadKey}%'
//     `;

//     const data = await db.sequelize.query(sql, { type: QueryTypes.SELECT })
//       .catch((err) => {
//         // console.error("❌ Error CRÍTICO en SQL de Terminales:", err.message);
//         return [];
//       });

//     const terminalesDTO = Object.keys(config.infraestructura).map(id => {
//       const term = config.infraestructura[id];
//       const registros = data.filter(op => op.codigoTerminal?.trim().toUpperCase() === id.trim().toUpperCase());
//       const totalMuelles = term.muelles.length;
//       const ocupados = registros.length;
//       const volumen = registros.reduce((acc, curr) => acc + (parseFloat(curr.cantidadMovida) || 0), 0);

//       return {
//         id: `RESUMEN_${id}`,
//         title: term.nombre,
//         subtitle: term.sub,
//         status: "operative",
//         badgeCount: `${ocupados}/${totalMuelles}`,
//         legend: term.desc,
//         docks: term.muelles.map(m => ({
//           label: m.id,
//           class: registros.some(o => o.muelle?.trim() === m.id.trim()) ? 'occupied' : 'free'
//         })),
//         kpis: {
//           occupancy: totalMuelles > 0 ? `${Math.round((ocupados / totalMuelles) * 100)}%` : "0%",
//           vessels: ocupados,
//           metricValue: this._formatearNumeroCompacto(volumen),
//           metricLabel: term.unidad
//         },
//         tableData: term.muelles.map(m => {
//           const barcoDB = registros.find(o => o.muelle?.trim() === m.id.trim());
//           return {
//             id: m.id,
//             especialidad: m.esp,
//             draft: m.calado,
//             vessel: barcoDB ? barcoDB.barco : "—",
//             operation: barcoDB ? barcoDB.operacion : "Disponible",
//             status: barcoDB ? "occupied" : "free"
//           };
//         })
//       };
//     });
//     return { KPI_TERMINALES: terminalesDTO };
//   }

//   // ====================================================================
//   // TABLA DE MOTONAVES (Operación y Forecast 72H)
//   // ====================================================================
//   async _obtenerPronosticoMotonaves(anio, mes, ciudadKey) {
//     try {
//       // 🚨 FIX: Apuntamos a TLCLineUpMaritimo y mapeamos los campos faltantes con mock data segura
//       const sql = `
//           SELECT 
//               motonave as nombreMotonave, 
//               terminal, 
//               'GENERAL' as tipoCarga, 
//               1500 as cantidadMovida, 
//               'ATRACADO' as estadoOperacion, 
//               GETDATE() as fechaETA, 
//               muelle as muelleAsignado, 
//               GETDATE() as fechaCreacion 
//           FROM TLCLineUpMaritimo 
//           WHERE UPPER(puerto) LIKE '%${ciudadKey}%'
//       `;

//       const data = await db.sequelize.query(sql, { type: QueryTypes.SELECT }).catch(() => []);

//       const formatearFechaHhMm = (fechaStr) => {
//         if (!fechaStr) return '--';
//         const d = new Date(fechaStr);
//         if (isNaN(d.getTime())) return '--';
//         const dia = String(d.getDate()).padStart(2, '0');
//         const mes = String(d.getMonth() + 1).padStart(2, '0');
//         const hrs = String(d.getHours()).padStart(2, '0');
//         const min = String(d.getMinutes()).padStart(2, '0');
//         return `${dia}/${mes} ${hrs}:${min}`;
//       };

//       const obtenerClaseBadge = (estado) => {
//         const est = (estado || '').toUpperCase();
//         if (est.includes('DESCARGA') || est.includes('CARGA')) return 'badge-descargando';
//         if (est.includes('FONDEO')) return 'badge-fondeo';
//         if (est.includes('ATRACA')) return 'badge-atracando';
//         if (est.includes('TRANSITO') || est.includes('TRÁNSITO')) return 'badge-transito';
//         return 'badge-transito';
//       };

//       const obtenerTipoBuque = (tipoCarga) => {
//         const t = (tipoCarga || '').toUpperCase();
//         if (t.includes('CONTENEDOR')) return 'Portacont.';
//         if (t.includes('GRANEL')) return 'Granelero';
//         if (t.includes('RO-RO') || t.includes('VEHICULO')) return 'Ro-Ro';
//         if (t.includes('SUELTA') || t.includes('GENERAL')) return 'Multipropósito';
//         if (t.includes('REEFER')) return 'Reefer';
//         return 'General';
//       };

//       const formatearCarga = (cantidad, tipoBuque) => {
//         const qty = this._formatearNumeroCompacto(cantidad);
//         if (tipoBuque === 'Portacont.' || tipoBuque === 'Reefer') return `${qty} TEU`;
//         if (tipoBuque === 'Ro-Ro') return `${qty} vehíc.`;
//         return `${qty} TM`;
//       };

//       const motonavesFormateadas = data.map(b => {
//         const tipo = obtenerTipoBuque(b.tipoCarga);
//         const estado = (b.estadoOperacion || 'EN TRÁNSITO').toUpperCase();

//         let ataStr = '--';
//         if (estado.includes('FONDEO')) ataStr = '-- fondeo';
//         else if (estado.includes('TRÁNSITO') || estado.includes('TRANSITO')) ataStr = '--';
//         else {
//           ataStr = `${formatearFechaHhMm(b.fechaCreacion)} - ${b.muelleAsignado || 'Muelle'}`;
//         }

//         return {
//           motonave: b.nombreMotonave || 'DESCONOCIDO',
//           naviera: 'ND',
//           terminal: b.terminal || 'ND',
//           tipo: tipo,
//           eta: formatearFechaHhMm(b.fechaETA),
//           ata: ataStr,
//           carga: formatearCarga(b.cantidadMovida, tipo),
//           estadoTexto: estado,
//           estadoClase: obtenerClaseBadge(estado)
//         };
//       });

//       return {
//         TABLE_REPORTE_MOTONAVES: {
//           titulo: 'REPORTE DE MOTONAVES · 72H',
//           subtitulo: 'Programación de arribos y atraques',
//           motonaves: motonavesFormateadas
//         }
//       };
//     } catch (e) {
//       // console.error("❌ Error en Tabla Motonaves:", e);
//       return { TABLE_REPORTE_MOTONAVES: { titulo: 'REPORTE DE MOTONAVES', subtitulo: 'Sin datos', motonaves: [] } };
//     }
//   }

//   // ====================================================================
//   // GRÁFICA: ETA vs ATA (Retraso promedio por terminal)
//   // ====================================================================
//   async _obtenerGraficaEtaVsAta(anio, mes, ciudadKey) {
//     try {
//       const config = this._getTerminalConfig(ciudadKey);
//       const idsTerminales = Object.keys(config.infraestructura);
//       const idsSql = idsTerminales.map(id => `'${id}'`).join(',');

//       // 🚨 FIX: Reemplazo a TLCLineUpMaritimo
//       const sql = `
//             SELECT terminal, 
//                    1.5 as retraso -- Valor mock temporal hasta enlazar fechas reales
//             FROM TLCLineUpMaritimo
//             WHERE terminal IN (${idsSql})
//               AND UPPER(puerto) LIKE '%${ciudadKey}%'
//             GROUP BY terminal
//         `;

//       const data = await db.sequelize.query(sql, { type: QueryTypes.SELECT });

//       const labels = idsTerminales.map(id => config.infraestructura[id].nombre);
//       const retrasos = idsTerminales.map(id => {
//         const row = data.find(r => r.terminal.trim() === id);
//         return row ? parseFloat(row.retraso.toFixed(1)) : 0;
//       });

//       return {
//         CHART_ETA_ATA: {
//           titulo: "⏱️ REPORTE ETA VS ATA",
//           subtitulo: "Retraso promedio por terminal (h)",
//           labels: labels,
//           datasets: [{ label: 'ETA planeada (h)', data: idsTerminales.map(() => 0) },
//           { label: 'Retraso real (h)', data: retrasos, backgroundColor: '#ff526a' }]
//         }
//       };
//     } catch (e) {
//       // console.error("Error dinámico:", e);
//       return { CHART_ETA_ATA: { labels: [], datasets: [] } };
//     }
//   }

//   // ====================================================================
//   // GRÁFICA: TONELADAS MOVIDAS POR TIPO Y TERMINAL
//   // ====================================================================
//   async _obtenerGraficaToneladas(ciudadKey) {
//     try {
//       // 🚨 FIX: Reemplazo a TLCLineUpMaritimo
//       const sql = `
//         SELECT 
//             terminal as codigoTerminal, 
//             'GENERAL' as tipoCarga, 
//             SUM(1500) as totalVolumen 
//         FROM TLCLineUpMaritimo
//         WHERE UPPER(puerto) LIKE '%${ciudadKey}%'
//         GROUP BY terminal
//     `;

//       const data = await db.sequelize.query(sql, { type: QueryTypes.SELECT })
//         .catch((err) => {
//           // console.error("❌ Error SQL Toneladas:", err.message);
//           return [];
//         });

//       const terminales = ['SPRBUN', 'TCBUEN', 'SPIA', 'COMPASCAS', 'COMPASAGD'];

//       const getVal = (term, tipo) => {
//         return data.filter(r =>
//           r.codigoTerminal.trim().toUpperCase() === term.trim().toUpperCase() &&
//           r.tipoCarga.toUpperCase().includes(tipo)
//         ).reduce((a, b) => a + b.totalVolumen, 0);
//       };

//       return {
//         CHART_TONELADAS: {
//           titulo: "📊 TONELADAS MOVIDAS HOY · POR TIPO",
//           labels: terminales,
//           datasets: [
//             { label: 'Contenedores (TEU eq.)', data: terminales.map(t => getVal(t, 'CONTENEDOR')), backgroundColor: '#3b82f6' },
//             { label: 'Granel agrícola (t)', data: terminales.map(t => getVal(t, 'AGRICOLA')), backgroundColor: '#10b981' },
//             { label: 'Granel mineral (t)', data: terminales.map(t => getVal(t, 'MINERAL')), backgroundColor: '#a87b51' },
//             { label: 'Granel líquido (t)', data: terminales.map(t => getVal(t, 'LIQUIDO')), backgroundColor: '#14b8a6' },
//             { label: 'Carga suelta (t)', data: terminales.map(t => getVal(t, 'SUELTA') || getVal(t, 'GENERAL')), backgroundColor: '#f59e0b' },
//             { label: 'Vehículos (uds)', data: terminales.map(t => getVal(t, 'VEHICULO') || getVal(t, 'RO-RO')), backgroundColor: '#ec4899' }
//           ]
//         }
//       };
//     } catch (e) {
//       // console.error("❌ Error en Gráfica Toneladas:", e);
//       return { CHART_TONELADAS: { titulo: "📊 TONELADAS MOVIDAS HOY", labels: [], datasets: [] } };
//     }
//   }

//   async obtenerPeriodoMasReciente() {
//     try {
//       const res = await db.sequelize.query(`SELECT TOP 1 YEAR(fechaInicioPeriodo) as anio, MONTH(fechaInicioPeriodo) as mes FROM TLCRNDCOperacionTerrestre ORDER BY fechaInicioPeriodo DESC`, { type: QueryTypes.SELECT });
//       return res.length > 0 ? { anio: res[0].anio, mes: res[0].mes } : { anio: 2026, mes: 1 };
//     } catch (e) { return { anio: 2026, mes: 1 }; }
//   }

//   _formatearNumeroCompacto(valor) {
//     if (valor === null || valor === undefined || isNaN(valor)) return "0";
//     const num = Number(valor);
//     if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
//     if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
//     if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
//     return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
//   }

//   _getTerminalConfig(ciudadKey) {
//     const config = MAPA_PORTUARIO[ciudadKey];
//     if (!config) throw new Error(`Configuración para ${ciudadKey} no encontrada`);
//     return config;
//   }
// }

// module.exports = new KpisService();

/*
    Author: German Valencia
    Patrón: PORTTOS Service Pattern - Orquestación con Tendencias Dinámicas Calculadas
*/
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
const { MAPA_PORTUARIO } = require('../../config/puertos.config');

class KpisService {

  async obtenerResumenOperativo(puerto) {
    const { anio, mes } = await this.obtenerPeriodoMasReciente();
    const ciudadKey = puerto ? puerto.toUpperCase() : 'BUENAVENTURA';

    try {
      const [kpisOp, terrestres, maritimos, alertas, terminales, tablaMotonaves, graficaEtaAta] = await Promise.all([
        this._calcularKpisOperativos(anio, mes, ciudadKey),
        this._calcularKpisTerrestres(anio, mes),
        this._calcularKpisMaritimos(anio, mes, ciudadKey),
        this._calcularKpisAlertas(),
        this._obtenerResumenTerminales(anio, mes, ciudadKey),
        this._obtenerPronosticoMotonaves(anio, mes, ciudadKey),
        this._obtenerGraficaEtaVsAta(anio, mes, ciudadKey)
      ]);

      return {
        ...kpisOp,
        ...terrestres,
        ...maritimos,
        ...alertas,
        KPI_TERMINALES: terminales.KPI_TERMINALES || [],
        TABLE_REPORTE_MOTONAVES: tablaMotonaves.TABLE_REPORTE_MOTONAVES || { motonaves: [] },
        CHART_ETA_ATA: graficaEtaAta.CHART_ETA_ATA
      };
    } catch (error) {
      throw new Error('Error al procesar el resumen integral');
    }
  }

  // ====================================================================
  // LÓGICA DE NEGOCIO: KPIs OPERATIVOS CON TENDENCIAS CALCULADAS
  // ====================================================================
  async _calcularKpisOperativos(anio, mes, ciudadKey) {
    try {
      const dataCamiones = await MaritimoRepository.getKpisOperativos(ciudadKey).catch(() => [{}]);
      const cCamion = dataCamiones[0] || {};
      const totalPreGate = cCamion.preGate || 0;
      const totalInterior = cCamion.interior || 0;
      const totalPuerto = cCamion.puerto || 0;
      const totalCamionesDia = totalPreGate + totalInterior + totalPuerto;

      const dataCargas = await MaritimoRepository.getCargasLineUp(ciudadKey).catch(() => []);

      const fcl = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('FCL')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const lcl = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('LCL')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const reefer = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('REEFER')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const totalContenedores = fcl + lcl + reefer;

      const agricola = dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('AGRICOLA')).reduce((a, b) => a + b.volumenTotal, 0) || 0;
      const mineral = dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('MINERAL')).reduce((a, b) => a + b.volumenTotal, 0) || 0;
      const liquido = dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('LIQUIDO')).reduce((a, b) => a + b.volumenTotal, 0) || 0;
      const totalGranel = agricola + mineral + liquido;

      const breakBulk = Math.round(dataCargas.filter(x => x.operacionActual?.toUpperCase().includes('BREAK')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const project = Math.round(dataCargas.filter(x => x.operacionActual?.toUpperCase().includes('PROJECT')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const paletizada = Math.round(dataCargas.filter(x => x.operacionActual?.toUpperCase().includes('PALET')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const totalSuelta = breakBulk + project + paletizada;

      const impVehiculos = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('VEHICULO') && x.operacionActual?.toUpperCase().includes('IMPORT')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const expVehiculos = Math.round(dataCargas.filter(x => x.tipoCarga?.toUpperCase().includes('VEHICULO') && x.operacionActual?.toUpperCase().includes('EXPORT')).reduce((a, b) => a + b.volumenTotal, 0) / 30) || 0;
      const totalVehiculos = impVehiculos + expVehiculos;

      return {
        KPI_CAMIONES: { titulo: "CAMIONES EN OPERACIÓN", valor: totalCamionesDia.toLocaleString('es-CO'), tendencia: `hoy · pre-gate ${totalPreGate} · interior ${totalInterior} · puerto ${totalPuerto}`, colorBorde: "borde-cyan" },
        KPI_CONTENEDORES: { titulo: "CONTENEDORES DÍA", valor: totalContenedores.toLocaleString('es-CO'), tendencia: `FCL ${fcl.toLocaleString('es-CO')} · LCL ${lcl.toLocaleString('es-CO')} · Reefer ${reefer.toLocaleString('es-CO')}`, colorBorde: "borde-cyan" },
        KPI_GRANEL: { titulo: "GRANEL - TONELADAS DÍA", valor: this._formatearNumeroCompacto(totalGranel / 30), tendencia: `Agrícola ${this._formatearNumeroCompacto(agricola)} · Mineral ${this._formatearNumeroCompacto(mineral)} · Líquido ${this._formatearNumeroCompacto(liquido)}`, colorBorde: "borde-naranja" },
        KPI_CARGA_SUELTA: { titulo: "CARGA SUELTA - TM", valor: totalSuelta.toLocaleString('es-CO'), tendencia: `Break-bulk ${breakBulk} · Project ${project} · Paletizada ${paletizada}`, colorBorde: "borde-amarillo" },
        KPI_RORO: { titulo: "VEHÍCULOS RO-RO", valor: totalVehiculos.toLocaleString('es-CO'), tendencia: `Imp ${impVehiculos} · Exp ${expVehiculos} · PDI 95% ocupado`, colorBorde: "borde-teal" },
        KPI_BODEGAS: { titulo: "SATURACIÓN BODEGAS", valor: "72%", tendencia: "8 bodegas · 2 críticas · ruteo activo", colorBorde: "borde-fucsia" }
      };
    } catch (error) {
      throw error;
    }
  }

  // ====================================================================
  // MÉTODOS DE SOPORTE ADICIONALES
  // ====================================================================
  async _calcularKpisTerrestres(anio, mes) {
    const r = await MaritimoRepository.getKpisTerrestres(anio, mes).catch(() => [{ v: 0, c: 0, f: 0, g: 0 }]);
    const data = r[0] || {};
    return {
      KPI_VIAJES: { titulo: "VIAJES RNDC", valor: this._formatearNumeroCompacto(data.v), colorBorde: "borde-cyan" },
      KPI_CARGA_TOTAL: { titulo: "CARGA KG", valor: this._formatearNumeroCompacto(data.c), colorBorde: "borde-verde" },
      KPI_ECONOMICO: { titulo: "COSTO FLETES", valor: `$${this._formatearNumeroCompacto(data.f)}`, colorBorde: "borde-purpura" },
      KPI_AMBIENTAL: { titulo: "COMBUSTIBLE", valor: `${this._formatearNumeroCompacto(data.g)} Gal`, colorBorde: "borde-esmeralda" }
    };
  }

  async _calcularKpisMaritimos(anio, mes, ciudadKey) {
    const r = await MaritimoRepository.getKpisMaritimos(ciudadKey).catch(() => [{ n: 0, c: 0 }]);
    const data = r[0] || {};
    return {
      KPI_MOTONAVES_ACTIVAS: { titulo: "MOTONAVES", valor: (data.n || 0).toString(), colorBorde: "borde-azul" },
      KPI_CARGA_MARITIMA: { titulo: "VOLUMEN MARÍTIMO", valor: this._formatearNumeroCompacto(data.c), colorBorde: "borde-verde" }
    };
  }

  async _calcularKpisAlertas() {
    const r = await MaritimoRepository.getAlertasViales().catch(() => [{ a: 0 }]);
    return { KPI_ALERTAS_VIALES: { titulo: "EVENTOS VIALES", valor: (r[0]?.a || 0).toString(), colorBorde: "borde-verde" } };
  }

  // ====================================================================
  // RESUMEN TERMINALES
  // ====================================================================
  async _obtenerResumenTerminales(anio, mes, ciudadKey) {
    const config = MAPA_PORTUARIO[ciudadKey];
    if (!config) return { KPI_TERMINALES: [] };

    const data = await MaritimoRepository.getTerminalesLineUp(ciudadKey).catch(() => []);

    const terminalesDTO = Object.keys(config.infraestructura).map(id => {
      const term = config.infraestructura[id];
      const registros = data.filter(op => op.codigoTerminal?.trim().toUpperCase() === id.trim().toUpperCase());
      const totalMuelles = term.muelles.length;
      const ocupados = registros.length;
      const volumen = registros.reduce((acc, curr) => acc + (parseFloat(curr.cantidadMovida) || 0), 0);

      return {
        id: `RESUMEN_${id}`,
        title: term.nombre,
        subtitle: term.sub,
        status: "operative",
        badgeCount: `${ocupados}/${totalMuelles}`,
        legend: term.desc,
        docks: term.muelles.map(m => ({
          label: m.id,
          class: registros.some(o => o.muelle?.trim() === m.id.trim()) ? 'occupied' : 'free'
        })),
        kpis: {
          occupancy: totalMuelles > 0 ? `${Math.round((ocupados / totalMuelles) * 100)}%` : "0%",
          vessels: ocupados,
          metricValue: this._formatearNumeroCompacto(volumen),
          metricLabel: term.unidad
        },
        tableData: term.muelles.map(m => {
          const barcoDB = registros.find(o => o.muelle?.trim() === m.id.trim());
          return {
            id: m.id,
            especialidad: m.esp,
            draft: m.calado,
            vessel: barcoDB ? barcoDB.barco : "—",
            operation: barcoDB ? barcoDB.operacion : "Disponible",
            status: barcoDB ? "occupied" : "free"
          };
        })
      };
    });
    return { KPI_TERMINALES: terminalesDTO };
  }

  // ====================================================================
  // TABLA DE MOTONAVES (Operación y Forecast 72H)
  // ====================================================================
  async _obtenerPronosticoMotonaves(anio, mes, ciudadKey) {
    try {
      const data = await MaritimoRepository.getPronosticoMotonaves(ciudadKey).catch(() => []);

      const formatearFechaHhMm = (fechaStr) => {
        if (!fechaStr) return '--';
        const d = new Date(fechaStr);
        if (isNaN(d.getTime())) return '--';
        const dia = String(d.getDate()).padStart(2, '0');
        const mes = String(d.getMonth() + 1).padStart(2, '0');
        const hrs = String(d.getHours()).padStart(2, '0');
        const min = String(d.getMinutes()).padStart(2, '0');
        return `${dia}/${mes} ${hrs}:${min}`;
      };

      const obtenerClaseBadge = (estado) => {
        const est = (estado || '').toUpperCase();
        if (est.includes('DESCARGA') || est.includes('CARGA')) return 'badge-descargando';
        if (est.includes('FONDEO')) return 'badge-fondeo';
        if (est.includes('ATRACA')) return 'badge-atracando';
        if (est.includes('TRANSITO') || est.includes('TRÁNSITO')) return 'badge-transito';
        return 'badge-transito';
      };

      const obtenerTipoBuque = (tipoCarga) => {
        const t = (tipoCarga || '').toUpperCase();
        if (t.includes('CONTENEDOR')) return 'Portacont.';
        if (t.includes('GRANEL')) return 'Granelero';
        if (t.includes('RO-RO') || t.includes('VEHICULO')) return 'Ro-Ro';
        if (t.includes('SUELTA') || t.includes('GENERAL')) return 'Multipropósito';
        if (t.includes('REEFER')) return 'Reefer';
        return 'General';
      };

      const formatearCarga = (cantidad, tipoBuque) => {
        const qty = this._formatearNumeroCompacto(cantidad);
        if (tipoBuque === 'Portacont.' || tipoBuque === 'Reefer') return `${qty} TEU`;
        if (tipoBuque === 'Ro-Ro') return `${qty} vehíc.`;
        return `${qty} TM`;
      };

      const motonavesFormateadas = data.map(b => {
        const tipo = obtenerTipoBuque(b.tipoCarga);
        const estado = (b.estadoOperacion || 'EN TRÁNSITO').toUpperCase();

        let ataStr = '--';
        if (estado.includes('FONDEO')) ataStr = '-- fondeo';
        else if (estado.includes('TRÁNSITO') || estado.includes('TRANSITO')) ataStr = '--';
        else {
          ataStr = `${formatearFechaHhMm(b.fechaCreacion)} - ${b.muelleAsignado || 'Muelle'}`;
        }

        return {
          motonave: b.nombreMotonave || 'DESCONOCIDO',
          naviera: 'ND',
          terminal: b.terminal || 'ND',
          tipo: tipo,
          eta: formatearFechaHhMm(b.fechaETA),
          ata: ataStr,
          carga: formatearCarga(b.cantidadMovida, tipo),
          estadoTexto: estado,
          estadoClase: obtenerClaseBadge(estado)
        };
      });

      return {
        TABLE_REPORTE_MOTONAVES: {
          titulo: 'REPORTE DE MOTONAVES · 72H',
          subtitulo: 'Programación de arribos y atraques',
          motonaves: motonavesFormateadas
        }
      };
    } catch (e) {
      return { TABLE_REPORTE_MOTONAVES: { titulo: 'REPORTE DE MOTONAVES', subtitulo: 'Sin datos', motonaves: [] } };
    }
  }

  // ====================================================================
  // GRÁFICA: ETA vs ATA (Retraso promedio por terminal)
  // ====================================================================
  async _obtenerGraficaEtaVsAta(anio, mes, ciudadKey) {
    try {
      const config = MAPA_PORTUARIO[ciudadKey];
      if (!config) return { CHART_ETA_ATA: { labels: [], datasets: [] } };
      const idsTerminales = Object.keys(config.infraestructura);
      const idsSql = idsTerminales.map(id => `'${id}'`).join(',');

      const data = await MaritimoRepository.getGraficaEtaAta(ciudadKey, idsSql).catch(() => []);

      const labels = idsTerminales.map(id => config.infraestructura[id].nombre);
      const retrasos = idsTerminales.map(id => {
        const row = data.find(r => r.terminal.trim() === id);
        return row ? parseFloat(row.retraso.toFixed(1)) : 0;
      });

      return {
        CHART_ETA_ATA: {
          titulo: "⏱️ REPORTE ETA VS ATA",
          subtitulo: "Retraso promedio por terminal (h)",
          labels: labels,
          datasets: [{ label: 'ETA planeada (h)', data: idsTerminales.map(() => 0) },
          { label: 'Retraso real (h)', data: retrasos, backgroundColor: '#ff526a' }]
        }
      };
    } catch (e) {
      return { CHART_ETA_ATA: { labels: [], datasets: [] } };
    }
  }

  // ====================================================================
  // GRÁFICA: TONELADAS MOVIDAS POR TIPO Y TERMINAL
  // ====================================================================
  async _obtenerGraficaToneladas(ciudadKey) {
    try {
      const data = await MaritimoRepository.getGraficaToneladas(ciudadKey).catch(() => []);

      const terminales = ['SPRBUN', 'TCBUEN', 'SPIA', 'COMPASCAS', 'COMPASAGD'];

      const getVal = (term, tipo) => {
        return data.filter(r =>
          r.codigoTerminal.trim().toUpperCase() === term.trim().toUpperCase() &&
          r.tipoCarga.toUpperCase().includes(tipo)
        ).reduce((a, b) => a + b.totalVolumen, 0);
      };

      return {
        CHART_TONELADAS: {
          titulo: "📊 TONELADAS MOVIDAS HOY · POR TIPO",
          labels: terminales,
          datasets: [
            { label: 'Contenedores (TEU eq.)', data: terminales.map(t => getVal(t, 'CONTENEDOR')), backgroundColor: '#3b82f6' },
            { label: 'Granel agrícola (t)', data: terminales.map(t => getVal(t, 'AGRICOLA')), backgroundColor: '#10b981' },
            { label: 'Granel mineral (t)', data: terminales.map(t => getVal(t, 'MINERAL')), backgroundColor: '#a87b51' },
            { label: 'Granel líquido (t)', data: terminales.map(t => getVal(t, 'LIQUIDO')), backgroundColor: '#14b8a6' },
            { label: 'Carga suelta (t)', data: terminales.map(t => getVal(t, 'SUELTA') || getVal(t, 'GENERAL')), backgroundColor: '#f59e0b' },
            { label: 'Vehículos (uds)', data: terminales.map(t => getVal(t, 'VEHICULO') || getVal(t, 'RO-RO')), backgroundColor: '#ec4899' }
          ]
        }
      };
    } catch (e) {
      return { CHART_TONELADAS: { titulo: "📊 TONELADAS MOVIDAS HOY", labels: [], datasets: [] } };
    }
  }

  async obtenerPeriodoMasReciente() {
    try {
      const res = await MaritimoRepository.getPeriodoMasReciente();
      return res.length > 0 ? { anio: res[0].anio, mes: res[0].mes } : { anio: 2026, mes: 1 };
    } catch (e) { return { anio: 2026, mes: 1 }; }
  }

  _formatearNumeroCompacto(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return "0";
    const num = Number(valor);
    if (num >= 1000000000) return (num / 1000000000).toFixed(1) + 'B';
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('es-CO', { maximumFractionDigits: 0 });
  }
}

module.exports = new KpisService();