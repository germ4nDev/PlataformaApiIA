/*
    Author: German Valencia
    Pattern: PORTTOS AI Orchestrator - Integración IA Motonaves Multimodal (Marítimo + Terrestre)
*/
const Anthropic = require('@anthropic-ai/sdk');
const { db } = require('../../database/connection');
const { schemaRespuestaMotonavesIA } = require('../../validators/motonaves.validator');
const MotonaveOperacionService = require('../torre-control/motonave-operacion.service');

const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});

class MotonavesIAService {

  /**
   * Evalúa el estado de las motonaves actuales cruzando datos reales con reglas de SLA y saturación terrestre
   * @returns {Promise<Object>} JSON validado listo para el widget de Angular
   */
  async generarDashboardMotonaves() {
    try {
      // console.log('[IA-SERVICE] Iniciando recopilación de contexto operativo integral...');
      // A. Obtenemos las reglas estáticas y la infraestructura vigente
      const reglasBD = await db.TCLTerminales.findAll({
        include: [
          { model: db.TCLParametrosInfraestructura, as: 'infraestructura' },
          { model: db.TCLReglasSLAOperacion, as: 'slas' }
        ],
        raw: false // Necesario en false si quieres mapear los includes anidados fácilmente
      });

      // B. Obtenemos las operaciones REALES activas marítimas
      const operacionesActivas = await MotonaveOperacionService.obtenerOperacionesActivas();

      // Si no hay barcos operando, retornamos el widget vacío para no gastar tokens
      if (!operacionesActivas || operacionesActivas.length === 0) {
        return this._generarRespuestaVacia();
      }

      // C. NUEVO: Obtenemos el volumen terrestre reciente (RNDC) hacia Buenaventura
      // Filtramos por el año en curso para ver la saturación reciente
      const anioActual = new Date().getFullYear();
      const [terrestreData] = await db.sequelize.query(`
          SELECT 
              SUM(viajesTotales) as camionesEnRuta,
              SUM(kilogramos) / 1000 as toneladasEnRuta
          FROM TLCRNDCOperacionTerrestre
          WHERE municipioDestino LIKE '%BUENAVENTURA%' 
          AND anio = :anioActual
      `, {
        replacements: { anioActual }
      });

      // =====================================================================
      // 2. TRANSFORMACIÓN (DTO para Claude)
      // =====================================================================

      // Comprimimos la data para no saturar el contexto de la IA y ahorrar tokens
      const dtoIA = {
        contexto_terrestre: {
          camiones_llegando: parseInt(terrestreData[0]?.camionesEnRuta || 0),
          toneladas_terrestres: parseFloat(terrestreData[0]?.toneladasEnRuta || 0)
        },
        reglas_puerto: reglasBD.map(t => ({
          terminal: t.codigoTerminal,
          calado_max: t.infraestructura ? t.infraestructura.caladoMaximoMetros : null,
          slas: (t.slas || []).map(sla => ({
            carga: sla.tipoCarga,
            min_h: sla.rendimientoMinimoHora,
            gracia: sla.horasGraciaInicio,
            ignora_lluvia: sla.descuentaLluvia
          }))
        })),
        operaciones: operacionesActivas.map(op => ({
          barco: op.nombreMotonave,
          terminal: op.codigoTerminal,
          carga: op.tipoCarga,
          calado: op.caladoMetros,
          fecha_inicio: op.fechaPrimeraLinea,
          lluvia_h: op.horasLluvia || 0,
          movido: op.cantidadMovida || 0
        }))
      };

      // =====================================================================
      // 3. INFERENCIA Y PROMPT ENGINEERING
      // =====================================================================

      const promptSystem = `Eres el Motor Analítico de la Torre de Control Logística del Puerto. 
Tu objetivo es analizar la saturación del puerto basándote en los flujos de carga terrestre y marítima, y generar un reporte de estado para las motonaves en ventana de 72 horas.
DEBES RESPONDER ÚNICAMENTE CON UN OBJETO JSON VÁLIDO. No incluyas markdown, saludos ni explicaciones, solo el JSON puro.`;

      const promptUser = `
REGLAS DE EVALUACIÓN:
1. CALADO: Compara el 'calado' de la operación con el 'calado_max' del terminal. Si es mayor, alerta_calado = true.
2. SLA (Rendimiento): 
   - Calcula las horas totales transcurridas desde 'fecha_inicio' hasta hoy.
   - Resta 'gracia' y si 'ignora_lluvia' es true, resta 'lluvia_h'.
   - Rendimiento = 'movido' / horas_netas.
   - Si rendimiento < 'min_h', estado es "INCUMPLE SLA" y badge_class es "badge-danger".
3. SATURACIÓN TERRESTRE: 
   - Si 'camiones_llegando' en el 'contexto_terrestre' es mayor a 5000, indica alta congestión.
   - Si hay alta congestión terrestre, añade en la 'observacion_ia' que existe un alto riesgo de retraso en muelle por cuello de botella logístico en tierra (Ley de Little). Usa un "badge-warning" si cumple SLA pero hay alta saturación.

DADOS LOS SIGUIENTES DATOS OPERATIVOS (DTO):
${JSON.stringify(dtoIA)}

Genera el JSON final con la siguiente estructura:
{
  "widgetId": "MOTONAVES_72H",
  "titulo": "REPORTE DE MOTONAVES - 72H",
  "subtitulo": "Análisis IA en tiempo real (Marítimo + Terrestre)",
  "data": {
    "barcos": [
      {
        "nombre": "string",
        "terminal": "string",
        "estado_operativo": "string",
        "badge_class": "badge-success | badge-warning | badge-danger | badge-info",
        "alerta_calado": boolean,
        "observacion_ia": "string detallado"
      }
    ]
  }
}`;

      console.log('[IA-SERVICE] Enviando contexto multimodal a Claude 3...');
      const response = await anthropic.messages.create({
        model: "claude-3-haiku-20240307",
        max_tokens: 1500,
        temperature: 0.1,
        system: promptSystem,
        messages: [{ role: "user", content: promptUser }]
      });

      // =====================================================================
      // 4. LIMPIEZA Y VALIDACIÓN DEL CONTRATO (El Escudo Joi)
      // =====================================================================

      const textoCrudo = response.content[0].text.trim();
      let jsonParseado;

      try {
        // Limpiamos los bloques de código markdown por si Claude los incluye
        const jsonLimpio = textoCrudo.replace(/```json/g, '').replace(/```/g, '').trim();
        jsonParseado = JSON.parse(jsonLimpio);
      } catch (parseError) {
        //console.error('[IA-SERVICE] Error al parsear la respuesta de Claude:', textoCrudo);
        throw new Error('La IA no devolvió un JSON parseable.');
      }

      // Validación final de estructura
      const { error, value } = schemaRespuestaMotonavesIA.validate(jsonParseado, { stripUnknown: true });

      if (error) {
        //console.error('[IA-SERVICE] La IA generó un JSON inválido según contrato:', error.details);
        throw new Error(`Validación IA fallida: ${error.message}`);
      }

      return value;

    } catch (error) {
      //console.error('[IA-SERVICE] Error procesando dashboard de motonaves:', error);
      throw error; // Lanzamos al controlador para que active el Fallback
    }
  }

  /**
   * Respuesta rápida para cuando el puerto no tiene motonaves operando
   */
  _generarRespuestaVacia() {
    return {
      widgetId: "MOTONAVES_72H",
      titulo: "REPORTE DE MOTONAVES - 72H",
      subtitulo: "Sin operaciones activas en este momento",
      data: { barcos: [] }
    };
  }
}

module.exports = new MotonavesIAService();