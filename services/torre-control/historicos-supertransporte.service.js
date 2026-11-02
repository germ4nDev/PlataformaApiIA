/*
    Author: German Valencia
    Pattern: PORTTOS Service - Sincronización de históricos de Supertransporte (proceso 'historicos-supertransporte', diario)
    Description: Trae de datos.gov.co (Supertransporte, conjunto 5r3g-zv5z) las toneladas mensuales por tipo de carga de cada
      puerto activo desde hace ANIOS años y las guarda en TCL_HistoricosSupertransporte con fuente 'SUPERTRANSPORTE'.
      Es dato real oficial (decisión del usuario 2026-10-29, OT-009): alimenta los históricos mensuales de Granel y Carga
      suelta. La zona de cada puerto sale del maestro (migración 024). Un puerto que falla no detiene a los demás.
*/
const Supertransporte = require('../../adapters/supertransporte.adapter');
const HistoricosRepository = require('../../repositories/torre-control/historicos-supertransporte.repository');
const { filasHistorico } = require('../../utils/supertransporte');

const ANIOS = 3;

class HistoricosSupertransporteService {
  constructor({ fuente = Supertransporte, repositorio = HistoricosRepository } = {}) {
    Object.assign(this, { fuente, repositorio });
  }

  /** Sincroniza todos los puertos. Devuelve { filas, puertos: { idPuerto: n | 'error: …' } }. */
  async sincronizar(ahora = new Date()) {
    const desde = ahora.getUTCFullYear() - ANIOS;
    const resultado = { filas: 0, puertos: {} };
    for (const p of await this.repositorio.zonasPuertos()) {
      try {
        const filas = filasHistorico(await this.fuente.mensualPorZona(p.zona, desde), p);
        // La fuente respondió vacío: se deja lo que había (no se borra un histórico por una respuesta vacía)
        resultado.puertos[p.idPuerto] = filas.length ? await this.repositorio.reemplazarPuerto(p.idPuerto, filas, ahora.toISOString()) : 0;
        resultado.filas += filas.length;
      } catch (error) {
        resultado.puertos[p.idPuerto] = `error: ${error.message}`;
      }
    }
    return resultado;
  }
}

module.exports = new HistoricosSupertransporteService();
module.exports.HistoricosSupertransporteService = HistoricosSupertransporteService;
