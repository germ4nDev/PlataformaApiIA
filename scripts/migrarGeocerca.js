// Script rápido de migración
require('dotenv').config();
const { Sequelize, QueryTypes } = require('sequelize');
const { db, sequelize } = require('../database/connection');

async function migrarGeocercas() {

  try {
    await sequelize.authenticate();

    const registros = await sequelize.query(
      "SELECT id_infraestructura, geocerca_bounding_box FROM T_Maestro_Infraestructura WHERE geocerca_bounding_box IS NOT NULL",
      { type: QueryTypes.SELECT }
    );


    for (const reg of registros) {
      try {
        // await sequelize.query(
        //   `UPDATE T_Maestro_Infraestructura 
        //              SET geocerca_geo = geometry::STGeomFromText(:wkt, 4326).MakeValid() 
        //              WHERE id_infraestructura = :id`,
        //   {
        //     replacements: { wkt: reg.geocerca_bounding_box, id: reg.id_infraestructura },
        //     type: QueryTypes.UPDATE
        //   }
        // );
        await sequelize.query(
          `UPDATE T_Maestro_Infraestructura 
     SET geocerca_geo = geocerca_bounding_box 
     WHERE id_infraestructura = :id`,
          {
            replacements: { id: reg.id_infraestructura },
            type: QueryTypes.UPDATE
          }
        );
        process.stdout.write('.');
      } catch (err) {
        console.log(`\n❌ Error en ID ${reg.id_infraestructura}: El texto es inválido.`);
      }
    }
  } catch (error) {
    console.error("🔴 Error crítico de conexión:", error);
  } finally {
    await sequelize.close();
  }
}

migrarGeocercas();