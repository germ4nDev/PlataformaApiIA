// tool.registry.js (Backend Node.js)
const db = require('../models'); // Importa tu core de Sequelize

const ToolRegistry = {

  "ejecutar_consulta_analitica_relacional": async (inputs) => {
    // RETIRADA (2026-10-24, capa de análisis con IA): ejecutaba SQL escrito por el modelo con un filtro por
    // palabras que se podía saltar. La reemplazan herramientas de lectura tipadas (fase 5 del diseño).
    // El código anterior queda abajo como referencia y no se ejecuta.
    const RETIRADA = true;
    if (RETIRADA) {
      return {
        error: 'Herramienta retirada por seguridad: el asistente ya no ejecuta SQL generado por el modelo.',
        db_source: 'Core-ASE Security Guardrail',
      };
    }
    const { sql_generado } = inputs;

    const queryVerificable = sql_generado.trim().toUpperCase();

    if (!queryVerificable.startsWith('SELECT')) {
      return {
        error: "Acceso denegado: La consulta solicitada no es de lectura.",
        db_source: "Core-ASE Security Guardrail"
      };
    }

    const palabrasPeligrosas = ['INSERT', 'UPDATE', 'DELETE', 'DROP', 'ALTER', 'TRUNCATE', 'RENAME', 'PTLUSUARIOS.CLAVEUSUARIO'];

    const contienePeligro = palabrasPeligrosas.some(palabra => queryVerificable.includes(palabra));

    if (contienePeligro) {
      return {
        error: "Acceso denegado: La consulta contiene palabras clave restringidas por políticas de seguridad de la junta directiva.",
        db_source: "Core-ASE Security Guardrail"
      };
    }

    try {
      const resultados = await db.sequelize.query(sql_generado, {
        type: db.Sequelize.QueryTypes.SELECT, // Forzamos a Sequelize a mapearlo únicamente como SELECT
        raw: true
      });

      return {
        registros_encontrados: resultados,
        total_filas: resultados.length,
        db_source: "plataformaBD (Live Analytical Engine)"
      };

    } catch (error) {
      console.error("❌ Error en motor SQL dinámico:", error.message);
      return {
        error: `Error de sintaxis relacional: ${error.message}`,
        db_source: "plataformaBD"
      };
    }
  }
};

module.exports = ToolRegistry;