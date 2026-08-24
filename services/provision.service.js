/*
    Author: German Valencia
    Service: Automatización y Provisión de Entornos (SaaS Multi-Tenant)
    Dialect: Microsoft SQL Server (mssql)
*/
const { sequelize } = require('../database/connection');

class ProvisionService {

  async clonarBaseDeDatos(codigoSuscriptor, dbPlantilla, prefijoBD) {
    // Blindaje
    if (!codigoSuscriptor || !dbPlantilla || !prefijoBD) {
      console.error("❌ [Provisión] Faltan parámetros para iniciar la clonación.");
      return false;
    }

    // Limpiamos el código del suscriptor para que sea válido en SQL
    const sufijo = codigoSuscriptor.replace(/-/g, '_').toLowerCase();
    const dbNueva = `${prefijoBD}_${sufijo}`;

    try {
      console.log(`⏳ [Provisión SQL Server] Iniciando clonación: [${dbPlantilla}] -> [${dbNueva}]`);

      // =========================================================
      // 1. CREAR LA BASE DE DATOS (Estilo SQL Server)
      // =========================================================
      // Consultamos si ya existe para ser idempotentes
      const [dbExiste] = await sequelize.query(`SELECT name FROM sys.databases WHERE name = N'${dbNueva}'`);

      if (dbExiste.length === 0) {
        await sequelize.query(`CREATE DATABASE [${dbNueva}]`);
        console.log(`✅ [Provisión] Base de datos [${dbNueva}] creada.`);
      } else {
        console.log(`⚡ [Provisión] La base de datos [${dbNueva}] ya existía, procediendo a verificar tablas.`);
      }

      // =========================================================
      // 2. OBTENER LAS TABLAS DE LA PLANTILLA
      // =========================================================
      // Consultamos el esquema de información de SQL Server
      const queryTablas = `SELECT TABLE_NAME FROM [${dbPlantilla}].INFORMATION_SCHEMA.TABLES WHERE TABLE_TYPE = 'BASE TABLE'`;
      const [tablas] = await sequelize.query(queryTablas);

      console.log(`⏳ [Provisión] Encontradas ${tablas.length} tablas en [${dbPlantilla}]. Iniciando copiado...`);

      // =========================================================
      // 3. CLONAR ESTRUCTURA Y DATOS
      // =========================================================
      for (let fila of tablas) {
        const nombreTabla = fila.TABLE_NAME;

        // Verificamos si la tabla ya existe en la base de datos nueva
        const queryTablaExiste = `SELECT TABLE_NAME FROM [${dbNueva}].INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = N'${nombreTabla}'`;
        const [tablaExiste] = await sequelize.query(queryTablaExiste);

        // Si la tabla no existe, la copiamos (Estructura y Datos al mismo tiempo)
        if (tablaExiste.length === 0) {
          await sequelize.query(`
                        SELECT * 
                        INTO [${dbNueva}].[dbo].[${nombreTabla}] 
                        FROM [${dbPlantilla}].[dbo].[${nombreTabla}]
                    `);
        }
      }

      console.log(`🚀 [Provisión] ¡ÉXITO! Entorno [${dbNueva}] completado y listo para el suscriptor.`);
      return true;

    } catch (error) {
      console.error(`❌ [Provisión] Error crítico al clonar BD [${dbNueva}] para el suscriptor [${codigoSuscriptor}]:`, error);
      return false;
    }
  }
}

module.exports = ProvisionService;