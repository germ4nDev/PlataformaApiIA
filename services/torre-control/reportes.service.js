/*
    Author: German Valencia
    Pattern: PORTTOS Reports Service (Internal/External Aggregator)
*/
const axios = require('axios');
const cheerio = require('cheerio');
const { db } = require('../../database/connection');

const ReportesService = {

  // ==========================================
  // 1. DATA EXTERNA: PRONÓSTICO DEL CLIMA
  // ==========================================
  async consultarClima(puertoKey = 'BUENAVENTURA', lat = 3.8801, lng = -77.0312) {
    console.log(`[Reportes] 🌤️ Consultando clima para ${puertoKey}...`);

    try {
      // Usamos Open-Meteo (Gratis, sin API Key)
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&current_weather=true&windspeed_unit=kn`;
      const response = await axios.get(url, { timeout: 8000 });

      const clima = response.data.current_weather;
      const vientoNudos = clima.windspeed.toFixed(1);
      const temp = clima.temperature;

      // Mapeo simple de códigos de clima (WMO) a texto
      let condicion = 'Despejado';
      if (clima.weathercode > 50) condicion = 'Lluvias';
      if (clima.weathercode > 70) condicion = 'Tormenta';

      const descripcion = `${condicion} (${temp}°C) · Vientos ${vientoNudos} nudos`;

      await this.guardarReporte({
        puerto: puertoKey,
        titulo: 'Pronóstico Meteomarino 72h',
        fecha_evento: 'Pronóstico',
        descripcion: descripcion,
        tipo_color: 'celeste' // Mapea a tu clase .border-celeste
      });

      console.log(`[Reportes] ✅ Clima guardado: ${descripcion}`);
    } catch (error) {
      console.error(`[Reportes] ❌ Error consultando clima:`, error.message);
    }
  },

  // ==========================================
  // 2. DATA INTERNA: PRODUCTIVIDAD DIARIA
  // ==========================================
  async generarReporteProductividadAyer(puertoKey = 'BUENAVENTURA') {
    console.log(`[Reportes] 📊 Calculando productividad interna para ${puertoKey}...`);

    try {
      // Ejemplo de Query SQL para calcular métricas internas
      // Ajusta los nombres de las tablas a tu esquema real
      const sql = `
                SELECT 
                    COUNT(*) as total_motonaves,
                    SUM(ocupacionActual) as total_toneladas
                FROM TCLNodosLogisticos
                WHERE tipoNodo = 'BUQUE' AND estadoOperativo = 'ZARPADO'
                -- AND fechaModificacion >= DATEADD(day, -1, GETDATE())
            `;

      const [resultados] = await db.sequelize.query(sql);
      const stats = resultados[0];

      const descripcion = `Productividad normal · ${stats.total_motonaves || 0} naves despachadas`;

      await this.guardarReporte({
        puerto: puertoKey,
        titulo: 'Reporte diario operaciones',
        fecha_evento: 'Ayer',
        descripcion: descripcion,
        tipo_color: 'verde' // Mapea a tu clase .border-verde
      });

      console.log(`[Reportes] ✅ Productividad guardada: ${descripcion}`);
    } catch (error) {
      console.error(`[Reportes] ❌ Error calculando productividad:`, error.message);
    }
  },

  // ==========================================
  // 3. DATA INTERNA: BOLETÍN SEMANAL (Azul)
  // ==========================================
  async generarBoletinSemanal(puertoKey = 'BUENAVENTURA') {
    console.log(`[Reportes] 📈 Generando boletín semanal para ${puertoKey}...`);

    try {
      // Lógica SQL para sumar carga y contar motonaves de los últimos 7 días
      const sql = `
                SELECT 
                    COUNT(*) as motonaves_semana,
                    SUM(ocupacionActual) as volumen_total
                FROM TCLNodosLogisticos
                WHERE tipoNodo = 'BUQUE' 
                AND estadoOperativo = 'ZARPADO'
                -- AND fechaModificacion >= DATEADD(day, -7, GETDATE()) 
            `;

      const [resultados] = await db.sequelize.query(sql);
      const stats = resultados[0];

      // Dando formato a los números (ej. 14500 -> 14.5k)
      const volumen = stats.volumen_total ? (stats.volumen_total / 1000).toFixed(1) + 'k' : '0';
      const naves = stats.motonaves_semana || 0;

      const descripcion = `${volumen} TEUs descargados · ${naves} motonaves`;

      await this.guardarReporte({
        puerto: puertoKey,
        titulo: 'Boletín semanal SPRBUN',
        fecha_evento: 'Hoy',
        descripcion: descripcion,
        tipo_color: 'azul' // Mapea a tu clase .border-azul
      });

      console.log(`[Reportes] ✅ Boletín semanal guardado: ${descripcion}`);
    } catch (error) {
      console.error(`[Reportes] ❌ Error en boletín semanal:`, error.message);
    }
  },

  // ==========================================
  // 4. DATA EXTERNA: BOLETINES DIMAR (Amarillo)
  // ==========================================
  async escanearBoletinesDIMAR(puertoKey = 'BUENAVENTURA') {
    console.log(`[Reportes] ⚓ Escaneando avisos de DIMAR para ${puertoKey}...`);

    try {
      // URL pública de ejemplo (Ajustar a la URL real de la Capitanía de Puerto deseada)
      const urlDimar = 'https://www.dimar.mil.co/capitanias-de-puerto';

      // Para evitar bloqueos institucionales, enviamos un User-Agent estándar
      const respuesta = await axios.get(urlDimar, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' },
        timeout: 10000
      });

      const $ = cheerio.load(respuesta.data);

      // Buscamos titulares que contengan palabras clave de alerta
      let alertaEncontrada = null;

      // Escaneamos etiquetas de título comunes
      $('h3, .noticia-titulo, .titular, strong').each((i, el) => {
        const texto = $(el).text().trim();
        const textoUpper = texto.toUpperCase();

        // Filtro de criticidad
        if (textoUpper.includes('RESTRICCIÓN') ||
          textoUpper.includes('DRAGADO') ||
          textoUpper.includes('CALADO')) {
          alertaEncontrada = texto;
          return false; // Rompe el ciclo en cuanto encuentra la primera alerta
        }
      });

      // Si hay restricción, muestra alerta. Si no, muestra normalidad.
      const descripcion = alertaEncontrada
        ? `Reporte DIMAR · ${alertaEncontrada.substring(0, 45)}...`
        : 'Reporte DIMAR · Canal operando con calado oficial';

      const titulo = alertaEncontrada
        ? 'Restricción dragado canal'
        : 'Condiciones de navegación';

      await this.guardarReporte({
        puerto: puertoKey,
        titulo: titulo,
        fecha_evento: 'Alerta',
        descripcion: descripcion,
        tipo_color: 'amarillo' // Mapea a tu clase .border-amarillo
      });

      console.log(`[Reportes] ✅ Reporte DIMAR guardado: ${descripcion}`);
    } catch (error) {
      console.error(`[Reportes] ❌ Error escaneando DIMAR:`, error.message);
    }
  },

  // ==========================================
  // MÉTODO DE PERSISTENCIA (Helper)
  // ==========================================
  async guardarReporte(data) {
    const sql = `
            INSERT INTO TLCReportesOperativos 
            (puerto, titulo, fecha_evento, descripcion, tipo_color, fecha_registro)
            VALUES 
            (:puerto, :titulo, :fecha_evento, :descripcion, :tipo_color, CONVERT(varchar, GETDATE(), 120))
        `;

    await db.sequelize.query(sql, {
      replacements: {
        puerto: data.puerto.toUpperCase(),
        titulo: data.titulo,
        fecha_evento: data.fecha_evento,
        descripcion: data.descripcion,
        tipo_color: data.tipo_color
      }
    });
  }
};

module.exports = ReportesService;