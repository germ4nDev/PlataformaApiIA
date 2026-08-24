const xlsx = require('xlsx');
const { sequelize } = require('../database/connection');
const { DataTypes } = require('sequelize');

class ExcelIngestionService {
  async procesarExcelYCrearTabla(filePath, nombreTabla) {
    const workbook = xlsx.readFile(filePath);
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const data = xlsx.utils.sheet_to_json(sheet, { header: 1 });
    const headers = data[0]; // Primera fila son los nombres de columnas

    // 1. Pedir a la IA que infiera los tipos de datos (STRING, INTEGER, DATE)
    // Aquí podrías usar un prompt a Claude para que analice los headers
    const schemaDefinition = await this._inferirEsquemaConIA(headers);

    // 2. Crear la tabla dinámicamente
    const tableDefinition = {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      ...this._convertirJsonATypesSequelize(schemaDefinition)
    };

    await sequelize.getQueryInterface().createTable(nombreTabla, tableDefinition);

    // 3. Insertar datos
    const Modelo = sequelize.define(nombreTabla, this._convertirJsonATypesSequelize(schemaDefinition));
    const registros = xlsx.utils.sheet_to_json(sheet);
    await Modelo.bulkCreate(registros);

    return { success: true, tabla: nombreTabla };
  }

  _convertirJsonATypesSequelize(schema) {
    // Función para mapear texto (ej: "INTEGER") a DataTypes.INTEGER
    const sequelizeSchema = {};
    for (const [key, type] of Object.entries(schema)) {
      sequelizeSchema[key] = { type: DataTypes[type] || DataTypes.STRING };
    }
    return sequelizeSchema;
  }
}