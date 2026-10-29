/*
    Author: German Valencia
    Pattern: PORTTOS Service - Tendencias de 24 h, 7 días y 30 días por puerto (capa de IA, fase 4)
    Description: Sin modelo y sin costo. Lee los promedios por hora (14 días) y por día (60 días) de las fotos de
      KPI y calcula las tendencias con utils/ia/tendencias. Caché de 10 min por puerto (las fotos son cada 15 min).
      - tendencias(params, query)   GET /api/analisis-ia/:puerto/tendencias?ventana=&modulo=&relevantes=
      - paraPuerto(clave, ahora)    lo mismo, para los resúmenes
      La IA no calcula nada aquí: en el resumen elige cuáles importan y las explica.
*/
const SnapshotsRepo = require('../../repositories/ia/snapshots-kpi.repository');
const PuertosIA = require('./puertos-ia.service');
const { validarCon } = require('../../helpers/errores.helper');
const { PuertoParamsSchema, TendenciasQuerySchema } = require('../../models/ia/analisis-ia.model');
const { calcularTendencias, destacadas, VENTANAS, CODIGOS_VENTANA } = require('../../utils/ia/tendencias');

const DIA = 86400000;
const TTL_MS = 10 * 60 * 1000;

class TendenciasIAService {
  constructor({ snapshots = SnapshotsRepo, puertos = PuertosIA } = {}) {
    Object.assign(this, { snapshots, puertos });
    this.cache = new Map();   // puerto → { hasta, valor }
  }

  async paraPuerto(clave, ahora = new Date()) {
    const enCache = this.cache.get(clave);
    if (enCache && enCache.hasta > ahora.getTime()) return enCache.valor;
    const [hora, dia] = await Promise.all([
      this.snapshots.agregados(clave, new Date(ahora.getTime() - 15 * DIA).toISOString(), 'hora'),
      this.snapshots.agregados(clave, new Date(ahora.getTime() - 61 * DIA).toISOString(), 'dia'),
    ]);
    const kpis = calcularTendencias({ hora, dia }, ahora);
    const valor = {
      puerto: clave, generadoEn: ahora.toISOString(), disponible: true,
      ventanas: CODIGOS_VENTANA.map((c) => ({ codigo: c, nombre: VENTANAS[c].nombre, contra: VENTANAS[c].contra })),
      conDatos: kpis.filter((k) => Object.values(k.ventanas).some((t) => t.direccion !== 'sin_datos')).length,
      kpis, destacadas: destacadas(kpis, 10),
    };
    this.cache.set(clave, { hasta: ahora.getTime() + TTL_MS, valor });
    return valor;
  }

  async tendencias(params, query = {}, ahora = new Date()) {
    const { puerto } = validarCon(PuertoParamsSchema, params);
    const { ventana, modulo, relevantes } = validarCon(TendenciasQuerySchema, query);
    const { clave, nombre } = await this.puertos.resolver(puerto);
    let datos;
    try {
      datos = await this.paraPuerto(clave, ahora);
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') throw error;
      return { puerto: clave, nombre, generadoEn: ahora.toISOString(), disponible: false, motivo: 'Falta la migración 015', ventanas: [], kpis: [], destacadas: [] };
    }
    const modulos = modulo ? modulo.split(',').map((m) => m.trim().toLowerCase()).filter(Boolean) : null;
    let kpis = datos.kpis.filter((k) => !modulos || modulos.includes(k.modulo));
    if (ventana) kpis = kpis.map((k) => ({ ...k, ventanas: { [ventana]: k.ventanas[ventana] } }));
    if (relevantes) kpis = kpis.filter((k) => Object.values(k.ventanas).some((t) => t.relevante));
    const dest = destacadas(datos.kpis.filter((k) => !modulos || modulos.includes(k.modulo)), 10, ventana ? [ventana] : CODIGOS_VENTANA);
    return { ...datos, nombre: nombre || clave, kpis, destacadas: dest };
  }

  limpiarCache() {
    this.cache.clear();
  }
}

module.exports = new TendenciasIAService();
module.exports.TendenciasIAService = TendenciasIAService;
