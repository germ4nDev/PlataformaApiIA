const { sequelize } = require('../database/connection');
const { PestanaModel, PestanaDTO } = require('../models/pestana.model');
const { getIO } = require('../helpers/socket.helper');
const PestanasMetadatos = require('../repositories/pestanas-metadatos.repository');
const { conEstilo } = require('../utils/pestanas-estilo');

class PestanaService {
  constructor() {
    this.model = PestanaModel(sequelize);
  }

  async obtenerPestanas(filtros = {}, esParaIA = false) {
    try {
      const queryOptions = {
        where: filtros,
      };

      if (esParaIA) {
        queryOptions.attributes = [
          'codigoPestana',
          'nombrePestana',
          'descripcionTipo',
          'estado'
        ];
      }

      const pestanas = await this.model.findAll(queryOptions);
      // OT-008: ícono, color y zona dinámica de la BD (no para la IA, que pide solo cuatro columnas)
      if (esParaIA) return pestanas;
      const [estilos, zonas] = await Promise.all([this.estilos(), this.zonas()]);
      return conEstilo(pestanas, estilos, zonas);

    } catch (error) {
      console.error("Error en PestranasService:", error);
      throw error;
    }
  }

  /** Ícono y color por pestaña; sin la migración 020 se avisa una vez y se sigue sin ellos (null en cada pestaña). */
  async estilos() {
    if (this.sinMigracion020) return {};
    try {
      return await PestanasMetadatos.estilos();
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      this.sinMigracion020 = true;
      console.warn(`⚠️ [Pestañas] ${error.msg}: el ícono y el color de cada pestaña salen del código.`);
      return {};
    }
  }

  /** Zona dinámica por pestaña (PTL_CfgZonasDinamicas): /api/layout/plantilla no la entrega bien (OT-008). */
  async zonas() {
    try {
      return await PestanasMetadatos.zonas();
    } catch (error) {
      console.warn('⚠️ [Pestañas] Zonas dinámicas no disponibles:', error?.message || error);
      return {};
    }
  }

  async obtenerPestanaPorId(codigo) {
    const registro = await this.model.findByPk(codigo);
    if (!registro) throw { statusCode: 404, msg: 'Pestana no encontrado' };
    return PestanaDTO(registro);
  }

  async obtenerPestanasPorContexto(codigoSuite, codigoAplicacion) {
    try {
      // console.log('app', codigoAplicacion);   // [ruido de consola: comentado 2026-10-26]
      // console.log('sui', codigoSuite);   // [ruido de consola: comentado 2026-10-26]

      const pestanas = await this.model.findAll({
        where: {
          estado: true,
          codigoAplicacion: codigoAplicacion,
          codigoSuite: codigoSuite
        },
        order: [['orden', 'ASC']]
      });
      // OT-008 (2026-10-29): ícono y color de la BD (migración 020; sin ella, null y cada cliente usa su respaldo) y la zona
      // dinámica, que la regla de layout de la web toma de aquí
      const [estilos, zonas] = await Promise.all([this.estilos(), this.zonas()]);
      return conEstilo(pestanas, estilos, zonas);
    } catch (error) {
      console.error('❌ Error en obtenerPestanasPorContexto:', error);
      throw error;
    }
  }

  async crearPestana(rawData) { // CC-139: recibía data y usaba rawData (ReferenceError → 500)
    const dataDTO = PestanaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const [existente, existeNombre] = await Promise.all([
        this.model.findOne({ where: { codigoPestana: dataDTO.codigoPestana }, transaction: t }),
        this.model.findOne({ where: { nombrePestana: dataDTO.nombrePestana }, transaction: t })
      ]);

      if (existente) throw { statusCode: 400, msg: `El código ${dataDTO.codigoPestana} ya está registrado.` };
      if (existeNombre) throw { statusCode: 400, msg: `Ya existe una pestana llamado ${dataDTO.nombrePestana}.` };

      const nuevo = await this.model.create(dataDTO, { transaction: t });

      getIO().emit('tipos-roles-actualizados', {
        action: 'create',
        msg: `Tipo de roles creado: ${nuevo.nombrePestana}`
      });

      return nuevo;
    });
  }

  async actualizarPestana(codigo, rawData) {
    const dataDTO = PestanaDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoPestana },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la pestana para actualizar." };

      await this.model.update(dataDTO, {
        where: { codigoPestana },
        transaction: t
      });

      const actualizado = await this.model.findOne({
        where: { codigoPestana },
        transaction: t
      });

      getIO().emit('pestanas-actualizados', {
        action: 'update',
        msg: `Pestana actualizado: ${actualizado.nombrePestana}`
      });

      return actualizado;
    });
  }

  async eliminarPestana(codigoPestana) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoPestana },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la pestana con ese código para eliminar." };

      const nombrePestana = registroDB.nombrePestana;

      await this.model.destroy({
        where: { codigoPestana },
        transaction: t
      });

      getIO().emit('pestanas-actualizados', {
        action: 'delete',
        msg: `Tipo de role eliminado: ${nombrePestana}`
      });

      return true;
    });
  }
}

module.exports = PestanaService;