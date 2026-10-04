/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { CfgZonasDinamicasModel, CfgZonasDinamicasDTO } = require('../models/cfg-zonas-dinamicas.model');
const { v4: uuidv4 } = require('uuid');

class CfgZonasDinamicasService {
  constructor() {
    this.zonasModel = CfgZonasDinamicasModel(sequelize);
  }

  // ==========================================
  // CONSULTAS ESPECÍFICAS (READ)
  // ==========================================

  /**
   * Obtiene todas las zonas dinámicas registradas en el sistema.
   */
  async getAllZonas() {
    try {
      const zonasDB = await this.zonasModel.findAll();
      return zonasDB.map(zona => zona.toJSON());
    } catch (error) {
      console.error("Error en CfgZonasDinamicasService.getAllZonas:", error);
      throw new Error(`Error al obtener las zonas dinámicas: ${error.message}`);
    }
  }

  /**
   * 🚨 CONSULTA ESTRELLA: Obtiene la zona dinámica de una pestaña específica.
   * Usado por el LayoutService para inyectar la matemática al motor de Angular.
   */
  async getZonaByPestana(codigoPestana) {
    try {
      const zonaDB = await this.zonasModel.findOne({
        where: { codigoPestana }
      });

      if (!zonaDB) return null;

      return zonaDB.toJSON();
    } catch (error) {
      console.error(`Error en CfgZonasDinamicasService.getZonaByPestana (${codigoPestana}):`, error);
      throw error;
    }
  }

  /**
   * Obtiene una zona dinámica por su GUID primario.
   */
  async getZonaById(idZona) {
    try {
      const zonaDB = await this.zonasModel.findByPk(idZona);
      return zonaDB ? zonaDB.toJSON() : null;
    } catch (error) {
      console.error("Error en CfgZonasDinamicasService.getZonaById:", error);
      throw error;
    }
  }

  // ==========================================
  // TRANSACCIONES Y MUTACIONES (CREATE / UPDATE)
  // ==========================================

  /**
   * Guarda o actualiza la configuración de la Zona Dinámica para una pestaña.
   * Lógica UPSERT: Si ya tiene una, la actualiza. Si no, la crea.
   */
  async saveZonaDinamica(rawData) {
    // Validamos y limpiamos la data usando el DTO
    const zonaDTO = CfgZonasDinamicasDTO ? CfgZonasDinamicasDTO(rawData) : rawData;
    const { codigoPestana } = zonaDTO;

    if (!codigoPestana) {
      throw new Error("El codigoPestana es obligatorio para guardar una zona dinámica.");
    }

    return await sequelize.transaction(async (t) => {
      try {
        // 1. Buscamos si la pestaña ya tiene una zona dinámica
        const zonaExistente = await this.zonasModel.findOne({
          where: { codigoPestana },
          transaction: t
        });

        if (zonaExistente) {
          // 2A. UPDATE: Ya existe, actualizamos sus dimensiones matemáticas
          await this.zonasModel.update({
            codigoMolde: zonaDTO.codigoMolde,
            inicioX: Number(zonaDTO.inicioX) || 0,
            inicioY: Number(zonaDTO.inicioY),
            colsPorItem: Number(zonaDTO.colsPorItem) || 4,
            rowsPorItem: Number(zonaDTO.rowsPorItem) || 3
          }, {
            where: { codigoPestana },
            transaction: t
          });

          return { ...zonaExistente.toJSON(), ...zonaDTO, action: 'UPDATED' };

        } else {
          // 2B. CREATE: No existe, creamos el motor desde cero asegurando un GUID
          const nuevaZona = await this.zonasModel.create({
            idZona: zonaDTO.idZona || uuidv4(),
            codigoPestana: codigoPestana,
            codigoMolde: zonaDTO.codigoMolde,
            inicioX: Number(zonaDTO.inicioX) || 0,
            inicioY: Number(zonaDTO.inicioY),
            colsPorItem: Number(zonaDTO.colsPorItem) || 4,
            rowsPorItem: Number(zonaDTO.rowsPorItem) || 3
          }, { transaction: t });

          return { ...nuevaZona.toJSON(), action: 'CREATED' };
        }
      } catch (error) {
        // El rollback es automático por el bloque transaction(async(t)) de Sequelize
        throw error;
      }
    });
  }

  // ==========================================
  // ELIMINACIÓN (DELETE)
  // ==========================================

  /**
   * Elimina la configuración de la Zona Dinámica (Se usa cuando una pestaña
   * cambia de estrategia CASCADA_DINAMICA a ESTATICA y ya no necesita motor).
   */
  async deleteZonaByPestana(codigoPestana) {
    try {
      const registrosEliminados = await this.zonasModel.destroy({
        where: { codigoPestana }
      });
      return registrosEliminados > 0;
    } catch (error) {
      console.error(`Error de BD al eliminar la zona dinámica de la pestaña ${codigoPestana}:`, error);
      throw new Error(`Error al eliminar la zona: ${error.message}`);
    }
  }
}

module.exports = CfgZonasDinamicasService;