/*
    OT-030: aplica los scripts nuevos de database/suscriptores/<PREFIJO>/ a todas las bases de suscriptor ya creadas (estado LISTA).
    Uso (con el .env del API): node scripts/aprovisionar-actualizar.js
*/
require('dotenv').config();
const Servicio = require('../services/plataforma/aprovisionamiento.service');

Servicio.actualizarTodas()
  .then((r) => {
    console.log(`Bases revisadas: ${r.revisadas}. Con error: ${r.conError.length ? r.conError.join(', ') : 'ninguna'}.`);
    process.exit(r.conError.length ? 1 : 0);
  })
  .catch((e) => { console.error('No se pudo actualizar:', e?.message || e); process.exit(1); });
