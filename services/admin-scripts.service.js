/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Batch Execution Security & Service Layer
*/
const fs = require('fs').promises;
const path = require('path');
const { Sequelize } = require('sequelize');
const Joi = require('joi');

// =======================================================================
// 🛡️ ESQUEMAS DE VALIDACIÓN QPLUS
// =======================================================================
const ScriptUnicoSchema = Joi.object({
    nombreArchivo: Joi.string().required(),
    nombreDb: Joi.string().pattern(/^[a-zA-Z0-9_]+$/).required()
});

const ScriptMultiSchema = Joi.object({
    nombreArchivo: Joi.string().required(),
    nombresDbs: Joi.array().items(Joi.string().pattern(/^[a-zA-Z0-9_]+$/)).min(1).required()
});

// =======================================================================
// 🗄️ MOTOR DE CONEXIÓN ADMIN (SINGLETON SCOPE)
// =======================================================================
const adminSequelize = new Sequelize(process.env.DB_NAME_MASTER, process.env.DB_USER, process.env.DB_PWD, {
    host: process.env.DB_SERVER,
    dialect: 'mssql',
    logging: false,
    dialectOptions: { options: { encrypt: true, trustServerCertificate: true } }
});

class AdminScriptService {

    // Motor interno de ejecución por lotes (Batch)
    async _ejecutarLotes(scriptSql) {
        const lotes = scriptSql.split(/^\s*GO\s*$/im);
        for (const lote of lotes) {
            const query = lote.trim();
            if (query.length > 0) await adminSequelize.query(query);
        }
    }

    _obtenerRutaSegura(nombreArchivo) {
        return path.join(__dirname, '..', 'uploads', 'plataforma', 'scripts', path.basename(nombreArchivo));
    }

    async ejecutarScript(rawData) {
        const { nombreArchivo, nombreDb } = await ScriptUnicoSchema.validateAsync(rawData);

        const rutaArchivo = this._obtenerRutaSegura(nombreArchivo);
        let scriptSql;

        try {
            scriptSql = await fs.readFile(rutaArchivo, 'utf8');
        } catch {
            throw { statusCode: 404, msg: `Archivo '${nombreArchivo}' no encontrado.` };
        }

        // Inyección controlada de contexto
        const scriptFinal = scriptSql.replace(/##NOMBRE_DB##/g, nombreDb);
        await this._ejecutarLotes(scriptFinal);

        return `Ejecución exitosa en ${nombreDb}.`;
    }

    async ejecutarScriptMultiDb(rawData) {
        const { nombreArchivo, nombresDbs } = await ScriptMultiSchema.validateAsync(rawData);

        const rutaArchivo = this._obtenerRutaSegura(nombreArchivo);
        const scriptBase = await fs.readFile(rutaArchivo, 'utf8').catch(() => {
            throw { statusCode: 404, msg: `Archivo '${nombreArchivo}' no encontrado.` };
        });

        const resultados = { exitosos: [], fallidos: [] };

        for (const dbName of nombresDbs) {
            try {
                const scriptAEjecutar = scriptBase.replace(/##NOMBRE_DB##/g, dbName);
                await this._ejecutarLotes(scriptAEjecutar);
                resultados.exitosos.push(dbName);
            } catch (error) {
                resultados.fallidos.push({ bd: dbName, error: error.message });
            }
        }
        return resultados;
    }
}

module.exports = new AdminScriptService();