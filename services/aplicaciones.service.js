// /*
//     Author: German Valencia
//     Refactored for: QPLUS Standard (Clean Service Layer)
// */
// const { sequelize } = require('../database/connection');
// const { AplicacionModel, AplicacionDTO } = require('../models/aplicacion');
// const { getIO } = require('../helpers/socket.helper');

// class AplicacionesService {
//   constructor() {
//     this.model = AplicacionModel(sequelize);
//   }

//   async getAplicaciones(filtros = {}, esParaIA = false) {
//     try {
//       const queryOptions = {
//         where: filtros,
//       };

//       if (esParaIA) {
//         queryOptions.attributes = [
//           'nombreAplicacion',
//           'descripcionAplicacion',
//           'descripcionAplicacion',
//           'imagenInicio'
//         ];
//       }

//       return await this.model.findAll(queryOptions);

//     } catch (error) {
//       console.error("Error en AplicacionesService:", error);
//       throw error;
//     }
//   }

//   async getAplicacionByCode(codigoAplicacion) {
//     const registro = await this.model.findOne({ where: { codigoAplicacion } });
//     if (!registro) throw { statusCode: 404, msg: "No existe la aplicación." };
//     return registro;
//   }

//   async crearAplicacion(rawData) {
//     try {
//       const dataDTO = AplicacionDTO(rawData);

//       return await sequelize.transaction(async (t) => {
//         const nuevaAplicacion = await this.model.create(dataDTO, { transaction: t });
//         console.log('Aplicación creada en BD:', nuevaAplicacion.toJSON());
//         getIO().emit('aplicaciones-actualizadas', {
//           action: 'create',
//           msg: `Aplicación creada: ${nuevaAplicacion.nombreAplicacion}`
//         });

//         return nuevaAplicacion;
//       });

//     } catch (error) {
//       // Quitamos el .message para ver todo el objeto del error
//       console.error('🔴 Error COMPLETO en crearAplicacion:', error);
//       throw error;
//     }
//   }

//   async updateAplicacion(codigoAplicacion, rawData) {
//     try {
//       console.log('aplicacion servicio antes dto', rawData);

//       // 🟢 INYECCIÓN CLAVE: Agregamos el código para que Joi no explote
//       const dataAValidar = {
//         ...rawData,
//         codigoAplicacion: codigoAplicacion
//       };

//       const dataDTO = AplicacionDTO(dataAValidar);
//       console.log('aplicacion servicio dto', dataDTO);

//       return await sequelize.transaction(async (t) => {
//         const dbApp = await this.model.findOne({
//           where: { codigoAplicacion },
//           transaction: t
//         });

//         if (!dbApp) {
//           throw { statusCode: 404, msg: "No existe la aplicación para actualizar." };
//         }

//         await this.model.update(dataDTO, {
//           where: { codigoAplicacion },
//           transaction: t
//         });

//         const actualizada = await this.model.findOne({
//           where: { codigoAplicacion },
//           transaction: t
//         });

//         getIO().emit('aplicaciones-actualizadas', {
//           action: 'update',
//           msg: `Aplicación actualizada: ${actualizada.nombreAplicacion}`
//         });

//         return actualizada;
//       });

//     } catch (error) {
//       // 🟢 Mejoramos el catch para poder ver los errores reales de Joi en consola
//       if (error.type === 'ValidationError') {
//         console.error('🔴 Error de Validación DTO en updateAplicacion:', JSON.stringify(error.details, null, 2));
//       } else {
//         console.error(`🔴 Error en updateAplicacion:`, error.msg || error.message || error);
//       }
//       throw error;
//     }
//   }

//   async deleteAplicacion(codigoAplicacion) {
//     try {
//       return await sequelize.transaction(async (t) => {
//         const dbApp = await this.model.findOne({
//           where: { codigoAplicacion },
//           transaction: t
//         });

//         if (!dbApp) {
//           throw { statusCode: 404, msg: "No existe una aplicación con ese código." };
//         }

//         await this.model.destroy({
//           where: { codigoAplicacion },
//           transaction: t
//         });

//         getIO().emit('aplicaciones-actualizadas', {
//           action: 'delete',
//           msg: `Aplicación eliminada: ${dbApp.nombreAplicacion}`
//         });


//         return dbApp;
//       });

