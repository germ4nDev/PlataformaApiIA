/*
    Author: German Valencia
    Pattern: PORTTOS Config - Capa de análisis con IA
    Description: Interruptores y parámetros de la capa de IA, leídos del .env (se aplican al reiniciar el API).
      Diseño: documento «Porttos — Capa de análisis con IA».

      IA_ENABLED=false               Disparador del Analista IA: llamadas al modelo (Claude) para alertas
                                     tempranas, tendencias y resúmenes. Apagado por defecto. Fase 2 en adelante.
      IA_SNAPSHOTS_ENABLED=true      Fotos de KPI cada 15 min y señales deterministas (sin IA, sin costo).
                                     Son la historia que necesita el analista; conviene dejarlas encendidas.
      IA_PUERTOS=TODOS               TODOS = cada puerto del maestro con geocerca; o una lista: BUENAVENTURA,CARTAGENA.
      IA_RETENCION_DIAS=90           Días que se guardan las fotos de KPI.
      Analista de turno (fase 2):
      IA_PROVEEDOR=anthropic         anthropic | simulador (pruebas sin costo: arma alertas desde las señales).
      IA_MODELO_ANALISTA=claude-sonnet-5-5
      IA_MODO_SOMBRA=true            Guarda los hallazgos como PROPUESTO y no los publica (2 semanas de evaluación).
      IA_INTERVALO_MIN=15            Cada cuánto revisa si hay señales nuevas (el modelo solo se llama si las hay).
      IA_LATIDO_MIN=60               Llamada de control aunque no haya señales nuevas.
      IA_TOPE_LLAMADAS_DIA=96        Topes diarios POR PUERTO; al llegar se omiten las llamadas y se registra.
      IA_TOPE_TOKENS_DIA=1500000
      IA_CONFIANZA_MINIMA=0.6
      Publicación (fase 3):
      IA_MODO_SOMBRA=false           Publica en el mapa (categoría ia_temprana) las alertas que pasan la política.
      IA_TIPOS_PUBLICAR=TODOS        Tipos que se publican (los que pasaron el modo sombra), p. ej. saturacion_muelles,corredor_vial.
      Tendencias, resúmenes y administración (fase 4):
      IA_RESUMENES_ENABLED=true      Cierre de turno y resumen diario. Con IA_ENABLED=true los redacta el modelo; si está
                                     apagado, el modelo falla o se acaba el presupuesto, se arma uno automático (sin costo).
      IA_TURNOS=6,14,22              Horas (Colombia) en que cierra cada turno. El resumen diario sale con el primero
                                     y cubre el día operativo (de ese turno al mismo del día anterior).
      IA_MODELO_RESUMEN=claude-sonnet-5-5
      IA_PERMISO_ADMIN=              llavePermiso (PTLActividades) exigida en /api/analisis-ia/admin/*. Vacío = basta el JWT.
      Asistente para preguntas (fase 5):
      IA_ASISTENTE_ENABLED=true      Asistente de la plataforma (necesita IA_ENABLED=true). Solo responde dentro del marco de
                                     alcance (proceso logístico portuario y Porttos) y solo con sus herramientas de lectura.
      IA_MODELO_ASISTENTE=claude-sonnet-5-5
      IA_MODELO_FILTRO=claude-haiku-5-5   Clasificador de alcance (barato) para las preguntas que las reglas no deciden.
      IA_ASISTENTE_TOPE_USUARIO_DIA=60    Preguntas por usuario por día.
      Lo que se configura por puerto y tarea en TCL_IAConfig (panel de administración, migración 017) manda sobre
      el .env: encendido, modo sombra, topes, confianza mínima y tipos a publicar. IA_ENABLED sigue siendo el
      interruptor general: apagado, no se llama al modelo en ningún puerto.

    Nunca lee ni expone la llave del proveedor: eso es del adaptador.
*/

const bool = (valor, defecto) => {
  if (valor === undefined || valor === null || String(valor).trim() === '') return defecto;
  return ['1', 'true', 'si', 'sí', 'on', 'yes'].includes(String(valor).trim().toLowerCase());
};
const entero = (valor, defecto, min, max) => {
  const n = Number.parseInt(valor, 10);
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : defecto;
};
const lista = (valor, defecto) => {
  const items = String(valor || '').split(',').map((s) => s.trim().toUpperCase()).filter(Boolean);
  return items.length ? items : defecto;
};

/** Horas del día (0–23) sin repetir y en orden: '22, 6,14' → [6, 14, 22]. */
const horas = (valor, defecto) => {
  const h = [...new Set(String(valor || '').split(',').map((x) => Number.parseInt(x, 10)).filter((x) => Number.isInteger(x) && x >= 0 && x <= 23))];
  return h.length ? h.sort((a, b) => a - b) : defecto;
};

/** Configuración efectiva a partir de un objeto tipo process.env (inyectable en pruebas). */
function leerConfigIA(env = process.env) {
  return Object.freeze({
    habilitada: bool(env.IA_ENABLED, false),
    fotosHabilitadas: bool(env.IA_SNAPSHOTS_ENABLED, true),
    puertos: lista(env.IA_PUERTOS, ['TODOS']),
    retencionDias: entero(env.IA_RETENCION_DIAS, 90, 7, 730),
    intervaloFotosMin: 15,
    intervaloSenalesMin: 5,
    proveedor: ['anthropic', 'simulador'].includes(String(env.IA_PROVEEDOR || '').trim().toLowerCase())
      ? String(env.IA_PROVEEDOR).trim().toLowerCase() : 'anthropic',
    modeloAnalista: String(env.IA_MODELO_ANALISTA || '').trim() || 'claude-sonnet-5-5',
    modoSombra: bool(env.IA_MODO_SOMBRA, true),
    intervaloAnalistaMin: entero(env.IA_INTERVALO_MIN, 15, 5, 240),
    latidoMin: entero(env.IA_LATIDO_MIN, 60, 15, 1440),
    topeLlamadasDia: entero(env.IA_TOPE_LLAMADAS_DIA, 96, 1, 2000),
    topeTokensDia: entero(env.IA_TOPE_TOKENS_DIA, 1500000, 10000, 50000000),
    confianzaMinima: Math.min(1, Math.max(0, Number.parseFloat(env.IA_CONFIANZA_MINIMA) || 0.6)),
    tiposPublicar: String(env.IA_TIPOS_PUBLICAR || 'TODOS').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
    resumenesHabilitados: bool(env.IA_RESUMENES_ENABLED, true),
    turnos: horas(env.IA_TURNOS, [6, 14, 22]),
    modeloResumen: String(env.IA_MODELO_RESUMEN || '').trim() || 'claude-sonnet-5-5',
    permisoAdmin: String(env.IA_PERMISO_ADMIN || '').trim() || null,
    asistenteHabilitado: bool(env.IA_ASISTENTE_ENABLED, true),
    modeloAsistente: String(env.IA_MODELO_ASISTENTE || '').trim() || 'claude-sonnet-5-5',
    modeloFiltro: String(env.IA_MODELO_FILTRO || '').trim() || 'claude-haiku-5-5',
    topePreguntasUsuarioDia: entero(env.IA_ASISTENTE_TOPE_USUARIO_DIA, 60, 1, 1000),
  });
}

module.exports = { leerConfigIA, configIA: leerConfigIA() };
