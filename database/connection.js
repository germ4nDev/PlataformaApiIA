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

const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PWD,
  {
    host: process.env.DB_SERVER,
    port: process.env.DB_PORT,
    dialect: 'mssql',
    logging: false,
    //logging: console.log,
    dialectOptions: {
      options: {
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