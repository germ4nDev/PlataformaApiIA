/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Foto operativa de un puerto (fase 1)
    Description: Arma el JSON compacto que verá el analista IA (fase 2) y que hoy muestra el endpoint de diagnóstico.
      - Cada hecho lleva un idEvidencia estable: kpi.<codigo> · senal.<codigo>.<tipo> · alerta.<id> · evento.<codigo>.
      - Lo simulado o de respaldo viaja marcado por módulo y por KPI.
      - Sin datos personales: las placas se reemplazan por un alias estable (CAM-xxxx).
      - Los textos de fuentes externas (descripciones de TomTom) van en campos *Externa: son datos, no instrucciones.
      - hash: huella de los hechos (sin la hora de generación) para no llamar dos veces al modelo con la misma foto.
*/
const crypto = require('crypto');
const { POR_CODIGO, MODULOS, umbralesDe, idEvidenciaKpi } = require('./catalogo-kpi');

const PUNTOS_SERIE = 8;          // 2 h de fotos de 15 min
const MAX_ALERTAS = 10;
const MAX_EVENTOS = 15;
const PLACA = /\b([A-Z]{3})[\s-]?(\d{3}|\d{2}[A-Z])\b/g;

const alias = (texto) => `CAM-${crypto.createHash('sha1').update(texto).digest('hex').slice(0, 4).toUpperCase()}`;
/** Reemplaza placas colombianas (ABC123, ABC-123, ABC12D) por un alias estable. */
const seudonimizar = (texto) => (texto === null || texto === undefined ? texto : String(texto).replace(PLACA, (m, l, n) => alias(`${l}${n}`)));
const corto = (t, n) => (t ? String(t).slice(0, n) : null);
const horaColombia = (fecha) => new Date(fecha.getTime() - 5 * 3600000).toISOString().replace('T', ' ').slice(0, 16);

/**
 * @param {object} p
 * @param {string} p.puerto
 * @param {Array} p.actuales         filas de extraerKpis() de este ciclo
 * @param {Map<string, Array>} p.series  codigoKpi → serie ascendente (incluye la actual)
 * @param {Array} p.senales          evaluarSenales()
 * @param {Array} [p.alertas]        bitácora del mapa (más recientes primero)
 * @param {Array} [p.viales]         eventos viales vigentes del puerto
 * @param {Array<{modulo, error}>} [p.modulosFallidos]
 */
function armarFoto({ puerto, actuales = [], series = new Map(), senales = [], alertas = [], viales = [], modulosFallidos = [], ahora = new Date() }) {
  const modulos = {};
  MODULOS.forEach((modulo) => {
    const filas = actuales.filter((f) => f.modulo === modulo);
    if (!filas.length) return;
    modulos[modulo] = {
      simulado: filas.some((f) => f.simulado),
      esRespaldo: filas.some((f) => f.esRespaldo),
      kpis: filas.map((f) => {
        const def = POR_CODIGO.get(f.codigoKpi);
        const serie = (series.get(f.codigoKpi) || []).slice(-PUNTOS_SERIE).map((s) => (s.valor === null || s.valor === undefined ? null : Number(s.valor)));
        return {
          id: idEvidenciaKpi(f.codigoKpi), titulo: def?.titulo || f.codigoKpi, valor: f.valor, unidad: f.unidad,
          umbrales: umbralesDe(f.codigoKpi), serie, simulado: !!f.simulado,
        };
      }),
    };
  });

  const alertasFoto = alertas.slice(0, MAX_ALERTAS).map((a) => ({
    id: `alerta.${a.id}`, nivel: a.nivel, categoria: a.categoria, titulo: seudonimizar(a.titulo),
    mensaje: seudonimizar(corto(a.mensaje, 200)), fecha: a.fecha, simulado: !!a.simulado,
  }));
  const vialesFoto = viales.slice(0, MAX_EVENTOS).map((e) => ({
    id: `evento.${e.codigoEvento}`, tipo: e.tipoEvento, corredor: e.corredorVial, sector: corto(e.sector, 100),
    severidad: e.nivelSeveridad, desde: e.fechaInicio ? new Date(e.fechaInicio).toISOString() : null,
    descripcionExterna: corto(e.descripcion, 160),
  }));

  const hechos = {
    puerto,
    modulos,
    senales: senales.map((s) => ({ id: s.id, tipo: s.tipo, severidad: s.severidad, titulo: s.titulo, datos: s.datos, evidencia: s.evidencia, simulado: s.simulado })),
    eventos: { alertas: alertasFoto, viales: vialesFoto },
    calidad: {
      modulosSinDato: modulosFallidos.map((m) => ({ modulo: m.modulo, motivo: corto(m.error, 120) })),
      modulosSimulados: Object.entries(modulos).filter(([, m]) => m.simulado).map(([k]) => k),
    },
  };
  const evidencias = [
    ...Object.values(modulos).flatMap((m) => m.kpis.map((x) => x.id)),
    ...hechos.senales.map((s) => s.id), ...alertasFoto.map((a) => a.id), ...vialesFoto.map((e) => e.id),
  ];
  const hash = crypto.createHash('sha256').update(JSON.stringify(hechos)).digest('hex');
  return { ...hechos, generadoEn: ahora.toISOString(), horaColombia: horaColombia(ahora), evidencias, hash, bytes: Buffer.byteLength(JSON.stringify(hechos)) };
}

module.exports = { armarFoto, seudonimizar, PUNTOS_SERIE };
