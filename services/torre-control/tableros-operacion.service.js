/*
    Author: German Valencia
    Pattern: PORTTOS Service - Tableros de Granel, Carga suelta y Capacidad (pestañas TLC_GRANEL_001, TLC_SUELTA_001,
      TLC_CAPACIDAD_001)
    Description: Orquesta repositorios y núcleos puros; una respuesta por pestaña y puerto (el front la comparte entre
      todos los widgets de la pestaña con shareReplay).
        granel(puerto)       → utils/granel.js
        cargaSuelta(puerto)  → utils/carga-suelta.js
        capacidad(puerto)    → utils/capacidad.js
      Los datos llegan por la ingesta de operación (terminales) o, mientras tanto, por el simulador (marcados simulado).
*/
const OperacionRepository = require('../../repositories/torre-control/operacion-portuaria.repository');
const CapacidadRepository = require('../../repositories/torre-control/capacidad.repository');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { armarGranel } = require('../../utils/granel');
const { armarCargaSuelta } = require('../../utils/carga-suelta');
const { armarCapacidad, categoriaBodega } = require('../../utils/capacidad');

const H24 = 24 * 3600000;
const iso = (ms) => new Date(ms).toISOString();
const ANIOS_HISTORICO = 2;

class TablerosOperacionService {
  constructor({ operacion = OperacionRepository, capacidad = CapacidadRepository, contexto = contextoPuerto } = {}) {
    Object.assign(this, { operacion, capacidadRepo: capacidad, contexto });
  }

  async granel(puerto, ahora = new Date()) {
    const p = await this.contexto(puerto);
    const hace24 = iso(ahora.getTime() - H24);
    const [operaciones, avance, equipos, bodegas, historico] = await Promise.all([
      this.operacion.operaciones(p.idPuerto, 'GRANEL', hace24),
      this.operacion.avance(p.idPuerto, 'GRANEL', hace24),
      this.operacion.equipos(p.idPuerto, ['GRANEL', 'MULTI']),
      this.capacidadRepo.bodegas(p.idPuerto, p.clave),
      this.operacion.historico(p.nombre, ahora.getUTCFullYear() - ANIOS_HISTORICO),
    ]);
    return armarGranel({
      operaciones, avance, equipos, historico, puerto: p.clave,
      bodegas: bodegas.filter((b) => categoriaBodega(b.tipo_carga_principal) === 'BODEGA_GRANEL'),
    }, ahora);
  }

  async cargaSuelta(puerto, ahora = new Date()) {
    const p = await this.contexto(puerto);
    const hace24 = iso(ahora.getTime() - H24);
    const [folios, roro, avanceRoro, vehiculos, patios, historico] = await Promise.all([
      this.operacion.folios(p.idPuerto, hace24),
      this.operacion.operaciones(p.idPuerto, 'RORO', hace24),
      this.operacion.avance(p.idPuerto, 'RORO', hace24),
      this.operacion.vehiculos(p.idPuerto),
      this.capacidadRepo.nodos(p.idPuerto, 'PATIO_PDI'),
      this.operacion.historico(p.nombre, ahora.getUTCFullYear() - ANIOS_HISTORICO),
    ]);
    return armarCargaSuelta({ folios, roro, avanceRoro, vehiculos, patios, historico, puerto: p.clave }, ahora);
  }

  async capacidad(puerto, ahora = new Date()) {
    const p = await this.contexto(puerto);
    const [nodos, bodegas, ocupaciones] = await Promise.all([
      this.capacidadRepo.nodos(p.idPuerto),
      this.capacidadRepo.bodegas(p.idPuerto, p.clave),
      this.capacidadRepo.ocupaciones(p.idPuerto, iso(ahora.getTime() - H24)),
    ]);
    return armarCapacidad({ nodos, bodegas, ocupaciones, puerto: p.clave }, ahora);
  }
}

module.exports = new TablerosOperacionService();
module.exports.TablerosOperacionService = TablerosOperacionService;
