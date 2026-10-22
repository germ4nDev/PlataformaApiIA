/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Contexto de puerto para los tableros por pestaña
    Description: De lo que manda el front ('BUENAVENTURA', 'Santa Marta') a { clave, idPuerto, nombre }:
      clave = normalizarPuerto (salas de socket, alertas); idPuerto = TCL_MaestroPuertos.id_puerto (tablas TCL_*).
      Caché de 5 minutos. Puerto inexistente → 404.
*/
const MaritimoVivoRepository = require('../repositories/torre-control/maritimo-vivo.repository');
const { normalizarPuerto } = require('./salas.helper');
const { noEncontrado } = require('./errores.helper');

const CACHE_MS = 5 * 60 * 1000;
const cache = new Map();

async function contextoPuerto(puerto) {
  const clave = normalizarPuerto(puerto || '');
  if (!clave) throw noEncontrado('Falta el puerto');
  const enCache = cache.get(clave);
  if (enCache && enCache.hasta > Date.now()) return enCache.valor;
  const fila = await MaritimoVivoRepository.buscarPuerto(clave);
  if (!fila) throw noEncontrado(`No existe el puerto ${clave}`);
  const valor = { clave, idPuerto: String(fila.idPuerto), nombre: fila.nombre || clave };
  cache.set(clave, { valor, hasta: Date.now() + CACHE_MS });
  return valor;
}

module.exports = { contextoPuerto };
