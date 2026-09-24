/*
    Author: German Valencia
    Pattern: PORTTOS Service - Motor de Datos Marítimos (PRODUCCIÓN)
    Descripción: Orquestador integral de la Pestaña Marítima.
*/
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
const ExternalIntegrationService = require('../../services/torre-control/external-integration.service');

const MapaPortuarioService = require('../../services/torre-control/mapa-portuario.service');
const { DICCIONARIO_HOMOLOGACION_ETL, MAPA_PORTUARIO } = require('../../utils/diccionarios');

class MaritimoService {

  async obtenerOperacionesSLA(puerto) {
    const ciudadKey = puerto ? puerto.toUpperCase() : 'BUENAVENTURA';
    try {
      const kpis = await this._calcularKpisOperativos(2026, 6, ciudadKey);
      return {
        success: true,
        data: {
          'KPI_CAMIONES': kpis.KPI_CAMIONES,
          'KPI_CONTENEDORES': kpis.KPI_CONTENEDORES,
          'KPI_GRANEL': kpis.KPI_GRANEL,
          'KPI_CARGA_SUELTA': kpis.KPI_CARGA_SUELTA,
          'KPI_RORO': kpis.KPI_RORO,
          'KPI_BODEGAS': kpis.KPI_BODEGAS,
          'productividad': ciudadKey === 'BUENAVENTURA'
            ? { 'SPRBUN': [22, 26, 28, 26, 24, 26, 23, 22], 'SPIA': [38, 42, 45, 43, 40, 44, 41, 39], 'TCBUEN': [42, 48, 52, 49, 47, 50, 46, 44] }
            : { 'SPRC': [35, 40, 42, 41, 39, 43, 40, 38], 'CONTECAR': [40, 45, 48, 47, 45, 49, 46, 44] }
        }
      };
    } catch (error) {
      throw new Error('Error al procesar el SLA operativo');
    }
  }

  async obtenerLineUp(puerto) {
    const ciudadKey = puerto ? puerto.toUpperCase() : 'BUENAVENTURA';
    try {
      const data = await this._obtenerPronosticoMotonaves(2026, 6, ciudadKey);
      return { success: true, data: data.TABLE_REPORTE_MOTONAVES.motonaves || [] };
    } catch (error) {
      return { success: true, data: [] };
    }
  }

  async _obtenerClima(puerto) {
    try {
      let lat = 3.8801, lon = -77.0319;
      if (puerto === 'CARTAGENA') { lat = 10.3910; lon = -75.4794; }

      const [weather, tides] = await Promise.all([
        ExternalIntegrationService.getWeatherData(lat, lon),
        ExternalIntegrationService.getTideData(lat, lon)
      ]);

      const estadoDelCanal = (weather && weather.wind?.speed > 15) ? 'Restringido' : 'Abierto';
      return {
        success: true,
        data: {
          marea: tides ? tides.nivel : 'N/A',
          pleamar: tides ? tides.hora : 'N/A',
          visibilidad: weather ? `${(weather.visibility / 1000).toFixed(1)} km` : 'N/A',
          viento: weather ? `${weather.wind?.speed} m/s` : 'N/A',
          estadoCanal: estadoDelCanal
        }
      };
    } catch (error) {
      return { success: true, data: { marea: 'N/A', pleamar: 'N/A', visibilidad: 'N/A', viento: 'N/A', estadoCanal: 'Desconocido' } };
    }
  }

  async obtenerResumenOperativo(puerto) {
    const ciudadKey = puerto ? puerto.toUpperCase() : 'BUENAVENTURA';

    // 1. Obtenemos la fecha y la validamos
    let ultimaFecha = await MaritimoRepository.getUltimoPeriodo();

    // Si viene como objeto (ej: resultado de un SELECT sin mapear), extraemos el valor
    if (ultimaFecha && typeof ultimaFecha === 'object') {
      ultimaFecha = ultimaFecha.fecha || ultimaFecha.max_fecha || ultimaFecha[Object.keys(ultimaFecha)[0]];
    }

    let fecha = new Date(ultimaFecha);

    // 2. BLINDAJE: Si la fecha es inválida, forzamos la fecha actual de Colombia para que SQL Server no explote
    if (isNaN(fecha.getTime())) {
      fecha = new Date();
    }

    const anio = fecha.getFullYear();
    const mes = fecha.getMonth() + 1;

    try {
      const [
        kpisOp,
        terrestres,
        maritimos,
        alertas,
        terminales,
        tablaMotonaves,
        graficaEtaAta,
        graficaToneladas,
        climaRes,
        kpiSemanalReal,
        analisisTraficoNacional,
        participacionNacional,
        mezclaTipoCarga,
        matrizTerminalCarga,
        historicoAnual,
        implicacionesOperativas,
        datosGraficaProductividad
      ] = await Promise.all([
        this._calcularKpisOperativos(anio, mes, ciudadKey).catch(e => ({})),
        this._calcularKpisTerrestres(anio, mes).catch(e => ({})),
        this._calcularKpisMaritimos(anio, mes, ciudadKey).catch(e => ({})),
        this._calcularKpisAlertas().catch(e => ({})),
        this._obtenerResumenTerminales(anio, mes, ciudadKey).catch(e => ({ WDG_TERMINALES: [] })),
        this._obtenerPronosticoMotonaves(anio, mes, ciudadKey).catch(e => ({ TABLE_REPORTE_MOTONAVES: { motonaves: [] } })),
        this._obtenerGraficaEtaVsAta(anio, mes, ciudadKey).catch(e => ({ WDG_CHART_ETA_ATA: { labels: [], datasets: [] } })),
        this._obtenerGraficaToneladas(ciudadKey).catch(e => ({ WDG_CHART_TONELADAS: { labels: [], datasets: [] } })),
        this._obtenerClima(ciudadKey).catch(e => ({ data: {} })),
        this._calcularKpiSemanalMaritimo(ciudadKey).catch(e => ({})),
        this._obtenerAnalisisTrafico(ciudadKey).catch(e => ({})),
        this._obtenerParticipacionNacional(ciudadKey).catch(e => ({})),
        this._obtenerMezclaCarga(ciudadKey).catch(e => ({})),
        this._obtenerMatrizCarga(ciudadKey).catch(e => ({})),
        this._obtenerHistoricoAnual(ciudadKey).catch(e => ({})),
        this._obtenerImplicacionesOperativas(ciudadKey).catch(e => ({ insights: [] })),
        this._obtenerWidgetProductividad(ciudadKey).catch(e => ({ titulo: "", labels: [], datasets: [] }))
      ]);

      // 1. Mapeo seguro para CONDICIONES_CANAL (Con blindaje ?.)
      const c = climaRes?.data || {};
      const WDG_CONDICIONES_CANAL = {
        marea: c.marea || 'N/A',
        pleamar: c.pleamar || '--',
        visibilidad: c.visibilidad || 'N/A',
        viento: c.viento || 'N/A',
        estadoCanal: c.estadoCanal || 'Desconocido',
        pilotaje: 'Normal',
        claseEstado: c.estadoCanal === 'Abierto' ? 'text-success' : 'text-danger'
      };

      // 2. Mapeo exacto para ARRIBOS 7 DÍAS (RESUMEN_SEMANAL) con protección anti-nulos
      const dataArribosProcesada = this._procesarArribosSemanal(tablaMotonaves?.TABLE_REPORTE_MOTONAVES?.motonaves || []);

      const WDG_RESUMEN_SEMANAL = {
        titulo: 'ARRIBOS 7 DÍAS',
        labels: dataArribosProcesada.labels,
        datasets: [{
          label: 'Arribos',
          data: dataArribosProcesada.data,
          backgroundColor: '#3b82f6',
          borderRadius: 4
        }],
        listado: tablaMotonaves?.TABLE_REPORTE_MOTONAVES?.motonaves || [],
        arribos: tablaMotonaves?.TABLE_REPORTE_MOTONAVES?.motonaves || []
      };

      const reportesCrudos = await MaritimoRepository.getReportesOperativos(ciudadKey);

      const WDG_REPORTES_OPERATIVOS = {
        titulo: "REPORTES OPERATIVOS",
        reportes: reportesCrudos.map(rep => ({
          titulo: rep.titulo,
          descripcion: rep.descripcion,
          fecha_evento: rep.fecha_evento || rep.etiquetaTiempo,
          tipo_color: rep.tipo_color || rep.colorLinea
        }))
      };

      return {
        ...kpisOp,
        ...terrestres,
        ...maritimos,
        ...alertas,
        ...graficaToneladas,
        WDG_TERMINALES: terminales?.WDG_TERMINALES || [],
        WDG_TABLE_REPORTE_MOTONAVES: tablaMotonaves?.WDG_TABLE_REPORTE_MOTONAVES || { motonaves: [] },
        WDG_CHART_ETA_ATA: graficaEtaAta?.WDG_CHART_ETA_ATA || { labels: [], datasets: [] },
        WDG_CONDICIONES_CANAL,
        WDG_CHART_PRODUCTIVIDAD: datosGraficaProductividad, // Inyectado directamente del helper dinámico
        WDG_RESUMEN_SEMANAL,
        WDG_REPORTES_OPERATIVOS,
        WDG_SEMANAL_MARITIMO: kpiSemanalReal,
        WDG_ANALISIS_TRAFICO: analisisTraficoNacional,
        WDG_PARTICIPACION_NAC: participacionNacional,
        WDG_MEZCLA_CARGA: mezclaTipoCarga,
        WDG_MATRIZ_TERMINAL_CARGA: matrizTerminalCarga,
        WDG_HISTORICO_ANUAL: historicoAnual,
        WDG_IMPLICACIONES_OPERATIVAS: implicacionesOperativas
      };
    } catch (error) {
      console.error('🔥 Error en obtenerResumenOperativo:', error.stack);
      throw new Error('Error al procesar el resumen integral marítimo');
    }
  }

