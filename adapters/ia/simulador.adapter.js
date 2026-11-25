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
      CC-283 (usuario 2026-11-20: sin créditos de Anthropic, se trabaja con la IA simulada):
        - emitir_recomendacion (prevención) y emitir_explicacion («¿Por qué?»): devuelve la versión automática que llega en
          `contexto.automatica`, con el resumen marcado «Simulador:».
        - Asistente: sin simulación de prueba, la herramienta sale de la pestaña del mensaje («pestaña «Virtual Gate»» →
          detalle_modulo del módulo), y la respuesta lista los indicadores que trajo la herramienta (título, valor y unidad), así sus
          cifras pasan la verificación. El filtro de alcance responde «dentro» por defecto.
      CC-288 (prueba en vivo del asistente: «No encontré indicadores» con datos): el tablero de un módulo (detalle_modulo) se lee
        con el catálogo de KPI, y lo que no trae {titulo, valor} (estado_maritimo: totalNaves, atracadas…) se lista por sus campos
        numéricos con nombre legible. Siempre cifras que están en el resultado.
*/
const { PESTANAS } = require('../../utils/ia/asistente');
const { CATALOGO_KPI } = require('../../utils/ia/catalogo-kpi');

/** CC-288 · «totalNaves» → «Total naves»; «fondeo.minutosPromedio» → «Fondeo · minutos promedio». */
const legible = (ruta) => ruta.split('.').map((c) => c.replace(/([a-z])([A-Z])/g, '$1 $2').replace(/_/g, ' ').toLowerCase())
  .join(' · ').replace(/^./, (x) => x.toUpperCase()).replace(/\bpct\b/g, '%').replace(/\bmin\b/g, '(min)');
const CAMPOS_FUERA = /(^|\.)(id|mmsi|imo|eslora|calado|lat|lon|latitud|longitud|horas|cadaMin|limite|relevancia)$/i;
const TIPO_POR_MODULO = {
  gate: 'congestion_gate', maritimo: 'saturacion_muelles', bodegas: 'saturacion_almacen', contenedores: 'saturacion_almacen',
  capacidad: 'saturacion_almacen', granel: 'retraso_buque', suelta: 'retraso_buque', viales: 'corredor_vial',
};

/** CC-283 · Herramienta según la pestaña que dice el mensaje del usuario (contextoPestana). */
function herramientaPorPestana(mensajes) {
  const texto = mensajes.filter((m) => m.role === 'user' && typeof m.content === 'string').map((m) => m.content).join(' ');
  const nombre = (texto.match(/pestaña «([^»]+)»/) || [])[1];
  const p = Object.values(PESTANAS).find((x) => x.nombre === nombre);
  if (!p) return null;
  const h = p.herramientas[0];
  return { nombre: h, entrada: h === 'detalle_modulo' ? { modulo: p.modulos[0] } : {} };
}

