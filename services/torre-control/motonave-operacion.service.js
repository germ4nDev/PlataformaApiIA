/*
    Author: German Valencia
    Pattern: QPLUS Service Pattern - Operaciones Motonaves
*/
const { Op } = require('sequelize');

// 1. Importamos la conexión real (Ajusta la ruta si es necesario)
const { db, sequelize } = require('../../database/connection');

// 2. Importamos la función constructora del modelo que ya tenías
const { MotonaveOperacionModel } = require('../../models/torre-control/motonave-operacion');
const { HomologacionMmsiModel, HomologacionMmsiDTO } = require('../../models/torre-control/homologador-mmsi.model');

// 3. 🚨 INICIALIZACIÓN: Creamos la instancia para usarla en la clase
const TCLMotonavesOperacion = MotonaveOperacionModel(sequelize);

class MotonaveOperacionService {

  /**
     * Obtiene las operaciones activas ordenadas por fecha de llegada
     * @returns {Promise<Array>} Lista de operaciones
     */
  async obtenerOperacionesActivas(terminalFilter = null) {
    const queryOptions = {
      where: {} // Puedes agregar aquí tus filtros de estadoRegistro si los tienes
    };

    // 🚨 AGREGAR: Si llega el filtro de terminal, lo aplicamos a la consulta
    if (terminalFilter) {
      queryOptions.where.codigoTerminal = terminalFilter;
    }

    return await TCLMotonavesOperacion.findAll(queryOptions);
  }

  /**
   * Inserta una nueva operación en la base de datos
   * @param {Object} dtoData - Datos ya validados y estructurados por el DTO
   * @returns {Promise<Object>} Registro creado
   */
  async registrarOperacion(dtoData) {
    try {
      // El modelo TCLMotonavesOperacion ya fue inicializado en tu index de modelos
      const nuevaOperacion = await db.TCLMotonavesOperacion.create(dtoData);
      return nuevaOperacion;
    } catch (error) {
      //console.error('Error en la capa de datos (MotonaveOperacionService):', error);
      // Relanzamos el error para que el controlador lo maneje y envíe el HTTP Status correcto
      throw error;
    }
  }

  async vincularMotonaveManual(rawData) {
    try {
      // 1. Pasamos los datos crudos por el DTO (valida, limpia y transforma)
      // Si falta el MMSI o el idAviso, Joi lanzará el 'ValidationError' aquí
      const datosLimpios = HomologacionMmsiDTO(rawData);

      // 2. Ejecutamos el Upsert en SQL Server
      const [registro, creado] = await db.TCLHomologacionMmsi.upsert(datosLimpios);

      return {
        registro,
        creado,
        mensaje: creado ? 'Vinculación creada con éxito' : 'Vinculación actualizada con éxito'
      };

    } catch (error) {
      // Burbujeamos el error para que el controlador decida qué código HTTP devolver
      throw error;
    }
  }

  // Aquí a futuro puedes agregar métodos como:
  // async obtenerOperacionesActivas() { ... }
  // async finalizarOperacion(codigoOperacion) { ... }
}

module.exports = new MotonaveOperacionService();