  async _calcularKpisOperativos(anio, mes, ciudadKey) {
    let errorSql = null;
    const dataCamiones = await MaritimoRepository.getKpisOperativos(ciudadKey).catch(() => ({}));

    // 1. Cálculos Base
    const totalViajesPeriodo = parseInt(dataCamiones.viajes) || 0;
    const lambdaDia = totalViajesPeriodo / 120.0;

    // 2. Tiempos W oficiales 
    const w_pre_gate = 0.75;
    const w_puerto = 3.00;
    const w_interior = 4.00;
    const w_corredor = 8.00;
    const w_total = 15.75;

    // 3. Distribución Física
    const totalPreGate = Math.round(lambdaDia * (w_pre_gate / 24.0));
    const totalPuerto = Math.round(lambdaDia * (w_puerto / 24.0));
    const totalInterior = Math.round(lambdaDia * (w_interior / 24.0));
    const totalCorredor = Math.round(lambdaDia * (w_corredor / 24.0));

    const totalUrbano = totalPreGate + totalPuerto + totalInterior;
    const granTotalActivos = totalUrbano + totalCorredor;

    // 4. Distribución por Naturaleza de Carga (Proporciones del documento)
    const camionesContenedor = Math.round(lambdaDia * (1487 / 2917) * (w_total / 24.0));
    const camionesGranel = Math.round(lambdaDia * (803 / 2917) * (w_total / 24.0));
    const camionesOtros = granTotalActivos - camionesContenedor - camionesGranel;

    const cargas = await MaritimoRepository.getCargasLineUp(ciudadKey).catch(() => []);

    const fcl = Math.round(cargas.filter(x => x.tipoCarga?.toUpperCase().includes('FCL')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const lcl = Math.round(cargas.filter(x => x.tipoCarga?.toUpperCase().includes('LCL')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const reefer = Math.round(cargas.filter(x => x.tipoCarga?.toUpperCase().includes('REEFER')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const totalContenedores = fcl + lcl + reefer;

    const agricola = cargas.filter(x => x.tipoCarga?.toUpperCase().includes('AGRICOLA')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) || 0;
    const mineral = cargas.filter(x => x.tipoCarga?.toUpperCase().includes('MINERAL')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) || 0;
    const liquido = cargas.filter(x => x.tipoCarga?.toUpperCase().includes('LIQUIDO')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) || 0;
    const totalGranel = agricola + mineral + liquido;

    const breakBulk = Math.round(cargas.filter(x => x.operacionActual?.toUpperCase().includes('BREAK')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const project = Math.round(cargas.filter(x => x.operacionActual?.toUpperCase().includes('PROJECT')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const paletizada = Math.round(cargas.filter(x => x.operacionActual?.toUpperCase().includes('PALET')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const totalSuelta = breakBulk + project + paletizada;

    const impVehiculos = Math.round(cargas.filter(x => x.tipoCarga?.toUpperCase().includes('VEHICULO') && x.operacionActual?.toUpperCase().includes('IMPORT')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const expVehiculos = Math.round(cargas.filter(x => x.tipoCarga?.toUpperCase().includes('VEHICULO') && x.operacionActual?.toUpperCase().includes('EXPORT')).reduce((a, b) => a + (parseFloat(b.volumenTotal) || 0), 0) / 30) || 0;
    const totalVehiculos = impVehiculos + expVehiculos;

    return {
      KPI_CAMIONES_PUERTO: {
        valor: totalUrbano.toLocaleString('es-CO'),
        subtitulo: `hoy · pre-gate ${totalPreGate} · interior ${totalInterior} · puerto ${totalPuerto}`,
        tendencia: `ZONA URBANA BUENAVENTURA`,
        titulo: "CAMIONES EN PUERTO",
        colorBorde: "borde-cyan"
      },
      KPI_CAMIONES_VIA: {
        valor: totalCorredor.toLocaleString('es-CO'),
        subtitulo: `Tránsito ruta Buenaventura - Loboguerrero/Cali`,
        tendencia: `CORREDOR LOGÍSTICO VÍA AL MAR`,
        titulo: "CAMIONES EN TRÁNSITO",
        colorBorde: "borde-amarillo"
      },
      KPI_CAMIONES_CARGA: {
        valor: granTotalActivos.toLocaleString('es-CO'),
        subtitulo: `Contenedor ${camionesContenedor} · Granel ${camionesGranel} · General/Otros ${camionesOtros}`,
        tendencia: `INVENTARIO TOTAL DEL SISTEMA (${w_total}h)`,
        titulo: "CAMIONES POR TIPO CARGA",
        colorBorde: "borde-naranja"
      },
      KPI_CONTENEDORES: { valor: totalContenedores.toLocaleString('es-CO'), subtitulo: `FCL ${fcl.toLocaleString('es-CO')} · LCL ${lcl.toLocaleString('es-CO')} · Reefer ${reefer.toLocaleString('es-CO')}`, tendencia: `FCL ${fcl.toLocaleString('es-CO')} · LCL ${lcl.toLocaleString('es-CO')} · Reefer ${reefer.toLocaleString('es-CO')}`, titulo: "CONTENEDORES DÍA", colorBorde: "borde-cyan" },
      KPI_GRANEL: { valor: this._formatearNumeroCompacto(totalGranel / 30), subtitulo: `Agrícola ${this._formatearNumeroCompacto(agricola)} · Mineral ${this._formatearNumeroCompacto(mineral)} · Líquido ${this._formatearNumeroCompacto(liquido)}`, tendencia: `Agrícola ${this._formatearNumeroCompacto(agricola)} · Mineral ${this._formatearNumeroCompacto(mineral)} · Líquido ${this._formatearNumeroCompacto(liquido)}`, titulo: "GRANEL - TONS DÍA", colorBorde: "borde-naranja" },
      KPI_CARGA_SUELTA: { valor: totalSuelta.toLocaleString('es-CO'), subtitulo: `Break-bulk ${breakBulk} · Project ${project} · Paletizada ${paletizada}`, tendencia: `Break-bulk ${breakBulk} · Project ${project} · Paletizada ${paletizada}`, titulo: "CARGA SUELTA - TM", colorBorde: "borde-amarillo" },
      KPI_RORO: { valor: totalVehiculos.toLocaleString('es-CO'), subtitulo: `Imp ${impVehiculos} · Exp ${expVehiculos} · PDI 95% ocupado`, tendencia: `Imp ${impVehiculos} · Exp ${expVehiculos} · PDI 95% ocupado`, titulo: "VEHÍCULOS RO-RO", colorBorde: "borde-teal" },
      KPI_BODEGAS: { valor: ciudadKey === 'BUENAVENTURA' ? '72%' : '85%', subtitulo: ciudadKey === 'BUENAVENTURA' ? '8 bodegas · 2 críticas · ruteo activo' : '5 bodegas · 4 críticas · ruteo activo', tendencia: ciudadKey === 'BUENAVENTURA' ? '8 bodegas · 2 críticas · ruteo activo' : '5 bodegas · 4 críticas · ruteo activo', titulo: "SATURACIÓN BODEGAS", colorBorde: "borde-fucsia" }
    };
  }

  async _obtenerPronosticoMotonaves(anio, mes, ciudadKey) {
    // 1. Obtener datos con manejo de errores
    const data = await MaritimoRepository.getPronosticoMotonaves(ciudadKey);

    if (!Array.isArray(data) || data.length === 0) {
      console.warn(`[WARN] No se encontraron motonaves para: ${ciudadKey}`);
      return { WDG_TABLE_REPORTE_MOTONAVES: { motonaves: [] } };
    }

    const formatearFecha = (fechaStr) => {
      if (!fechaStr) return '--';
      const d = new Date(fechaStr);
      if (isNaN(d.getTime())) return '--';
      return `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
    };

    const navierasMock = ['MSC', 'Maersk', 'Hapag-Lloyd', 'CMA CGM', 'Evergreen', 'Hamburg Süd'];

    const motonavesFormateadas = data.map((b, index) => {
      const estadoStr = (b.estadoOperacion || 'EN TRÁNSITO').toUpperCase();

      // Lógica de estados
      let clasePildora = 'badge-transito';
      let textoEstado = 'EN TRÁNSITO';

      if (estadoStr.includes('DESCARGA') || estadoStr.includes('DISCHARGE') || estadoStr.includes('ATRACADO')) {
        clasePildora = 'badge-descargando';
        textoEstado = 'DESCARGANDO';
      } else if (estadoStr.includes('FONDEO') || estadoStr.includes('ESPERA') || estadoStr.includes('ANCHOR')) {
        clasePildora = 'badge-fondeo';
        textoEstado = 'EN FONDEO';
      }

      // Lógica de carga
      const cantidadReal = parseFloat(b.cantidadMovida) || 0;
      const tipoCargaReal = (b.tipoCarga || 'GENERAL').toUpperCase();

      let textoCarga = `${cantidadReal.toLocaleString('es-CO')} TM`;
      let tipoBuque = 'Multipropósito';

      if (tipoCargaReal.includes('CONTENEDOR') || tipoCargaReal.includes('FCL')) {
        textoCarga = `${cantidadReal.toLocaleString('es-CO')} TEU`;
        tipoBuque = 'Portacont.';
      } else if (tipoCargaReal.includes('AGRICOLA') || tipoCargaReal.includes('MINERAL')) {
        textoCarga = `${cantidadReal.toLocaleString('es-CO')} TM`;
        tipoBuque = 'Granelero';
      }

      return {
        motonave: b.nombreMotonave || 'DESCONOCIDO',
        naviera: navierasMock[index % navierasMock.length],
        terminal: b.terminal || 'ND',
        tipo: tipoBuque,
        carga: textoCarga,
        eta: formatearFecha(b.fechaETA),
        ata: '--',
        estadoTexto: textoEstado,
        estadoClase: clasePildora
      };
    });

    return { WDG_TABLE_REPORTE_MOTONAVES: { motonaves: motonavesFormateadas } };
  }

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
    return {
      KPI_MOTONAVES_ACTIVAS: { titulo: "MOTONAVES", valor: (r[0]?.n || 0).toString(), colorBorde: "borde-azul" },
      KPI_CARGA_MARITIMA: { titulo: "VOLUMEN MARÍTIMO", valor: this._formatearNumeroCompacto(r[0]?.c), colorBorde: "borde-verde" }
    };
  }

  async _calcularKpisAlertas() {
    const r = await MaritimoRepository.getAlertasViales().catch(() => [{ a: 0 }]);
    return { KPI_ALERTAS_VIALES: { titulo: "EVENTOS VIALES", valor: (r[0]?.a || 0).toString(), colorBorde: "borde-verde" } };
  }

  async _obtenerResumenTerminales(anio, mes, ciudadKey) {
    const mapaCompletoBD = await MapaPortuarioService.obtenerMapaFormatoFrontend();
    const config = mapaCompletoBD[ciudadKey];

    if (!config) {
      console.warn(`[WARN] No hay terminales configuradas en la BD para: ${ciudadKey}`);
      return { WDG_TERMINALES: [] };
    }

    // Extraemos la data de la base de datos
    const data = await MaritimoRepository.getTerminalesLineUp(ciudadKey).catch(() => []);

    const terminalesDTO = Object.keys(config.infraestructura).map(id => {
      const term = config.infraestructura[id];
      const configId = id.trim().toUpperCase();
      const misAlias = term.alias ? term.alias.map(a => a.toUpperCase()) : [];

      // 1. FILTRO ANTI-CAPA-8 (Limpieza de nombres de terminales)
      const registrosTerminal = data.filter(op => {
        const dbNameRaw = (op.codigoTerminal || op.terminal || '').trim().toLowerCase();
        const codigoOficial = DICCIONARIO_HOMOLOGACION_ETL[dbNameRaw] || dbNameRaw.toUpperCase();
        return codigoOficial === configId || dbNameRaw.toUpperCase().includes(configId);
      });

      // 2. EL ENSAMBLAJE DE MUELLES Y BARCOS (A prueba de nulos y "Spanglish")
      const tablaMuelles = term.muelles.map(m => {
        const idVisual = (m.id || '').trim().toUpperCase();
        const idBaseDatos = (m.dbId || '').trim().toUpperCase();

        const barcoDB = registrosTerminal.find(o => {
          const dbMuelle = (o.muelle || '').trim().toUpperCase();

          // Candado de seguridad: Ignorar si viene nulo o vacío
          if (!dbMuelle) return false;

          return dbMuelle === idVisual || dbMuelle === idBaseDatos;
        });

        // Lógica de estados
        let operacionTexto = 'DISPONIBLE';
        let clasePildora = 'badge-libre';

        if (barcoDB) {
          const pos = (barcoDB.estado_posicion || barcoDB.posicion || '').toUpperCase();
          const trabajo = (barcoDB.tipo_trabajo || barcoDB.trabajoOperacion || '').toUpperCase();

          if (trabajo.includes('DESCARGA') || trabajo.includes('CARGA')) {
            clasePildora = 'badge-descargando';
            operacionTexto = trabajo;
          } else if (pos.includes('FONDEO')) {
            clasePildora = 'badge-fondeo';
            operacionTexto = 'EN FONDEO';
          } else {
            clasePildora = 'badge-atracando';
            operacionTexto = pos || 'ATRACADO';
          }
        }

        const nombreBarco = barcoDB ? (barcoDB.barco || barcoDB.motonave || "SIN NOMBRE") : "—";

        return {
          id: m.id,
          especialidad: m.esp,
          draft: m.calado,
          calado: m.calado,
          vessel: nombreBarco,
          barco: nombreBarco,
          motonave: nombreBarco,
          barcoAtracado: nombreBarco,
          operacionBarco: operacionTexto,
          operation: operacionTexto,
          operacion: operacionTexto,
          claseEstado: clasePildora,
          status: barcoDB ? "occupied" : "free",
          estado: barcoDB ? "ocupado" : "libre",
          cantidad: barcoDB ? (parseFloat(barcoDB.cantidadMovida) || 0) : 0
        };
      });

      // 3. CÁLCULO EXACTO DE KPIs
      const muellesOcupados = tablaMuelles.filter(m => m.status === 'occupied');
      const totalOcupados = muellesOcupados.length;
      const totalToneladas = tablaMuelles.reduce((acc, curr) => acc + curr.cantidad, 0);
      const porcentajeOcupacion = term.muelles.length > 0 ? Math.round((totalOcupados / term.muelles.length) * 100) : 0;

      return {
        id: `WDG_RESUMEN_${id}`,
        title: term.nombre,
        nombreTerminal: term.nombre,
        subtitle: term.sub,
        status: "operative",
        badgeCount: `${totalOcupados}/${term.muelles.length}`,
        legend: term.desc,
        docks: tablaMuelles.map(m => ({
          label: m.id,
          class: m.status
        })),
        kpis: {
          occupancy: `${porcentajeOcupacion}%`,
          ocupacion: `${porcentajeOcupacion}%`,

          vessels: totalOcupados,
          motonaves: totalOcupados,

          metricValue: this._formatearNumeroCompacto(totalToneladas),
          metricLabel: term.unidad
        },
        tableData: tablaMuelles
      };
    });

    return { WDG_TERMINALES: terminalesDTO };
  }
  // async _obtenerResumenTerminales(anio, mes, ciudadKey) {
  //   try {
  //     // 1. Validar que el servicio existe
  //     if (!MapaPortuarioService || !MapaPortuarioService.obtenerMapaFormatoFrontend) {
  //       return { WDG_TERMINALES: [], DEBUG_API: "❌ El servicio MapaPortuarioService no está importado o le falta el método." };
  //     }

  //     const mapaCompletoBD = await MapaPortuarioService.obtenerMapaFormatoFrontend();
  //     const llavesDisponibles = Object.keys(mapaCompletoBD);

  //     const llaveReal = llavesDisponibles.find(k => k.includes(ciudadKey) || ciudadKey.includes(k));
  //     const config = llaveReal ? mapaCompletoBD[llaveReal] : null;

  //     // 2. Validar si la base de datos entregó puertos
  //     if (!config) {
  //       return {
  //         WDG_TERMINALES: [],
  //         DEBUG_API: `⚠️ No se halló el puerto. Buscaba: ${ciudadKey}. Encontrados en BD: ${llavesDisponibles.join(', ') || 'NINGUNO'}`
  //       };
  //     }

  //     // 3. Validar si el puerto tiene infraestructura
  //     if (!config.infraestructura || Object.keys(config.infraestructura).length === 0) {
  //       return { WDG_TERMINALES: [], DEBUG_API: `⚠️ Puerto ${llaveReal} existe, pero su objeto 'infraestructura' está vacío.` };
  //     }

  //     if (!config) return { WDG_TERMINALES: [] };

  //     const data = await MaritimoRepository.getTerminalesLineUp(ciudadKey).catch(e => {
  //       throw new Error(`Error en getTerminalesLineUp: ${e.message}`);
  //     });

  //     if (data.length > 0) console.log("🔍 [DEBUG DATA] Ejemplo del primer registro:", data[0]);

  //     // --- Mapeo normal ---
  //     const terminalesDTO = Object.keys(config.infraestructura).map(id => {
  //       const term = config.infraestructura[id];
  //       const configId = id.trim().toUpperCase();
  //       const misAlias = term.alias && Array.isArray(term.alias) ? term.alias.map(a => a.toUpperCase()) : [];

  //       const registrosTerminal = data.filter(op => {
  //         const dbNameRaw = (op.codigoTerminal || op.terminal || '').trim().toLowerCase();
  //         const codigoOficial = DICCIONARIO_HOMOLOGACION_ETL[dbNameRaw] || dbNameRaw.toUpperCase();
  //         return codigoOficial === configId || dbNameRaw.toUpperCase().includes(configId);
  //       });

  //       const tablaMuelles = term.muelles.map(m => {
  //         const idVisual = (m.id || '').trim().toUpperCase();
  //         const idBaseDatos = (m.dbId || '').trim().toUpperCase();
  //         const barcoDB = registrosTerminal.find(o => {
  //           const dbMuelle = (o.muelle || '').trim().toUpperCase();
  //           if (!dbMuelle) return false;
  //           return dbMuelle === idVisual || dbMuelle === idBaseDatos;
  //         });

  //         return {
  //           id: m.id, especialidad: m.esp, draft: m.calado, calado: m.calado,
  //           vessel: barcoDB ? (barcoDB.barco || barcoDB.motonave) : "—",
  //           barco: barcoDB ? (barcoDB.barco || barcoDB.motonave) : "—",
  //           operacionBarco: barcoDB ? 'OCUPADO' : 'DISPONIBLE',
  //           claseEstado: barcoDB ? 'badge-atracando' : 'badge-libre',
  //           status: barcoDB ? "occupied" : "free",
  //           estado: barcoDB ? "ocupado" : "libre",
  //           cantidad: barcoDB ? (parseFloat(barcoDB.cantidadMovida) || 0) : 0
  //         };
  //       });

  //       const muellesOcupados = tablaMuelles.filter(m => m.status === 'occupied');
  //       const totalToneladas = tablaMuelles.reduce((acc, curr) => acc + curr.cantidad, 0);

  //       return {
  //         id: `WDG_RESUMEN_${id}`, title: term.nombre, status: "operative",
  //         badgeCount: `${muellesOcupados.length}/${term.muelles.length}`,
  //         kpis: { occupancy: `0%`, motonaves: muellesOcupados.length, metricValue: totalToneladas },
  //         tableData: tablaMuelles
  //       };
  //     });

  //     return { WDG_TERMINALES: terminalesDTO, DEBUG_API: `✅ Todo OK. Terminales armadas: ${terminalesDTO.length}` };

  //   } catch (error) {
  //     // 4. Atrapa si algo revienta en SQL Server
  //     return { WDG_TERMINALES: [], DEBUG_API: `🔥 ERROR FATAL CODE: ${error.message}` };
  //   }
  // }

  // async _obtenerGraficaEtaVsAta(anio, mes, ciudadKey) {
  //   try {
  //     const mapaCompletoBD = await MapaPortuarioService.obtenerMapaFormatoFrontend();
  //     const llavesDisponibles = Object.keys(mapaCompletoBD);
  //     const llaveReal = llavesDisponibles.find(k => k.includes(ciudadKey) || ciudadKey.includes(k));
  //     const config = llaveReal ? mapaCompletoBD[llaveReal] : null;

  //     if (!config) {
  //       return { WDG_CHART_ETA_ATA: { labels: [], datasets: [] } };
  //     }

  //     const data = await MaritimoRepository.getGraficaEtaAta(ciudadKey).catch(() => []);

  //     if (data.length > 0) console.log("🔍 [DEBUG ETA/ATA] Ejemplo del primer registro:", data[0]);

  //     const idsTerminales = Object.keys(config.infraestructura);
  //     const labelsLimpios = [];
  //     const datosRetraso = [];
  //     const datosPlaneado = [];

  //     idsTerminales.forEach(id => {
  //       const terminalConfig = config.infraestructura[id];
  //       const configId = id.trim().toLowerCase();
  //       const nombreMostrar = terminalConfig.nombre;
  //       console.log('&&************&&&&&&&&&&&&& terminalConfig', terminalConfig);
  //       console.log('&&************ configId', configId);
  //       console.log('&&************ nombreMostrar', nombreMostrar);

  //       const misAlias = terminalConfig.alias && Array.isArray(terminalConfig.alias) ? terminalConfig.alias : [];

  //       const row = data.find(r => {
  //         // const dbTerminal = (r.terminal || '').trim().toLowerCase();
  //         const dbTerminal = (r.terminal || '').trim().toLowerCase();
  //         console.log('&&************ dbTerminal', dbTerminal);

  //         // if (dbTerminal.includes(configId) || configId.includes(dbTerminal)) return true;
  //         if (nombreMostrar.includes(configId) || configId.includes(nombreMostrar)) return true;
  //         return misAlias.some(alias => dbTerminal.includes(alias.toLowerCase()));
  //       });
  //       // console.log('&&************ row', row);

  //       // if (row) {
  //       const retrasoH = Math.round(parseFloat(row.retrasoPromedio || 0));
  //       labelsLimpios.push(nombreMostrar);
  //       datosRetraso.push(retrasoH);
  //       datosPlaneado.push(0);
  //       console.log('&&************ nombreMostrar', nombreMostrar);
  //       console.log('&&************ datosRetraso', datosRetraso);
  //       console.log('&&************ datosPlaneado', datosPlaneado);
  //       // }
  //     });

  //     return {
  //       WDG_CHART_ETA_ATA: {
  //         titulo: "⏱️ REPORTE ETA VS ATA",
  //         subtitulo: `Comparativa promedio (h) - ${ciudadKey}`,
  //         labels: labelsLimpios,
  //         datasets: [
  //           { label: 'ETA planeada (h)', data: datosPlaneado, backgroundColor: '#60a5fa' },
  //           { label: 'Retraso real (h)', data: datosRetraso, backgroundColor: '#ff526a' }
  //         ]
  //       }
  //     };
  //   } catch (error) {
  //     console.error('🔥 Error en _obtenerGraficaEtaVsAta:', error);
  //     throw error;
  //   }
  // }

  // async _obtenerGraficaEtaVsAta(anio, mes, ciudadKey) {
  //   const mapaCompletoBD = await MapaPortuarioService.obtenerMapaFormatoFrontend();
  //   const config = mapaCompletoBD[ciudadKey];

  //   if (!config) {
  //     console.warn(`[WARN] No hay terminales configuradas en la BD para ETA/ATA en: ${ciudadKey}`);
  //     return { WDG_CHART_ETA_ATA: { labels: [], datasets: [] } };
  //   }

  //   const data = await MaritimoRepository.getGraficaEtaAta(ciudadKey).catch(() => []);

  //   const idsTerminales = Object.keys(config.infraestructura);
  //   const labelsLimpios = [];
  //   const datosRetraso = [];
  //   const datosPlaneado = [];

  //   idsTerminales.forEach(id => {
  //     const terminalConfig = config.infraestructura[id];
  //     const configId = id.trim().toLowerCase();
  //     const nombreMostrar = terminalConfig.nombre;

  //     // 💡 EXTRAEMOS LOS ALIAS DINÁMICAMENTE DESDE LA CONFIGURACIÓN
  //     const misAlias = terminalConfig.alias || [];

  //     const row = data.find(r => {
  //       const dbTerminal = (r.terminal || '').trim().toLowerCase();

  //       // 1. Chequeo directo (por si el ID coincide perfecto)
  //       if (dbTerminal.includes(configId) || configId.includes(dbTerminal)) return true;

  //       // 2. Chequeo dinámico por alias (Funciona para cualquier puerto de Colombia)
  //       return misAlias.some(alias => dbTerminal.includes(alias.toLowerCase()));
  //     });

  //     // Si la terminal tiene datos en BD, la armamos para la gráfica
  //     if (row) {
  //       const retrasoH = Math.round(parseFloat(row.retrasoPromedio || 0));

  //       labelsLimpios.push(nombreMostrar);
  //       datosRetraso.push(retrasoH);
  //       datosPlaneado.push(0);
  //     }
  //   });

  //   return {
  //     WDG_CHART_ETA_ATA: {
  //       titulo: "⏱️ REPORTE ETA VS ATA",
  //       subtitulo: `Comparativa promedio (h) - ${ciudadKey}`, // Un buen toque para saber qué puerto vemos
  //       labels: labelsLimpios,
  //       datasets: [
  //         { label: 'ETA planeada (h)', data: datosPlaneado, backgroundColor: '#60a5fa' },
  //         { label: 'Retraso real (h)', data: datosRetraso, backgroundColor: '#ff526a' }
  //       ]
  //     }
  //   };
  // }

  async _obtenerGraficaEtaVsAta(anio, mes, ciudadKey) {
    try {
      const mapaCompletoBD = await MapaPortuarioService.obtenerMapaFormatoFrontend();
      const llavesDisponibles = Object.keys(mapaCompletoBD);
      const llaveReal = llavesDisponibles.find(k => k.includes(ciudadKey) || ciudadKey.includes(k));
      const config = llaveReal ? mapaCompletoBD[llaveReal] : null;

      if (!config) {
        return { WDG_CHART_ETA_ATA: { labels: [], datasets: [] } };
      }

      const data = await MaritimoRepository.getGraficaEtaAta(ciudadKey).catch(() => []);

      const idsTerminales = Object.keys(config.infraestructura);
      const labelsLimpios = [];
      const datosRetraso = [];
      const datosPlaneado = [];

      idsTerminales.forEach(id => {
        const terminalConfig = config.infraestructura[id];
        const configId = id.trim().toUpperCase();
        const nombreMostrar = terminalConfig.nombre;

        const row = data.find(r => {
          const dbNameRaw = (r.terminal || '').trim().toLowerCase();
          const codigoOficial = DICCIONARIO_HOMOLOGACION_ETL[dbNameRaw] || dbNameRaw.toUpperCase();
          return codigoOficial === configId || dbNameRaw.toUpperCase().includes(configId);
        });

        // 🟢 EL AJUSTE: Solo pintar en la gráfica si la terminal tiene registros
        if (row) {
          const retrasoH = Math.round(parseFloat(row.retrasoPromedio || 0));

          labelsLimpios.push(nombreMostrar);
          datosRetraso.push(retrasoH);
          datosPlaneado.push(0); // Línea base ETA (planeado)
        }
      });

      return {
        WDG_CHART_ETA_ATA: {
          titulo: "⏱️ REPORTE ETA VS ATA",
          subtitulo: `Comparativa promedio (h) - ${ciudadKey}`,
          labels: labelsLimpios,
          datasets: [
            { label: 'ETA planeada (h)', data: datosPlaneado, backgroundColor: '#60a5fa' },
            { label: 'Retraso real (h)', data: datosRetraso, backgroundColor: '#ff526a' }
          ]
        }
      };
    } catch (error) {
      console.error('🔥 Error en _obtenerGraficaEtaVsAta:', error);
      throw error;
    }
  }

  async _obtenerGraficaToneladas(ciudadKey) {
    const data = await MaritimoRepository.getGraficaToneladas(ciudadKey).catch(() => []);
    const terminales = ['SPRBUN', 'TCBUEN', 'SPIA', 'COMPASCAS', 'COMPASAGD'];

    const getVal = (term, tipo) => {
      return data.filter(r => {
        const dbName = (r.codigoTerminal || '').trim().toUpperCase();
        const isMatch = (
          dbName === term ||
          (term === 'SPRBUN' && dbName.includes('SPBUN')) ||
          (term === 'COMPASCAS' && dbName.includes('CASCAJAL')) ||
          (term === 'COMPASAGD' && (dbName.includes('AGUA DULCE') || dbName.includes('AGUADULCE'))) ||
          (term === 'SPIA' && (dbName.includes('SPIA') || dbName.includes('PUERTO AGUADULCE')))
        );
        return isMatch && (r.tipoCarga || '').toUpperCase().includes(tipo);
      }).reduce((a, b) => a + (parseFloat(b.totalVolumen) || 0), 0);
    };

    return {
      WDG_CHART_TONELADAS: {
        titulo: "📊 TONELADAS MOVIDAS HOY · POR TIPO", labels: terminales,
        datasets: [
          { label: 'Contenedores', data: terminales.map(t => getVal(t, 'CONTENEDOR') || getVal(t, 'FCL')), backgroundColor: '#3b82f6' },
          { label: 'Granel agrícola', data: terminales.map(t => getVal(t, 'AGRICOLA')), backgroundColor: '#10b981' },
          { label: 'Granel mineral', data: terminales.map(t => getVal(t, 'MINERAL')), backgroundColor: '#a87b51' },
          { label: 'Granel líquido', data: terminales.map(t => getVal(t, 'LIQUIDO')), backgroundColor: '#14b8a6' },
          { label: 'Carga suelta', data: terminales.map(t => getVal(t, 'SUELTA') || getVal(t, 'BREAK')), backgroundColor: '#f59e0b' },
          { label: 'Vehículos', data: terminales.map(t => getVal(t, 'VEHICULO') || getVal(t, 'RO-RO')), backgroundColor: '#ec4899' }
        ]
      }
    };
  }

  async _calcularKpiSemanalMaritimo(ciudadKey) {
    const r = await MaritimoRepository.getResumenSemanalMaritimo(ciudadKey).catch((err) => {
      console.error("🔥 Error SQL en getResumenSemanalMaritimo:", err.message);
      return [{ totalMotonaves: 0, totalTeus: 0, totalGranel: 0, totalVehiculos: 0 }];
    });

    const data = r[0] || {};

    let motonaves = parseInt(data.totalMotonaves) || 0;
    let teus = parseFloat(data.totalTeus) || 0;
    let granel = parseFloat(data.totalGranel) || 0;
    let vehiculos = parseFloat(data.totalVehiculos) || 0;

    if (motonaves === 0 && teus === 0) {
      motonaves = 86;
      teus = 142000;
      granel = 312000;
      vehiculos = 6840;
    }

    return {
      titulo: "RESUMEN SEMANAL MARÍTIMO",
      metricas: [
        {
          label: "MOTONAVES ATENDIDAS",
          valor: motonaves.toString(),
          tendencia: "▲ 4 vs sem. anterior",
          claseTendencia: "text-success"
        },
        {
          label: "TEUS TOTALES",
          valor: this._formatearNumeroCompacto(teus),
          tendencia: "+8.2% YoY",
          claseTendencia: "text-success"
        },
        {
          label: "TM GRANEL",
          valor: this._formatearNumeroCompacto(granel),
          tendencia: "+12% YoY",
          claseTendencia: "text-success"
        },
        {
          label: "VEHÍCULOS",
          valor: vehiculos.toLocaleString('es-CO'),
          tendencia: "▼ 3% vs sem.",
          claseTendencia: "text-danger"
        }
      ]
    };
  }

  async _obtenerAnalisisTrafico(ciudadKey) {
    try {
      const axios = require('axios');
      const anioActual = new Date().getFullYear();

      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;

      const respuesta = await axios.get(url, {
        params: {
          zona_portuaria: ciudadKey === 'BUENAVENTURA' ? 'BUENAVENTURA' : ciudadKey,
          $where: `a_o_vigencia >= '${anioActual - 2}'`,
          $limit: 50000
        }
      });

      const datos = respuesta.data;
      if (!datos || datos.length === 0) throw new Error("API vacía");

      let totalAnioActual = 0;
      let totalAnioAnterior = 0;
      let totalImpo = 0;
      let granTotal = 0;
      const agrupacionMensual = {};

      datos.forEach(row => {
        const anio = parseInt(row.a_o_vigencia || row.ano_vigencia);
        const mes = parseInt(row.mes_vigencia);
        if (!anio || !mes) return;

        const expo = parseFloat(row.exportacion) || 0;
        const impo = parseFloat(row.importaci_n || row.importacion) || 0;
        const cabotaje = parseFloat(row.cabotaje) || 0;
        const transbordo = parseFloat(row.transbordo) || 0;
        const fluvial = parseFloat(row.fluvial) || 0;

        const totalFila = expo + impo + cabotaje + transbordo + fluvial;

        if (anio === anioActual) totalAnioActual += totalFila;
        if (anio === anioActual - 1) totalAnioAnterior += totalFila;
        totalImpo += impo;
        granTotal += totalFila;

        const llaveMes = `${anio}-${String(mes).padStart(2, '0')}`;
        if (!agrupacionMensual[llaveMes]) agrupacionMensual[llaveMes] = {};

        const tipoCargaStr = (row.tipo_de_carga || 'OTRO').toUpperCase();
        let categoria = 'General / vehíc.';

        if (tipoCargaStr.includes('CONTENEDOR')) categoria = 'Contenedores';
        else if (tipoCargaStr.includes('LIQUIDO')) categoria = 'Granel líquido';
        else if (tipoCargaStr.includes('CARBON') || tipoCargaStr.includes('CARBÓN')) categoria = 'Carbón';
        else if (tipoCargaStr.includes('GRANEL')) categoria = 'Granel sólido';

        agrupacionMensual[llaveMes][categoria] = (agrupacionMensual[llaveMes][categoria] || 0) + totalFila;
      });

      const labels = Object.keys(agrupacionMensual).sort();
      const mesesNombres = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
      const labelsFormat = labels.map(l => {
        const [a, m] = l.split('-');
        return `${mesesNombres[parseInt(m) - 1]} ${a.slice(-2)}`;
      });

      const categorias = ['Contenedores', 'Granel sólido', 'General / vehíc.', 'Granel líquido', 'Carbón'];
      const colores = ['#3b82f6', '#10b981', '#f59e0b', '#a855f7', '#64748b'];

      const datasets = categorias.map((cat, idx) => ({
        label: cat,
        backgroundColor: colores[idx],
        data: labels.map(l => agrupacionMensual[l][cat] || 0)
      }));

      const variacion = totalAnioAnterior > 0 ? ((totalAnioActual - totalAnioAnterior) / totalAnioAnterior) * 100 : 0;
      const pctImpo = granTotal > 0 ? (totalImpo / granTotal) * 100 : 0;
      const valorVariacion = (variacion > 0 ? '+' : '') + variacion.toFixed(1) + '%';

      return {
        titulo: `ANÁLISIS DE TRÁFICO PORTUARIO - ${ciudadKey}`,
        subtitulo: "Fuente: Supertransporte (API Socrata) · toneladas movilizadas por tipo de carga y operación",
        kpisTop: {
          toneladas: { valor: `${(totalAnioActual / 1000000).toFixed(1)} M t`, detalle: `${totalAnioActual.toLocaleString('es-CO')} t · acumulado ${anioActual}` },
          variacion: { valor: valorVariacion, detalle: `${anioActual - 1} → ${anioActual} · comparativo YoY`, claseTendencia: variacion >= 0 ? "text-success" : "text-danger" },
          participacion: { valor: "13.2%", detalle: "#4 puerto de Colombia · líder del Pacífico" },
          flujo: { valor: `IMPO ${pctImpo.toFixed(0)}%`, detalle: `${(totalImpo / 1000000).toFixed(1)} M t importadas · puerto fundamentalmente importador`, claseTendencia: "text-info" }
        },
        chartEvolucion: { labels: labelsFormat, datasets: datasets }
      };

    } catch (error) {
      console.warn("⚠️ API Supertransporte falló. Entrando en modo Fallback local...", error.message);
      return this._obtenerMockAnalisisTrafico();
    }
  }

  async _obtenerParticipacionNacional(ciudadKey) {
    const axios = require('axios');
    try {
      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;
      const zonaFiltro = (ciudadKey || 'BUENAVENTURA').toUpperCase().trim();

      const respuesta = await axios.get(url, {
        params: {
          $where: `upper(zona_portuaria) like '%${zonaFiltro}%'`,
          $limit: 4000
        }
      });
      let datos = respuesta.data;
      if (!datos || datos.length === 0) throw new Error("Sin datos de terminales");

      const anioReportado = Math.max(...datos.map(d => parseInt(d.a_o_vigencia || d.vigencia || 0)).filter(a => a > 0)) || new Date().getFullYear();
      datos = datos.filter(d => parseInt(d.a_o_vigencia || d.vigencia) === anioReportado);

      const toneladasPorTerminal = {};
      let granTotal = 0;

      datos.forEach(row => {
        let terminal = (row.sociedad_portuaria || 'OTROS').toUpperCase();

        if (zonaFiltro.includes('BUENAVENTURA')) {
          if (terminal.includes('REGIONAL')) terminal = 'SPRBUN';
          else if (terminal.includes('TCBUEN')) terminal = 'TCBUEN';
          else if (terminal.includes('AGUADULCE')) terminal = 'AGUADULCE';
          else if (terminal.includes('COMPAS')) terminal = 'COMPAS';
          else terminal = 'OTROS';
        } else {
          terminal = terminal.replace('SOCIEDAD PORTUARIA', 'SP')
            .replace('REGIONAL DE', 'REG')
            .replace('TERMINAL DE CONTENEDORES DE', 'CON')
            .replace('TERMINAL', 'TERM')
            .trim();
          if (terminal.length > 14) terminal = terminal.substring(0, 14) + '.';
        }

        const totalFila = (parseFloat(row.exportacion) || 0) + (parseFloat(row.importaci_n || row.importacion) || 0) + (parseFloat(row.cabotaje) || 0) + (parseFloat(row.transbordo) || 0) + (parseFloat(row.fluvial) || 0);
        toneladasPorTerminal[terminal] = (toneladasPorTerminal[terminal] || 0) + totalFila;
        granTotal += totalFila;
      });

      if (granTotal === 0) throw new Error("Datos en ceros desde la API");

      const ordenadas = Object.entries(toneladasPorTerminal)
        .sort((a, b) => b[1] - a[1])
        .map(([nombre, ton]) => ({ nombre, porcentaje: granTotal > 0 ? parseFloat(((ton / granTotal) * 100).toFixed(1)) : 0 }));

      return { labels: ordenadas.map(t => t.nombre), valores: ordenadas.map(t => t.porcentaje) };
    } catch (e) {
      console.warn(`⚠️ API Participación falló para ${ciudadKey}. Usando contingencia adaptativa...`);
      const key = (ciudadKey || '').toUpperCase();

      if (key.includes('CARTAGENA')) {
        return { labels: ['SP CONTECAR', 'SP REG CARTAGENA', 'COMPAS', 'OTROS'], valores: [45.0, 38.0, 11.0, 6.0] };
      } else if (key.includes('BARRANQUILLA')) {
        return { labels: ['SP REG BARRANQUILLA', 'PUERTO PIMSA', 'BITCO', 'PALERMO', 'OTROS'], valores: [42.5, 22.0, 18.5, 12.0, 5.0] };
      } else if (key.includes('SANTA MARTA')) {
        return { labels: ['SP REG SANTA MARTA', 'SMI', 'CARBOSAN', 'OTROS'], valores: [55.0, 30.0, 10.0, 5.0] };
      }
      return { labels: ['SPRBUN', 'TCBUEN', 'AGUADULCE', 'COMPAS', 'OTROS'], valores: [38.5, 25.2, 20.1, 10.5, 5.7] };
    }
  }

  async _obtenerTipoOperacion(ciudadKey) {
    const axios = require('axios');
    const zonaFiltro = (ciudadKey || 'BUENAVENTURA').toUpperCase().trim();
    try {
      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;
      const respuesta = await axios.get(url, {
        params: {
          $where: `upper(zona_portuaria) like '%${zonaFiltro}%'`,
          $limit: 4000
        }
      });
      let datos = respuesta.data;
      if (!datos || datos.length === 0) throw new Error("Sin datos de operaciones");

      const anioReportado = Math.max(...datos.map(d => parseInt(d.a_o_vigencia || d.vigencia || 0)).filter(a => a > 0)) || new Date().getFullYear();
      datos = datos.filter(d => parseInt(d.a_o_vigencia || d.vigencia) === anioReportado);

      let expo = 0, impo = 0, trans = 0, cabo = 0;
      datos.forEach(row => {
        expo += parseFloat(row.exportacion) || 0;
        impo += parseFloat(row.importaci_n || row.importacion) || 0;
        trans += parseFloat(row.transbordo) || 0;
        cabo += parseFloat(row.cabotaje) || 0;
      });

      const total = expo + impo + trans + cabo;
      if (total === 0) throw new Error("Datos en ceros");

      const getP = (v) => parseFloat(((v / total) * 100).toFixed(1));
      return { labels: ['Importación', 'Exportación', 'Transbordo', 'Cabotaje'], valores: [getP(impo), getP(expo), getP(trans), getP(cabo)] };
    } catch (e) {
      console.warn(`⚠️ API Mezcla falló para ${ciudadKey}. Usando contingencia adaptativa...`);
      const key = (ciudadKey || '').toUpperCase();
      const anio = new Date().getFullYear();
      let labels = ['Contenedores', 'Granel sólido', 'General/vehíc.', 'Granel líquido', 'Carbón'];
      let valores, sub;

      if (key.includes('BARRANQUILLA')) {
        valores = [4.5, 3.8, 2.9, 1.5, 0.5];
        sub = `Granel Sólido domina 28% · ${anio} (Mock)`;
      } else if (key.includes('CARTAGENA')) {
        valores = [22.5, 1.2, 0.5, 3.5, 0.1];
        sub = `Contenedores domina 81% · ${anio} (Mock)`;
      } else {
        valores = [13.8, 6.1, 1.9, 0.8, 0.6];
        sub = `Contenedores domina 60% · ${anio} (Mock)`;
      }
      return { labels, valores, subtitulo: sub };
    }
  }

  async _obtenerMezclaCarga(ciudadKey) {
    const axios = require('axios');
    const anioActual = new Date().getFullYear();
    const zonaFiltro = (ciudadKey || 'BUENAVENTURA').toUpperCase().trim();
    try {
      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;
      const respuesta = await axios.get(url, {
        params: {
          $where: `upper(zona_portuaria) like '%${zonaFiltro}%'`,
          $limit: 4000
        }
      });
      let datos = respuesta.data;
      if (!datos || datos.length === 0) throw new Error("Sin datos de mezcla");

      const anioReportado = Math.max(...datos.map(d => parseInt(d.a_o_vigencia || d.vigencia || 0)).filter(a => a > 0)) || anioActual;
      datos = datos.filter(d => parseInt(d.a_o_vigencia || d.vigencia) === anioReportado);

      let cont = 0, solido = 0, general = 0, liquido = 0, carbon = 0;
      datos.forEach(row => {
        cont += parseFloat(row.contenedor || row.contenedores) || 0;
        solido += parseFloat(row.granel_solido) || 0;
        general += parseFloat(row.carga_general) || 0;
        liquido += parseFloat(row.granel_liquido) || 0;
        carbon += parseFloat(row._carbon || row.carbon) || 0;
      });

      const aMt = (v) => parseFloat((v / 1000000).toFixed(2));
      const vCont = aMt(cont), vSol = aMt(solido), vGen = aMt(general), vLiq = aMt(liquido), vCar = aMt(carbon);
      const total = vCont + vSol + vGen + vLiq + vCar;

      if (total === 0) throw new Error("Datos en ceros");

      const pct = Math.round((vCont / total) * 100);
      const lista = [
        { label: 'Contenedores', valor: vCont }, { label: 'Granel sólido', valor: vSol },
        { label: 'General/vehíc.', valor: vGen }, { label: 'Granel líquido', valor: vLiq },
        { label: 'Carbón', valor: vCar }
      ].sort((a, b) => b.valor - a.valor);

      return { labels: lista.map(i => i.label), valores: lista.map(i => i.valor), subtitulo: `Contenedores domina ${pct}% · ${anioReportado}` };
    } catch (e) {
      console.warn(`⚠️ API Operaciones falló para ${ciudadKey}. Usando contingencia adaptativa...`);
      const key = (ciudadKey || '').toUpperCase();
      let valores;

      if (key.includes('CARTAGENA')) {
        valores = [22.5, 28.1, 46.2, 3.2];
      } else if (key.includes('BARRANQUILLA')) {
        valores = [65.5, 25.2, 5.1, 4.2];
      } else {
        valores = [48.2, 32.5, 12.1, 7.2];
      }
      return { labels: ['Importación', 'Exportación', 'Transbordo', 'Cabotaje'], valores };
    }
  }

  async _obtenerMatrizCarga(ciudadKey) {
    const axios = require('axios');
    const zonaFiltro = (ciudadKey || 'BUENAVENTURA').toUpperCase().trim();
    const anioActual = new Date().getFullYear();
    try {
      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;
      const res = await axios.get(url, { params: { $where: `upper(zona_portuaria) like '%${zonaFiltro}%'`, $limit: 4000 } });
      let datos = res.data;
      if (!datos || datos.length === 0) throw new Error("Sin datos");

      const anioReportado = Math.max(...datos.map(d => parseInt(d.a_o_vigencia || d.vigencia || 0)).filter(a => a > 0)) || anioActual;
      datos = datos.filter(d => parseInt(d.a_o_vigencia || d.vigencia) === anioReportado);

      const matriz = {};
      let granTotal = 0;

      datos.forEach(row => {
        let terminal = (row.sociedad_portuaria || 'OTROS').toUpperCase();

        if (zonaFiltro.includes('BUENAVENTURA')) {
          if (terminal.includes('REGIONAL')) terminal = 'SPRBUN';
          else if (terminal.includes('TCBUEN')) terminal = 'TCBUEN';
          else if (terminal.includes('AGUADULCE')) terminal = 'Puerto Aguadulce (SPIA)';
          else if (terminal.includes('COMPAS')) terminal = 'COMPAS Cascajal';
          else terminal = 'Grupo Portuario (M13)';
        } else {
          terminal = terminal.replace('SOCIEDAD PORTUARIA', 'SP').substring(0, 18);
        }

        if (!matriz[terminal]) matriz[terminal] = { terminal, cont: 0, solido: 0, general: 0, liquido: 0, carbon: 0, total: 0 };

        matriz[terminal].cont += parseFloat(row.contenedor || row.contenedores) || 0;
        matriz[terminal].solido += parseFloat(row.granel_solido) || 0;
        matriz[terminal].general += parseFloat(row.carga_general) || 0;
        matriz[terminal].liquido += parseFloat(row.granel_liquido) || 0;
        matriz[terminal].carbon += parseFloat(row._carbon || row.carbon) || 0;

        granTotal += (matriz[terminal].cont + matriz[terminal].solido + matriz[terminal].general + matriz[terminal].liquido + matriz[terminal].carbon);
      });

      if (granTotal === 0) throw new Error("Datos en ceros");

      const filas = Object.values(matriz).map(f => {
        f.total = f.cont + f.solido + f.general + f.liquido + f.carbon;
        return f;
      }).filter(f => f.total > 0).sort((a, b) => b.total - a.total);

      return { anio: anioReportado, operadores: filas.length, filas };
    } catch (e) {
      console.warn(`⚠️ API Matriz falló para ${ciudadKey}. Usando contingencia adaptativa...`);
      const key = (ciudadKey || '').toUpperCase();
      const anio = new Date().getFullYear();

      if (key.includes('BARRANQUILLA')) {
        return {
          anio, operadores: 4,
          filas: [
            { terminal: 'SP REG BARRANQUILLA', cont: 120500, solido: 2500400, general: 800200, liquido: 300100, carbon: 0, total: 3721200 },
            { terminal: 'PALERMO', cont: 0, solido: 600000, general: 300000, liquido: 500000, carbon: 0, total: 1400000 },
            { terminal: 'PUERTO PIMSA', cont: 0, solido: 950000, general: 420000, liquido: 0, carbon: 0, total: 1370000 },
            { terminal: 'BITCO', cont: 85000, solido: 0, general: 150000, liquido: 0, carbon: 0, total: 235000 }
          ]
        };
      } else if (key.includes('CARTAGENA')) {
        return {
          anio, operadores: 3,
          filas: [
            { terminal: 'SP CONTECAR', cont: 2500000, solido: 0, general: 100000, liquido: 0, carbon: 0, total: 2600000 },
            { terminal: 'SP REG CARTAGENA', cont: 1800000, solido: 200000, general: 50000, liquido: 0, carbon: 0, total: 2050000 },
            { terminal: 'COMPAS CARTAGENA', cont: 0, solido: 800000, general: 20000, liquido: 100000, carbon: 0, total: 920000 }
          ]
        };
      } else {
        return {
          anio, operadores: 5,
          filas: [
            { terminal: 'SPRBUN', cont: 5379357, solido: 4045105, general: 1518866, liquido: 830059, carbon: 0, total: 11773387 },
            { terminal: 'Puerto Aguadulce (SPIA)', cont: 5149683, solido: 760216, general: 347621, liquido: 0, carbon: 796111, total: 7053631 },
            { terminal: 'TCBUEN', cont: 3212394, solido: 0, general: 13, liquido: 0, carbon: 0, total: 3212407 },
            { terminal: 'COMPAS Cascajal', cont: 0, solido: 1070395, general: 0, liquido: 0, carbon: 0, total: 1070395 },
            { terminal: 'Grupo Portuario (M13)', cont: 0, solido: 3630, general: 0, liquido: 0, carbon: 0, total: 3630 }
          ]
        };
      }
    }
  }

  async _obtenerHistoricoAnual(ciudadKey) {
    const axios = require('axios');
    const zonaFiltro = (ciudadKey || 'BUENAVENTURA').toUpperCase().trim();
    try {
      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;
      const res = await axios.get(url, { params: { $where: `upper(zona_portuaria) like '%${zonaFiltro}%'`, $limit: 10000 } });
      if (!res.data || res.data.length === 0) throw new Error("Sin datos");

      const agrupadoPorAnio = {};
      let granTotal = 0;

      res.data.forEach(row => {
        const anio = parseInt(row.a_o_vigencia || row.vigencia || 0);
        if (anio < 2018) return;

        const totalRow = (parseFloat(row.exportacion) || 0) + (parseFloat(row.importaci_n || row.importacion) || 0) + (parseFloat(row.cabotaje) || 0) + (parseFloat(row.transbordo) || 0) + (parseFloat(row.fluvial) || 0);

        agrupadoPorAnio[anio] = (agrupadoPorAnio[anio] || 0) + totalRow;
        granTotal += totalRow;
      });

      if (granTotal === 0) throw new Error("Datos en ceros");

      const aniosOrdenados = Object.keys(agrupadoPorAnio).sort();
      const labels = aniosOrdenados;
      const valores = aniosOrdenados.map(a => parseFloat((agrupadoPorAnio[a] / 1000000).toFixed(2)));

      return { rango: `${labels[0]}-${labels[labels.length - 1]}`, labels, valores };
    } catch (e) {
      console.warn(`⚠️ API Histórico falló para ${ciudadKey}. Usando contingencia adaptativa...`);
      const key = (ciudadKey || '').toUpperCase();
      const labels = ['2018', '2019', '2020', '2021', '2022', '2023', '2024', '2025'];
      let valores;

      if (key.includes('BARRANQUILLA')) {
        valores = [11.2, 10.5, 9.8, 11.0, 12.5, 12.8, 13.5, 14.2];
      } else if (key.includes('CARTAGENA')) {
        valores = [28.5, 29.0, 26.5, 29.8, 31.2, 33.0, 34.5, 36.1];
      } else {
        valores = [25.5, 20.8, 17.4, 18.0, 19.8, 19.0, 20.7, 23.1];
      }

      return { rango: '2018-2025', labels, valores };
    }
  }

  async _obtenerImplicacionesOperativas(ciudadKey) {
    const axios = require('axios');
    const zonaFiltro = (ciudadKey || 'BUENAVENTURA').toUpperCase().trim();

    try {
      const url = `https://www.datos.gov.co/resource/5r3g-zv5z.json`;
      const respuesta = await axios.get(url, { params: { $where: `upper(zona_portuaria) like '%${zonaFiltro}%'`, $limit: 5000 } });
      let datos = respuesta.data;
      if (!datos || datos.length === 0) throw new Error("Sin datos para insights");

      const anioReportado = Math.max(...datos.map(d => parseInt(d.a_o_vigencia || d.vigencia || 0)).filter(a => a > 0)) || new Date().getFullYear();
      datos = datos.filter(d => parseInt(d.a_o_vigencia || d.vigencia) === anioReportado);

      let cont = 0, solido = 0, general = 0, liquido = 0, carbon = 0;
      let expo = 0, impo = 0, trans = 0, cabo = 0;
      let terminales = {};

      datos.forEach(row => {
        const c = parseFloat(row.contenedor || row.contenedores) || 0;
        const s = parseFloat(row.granel_solido) || 0;
        const g = parseFloat(row.carga_general) || 0;
        const l = parseFloat(row.granel_liquido) || 0;
        const cb = parseFloat(row._carbon || row.carbon) || 0;
        cont += c; solido += s; general += g; liquido += l; carbon += cb;

        expo += parseFloat(row.exportacion) || 0;
        impo += parseFloat(row.importaci_n || row.importacion) || 0;
        trans += parseFloat(row.transbordo) || 0;
        cabo += parseFloat(row.cabotaje) || 0;

        let term = (row.sociedad_portuaria || 'OTROS').toUpperCase().replace('SOCIEDAD PORTUARIA', 'SP').substring(0, 15);
        terminales[term] = (terminales[term] || 0) + (c + s + g + l + cb);
      });

      const totalCarga = cont + solido + general + liquido + carbon;
      const totalOps = expo + impo + trans + cabo;
      if (totalCarga === 0) throw new Error("Datos en ceros");

      const topTerm = Object.entries(terminales).sort((a, b) => b[1] - a[1])[0];
      const aMt = (v) => (v / 1000000).toFixed(1);

      const pctCont = Math.round((cont / totalCarga) * 100);
      const pctSol = Math.round((solido / totalCarga) * 100);
      const pctImpo = Math.round((impo / totalOps) * 100);
      const pctExpo = Math.round((expo / totalOps) * 100);
      const pctTrans = Math.round((trans / totalOps) * 100);

      let mainVocacion = pctImpo > pctExpo ? `IMPORTADOR (${pctImpo}%)` : `EXPORTADOR (${pctExpo}%)`;
      if (pctTrans > Math.max(pctImpo, pctExpo)) mainVocacion = `HUB DE TRANSBORDO (${pctTrans}%)`;

      return {
        insights: [
          {
            color: '#3b82f6',
            titulo: `Operación de Contenedores (${pctCont}%)`,
            descripcion: `Representa un volumen de ${aMt(cont)} Mt movilizadas. El líder operativo en la zona es ${topTerm[0]} con ${aMt(topTerm[1])} Mt en total. Vigilar congestión de vacíos y disponibilidad de grúas STS.`
          },
          {
            color: '#10b981',
            titulo: `Granel Sólido (${pctSol}%)`,
            descripcion: `Volumen actual de ${aMt(solido)} Mt este año. La torre debe priorizar la inspección de calado del canal de acceso y la disponibilidad de silos o bodegas para descarga directa.`
          },
          {
            color: '#f59e0b',
            titulo: `Carga General y Vehículos (${Math.round((general / totalCarga) * 100)}%)`,
            descripcion: `Se movieron ${aMt(general)} Mt de carga suelta. Requiere disponibilidad constante de equipos pesados (reach stackers, grúas multipropósito) y coordinación en patios Ro-Ro.`
          },
          {
            color: '#06b6d4',
            titulo: `Flujo Operativo: Perfil ${mainVocacion}`,
            descripcion: `La logística debe alinearse a este flujo dominante. La mezcla real es: Transbordo ${pctTrans}%, Importación ${pctImpo}%, Exportación ${pctExpo}%, Cabotaje ${Math.round((cabo / totalOps) * 100)}%.`
          }
        ]
      };

    } catch (e) {
      console.warn("⚠️ API Insights falló. Usando contingencia estática...");
      return {
        insights: [
          { color: '#3b82f6', titulo: 'Operación de contenedores - prioridad máxima', descripcion: 'La saturación de patios reefer y depots de vacíos es el primer indicador a vigilar en las terminales principales.' },
          { color: '#10b981', titulo: 'Granel sólido - segunda prioridad', descripcion: 'Monitorear la rotación en bodegas y coordinar despachos directos para evitar cuellos de botella en muelles.' },
          { color: '#f59e0b', titulo: 'Carga general e industrial', descripcion: 'Vigilar disponibilidad de equipos de izaje y consolidación de proyectos especiales en zona extraportuaria.' },
          { color: '#38bdf8', titulo: 'Flujo operativo predominante', descripcion: 'Asegurar cruces de Virtual Gate fluidos y priorizar el retiro rápido de mercancía de importación.' }
        ]
      };
    }
  }

  async _obtenerWidgetProductividad(puertoKey) {
    try {
      const dataCruda = await MaritimoRepository.getProductividadIntradiaria(puertoKey);

      if (!dataCruda || dataCruda.length === 0) {
        return { titulo: "PRODUCTIVIDAD (MOVS/H)", labels: [], datasets: [] };
      }

      const horasSet = new Set(dataCruda.map(d => d.hora_etiqueta));
      const labels = Array.from(horasSet).sort();
      const terminalesSet = new Set(dataCruda.map(d => d.terminal));
      const terminales = Array.from(terminalesSet).sort();

      const datasets = terminales.map((nombreTerminal) => {
        const datosTerminal = dataCruda.filter(d => d.terminal === nombreTerminal);
        const valoresOrdenados = labels.map(hora => {
          const registro = datosTerminal.find(d => d.hora_etiqueta === hora);
          return registro ? registro.movimientos_hora : 0;
        });

        // 🔥 CORRECCIÓN CRÍTICA APLICADA: this._generarColorPorNombre
        const colorBase = this._generarColorPorNombre(nombreTerminal);
        const colorFondo = colorBase.replace(')', ', 0.15)').replace('hsl', 'hsla');

        return {
          label: nombreTerminal,
          data: valoresOrdenados,
          borderColor: colorBase,
          backgroundColor: colorFondo,
          fill: true,
          tension: 0.4,
          borderWidth: 2,
          pointBackgroundColor: '#1e293b',
          pointBorderColor: colorBase,
          pointBorderWidth: 2,
          pointRadius: 4,
          pointHoverRadius: 6
        };
      });

      return {
        titulo: "PRODUCTIVIDAD (MOVS/H)",
        labels: labels,
        datasets: datasets
      };

    } catch (error) {
      console.error("[Service] ❌ Error empaquetando gráfica de productividad:", error);
      throw error;
    }
  }

  async _obtenerGeoJsonClimaNacional() {
    try {
      // 1. Obtenemos los puertos del repositorio (la consulta que ya validaste)
      const puertos = await MaritimoRepository.getPuertosActivos();

      if (!puertos || puertos.length === 0) return { type: 'FeatureCollection', features: [] };

      // 2. Consultar clima en paralelo
      const promesasClima = puertos.map(p => ExternalIntegrationService.getWeatherData(p.lat, p.lon));
      const resultados = await Promise.all(promesasClima);

      // 3. Transformación con Blindaje para NULLs
      const features = resultados.map((weather, index) => {
        if (!weather) return null;

        const puerto = puertos[index];

        // Blindaje: Si los bbox son NULL, enviamos null al frontend para que no intente hacer zoom ahí
        const hasBbox = puerto.bbox_lat_sur !== null && puerto.bbox_lon_oeste !== null;
        const bbox = hasBbox
          ? [puerto.bbox_lon_oeste, puerto.bbox_lat_sur, puerto.bbox_lon_este, puerto.bbox_lat_norte]
          : null;

        return {
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [puerto.lon, puerto.lat]
          },
          properties: {
            id: puerto.id_puerto,
            zona: puerto.nombre,
            temp: weather.main?.temp || 0,
            viento: weather.wind?.speed || 0,
            presion: weather.main?.pressure || 0,
            descripcion: weather.weather?.[0]?.description || 'Sin datos',
            bbox: bbox // Se envía null si no hay datos, protegiendo al frontend
          }
        };
      }).filter(f => f !== null);

      return {
        type: 'FeatureCollection',
        features: features
      };
    } catch (error) {
      console.error("🔥 Error generando GeoJSON:", error);
      return { type: 'FeatureCollection', features: [] };
    }
  }

  _obtenerMockAnalisisTrafico() {
    const labels = ['Abr 24', 'May 24', 'Jun 24', 'Jul 24', 'Ago 24', 'Sep 24', 'Oct 24', 'Nov 24', 'Dic 24', 'Ene 25', 'Feb 25', 'Mar 25', 'Abr 25', 'May 25', 'Jun 25', 'Jul 25', 'Ago 25', 'Sep 25', 'Oct 25', 'Nov 25', 'Dic 25', 'Ene 26', 'Feb 26', 'Mar 26'];
    const genData = (base, varY) => Array.from({ length: 24 }, () => Math.floor(base + Math.random() * varY));

    return {
      titulo: "ANÁLISIS DE TRÁFICO PORTUARIO - BUENAVENTURA",
      subtitulo: "Fuente: Supertransporte · serie histórica · modo offline",
      kpisTop: {
        toneladas: { valor: "23.1 M t", detalle: "23,113,450 t · cierre completo" },
        variacion: { valor: "+11.8%", detalle: "2024 → 2025 · recuperación sostenida", claseTendencia: "text-success" },
        participacion: { valor: "13.2%", detalle: "#4 puerto de Colombia" },
        flujo: { valor: "IMPO 75%", detalle: "17.4 M t importadas", claseTendencia: "text-info" }
      },
      chartEvolucion: {
        labels: labels,
        datasets: [
          { label: 'Contenedores', data: genData(800000, 400000), backgroundColor: '#3b82f6' },
          { label: 'Granel sólido', data: genData(300000, 200000), backgroundColor: '#10b981' },
          { label: 'General / vehíc.', data: genData(100000, 80000), backgroundColor: '#f59e0b' },
          { label: 'Granel líquido', data: genData(80000, 50000), backgroundColor: '#a855f7' },
          { label: 'Carbón', data: genData(20000, 30000), backgroundColor: '#64748b' }
        ]
      }
    };
  }

  _procesarArribosSemanal(motonaves) {
    const labels = [];
    const conteo = {};
    const hoy = new Date();

    for (let i = 0; i < 7; i++) {
      const d = new Date();
      d.setDate(hoy.getDate() + i);
      const dia = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')}`;
      labels.push(dia);
      conteo[dia] = 0;
    }

    motonaves.forEach(m => {
      const dia = m.eta.split(' ')[0];
      if (conteo.hasOwnProperty(dia)) {
        conteo[dia] += 1;
      }
    });

    return {
      labels: labels,
      data: Object.values(conteo)
    };
  }

  _calcularTendencia(valorActual, valorAnterior, sufijo = 'vs sem.') {
    if (valorAnterior === 0) {
      return { texto: `▲ N/A (nuevo)`, clase: 'text-success' };
    }

    const diferencia = valorActual - valorAnterior;
    const porcentaje = ((diferencia / valorAnterior) * 100).toFixed(1);

    if (diferencia > 0) {
      return { texto: `▲ +${porcentaje}% ${sufijo}`, clase: 'text-success' };
    } else if (diferencia < 0) {
      return { texto: `▼ ${porcentaje}% ${sufijo}`, clase: 'text-danger' };
    }
    return { texto: `= 0% ${sufijo}`, clase: 'text-muted' };
  }

  _formatearNumeroCompacto(valor) {
    if (valor === null || valor === undefined || isNaN(valor)) return "0";
    const num = Number(valor);
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M';
    if (num >= 1000) return (num / 1000).toFixed(1) + 'K';
    return num.toLocaleString('es-CO');
  }

  _generarColorPorNombre(nombre) {
    let hash = 0;
    for (let i = 0; i < nombre.length; i++) {
      hash = nombre.charCodeAt(i) + ((hash << 5) - hash);
    }
    const hue = Math.abs(hash % 360);
    return `hsl(${hue}, 70%, 60%)`;
  }
}

module.exports = new MaritimoService();