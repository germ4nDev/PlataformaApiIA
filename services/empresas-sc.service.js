/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { sequelize } = require('../database/connection');
const { EmpresaSCModel, EmpresaSCDTO } = require('../models/empresa-sc');
const { io } = require('../index');

class EmpresaSCService {
  constructor() {
    this.model = EmpresaSCModel(sequelize);
  }

  async getEmpresasSC() {
    return await this.model.findAll();
  }

  async getEmpresaSCById(codigoEmpresaSC) {
    const registro = await this.model.findOne({ where: { codigoEmpresaSC } });
    if (!registro) throw { statusCode: 404, msg: "No existe la empresa solicitada." };
    return registro;
  }

  /**
   * Crea una nueva empresa (tenant/unidad de negocio)
   */
  async createEmpresaSC(rawData) {
    const dataDTO = EmpresaSCDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const nuevaEmpresa = await this.model.create(dataDTO, { transaction: t });

      io.emit('empresas-sc-actualizadas', {
        action: 'create',
        msg: `Empresa creada: ${nuevaEmpresa.nombreEmpresa}`
      });

      return nuevaEmpresa;
    });
  }

  /**
   * Actualiza una empresa existente
   */
  async updateEmpresaSC(codigoEmpresaSC, rawData) {
    // El controlador debe inyectar el codigoUsuario en rawData antes de llamar al servicio
    const dataDTO = EmpresaSCDTO(rawData);

    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoEmpresaSC },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la empresa para update." };

      await this.model.update(dataDTO, {
        where: { codigoEmpresaSC },
        transaction: t
      });

      const actualizada = await this.model.findOne({
        where: { codigoEmpresaSC },
        transaction: t
      });

      io.emit('empresas-sc-actualizadas', {
        action: 'update',
        msg: `Empresa actualizada: ${actualizada.nombreEmpresa}`
      });

      return actualizada;
    });
  }

  async deleteEmpresaSC(codigoEmpresaSC) {
    return await sequelize.transaction(async (t) => {
      const registroDB = await this.model.findOne({
        where: { codigoEmpresaSC },
        transaction: t
      });

      if (!registroDB) throw { statusCode: 404, msg: "No existe la empresa con ese ID." };

      const nombreEmpresa = registroDB.nombreEmpresa;

      await this.model.destroy({
        where: { codigoEmpresaSC },
        transaction: t
      });

      io.emit('empresas-sc-actualizadas', {
        action: 'delete',
        msg: `Empresa eliminada correctamente: ${nombreEmpresa}`
      });

      return true;
    });
  }
}

module.exports = EmpresaSCService;