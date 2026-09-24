/*
    Author: German Valencia
    Pattern: PORTTOS Ingestion Service (Scraping Mode)
*/
const cheerio = require('cheerio');
const axios = require('axios');
const path = require('path');
const fs = require('fs');
const puppeteer = require('puppeteer');
const { db, sequalize } = require('../../database/connection');
const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');
const { NodoLogisticoDTO } = require('../../models/torre-control/motonave-operacion.model');
const { ProductividadTerminalesDTO } = require('../../models/torre-control/productividad-terminal.model');

const IngestionService = {
  async sincronizarTodosLosPuertos() {
    try {
      const puertosActivos = await db.sequelize.query(
        `SELECT id_puerto, url_fuente_scraping FROM T_Maestro_Puertos WHERE estado = 1`,
        { type: db.sequelize.QueryTypes.SELECT }
      );

      for (const puerto of puertosActivos) {
        await this.sincronizarMotonaves(puerto.id_puerto, puerto.url_fuente_scraping);
        await this.registrarProductividadActual(puerto.id_puerto);
      }
    } catch (error) {
      console.error('[ETL] Error crítico en sincronización masiva:', error.message);
    }
  },

  // 2. MÉTODO DE TRABAJO: Extrae y guarda para un puerto específico
  async sincronizarMotonaves(puertoKey, urlDestino) {
    try {
      const respuesta = await axios.get(urlDestino, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/114.0.0.0' },
        timeout: 10000
      });

      const $ = cheerio.load(respuesta.data);
      const nodosEncontrados = [];

      // Selector unificado para tablas (ajustar según el HTML real)
      $('table tbody tr').each((i, el) => {
        const nombre = $(el).find('td').eq(1).text().trim();
        const tipo = $(el).find('td').eq(2).text().trim();
        const estadoCrudo = $(el).find('td').eq(5).text().trim();
        const lat = $(el).attr('data-lat');
        const lon = $(el).attr('data-lon');

        if (nombre && nombre.length > 2) {
          let estadoReal = 'EN TRÁNSITO';
          const s = estadoCrudo.toLowerCase();
          if (s.includes('moored')) estadoReal = 'OPERANDO';
          if (s.includes('anchor')) estadoReal = 'FONDEO';

          nodosEncontrados.push({
            codigoNodo: `VF-${nombre.replace(/\s+/g, '-').substring(0, 20)}`,
            nombreNodo: nombre.toUpperCase(),
            tipoNodo: 'BUQUE',
            capacidadMaxima: 99999,
            ocupacionActual: Math.floor(Math.random() * 5000), // Simulación de carga real
            unidadMedida: 'TM',
            estadoOperativo: estadoReal
          });
        }
      });
      console.log(`📡 [AIS] Barcos capturados de la web: ${nodosEncontrados.length}`);
      if (nodosEncontrados.length > 0) {
        await this.guardarVesselEnBD(nodosEncontrados);
      }

    } catch (error) {
      console.error(`[ETL] ❌ Error en ${puertoKey}:`, error.message);
    }
  },

  // async sincronizarMotonavesColombia() {
  //   console.log("🚀 [CRON] Iniciando sincronización AIS con Puppeteer...");
  //   const puppeteer = require('puppeteer');
  //   let browser;

  //   try {
  //     // 1. Levantamos el navegador fantasma
  //     browser = await puppeteer.launch({
  //       headless: "new",
  //       args: ['--no-sandbox', '--disable-setuid-sandbox']
  //     });

  //     const page = await browser.newPage();

  //     // 2. Disfraz y evasión de Cloudflare
  //     await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
  //     await page.goto('https://www.myshiptracking.com/', { waitUntil: 'networkidle2' });

  //     // 3. Petición a la nueva URL secreta
  //     const urlApi = 'https://www.myshiptracking.com/requests/vesselsonmaptempTTT.php?type=json&minlat=-4.0&maxlat=14.0&minlon=-82.0&maxlon=-70.0&zoom=6&selid=-1&seltype=0&timecode=-1&filters=%7B%22vtypes%22%3A%22%2C0%2C3%2C4%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C2%22%2C%22ports%22%3A%221%22%2C%22minsog%22%3A0%2C%22maxsog%22%3A60%2C%22minsz%22%3A0%2C%22maxsz%22%3A500%2C%22minyr%22%3A1950%2C%22maxyr%22%3A2026%2C%22status%22%3A%22%22%2C%22mapflt_from%22%3A%22%22%2C%22mapflt_dest%22%3A%22%22%7D';
  //     await page.goto(urlApi, { waitUntil: 'domcontentloaded' });

  //     // 4. Extracción de los datos en texto crudo
  //     const contenido = await page.evaluate(() => document.body.innerText);

  //     console.log("🔍 RESPUESTA CRUDA DE LA PÁGINA:");
  //     console.log(contenido.substring(0, 500));

  //     const lineas = contenido.split('\n');
  //     const nodosEncontrados = [];

  //     // 5. Traducción de Texto a JSON para el modelo de Sequelize
  //     for (const linea of lineas) {
  //       const col = linea.trim().split('\t');

  //       // if (col.length >= 6) {
  //       //   const mmsi = col[2];
  //       //   const nombre = col[3] ? col[3].trim().toUpperCase() : 'DESCONOCIDO';
  //       //   const lat = parseFloat(col[4]);
  //       //   const lon = parseFloat(col[5]);
  //       //   const velocidad = parseFloat(col[6]) || 0;
  //       //   const rumbo = parseFloat(col[7]) || 0;

  //       //   // Validación estricta para evitar basuras en la BD
  //       //   if (mmsi && !isNaN(lat) && !isNaN(lon)) {
  //       //     nodosEncontrados.push({
  //       //       codigoNodo: `MMSI-${mmsi}`,
  //       //       omi: null, // Ya no dependemos del OMI, cruzamos por Nombre
  //       //       nombreNodo: nombre,
  //       //       tipoNodo: 'BUQUE',
  //       //       estadoOperativo: 'EN TRÁNSITO',
  //       //       velocidadNudos: velocidad,
  //       //       rumboGrados: rumbo,
  //       //       destino: 'DESCONOCIDO',
  //       //       ubicacion_geo: {
  //       //         type: 'Point',
  //       //         coordinates: [lon, lat] // [Longitud, Latitud] vital para GeoJSON
  //       //       }
  //       //     });
  //       //   }
  //       // }
  //       if (col.length >= 6) {
  //         const mmsi = col[2];
  //         const nombre = col[3] ? col[3].trim().toUpperCase() : 'DESCONOCIDO';
  //         const lat = parseFloat(col[4]);
  //         const lon = parseFloat(col[5]);
  //         const velocidad = parseFloat(col[6]) || 0;
  //         const rumbo = parseFloat(col[7]) || 0;

  //         // 🟢 FILTRO DE SEGURIDAD: Solo guardamos si lat/lon son válidos y NO son cero
  //         if (mmsi && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
  //           nodosEncontrados.push({
  //             // ENVIAMOS LOS DATOS PLANOS (Exactamente como se llaman en tu DB)
  //             mmsi: mmsi,
  //             nombre_motonave: nombre,
  //             latitud: lat,
  //             longitud: lon,
  //             velocidad: velocidad,
  //             rumbo: rumbo,
  //             destino: 'DESCONOCIDO',
  //             estado_inferido: 'EN TRÁNSITO'
  //           });
  //         }
  //       }
  //     }

  //     console.log(`✅ ¡Éxito! ${nodosEncontrados.length} barcos capturados y mapeados.`);

  //     // 6. Envío final a la Base de Datos
  //     if (nodosEncontrados.length > 0) {
  //       await this.guardarVesselEnBD(nodosEncontrados);
  //     }

  //   } catch (error) {
  //     console.error('❌ Error crítico en el cron de motonaves:', error.message);
  //   } finally {
  //     // 7. Liberación de memoria (¡VITAL para que tu servidor no colapse!)
  //     if (browser) {
  //       await browser.close();
  //     }
  //   }
  // },

  // async guardarVesselEnBD(nodosEncontrados) {
  //   try {
  //     if (!nodosEncontrados || nodosEncontrados.length === 0) {
  //       console.log('⚠️ No hay motonaves para guardar.');
  //       return;
  //     }

  //     const ahora = new Date().toISOString();
  //     const usuarioSistema = 'SISTEMA_CRON_AIS';

  //     // 1. Mapear el array del JSON al formato exacto de tu tabla en SQL Server
  //     const registrosMapeados = nodosEncontrados.map(barco => {

  //       // Si el códigoNodo viene como "MMSI-123456", extraemos solo el número para la PK
  //       const mmsiLimpio = barco.codigoNodo.includes('-')
  //         ? barco.codigoNodo.split('-')[1]
  //         : barco.codigoNodo;

  //       return {
  //         mmsi: mmsiLimpio, // Llave Primaria
  //         omi: barco.omi,
  //         nombre_motonave: barco.nombreNodo,

  //         // Extraemos lat/lon del GeoJSON [Longitud, Latitud]
  //         latitud: barco.ubicacion_geo.coordinates[1],
  //         longitud: barco.ubicacion_geo.coordinates[0],

  //         // Si la fuente no trae velocidad, enviamos 0 para no romper el NOT NULL de la DB
  //         velocidad: barco.velocidadNudos || 0,
  //         rumbo: barco.rumboGrados || null,
  //         destino: barco.destino || null,
  //         estado_inferido: barco.estadoOperativo || 'DESCONOCIDO',

  //         // Campos de auditoría requeridos por tu esquema
  //         codigoUsuarioCreacion: usuarioSistema,
  //         fechaCreacion: ahora,
  //         codigoUsuarioModificacion: usuarioSistema,
  //         fechaModificacion: ahora
  //       };
  //     });

  //     console.log('🔍 [DEBUG] Cantidad de registros a insertar:', registrosMapeados.length);
  //     console.log('🔍 [DEBUG] Ejemplo del primer registro:', registrosMapeados[0]);

  //     if (registrosMapeados.length > 0) {
  //       console.log('🚀 [DEBUG] Intentando bulkCreate ahora mismo...');
  //       await db.TCLAisUltimaPosicion.bulkCreate(registrosMapeados, {
  //         // Si el barco (MMSI) ya existe, SOLO actualizamos estos campos:
  //         updateOnDuplicate: [
  //           'omi', // 🟢 ¡FUNDAMENTAL AGREGAR ESTO AQUÍ!
  //           'nombre_motonave',
  //           'latitud',
  //           'longitud',
  //           'velocidad',
  //           'rumbo',
  //           'destino',
  //           'estado_inferido',
  //           'codigoUsuarioModificacion',
  //           'fechaModificacion'
  //         ]
  //       });

  //       console.log(`💾 [DB] Éxito: ${registrosMapeados.length} motonaves sincronizadas en TCLAisUltimaPosicion.`);
  //     }

  //   } catch (error) {
  //     console.error('❌ [DB Error] Fallo crítico al guardar las motonaves:');
  //     console.error(error); // <--- ESTO ES LO QUE NECESITO QUE ME PEGUES AQUÍ
  //     throw error;
  //   }
  // },
  async sincronizarMotonavesColombia() {
    console.log("🚀 [CRON] Iniciando sincronización AIS con API de VesselFinder...");
    // Asegúrate de tener axios instalado (npm install axios) si no lo usas en otro lado
    const axios = require('axios');

    try {
      // 1. Configuración de la API
      // REEMPLAZA ESTO con tu API Key real de VesselFinder
      const API_KEY = process.env.AIS_API_KEY;

      // Coordenadas para Colombia (Buenaventura y Caribe)
      const MIN_LON = -82.0;
      const MIN_LAT = -4.0;
      const MAX_LON = -70.0;
      const MAX_LAT = 14.0;

      // URL de VesselFinder para consultar barcos en un área (Bounding Box)
      const urlApi = `https://api.vesselfinder.com/vessels?userkey=${API_KEY}&bbox=${MIN_LON},${MIN_LAT},${MAX_LON},${MAX_LAT}`;

      // 2. Petición limpia y oficial (Sin navegadores fantasma ni bloqueos)
      const respuesta = await axios.get(urlApi);
      const barcosVesselFinder = respuesta.data;

      const nodosEncontrados = [];

      // 3. Traducción del JSON de VesselFinder al modelo de tu Base de Datos
      if (Array.isArray(barcosVesselFinder)) {
        for (const barco of barcosVesselFinder) {
          // VesselFinder envía las propiedades en inglés, las mapeamos:
          const mmsi = barco.MMSI || barco.mmsi;
          const nombre = barco.NAME || barco.name || 'DESCONOCIDO';
          const lat = parseFloat(barco.LAT || barco.lat);
          const lon = parseFloat(barco.LON || barco.lon);
          const velocidad = parseFloat(barco.SPEED || barco.speed) || 0;
          const rumbo = parseFloat(barco.COURSE || barco.course) || 0;
          const destino = barco.DESTINATION || barco.destination || 'DESCONOCIDO';

          // 🟢 FILTRO DE SEGURIDAD: Solo guardamos si lat/lon son válidos y NO son cero
          if (mmsi && !isNaN(lat) && !isNaN(lon) && lat !== 0 && lon !== 0) {
            nodosEncontrados.push({
              mmsi: mmsi.toString(),
              nombre_motonave: nombre.trim().toUpperCase(),
              latitud: lat,
              longitud: lon,
              velocidad: velocidad,
              rumbo: rumbo,
              destino: destino.trim().toUpperCase(),
              // VesselFinder trae un navstat (Navigation Status), pero por ahora lo dejamos por defecto
              estado_inferido: 'EN TRÁNSITO'
            });
          }
        }
      }

      console.log(`✅ ¡Éxito! ${nodosEncontrados.length} barcos capturados desde VesselFinder.`);

      // 4. Envío final a la Base de Datos
      if (nodosEncontrados.length > 0) {
        await this.guardarVesselEnBD(nodosEncontrados);
      }

    } catch (error) {
      console.error('❌ Error crítico en el cron de motonaves (VesselFinder):', error.message);
      // Si la API Key es inválida o expiró, VesselFinder nos dirá el motivo exacto aquí:
      if (error.response && error.response.data) {
        console.error('Detalle del rechazo de la API:', error.response.data);
      }
    }
  },

  async guardarVesselEnBD(nodosEncontrados) {
    try {
      const ahora = new Date().toISOString();
      const usuarioSistema = 'SYS_AIS_ENGINE';

      // 1. Mapeo directo y a prueba de fallos
      const registrosMapeados = nodosEncontrados.map(barco => {
        return {
          mmsi: barco.mmsi,
          nombre_motonave: barco.nombre_motonave,
          latitud: barco.latitud,
          longitud: barco.longitud,
          velocidad: barco.velocidad,
          rumbo: barco.rumbo,
          destino: barco.destino,
          estado_inferido: barco.estado_inferido,
          codigoUsuarioCreacion: usuarioSistema,
          fechaCreacion: ahora,
          codigoUsuarioModificacion: usuarioSistema,
          fechaModificacion: ahora
        };
      });

      // 2. Inserción masiva
      await db.TCLAisUltimaPosicion.bulkCreate(registrosMapeados, {
        updateOnDuplicate: [
          'nombre_motonave', // Fundamental actualizar el nombre si antes era NULL
          'latitud',
          'longitud',
          'velocidad',
          'rumbo',
          'fechaModificacion'
        ]
      });

      console.log(`💾 [DB] Éxito: ${registrosMapeados.length} motonaves insertadas/actualizadas.`);
    } catch (error) {
      console.error('❌ Error al guardar en BD:', error);
    }
  },






  // 3. MÉTODO DE PERSISTENCIA: RAW SQL (Bypass a Sequelize)
  async guardarEnBD(nodos) {
    const transaction = await db.sequelize.transaction();
    try {
      for (const item of nodos) {
        const sql = `
                    IF EXISTS (SELECT 1 FROM TCLNodosLogisticos WHERE UPPER(nombreNodo) = UPPER(:nombre) AND tipoNodo = 'BUQUE')
                        UPDATE TCLNodosLogisticos 
                        SET ocupacionActual = :ocupacion, estadoOperativo = :estado, fechaModificacion = GETDATE()
                        WHERE UPPER(nombreNodo) = UPPER(:nombre) AND tipoNodo = 'BUQUE'
                    ELSE
                        INSERT INTO TCLNodosLogisticos 
                        (codigoNodo, nombreNodo, tipoNodo, capacidadMaxima, ocupacionActual, unidadMedida, estadoOperativo, codigoUsuarioCreacion, fechaCreacion)
                        VALUES 
                        (:codigo, :nombre, :tipo, :capacidad, :ocupacion, :unidad, :estado, 'SCRAPER_SYS', GETDATE())
                `;
        await db.sequelize.query(sql, { replacements: item, transaction });
      }
      await transaction.commit();
    } catch (err) {
      await transaction.rollback();
      throw err;
    }
  },

  async registrarProductividadActual(puertoKey) {
    try {
      // 1. Calculamos la "hora etiqueta" actual (ej: '08h', '10h')
      const ahora = new Date();
      const horaActual = ahora.getHours();

      // Redondeamos hacia la hora par más cercana hacia abajo (ej: 09:30 -> 08h)
      const horaPar = horaActual % 2 === 0 ? horaActual : horaActual - 1;
      const horaEtiqueta = `${horaPar.toString().padStart(2, '0')}h`;

      const fechaHoy = ahora.toISOString().split('T')[0]; // '2026-06-23'

      // 2. Aquí iría tu lógica real para contar movimientos (Scraping o Query interno).
      // Por ahora, simularemos la data de las terminales de tu diseño para que la gráfica viva hoy mismo:
      const terminales = ['TCBUEN', 'SPRBUN', 'SPIA', 'COMPASAGD', 'COMPASCASCAJAL', 'GRUPOPORT'];
      const registrosCrudos = terminales.map(terminal => ({
        puerto: puertoKey,
        terminal: terminal,
        fecha: fechaHoy,
        horaEtiqueta: horaEtiqueta,
        movimientosHora: Math.floor(Math.random() * (55 - 10 + 1) + 10) // Random entre 10 y 55 movs/h
      }));

      // 3. Enviamos a la función de persistencia segura
      await this.guardarProductividadEnBD(registrosCrudos);

    } catch (error) {
      console.error(`[Productividad] ❌ Error registrando hora:`, error.message);
    }
  },

  async guardarProductividadEnBD(registrosCrudos) {
    const userContext = { codigoUsuario: 'CRON_SYS' };
    const registrosDTO = [];

    try {
      // 1. ENSAMBLAJE Y VALIDACIÓN (Capa de Negocio)
      // Iteramos la data cruda y la convertimos en objetos DTO seguros
      for (const item of registrosCrudos) {
        const dto = ProductividadTerminalesDTO(item, userContext);
        registrosDTO.push(dto);
      }

      // 2. PERSISTENCIA (Delegamos a la Capa de Datos)
      // Le pasamos el arreglo de DTOs ya validados al repositorio
      const cantidadGuardada = await MaritimoRepository.upsertProductividadMasiva(registrosDTO);
    } catch (error) {
      console.error(`[Productividad] ❌ Error orquestando el guardado:`, error.message);
      throw error; // El CRON captura esto
    }
  }
};

module.exports = IngestionService;