//     } catch (error) {
//       console.error(`Error en deleteAplicacion (Rollback):`, error.msg || error.message);
//       throw error;
//     }
//   }
// }

// module.exports = AplicacionesService;
/*
    Author: German Valencia
    Refactored for: QPLUS Standard (Clean Service Layer)
*/
const { sequelize } = require('../database/connection');
const { AplicacionModel, AplicacionDTO } = require('../models/aplicacion');
const { getIO } = require('../helpers/socket.helper');

class AplicacionesService {
  constructor() {
    this.model = AplicacionModel(sequelize);
  }

  async getAplicaciones(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoAplicacion', // 🟢 Fundamental para que la IA sepa el ID
          'nombreAplicacion',
          'descripcionAplicacion',
          // Eliminado el duplicado de descripcionAplicacion
          'imagenInicio'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("🔴 Error en AplicacionesService (getAplicaciones):", error);
      throw error;
    }
  }

  async getAplicacionByCode(codigoAplicacion) {
    const registro = await this.model.findOne({ where: { codigoAplicacion } });
    if (!registro) throw { statusCode: 404, msg: "No existe la aplicación." };
    return registro;
  }

  async crearAplicacion(rawData) {
    try {
      // Pasa por la aduana estricta de Joi
      const dataDTO = AplicacionDTO(rawData);

      return await sequelize.transaction(async (t) => {
        const nuevaAplicacion = await this.model.create(dataDTO, { transaction: t });

        getIO().emit('aplicaciones-actualizadas', {
          action: 'create',
          msg: `Aplicación creada: ${nuevaAplicacion.nombreAplicacion}`
        });

        return nuevaAplicacion;
      });

    } catch (error) {
      // 🟢 Revelamos el detalle exacto si Joi rechaza el DTO al crear
      if (error.type === 'ValidationError') {
        console.error('🔴 Error de Validación DTO en crearAplicacion:', JSON.stringify(error.details, null, 2));
      } else {
        console.error('🔴 Error COMPLETO en crearAplicacion:', error);
      }
      throw error;
    }
  }

  async updateAplicacion(codigoAplicacion, rawData) {
    try {
      // Inyección clave para que el DTO pase la regla del required()
      const dataAValidar = {
        ...rawData,
        codigoAplicacion: codigoAplicacion
      };

      const dataDTO = AplicacionDTO(dataAValidar);

      return await sequelize.transaction(async (t) => {
        const dbApp = await this.model.findOne({
          where: { codigoAplicacion },
          transaction: t
        });

        if (!dbApp) {
          throw { statusCode: 404, msg: "No existe la aplicación para actualizar." };
        }

        await this.model.update(dataDTO, {
          where: { codigoAplicacion },
          transaction: t
        });

        const actualizada = await this.model.findOne({
          where: { codigoAplicacion },
          transaction: t
        });

        getIO().emit('aplicaciones-actualizadas', {
          action: 'update',
          msg: `Aplicación actualizada: ${actualizada.nombreAplicacion}`
        });

        return actualizada;
      });

    } catch (error) {
      if (error.type === 'ValidationError') {
        console.error('🔴 Error de Validación DTO en updateAplicacion:', JSON.stringify(error.details, null, 2));
      } else {
        console.error(`🔴 Error en updateAplicacion:`, error.msg || error.message || error);
      }
      throw error;
    }
  }

  async deleteAplicacion(codigoAplicacion) {
    try {
      return await sequelize.transaction(async (t) => {
        const dbApp = await this.model.findOne({
          where: { codigoAplicacion },
          transaction: t
        });

        if (!dbApp) {
          throw { statusCode: 404, msg: "No existe una aplicación con ese código." };
        }

        await this.model.destroy({
          where: { codigoAplicacion },
          transaction: t
        });

        getIO().emit('aplicaciones-actualizadas', {
          action: 'delete',
          msg: `Aplicación eliminada: ${dbApp.nombreAplicacion}`
        });

        return dbApp; // Devuelve la data en memoria del registro que acaba de morir
      });

    } catch (error) {
      // 🟢 Ajustado para no explotar si el error es de DB y no trae .msg
      console.error(`🔴 Error en deleteAplicacion (Rollback):`, error.msg || error.message || error);
      throw error;
    }
  }
}

module.exports = AplicacionesService;