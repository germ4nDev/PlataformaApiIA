/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, File System Management & Transactional Integrity
*/
const fs = require("fs").promises;
const path = require("path");
const { sequelize } = require("../database/connection");
const { BibliotecaModel, BibliotecaDTO } = require("../models/biblioteca");
const { io } = require("../index");

class BibliotecasService {
  constructor() {
    this.model = BibliotecaModel(sequelize);
  }

  // Método privado para gestión de archivos físicos
  async #deleteArchivoFisico(nombreArchivo) {
    if (!nombreArchivo || nombreArchivo === 'no-imagen.png') return;
    try {
      const ruta = path.join(__dirname, "..", "uploads", "bibliotecas", nombreArchivo);
      await fs.unlink(ruta);
    } catch (error) {
      console.warn(`No se pudo eliminar el archivo físico: ${nombreArchivo}`, error.message);
    }
  }

  async getBibliotecas(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'nombreBiblioteca',
          'descripcionBiblioteca',
          'estadoBiblioteca'
        ];
      }

      return await this.model.findAll(queryOptions);

    } catch (error) {
      console.error("Error en BibliotecasService:", error);
      throw error;
    }
  }

  async getBibliotecaByCode(codigoBiblioteca) {
    const registro = await this.model.findOne({ where: { codigoBiblioteca } });
    if (!registro) throw { statusCode: 404, msg: "Biblioteca no encontrada." };
    return registro;
  }

  async createBiblioteca(rawData) {
    const dataDTO = BibliotecaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevaBiblioteca = await this.model.create(dataDTO, { transaction: t });

      io.emit("biblioteca-actualizadas", {
        action: "create",
        msg: `Biblioteca creada: ${nuevaBiblioteca.nombreBiblioteca}`,
      });

      return nuevaBiblioteca;
    });
  }

  async updateBiblioteca(codigoBiblioteca, rawData) {
    const dataDTO = BibliotecaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const bibliotecaDB = await this.model.findOne({
        where: { codigoBiblioteca },
        transaction: t
      });

      if (!bibliotecaDB) throw { statusCode: 404, msg: "Biblioteca no encontrada." };

      const imagenAnterior = bibliotecaDB.imagenBiblioteca;

      await this.model.update(dataDTO, {
        where: { codigoBiblioteca },
        transaction: t
      });

      // Lógica de limpieza de imagen antigua si cambió
      if (dataDTO.imagenBiblioteca && imagenAnterior !== dataDTO.imagenBiblioteca) {
        await this.#deleteArchivoFisico(imagenAnterior);
      }

      const actualizada = await this.model.findOne({
        where: { codigoBiblioteca },
        transaction: t
      });

      io.emit("biblioteca-actualizadas", {
        action: "update",
        msg: `Biblioteca actualizada: ${actualizada.nombreBiblioteca}`,
      });

      return actualizada;
    });
  }

  async deleteBiblioteca(codigoBiblioteca) {
    return await sequelize.transaction(async (t) => {
      const bibliotecaDB = await this.model.findOne({
        where: { codigoBiblioteca },
        transaction: t
      });

      if (!bibliotecaDB) throw { statusCode: 404, msg: "Biblioteca no encontrada." };

      const imagenABorrar = bibliotecaDB.imagenBiblioteca;

      await this.model.destroy({
        where: { codigoBiblioteca },
        transaction: t
      });

      // Limpieza del archivo asociado
      await this.#deleteArchivoFisico(imagenABorrar);

      io.emit("biblioteca-actualizadas", {
        action: "delete",
        msg: `Biblioteca eliminada correctamente.`,
      });

      return true;
    });
  }
}

module.exports = BibliotecasService;