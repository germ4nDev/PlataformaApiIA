const { DataTypes } = require('sequelize');

// const BitacoraSincronizacionModel = (sequelize) => {
//   const Modelo = sequelize.define('TCL_BitacoraSincronizacion', {
//     proceso: {
//       type: DataTypes.STRING(100),
//       allowNull: false
//     },
//     estado: {
//       type: DataTypes.STRING(50),
//       allowNull: false
//     },
//     registros_procesados: {
//       type: DataTypes.INTEGER,
//       defaultValue: 0
//     },
//     errores: {
//       type: DataTypes.TEXT,
//       allowNull: true
//     },
//     duracion_ms: {
//       type: DataTypes.INTEGER,
//       allowNull: true
//     },
//     fecha_ejecucion: {
//       type: DataTypes.STRING(100),
//       defaultValue: DataTypes.NOW
//     },
//     createdAt: {
//       type: DataTypes.STRING(100),
//       defaultValue: DataTypes.NOW
//     },
//     updatedAt: {
//       type: DataTypes.STRING(100),
//       defaultValue: DataTypes.NOW
//     }
//   }, {
//     tableName: 'TCL_BitacoraSincronizacion',
//     timestamps: true
//   });

//   return Modelo;
// };

const BitacoraSincronizacionModel = (sequelize) => {
  return sequelize.define('TCL_BitacoraSincronizacion', {
    proceso: {
      type: DataTypes.STRING(100),
      allowNull: false
    },
    estado: {
      type: DataTypes.STRING(50),
      allowNull: false
    },
    registros_procesados: {
      type: DataTypes.INTEGER,
      defaultValue: 0
    },
    errores: {
      type: DataTypes.TEXT,
      allowNull: true
    },
    duracion_ms: {
      type: DataTypes.INTEGER,
      allowNull: true
    },
    fecha_ejecucion: {
      type: DataTypes.STRING(100),
      defaultValue: DataTypes.NOW
    },
    createdAt: {
      type: DataTypes.STRING(100),
      defaultValue: DataTypes.NOW
    },
    updatedAt: {
      type: DataTypes.STRING(100),
      defaultValue: DataTypes.NOW
    }
  }, {
    tableName: 'TCL_BitacoraSincronizacion',
    timestamps: false
  });

};

// Se exporta como objeto para que el destructuring ( { BitacoraSincronizacionModel } ) 
// en tu index.js funcione correctamente.
module.exports = { BitacoraSincronizacionModel };