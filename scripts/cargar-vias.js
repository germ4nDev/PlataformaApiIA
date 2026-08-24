// cargar-vias.js
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { sequelize } = require('./../database/connection');

// Función casera y rápida para convertir GeoJSON a WKT (Well-Known Text)
function geoJsonToWkt(geometry) {
  if (geometry.type === 'LineString') {
    const coords = geometry.coordinates.map(c => `${c[0]} ${c[1]}`).join(', ');
    return `LINESTRING(${coords})`;
  } else if (geometry.type === 'MultiLineString') {
    const lines = geometry.coordinates.map(line => {
      return '(' + line.map(c => `${c[0]} ${c[1]}`).join(', ') + ')';
    }).join(', ');
    return `MULTILINESTRING(${lines})`;
  }
  return null;
}

async function migrarVias() {
  console.log('🚀 Iniciando la migración de la Red Vial a SQL Server...');

  try {
    // 1. Probar conexión
    await sequelize.authenticate();
    console.log('✅ Base de datos conectada.');

    // 2. Leer el archivo GeoJSON
    // IMPORTANTE: Asegúrate de que el archivo esté en la misma carpeta que este script
    const filePath = path.join(__dirname, '..', 'data', 'Red_Vial_20260626.geojson');
    const rawData = fs.readFileSync(filePath, 'utf-8');
    const geojson = JSON.parse(rawData);

    const features = geojson.features;
    console.log(`📦 Se encontraron ${features.length} tramos viales en el archivo.`);

    // 3. Procesar e insertar en lotes
    let insertados = 0;
    let ignorados = 0;

    for (const feature of features) {
      const geomWKT = geoJsonToWkt(feature.geometry);

      if (!geomWKT) {
        ignorados++;
        continue;
      }

      // Extraemos propiedades comunes (ajusta los nombres si tu GeoJSON tiene llaves diferentes)
      // Ej: INVIAS suele usar NOMBRE_VIA, TIPO_VIA, etc.
      const props = feature.properties || {};
      const nombre = props.nombre || props.NOMBRE_VIA || props.corredor || 'Vía sin nombre';
      const tipo = props.tipo || props.TIPO_VIA || 'Carretera';
      const estado = props.estado || props.ESTADO || 'Bueno';

      // Insertamos usando query crudo para garantizar el SRID 4326
      const query = `
                INSERT INTO TCL_RedVial (nombre_via, tipo_via, estado_superficie, geometria_via)
                VALUES (:nombre, :tipo, :estado, geometry::STGeomFromText(:wkt, 4326))
            `;

      await sequelize.query(query, {
        replacements: { nombre, tipo, estado, wkt: geomWKT }
      });

      insertados++;
      if (insertados % 500 === 0) {
        console.log(`⏳ Progreso: ${insertados} tramos insertados...`);
      }
    }

    console.log(`🎉 ¡Migración exitosa!`);
    console.log(`🛣️ Tramos insertados: ${insertados}`);
    console.log(`⚠️ Tramos ignorados (no eran líneas): ${ignorados}`);

    process.exit(0);

  } catch (error) {
    console.error('❌ Error catastrófico durante la migración:', error);
    process.exit(1);
  }
}

migrarVias();