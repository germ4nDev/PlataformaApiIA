require('dotenv').config();
const axios = require('axios');
// Importamos la conexión directa a Sequelize que ya tienes configurada
const { sequelize } = require('../models/index'); // Ajusta esta ruta si tu index de models está en otra carpeta

async function ejecutarPruebaAIS() {
  console.log("==================================================");
  console.log("🚢 INICIANDO PRUEBA MANUAL AIS (VESSELFINDER) 🚢");
  console.log("==================================================");

  try {
    // 1. CONFIGURACIÓN
    // ⚠️ PON AQUÍ TU API KEY REAL
    const API_KEY = process.env.AIS_API_KEY;
    const urlApi = `https://api.vesselfinder.com/vessels?userkey=${API_KEY}&bbox=-82.0,-4.0,-70.0,14.0`;

    console.log("📡 1. Conectando con la API de VesselFinder...");
    const respuesta = await axios.get(urlApi);
    const barcosVesselFinder = respuesta.data;

    if (!Array.isArray(barcosVesselFinder)) {
      console.log("⚠️ La API no devolvió un arreglo. Respuesta:", barcosVesselFinder);
      return;
    }

    console.log(`✅ API respondió con éxito. Se encontraron ${barcosVesselFinder.length} barcos en el área.`);
    if (barcosVesselFinder.length === 0) return;

    console.log("💾 2. Iniciando inserción en SQL Server...");
    let insertados = 0;
    let erroresDB = 0;

    // 2. PROCESAMIENTO E INSERCIÓN
    for (const barco of barcosVesselFinder) {
      const mmsi = (barco.MMSI || barco.mmsi || '').toString();
      const nombre = barco.NAME || barco.name || 'DESCONOCIDO';
      const lat = parseFloat(barco.LAT || barco.lat);
      const lon = parseFloat(barco.LON || barco.lon);
      const vel = parseFloat(barco.SPEED || barco.speed) || 0;
      const rumbo = parseFloat(barco.COURSE || barco.course) || 0;
      const destino = barco.DESTINATION || barco.destination || 'DESCONOCIDO';

      if (!mmsi || isNaN(lat) || isNaN(lon) || lat === 0 || lon === 0) {
        continue; // Saltamos datos inválidos
      }

      try {
        // Consulta UPSERT (Actualiza si existe, Inserta si es nuevo) segura para SQL Server
        const querySQL = `
                    IF EXISTS (SELECT 1 FROM dbo.TCLAisUltimaPosicion WITH(NOLOCK) WHERE mmsi = :mmsi)
                    BEGIN
                        UPDATE dbo.TCLAisUltimaPosicion
                        SET 
                            latitud = :lat, longitud = :lon, 
                            velocidad = :vel, rumbo = :rumbo, destino = :destino, 
                            nombre_motonave = :nombre, estado_inferido = 'EN TRÁNSITO'
                            -- Si tienes columna espacial, descomenta la siguiente línea:
                            -- , ubicacion_geo = geometry::STGeomFromText('POINT(' + CAST(:lon AS VARCHAR(20)) + ' ' + CAST(:lat AS VARCHAR(20)) + ')', 4326)
                        WHERE mmsi = :mmsi;
                    END
                    ELSE
                    BEGIN
                        INSERT INTO dbo.TCLAisUltimaPosicion 
                        (mmsi, nombre_motonave, latitud, longitud, velocidad, rumbo, destino, estado_inferido)
                        -- Si tienes columna espacial, agrega 'ubicacion_geo' arriba y el valor espacial abajo:
                        VALUES 
                        (:mmsi, :nombre, :lat, :lon, :vel, :rumbo, :destino, 'EN TRÁNSITO');
                    END
                `;

        await sequelize.query(querySQL, {
          replacements: { mmsi, nombre, lat, lon, vel, rumbo, destino }
        });

        insertados++;
      } catch (dbError) {
        erroresDB++;
        console.log(`\n❌ ERROR SQL GUARDANDO EL BARCO [${nombre} - MMSI: ${mmsi}]:`);
        console.log(dbError.original?.message || dbError.message);
        // Frenamos en el primer error para leerlo claramente
        break;
      }
    }

    console.log("==================================================");
    console.log(`🏁 RESUMEN: ${insertados} guardados exitosamente | ${erroresDB} errores de BD.`);
    console.log("==================================================");

  } catch (apiError) {
    console.log("\n❌ ERROR DE COMUNICACIÓN CON VESSELFINDER:");
    if (apiError.response) {
      console.log("Estado HTTP:", apiError.response.status);
      console.log("Detalle:", apiError.response.data);
    } else {
      console.log(apiError.message);
    }
  } finally {
    // Cerramos la conexión para que el script termine correctamente
    await sequelize.close();
  }
}

ejecutarPruebaAIS();