/** CC-283 · Respuesta legible con los indicadores que trajo la herramienta (objetos con título y valor), sin inventar cifras. */
function respuestaSimulada(herramienta, texto) {
  let datos = null;
  try { datos = JSON.parse(texto); } catch { datos = null; }
  const filas = [];
  const fila = (titulo, valor, unidad) => {
    if (filas.length < 8) filas.push(`- **${String(titulo).slice(0, 80)}:** ${valor}${unidad ? ` ${unidad}` : ''}`);
  };
  // CC-306 · 0) Lo que se viene (pronosticos_puerto): los riesgos con su nivel y en cuántas horas (cifras del resultado).
  if (Array.isArray(datos?.riesgos)) {
    const NIVEL = { critico: 'crítico', atencion: 'en atención', posible: 'posible', normal: 'normal' };
    datos.riesgos.filter((r) => r && typeof r === 'object' && r.nivel !== 'normal').forEach((r) => {
      const cuando = r.enHoras === 0 ? 'ahora' : `en ${r.enHoras} h${r.hora ? ` (hacia las ${r.hora})` : ''}`;
      fila(`${r.frente} · ${r.nombre}`, `${NIVEL[r.nivel] || r.nivel} ${cuando}`);
    });
    if (!filas.length) fila('Riesgos en 24 h', 0);
  }
  // 1) El tablero de un módulo: sus KPI del catálogo (los mismos de la foto).
  if (datos?.modulo && datos.datos && typeof datos.datos === 'object') {
    CATALOGO_KPI.filter((k) => k.modulo === datos.modulo).forEach((k) => {
      let v = null;
      try { v = k.extraer(datos.datos); } catch { v = null; }
      if (v !== null && v !== undefined && Number.isFinite(Number(v))) fila(k.titulo, v, k.unidad);
    });
  }
  // 2) Objetos con título y valor.
  const recorrer = (v, prof = 0) => {
    if (filas.length >= 8 || prof > 6 || !v || typeof v !== 'object') return;
    if (Array.isArray(v)) { v.forEach((x) => recorrer(x, prof + 1)); return; }
    const titulo = v.titulo || v.title || v.nombre;
    const valor = v.valor ?? v.value;
    if (titulo && (typeof valor === 'number' || typeof valor === 'string')) fila(titulo, valor, v.unidad || v.unit);
    Object.values(v).forEach((x) => recorrer(x, prof + 1));
  };
  if (!filas.length) recorrer(datos);
  // 3) Campos numéricos sueltos (hasta dos niveles), con nombre legible.
  if (!filas.length && datos && typeof datos === 'object') {
    const campos = (o, prefijo, prof) => {
      Object.entries(o || {}).forEach(([c, v]) => {
        const ruta = prefijo ? `${prefijo}.${c}` : c;
        if (CAMPOS_FUERA.test(ruta)) return;
        if (typeof v === 'number' && Number.isFinite(v)) fila(legible(ruta), v);
        else if (v && typeof v === 'object' && !Array.isArray(v) && prof < 1) campos(v, ruta, prof + 1);
      });
    };
    campos(datos.datos && typeof datos.datos === 'object' ? datos.datos : datos, '', 0);
  }
  const encabezado = `**Respuesta simulada** (la IA está en modo simulador, sin modelo): esto es lo que trae «${herramienta}».`;
  return filas.length ? `${encabezado}\n\n${filas.join('\n')}` : `${encabezado} No encontré indicadores con valor para resumir.`;
}

class SimuladorAdapter {
  constructor() {
    this.nombre = 'simulador';
  }

  async conversar({ modelo, mensajes = [], herramientas = [], eleccion = 'any', contexto = {} }) {
    const uso = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 };
    const resultados = mensajes.flatMap((m) => (Array.isArray(m.content) ? m.content : [])).filter((c) => c.type === 'tool_result');
    const elegida = contexto.simulacion?.herramienta ? null : herramientaPorPestana(mensajes);
    const herramienta = contexto.simulacion?.herramienta || elegida?.nombre || 'foto_operativa';
    const entrada = contexto.simulacion?.entrada || elegida?.entrada || {};
    if (!resultados.length && eleccion === 'any' && herramientas.some((h) => h.name === herramienta)) {
      return {
        contenido: [{ type: 'tool_use', id: 'sim-1', name: herramienta, input: entrada }],
        modelo: `simulador (${modelo})`, stopReason: 'tool_use', uso,
      };
    }
    const ultimo = resultados[resultados.length - 1];
    const texto = typeof ultimo?.content === 'string' ? ultimo.content : JSON.stringify(ultimo?.content || '');
    return {
      contenido: [{
        type: 'tool_use', id: 'sim-2', name: 'responder',
        input: {
          respuesta: contexto.simulacion?.respuesta || respuestaSimulada(herramienta, texto),
          fuentes: [{ herramienta, detalle: 'simulador' }], sugerencias: [], sinDatos: !ultimo, fueraDeAlcance: false,
        },
      }],
      modelo: `simulador (${modelo})`, stopReason: 'tool_use', uso,
    };
  }

  async generar({ modelo, herramienta, contexto = {} }) {
    if (herramienta?.name === 'clasificar_pregunta') {
      return {
        toolInput: contexto.clasificacion || { decision: 'dentro', tema: 'ninguno', confianza: 0.5, motivo: 'simulador' },
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
    // CC-283: prevención y «¿Por qué?»: la versión automática que calculó el servicio
    if (['emitir_recomendacion', 'emitir_explicacion'].includes(herramienta?.name) && contexto.automatica) {
      const a = contexto.automatica;
      return {
        toolInput: { ...a, resumen: `Simulador: ${a.resumen}`.slice(0, 400) },
        toolUseId: 'simulador', modelo: `simulador (${modelo})`, stopReason: 'tool_use', uso: { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 },
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
module.exports.respuestaSimulada = respuestaSimulada;   // CC-288 (pruebas)
