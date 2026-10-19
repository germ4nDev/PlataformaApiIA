/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Operaciones de motonaves y homologación MMSI
    Description: Acceso a datos de TCL_MotonavesOperacion y TCL_HomologacionMMSI con sus modelos.
*/
const { sequelize } = require('../../database/connection');
const { MotonaveOperacionModel } = require('../../models/torre-control/motonave-operacion.model');
const { HomologacionMmsiModel } = require('../../models/torre-control/homologador-mmsi.model');

const Operacion = MotonaveOperacionModel(sequelize);
const Homologacion = HomologacionMmsiModel(sequelize);
const plano = (f) => (f && f.get ? f.get({ plain: true }) : f);

module.exports = {
  listar: (codigoTerminal = null) => Operacion.findAll({ raw: true, where: codigoTerminal ? { codigoTerminal } : {} }),
  crear: async (datos) => plano(await Operacion.create(datos)),
  /** Inserta o actualiza la vinculación aviso ↔ MMSI. Devuelve [registro, creado]. */
  vincularMmsi: async (datos) => {
    const [registro, creado] = await Homologacion.upsert(datos);
    return [plano(registro), creado];
  },
};
