/*
    Author: German Valencia
    Refactored for: QPLUS Architecture - Full Analytical Adapter (SIMULATOR)
*/
const sequelize = require('../database/connection');

class ClaudeAdapter {
  constructor() {
    this.dbSchemaContext = this._extractDynamicSchema();
  }

  _extractDynamicSchema() {
    try {
      const models = sequelize.models;
      const schema = {};
      for (const modelName in models) {
        const model = models[modelName];
        schema[modelName] = {
          columnas: Object.keys(model.rawAttributes).map(attr => ({
            columna: model.rawAttributes[attr].field || attr,
            tipo: model.rawAttributes[attr].type.key
          }))
        };
      }
      return JSON.stringify(schema, null, 2);
    } catch (error) { return "Esquema no disponible."; }
  }

  async generateText(prompt, systemContext, tools = null) {
    // // console.log("🤖 [SIMULADOR ACTIVADO] Recibiendo prompt:", prompt);
    await new Promise(resolve => setTimeout(resolve, 1500));
    const p = prompt.toLowerCase();

    // 1. SIMULADOR DE GRÁFICAS AGRUPADAS (NUEVO PATRÓN UNIVERSAL)
    if (p.includes("grafica") || p.includes("gráfica") || p.includes("barras") || p.includes("pastel") || p.includes("pie")) {
      // // console.log("🤖 [SIMULADOR] Decisión: generar_grafica_agrupada");

      let entidad = "usuarios";
      let columna = "estadoUsuario";

      if (p.includes("modulo") || p.includes("módulo")) {
        entidad = "modulos";
        columna = "estadoModulo"; // Ajusta esto si tu columna se llama diferente en la BD
      } else if (p.includes("ticket")) {
        entidad = "tickets";
        columna = "estadoTicket"; // Ajusta esto si tu columna se llama diferente
      }

      return {
        type: "tool_use",
        toolName: "generar_grafica_agrupada",
        toolInput: {
          entidad: entidad,
          columna_agrupacion: columna,
          tipo_grafica: (p.includes("pastel") || p.includes("pie")) ? "pie" : "barras"
        }
      };
    }

    // 2. SIMULADOR DE PROMEDIOS / SUMATORIAS / MÁXIMOS
    if (p.includes("promedio") || p.includes("suma") || p.includes("mayor") || p.includes("caro")) {
      // console.log("🤖 [SIMULADOR] Decisión: calcular_metrica (Operaciones Complejas)");
      let op = "avg";
      if (p.includes("suma") || p.includes("total de")) op = "sum";
      if (p.includes("mayor") || p.includes("caro") || p.includes("máximo")) op = "max";
      if (p.includes("menor") || p.includes("barato") || p.includes("mínimo")) op = "min";

      return {
        type: "tool_use", toolName: "calcular_metrica",
        toolInput: { entidad: "modulos", operacion: op, campo: "precioModulo" }
      };
    }

    // 3. SIMULADOR DE CONTEOS BÁSICOS
    if (p.includes("cuántos") || p.includes("cuantos") || p.includes("total")) {
      // console.log("🤖 [SIMULADOR] Decisión: calcular_metrica (Operación: count)");
      return {
        type: "tool_use", toolName: "calcular_metrica",
        toolInput: { entidad: p.includes("ticket") ? "tickets" : "usuarios", operacion: "count" }
      };
    }

    // 4. RESPUESTA ESTÁNDAR
    return { type: "text", content: "Respuesta general. No detecté intención de datos." };
  }

  async generateFinalResponseWithToolResult(userPrompt, toolName, dbResult) {
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (toolName === 'generar_grafica_agrupada') {
      if (dbResult.error) return `Hubo un error al generar la gráfica: ${dbResult.error}`;
      return `He generado el análisis visual agrupado a partir de los registros de la plataforma.`;
    }

    if (toolName === 'calcular_metrica') {
      if (dbResult.error) return `Hubo un error analítico: ${dbResult.error}`;
      const formatNumber = new Intl.NumberFormat('es-CO').format(dbResult.valor || 0);
      return `He analizado los datos solicitados. El resultado de tu consulta es: **${formatNumber}** (${dbResult.descripcion}).`;
    }

    return `Consulta ejecutada. Registros encontrados: ${dbResult.data?.length || 0}.`;
  }
}
module.exports = new ClaudeAdapter();