/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../../database/connection');
const { InventarioContenedoresModel, InventarioContenedoresDTO } = require('../../models/torre-control/inventario-contenedores.model');
const { getIO } = require('../../helpers/socket.helper');
const xlsx = require('xlsx');
const crypto = require('crypto');

class InventarioContenedoresService {
  constructor() {
    this.model = InventarioContenedoresModel(sequelize);
  }

  async getInventarios(filtros = {}) {
    try {
      // Usualmente los tableros solo necesitan los que están en patio. 
      // Se puede sobreescribir mediante los 'filtros' desde el controlador.
      return await this.model.findAll({
        where: filtros
      });
    } catch (error) {
      console.error("Error en InventarioContenedoresService:", error);
      throw error;
    }
  }

  async getInventarioById(id_inventario) {
    const contenedor = await this.model.findOne({
      where: { id_inventario }
    });

    if (!contenedor) {
      throw { statusCode: 404, msg: "No existe el contenedor solicitado." };
    }

    return contenedor;
  }

  async createInventario(rawData) {
    // 1. Sanitización y Validación QPLUS DTO
    if (!rawData.id_inventario) rawData.id_inventario = crypto.randomUUID();
    const dataDTO = InventarioContenedoresDTO(rawData);

    return await sequelize.transaction(async (t) => {
      // 2. Validación de Negocio: No puede haber el mismo contenedor físico 
      // figurando como "EN_PATIO" dos veces simultáneamente.
      const existeEnPatio = await this.model.findOne({
        where: {
          sigla_numero: dataDTO.sigla_numero,
          estado_operativo: 'EN_PATIO'
        },
        transaction: t
      });

      if (existeEnPatio) {
        throw {
          statusCode: 400,
          msg: `El contenedor ${dataDTO.sigla_numero} ya se encuentra registrado físicamente en patio.`,
          contenedor: existeEnPatio
        };
      }

      // 3. Persistencia
      const contenedorDB = await this.model.create(dataDTO, { transaction: t });

      // 4. Emisión en Tiempo Real (Socket.io) para recargar los gráficos del tablero
      getIO().emit("inventario-actualizado", {
        action: "create",
        msg: `Nuevo ingreso: ${contenedorDB.sigla_numero} (${contenedorDB.naviera})`,
        id_puerto: contenedorDB.id_puerto
      });

      return contenedorDB;
    });
  }

  async cargueMasivoExcel(fileBuffer, usuarioCreador) {
    const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
    const sheetName = workbook.SheetNames[0];
    const rawDataArray = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);

    if (!rawDataArray || rawDataArray.length === 0) {
      throw { statusCode: 400, msg: 'El archivo Excel de contenedores está vacío o inválido.' };
    }

    const contenedoresLimpios = [];
    const erroresValidacion = [];

    rawDataArray.forEach((fila, index) => {
      try {
        const rawContenedor = {
          id_inventario: fila.id_inventario || crypto.randomUUID(),
          id_puerto: fila.id_puerto || 'BUENAVENTURA',
          sigla_numero: fila.sigla_numero,
          codigo_iso: fila.codigo_iso,
          naviera: fila.naviera,
          estado_carga: fila.estado_carga || 'FCL',
          peso_tara_kg: fila.peso_tara_kg,
          peso_bruto_kg: fila.peso_bruto_kg,
          ubicacion_bloque: fila.ubicacion_bloque || null,
          ubicacion_bahia: fila.ubicacion_bahia || null,
          ubicacion_fila: fila.ubicacion_fila || null,
          ubicacion_altura: fila.ubicacion_altura || null,
          es_reefer: fila.es_reefer === 'SI' || fila.es_reefer === true,
          temp_requerida_celsius: fila.temp_requerida_celsius || null,
          codigo_imo: fila.codigo_imo || null,
          fecha_ingreso: fila.fecha_ingreso || new Date().toISOString(),
          fecha_limite_freetime: fila.fecha_limite_freetime || null,
          estado_operativo: fila.estado_operativo || 'EN_PATIO',
          codigoUsuarioCreacion: usuarioCreador,
          fechaCreacion: new Date().toISOString(),
          codigoUsuarioModificacion: usuarioCreador,
          fechaModificacion: new Date().toISOString()
        };

        const contenedorDTO = InventarioContenedoresDTO(rawContenedor);
        contenedoresLimpios.push(contenedorDTO);
      } catch (error) {
        erroresValidacion.push({ filaExcel: index + 2, detalles: error.details || error });
      }
    });

    if (erroresValidacion.length > 0) {
      throw { statusCode: 400, msg: 'Errores de validación en el archivo Excel.', errores: erroresValidacion };
    }

    // 2. Ejecutar inserción masiva transaccional
    const resultado = await sequelize.transaction(async (t) => {
      try {
        return await this.model.bulkCreate(contenedoresLimpios, { transaction: t });
      } catch (dbError) {
        throw { statusCode: 409, msg: 'Error de integridad en BD al importar contenedores.', detalle: dbError.message };
      }
    });

    // 3. Emitir el evento de actualización global al tablero
    getIO().emit('inventario-actualizado', {
      action: "update_masivo",
      msg: 'Cargue masivo de contenedores completado. Recalculando patios...'
    });

    return resultado;
  }

  async updateInventario(id_inventario, rawData) {
    const dataDTO = InventarioContenedoresDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const contenedorDB = await this.model.findOne({
        where: { id_inventario },
        transaction: t
      });

      if (!contenedorDB) {
        throw { statusCode: 404, msg: "No existe el contenedor con ese ID para actualizar." };
      }

      await this.model.update(dataDTO, {
        where: { id_inventario },
        transaction: t
      });

      const contenedorActualizado = await this.model.findOne({
        where: { id_inventario },
        transaction: t
      });

      getIO().emit("inventario-actualizado", {
        action: "update",
        msg: `Contenedor reubicado/actualizado: ${contenedorActualizado.sigla_numero}`
      });

      return contenedorActualizado;
    });
  }

  async deleteInventario(id_inventario) {
    return await sequelize.transaction(async (t) => {
      const contenedorDB = await this.model.findOne({
        where: { id_inventario },
        transaction: t
      });

      if (!contenedorDB) {
        throw { statusCode: 404, msg: "No existe el contenedor con ese ID para eliminar." };
      }

      const sigla = contenedorDB.sigla_numero;

      const resultado = await this.model.destroy({
        where: { id_inventario },
        transaction: t
      });

      getIO().emit("inventario-actualizado", {
        action: "delete",
        msg: `Contenedor eliminado del registro: ${sigla}`
      });

      return resultado;
    });
  }
}

module.exports = InventarioContenedoresService;