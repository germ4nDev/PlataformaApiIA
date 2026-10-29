/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Cerebro IA · Simulador (pruebas sin costo ni red), puerto CerebroIA
    Description: Responde como el analista sin llamar a ningún modelo: arma una alerta por cada señal de
      severidad atención o crítica (máx. 3), con el texto de la señal y su evidencia, y un resumen. Sirve para
      probar de punta a punta (validación, verificación, hallazgos) con IA_PROVEEDOR=simulador.
      Necesita la foto: la recibe en `contexto.foto` (el adaptador real la ignora).
      Resúmenes (herramienta emitir_resumen, fase 4): devuelve el resumen automático que le llega en
      `contexto.borrador`, marcado como del simulador.
      Asistente (conversar, fase 5): primer turno llama la herramienta de `contexto.simulacion.herramienta`
      (foto_operativa por defecto); con el resultado, responde citándolo.
*/
const TIPO_POR_MODULO = {
  gate: 'congestion_gate', maritimo: 'saturacion_muelles', bodegas: 'saturacion_almacen', contenedores: 'saturacion_almacen',
  capacidad: 'saturacion_almacen', granel: 'retraso_buque', suelta: 'retraso_buque', viales: 'corredor_vial',
};

class SimuladorAdapter {
  constructor() {
    this.nombre = 'simulador';
  }

  async conversar({ modelo, mensajes = [], herramientas = [], eleccion = 'any', contexto = {} }) {
    const uso = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 };
    const resultados = mensajes.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((c) => c.type === 'tool_result');
    const herramienta = contexto.simulacion?.herramienta || 'foto_operativa';
    if (!resultados.length && eleccion === 'any' && herramientas.some((h) => h.name === herramienta)) {
      return {
        contenido: [{ type: 'tool_use', id: 'sim-1', name: herramienta, input: contexto.simulacion?.entrada || {} }],
        modelo: `simulador (${modelo})`, stopReason: 'tool_use', uso,
      };
    }
    const ultimo = resultados[resultados.length - 1];
    const texto = typeof ultimo?.content === 'string' ? ultimo.content : JSON.stringify(ultimo?.content || '');
    return {
      contenido: [{
        type: 'tool_use', id: 'sim-2', name: 'responder',
        input: {
          respuesta: contexto.simulacion?.respuesta || `Simulador: consulté ${herramienta} (${texto.length} caracteres de datos).`,
          fuentes: [{ herramienta, detalle: 'simulador' }], sugerencias: [], sinDatos: !ultimo, fueraDeAlcance: false,
        },
      }],
      modelo: `simulador (${modelo})`, stopReason: 'tool_use', uso,
    };
  }

  async generar({ modelo, herramienta, contexto = {} }) {
    if (herramienta?.name === 'clasificar_pregunta') {
      return {
        toolInput: contexto.clasificacion || { decision: 'frontera', tema: 'ninguno', confianza: 0.5, motivo: 'simulador' },
        toolUseId: 'simulador', modelo: `simulador (${modelo})`, stopReason: 'tool_use', uso: { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 },
      };
    }
    if (herramienta?.name === 'emitir_resumen') {
      const b = contexto.borrador || { titular: 'Sin datos', loQuePaso: [], loQueViene: [], vigilar: [], tendencias: [], evidencia: [] };
      return {
        toolInput: { ...b, titular: `Simulador: ${b.titular}`.slice(0, 140) },
        toolUseId: 'simulador', modelo: `simulador (${modelo})`, stopReason: 'tool_use',
        uso: { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 },
      };
    }
    const foto = contexto.foto || {};
    const graves = (foto.senales || []).filter((s) => s.severidad !== 'info' && s.tipo !== 'dato_viejo').slice(0, 3);
    const alertas = graves.map((s) => ({
      tipo: TIPO_POR_MODULO[String(s.id).split('.')[1]] || 'otro',
      entidad: String(s.id).split('.').slice(1, 3).join('.'),
      severidad: s.severidad,
      horizonteHoras: [1, 4],
      confianza: s.simulado ? 0.4 : 0.65,
      titulo: String(s.titulo).slice(0, 90),
      explicacion: `Señal determinista ${s.tipo}${s.simulado ? ' sobre datos simulados' : ''}. ${String(s.titulo).slice(0, 300)}`,
      accionSugerida: 'Revisar el módulo en el tablero y confirmar con la operación.',
      evidencia: [s.id, ...(s.evidencia || [])].slice(0, 8),
    }));
    return {
      toolInput: {
        alertas,
        tendencias: [],
        resumenTurno: alertas.length ? `Simulador: ${alertas.length} alerta(s) a partir de señales deterministas.` : 'Simulador: sin señales relevantes.',
        datosInsuficientes: (foto.calidad?.modulosSinDato || []).map((m) => m.modulo),
      },
      toolUseId: 'simulador',
      modelo: `simulador (${modelo})`,
      stopReason: 'tool_use',
      uso: { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 },
    };
  }
}

module.exports = new SimuladorAdapter();
module.exports.SimuladorAdapter = SimuladorAdapter;
