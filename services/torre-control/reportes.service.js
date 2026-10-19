/*
    Author: German Valencia
    Pattern: PORTTOS Service - Reportes operativos
    Description: Reportes del panel "Reportes operativos" del Marítimo: los que registran los usuarios y los que
      generan los procesos (clima marino, productividad del día anterior, boletín semanal, aviso de canal DIMAR).
      Acceso a datos en reportes-operativos.repository.js; fuentes externas en adapters/.
*/
const ReportesRepository = require('../../repositories/torre-control/reportes-operativos.repository');
const { climaMarino } = require('../../adapters/open-meteo.adapter');
const { titularRestriccionCanal } = require('../../adapters/dimar-web.adapter');
const FuentesExternas = require('../../adapters/fuentes-externas.adapter');

const fechaCorta = (valor) => new Date(valor).toLocaleDateString('es-CO', { day: '2-digit', month: '2-digit' });

const ReportesService = {
  /** Reportes del puerto + aviso DIMAR + 2 noticias, en el formato del widget. */
  async obtenerReportesPuerto(puerto) {
    const reportes = (await ReportesRepository.ultimosDelPuerto(puerto, 10)).map((r) => ({
      titulo: r.titulo || 'Reporte Operativo',
      fecha: r.fecha_registro ? fechaCorta(r.fecha_registro) : 'N/A',
      descripcion: r.descripcion || '',
      color: r.tipo_color || 'primary',
    }));

    let avisoDimar = 'Condiciones normales';
    let noticias = [];
    try {
      avisoDimar = await FuentesExternas.getAvisosDIMAR();
      noticias = await FuentesExternas.getLogisticsNews();
    } catch {
      console.warn('[Reportes] Servicios externos (DIMAR/noticias) no disponibles temporalmente.');
    }

    return [
      ...reportes,
      {
        titulo: 'Aviso DIMAR',
        fecha: fechaCorta(Date.now()),
        descripcion: typeof avisoDimar === 'string' ? avisoDimar : 'Sin avisos',
        color: 'warning',
      },
      ...(Array.isArray(noticias) ? noticias.slice(0, 2) : []),
    ];
  },

  crearReporte: (dto) => ReportesRepository.crear(dto),

  async consultarClima(puertoKey = 'BUENAVENTURA', lat = 3.8801, lng = -77.0312) {
    const clima = await climaMarino(lat, lng);
    if (!clima) return;
    let condicion = 'Despejado';
    if (clima.codigoTiempo > 50) condicion = 'Lluvias';
    if (clima.codigoTiempo > 70) condicion = 'Tormenta';
    await ReportesRepository.registrarAutomatico({
      puerto: puertoKey,
      titulo: 'Pronóstico Meteomarino 72h',
      fecha_evento: 'Pronóstico',
      descripcion: `${condicion} (${clima.temperatura}°C) · Vientos ${Number(clima.vientoNudos).toFixed(1)} nudos`,
      tipo_color: 'celeste',
    });
  },

  async generarReporteProductividadAyer(puertoKey = 'BUENAVENTURA') {
    try {
      const stats = await ReportesRepository.buquesZarpados();
      await ReportesRepository.registrarAutomatico({
        puerto: puertoKey,
        titulo: 'Reporte diario operaciones',
        fecha_evento: 'Ayer',
        descripcion: `Productividad normal · ${stats.total_motonaves || 0} naves despachadas`,
        tipo_color: 'verde',
      });
    } catch (error) {
      console.error('[Reportes] Error calculando productividad:', error.message);
    }
  },

  async generarBoletinSemanal(puertoKey = 'BUENAVENTURA') {
    try {
      const stats = await ReportesRepository.buquesZarpados();
      const volumen = stats.total_toneladas ? `${(stats.total_toneladas / 1000).toFixed(1)}k` : '0';
      await ReportesRepository.registrarAutomatico({
        puerto: puertoKey,
        titulo: 'Boletín semanal SPRBUN',
        fecha_evento: 'Hoy',
        descripcion: `${volumen} TEUs descargados · ${stats.total_motonaves || 0} motonaves`,
        tipo_color: 'azul',
      });
    } catch (error) {
      console.error('[Reportes] Error en boletín semanal:', error.message);
    }
  },

  async escanearBoletinesDIMAR(puertoKey = 'BUENAVENTURA') {
    try {
      const titular = await titularRestriccionCanal();
      await ReportesRepository.registrarAutomatico({
        puerto: puertoKey,
        titulo: titular ? 'Restricción dragado canal' : 'Condiciones de navegación',
        fecha_evento: 'Alerta',
        descripcion: titular ? `Reporte DIMAR · ${titular.substring(0, 45)}...` : 'Reporte DIMAR · Canal operando con calado oficial',
        tipo_color: 'amarillo',
      });
    } catch (error) {
      console.error('[Reportes] Error escaneando DIMAR:', error.message);
    }
  },
};

module.exports = ReportesService;
