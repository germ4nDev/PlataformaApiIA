const { Sequelize, DataTypes } = require('sequelize');

// 1. Instancia única de conexión
// const sequelize = new Sequelize(
//   process.env.DB_NAME,
//   process.env.DB_USER,
//   process.env.DB_PWD,
//   {
//     host: process.env.DB_SERVER,
//     dialect: 'mssql',
//     port: 1433,
//     logging: false,
//     pool: { max: 5, min: 0, acquire: 30000, idle: 10000 },
//     dialectOptions: {
//       options: {
//         encrypt: false, // Cambia a true si usas Azure
//         trustServerCertificate: true
//       }
//     }
//   }
// );

// ------------------------------------------------------------------------------------------------------------
// PRODUCCIÓN (https://porttosapi.porttos.co, primer despliegue 2026-10-29)
// La conexión es la misma de abajo: cambia solo el .env DEL SERVIDOR, que nunca se sube al repositorio.
// Aquí no van usuario ni clave reales (este archivo está en git). Llaves que debe tener el .env de producción:
//   DB_SERVER=<servidor SQL de producción>     DB_PORT=1433
//   DB_NAME=<base de producción>               DB_USER=<usuario de la aplicación, no sa>
//   DB_PWD=<clave>                             DB_POOL_MAX=20        DB_LOGGING=false
//   DB_SYNC=false   (nunca true)
// Si el SQL de producción exige cifrado (Azure u otro con TLS obligatorio), cambiar abajo encrypt a true y
// trustServerCertificate a false con un certificado válido.
// ------------------------------------------------------------------------------------------------------------
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PWD,
  {
    host: process.env.DB_SERVER,
    port: process.env.DB_PORT,
    dialect: 'mssql',
    // SQL en consola solo si DB_LOGGING=true (imprimir cada consulta degrada el rendimiento)
    logging: process.env.DB_LOGGING === 'true' ? console.log : false,
    // Pool ampliado: AIS, crons, sockets y la API comparten conexiones
    pool: {
      max: parseInt(process.env.DB_POOL_MAX, 10) || 20,
      min: 2,
      acquire: 30000,
      idle: 10000,
    },
    dialectOptions: {
      options: {
        requestTimeout: 30000,
        encrypt: false,
        trustServerCertificate: true
      }
    }
  }
);

// 2. Objeto db que contendrá los modelos
const db = {};
db.Sequelize = Sequelize;
db.sequelize = sequelize;

// // 3. Registro de modelos con manejo de errores interno
try {
  db.TLCRNDCOperacionTerrestre = require('../models/torre-control/rndc.model')(sequelize, DataTypes);

  // 👉 CORRECCIÓN: Apuntamos al nuevo modelo y le asignamos el nombre correcto en el objeto db
  db.TCL_CamionesOperaciones = require('../models/torre-control/flota-terrestre.model').FlotaTerrestreDTOModel(sequelize);

  // Agrega aquí otros modelos futuros:
  // db.OtraTabla = require('../models/otra.model')(sequelize, DataTypes);
} catch (err) {
  console.error('❌ Error al cargar los modelos:', err);
}

// 4. Verificación de conexión (NO LA EXPORTES HASTA QUE SEPRUEBE)
sequelize.authenticate()
  .then(() => console.log('✅ Conexión establecida con SQL Server.'))
  .catch(err => console.error('❌ No se pudo conectar a la BD:', err));

module.exports = { db, sequelize };