/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Batch Execution Safety & Error Handling
*/
const fs = require('fs').promises;
const path = require('path');
const { sequelize } = require('../database/connection');

class DbInitService {
    constructor() {
        this.scriptPath = path.join(__dirname, '..', 'database', 'plataforma_db.sql');
    }

    /**
     * Ejecuta fragmentos de SQL divididos por el delimitador 'GO'
     * @private
     */
    async #ejecutarLotes(scriptSql) {
        const lotes = scriptSql.split(/^\s*GO\s*$/im);
        let ejecutados = 0;

        for (const lote of lotes) {
            const query = lote.trim();
            if (query.length > 0) {
                try {
                    await sequelize.query(query);
                    ejecutados++;
                } catch (error) {
                    console.error(`Error en lote ${ejecutados + 1}:`, error.message);
                    throw {
                        statusCode: 500,
                        msg: `Error al procesar el lote #${ejecutados + 1}.`,
                        detalle: error.message
                    };
                }
            }
        }
        return ejecutados;
    }

    /**
     * Punto de entrada para inicializar la estructura de la base de datos
     */
    async ejecutarScriptBD() {
        // Verificación preventiva de existencia
        try {
            await fs.access(this.scriptPath);
        } catch {
            throw {
                statusCode: 404,
                msg: 'El archivo de inicialización SQL no existe.',
                detalle: this.scriptPath
            };
        }

        const sqlScript = await fs.readFile(this.scriptPath, 'utf-8');

        // Ejecución secuencial controlada
        const totalLotes = await this.#ejecutarLotes(sqlScript);

        return {
            comandosEjecutados: totalLotes,
            mensaje: `Base de datos inicializada: ${totalLotes} lotes procesados correctamente.`
        };
    }
}

module.exports = DbInitService;