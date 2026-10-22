/*
    Author: German Valencia
    Salas de Socket.IO: convención única de nombres para segmentar el tiempo real.
      - SALA_OPERACION: clientes autorizados a recibir datos operativos (radar AIS, crons...).
      - puerto:{PUERTO}:{modulo}: datos de un módulo para un puerto (ej. puerto:BUENAVENTURA:gnl).
*/
const SALA_OPERACION = 'operacion';
const MODULOS = ['gnl', 'mapa', 'gate', 'maritimo', 'bodegas', 'contenedores', 'granel', 'suelta', 'capacidad', 'noticias'];
const PATRON_SALA_PUERTO = new RegExp(`^puerto:[A-Z0-9_]{2,40}:(${MODULOS.join('|')})$`);

/** "Buenaventura " → "BUENAVENTURA"; "Santa Marta" → "SANTA_MARTA" */
function normalizarPuerto(puerto) {
  return String(puerto || '')
    .normalize('NFD').replace(/[̀-ͯ]/g, '')
    .trim().toUpperCase()
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

function salaPuerto(puerto, modulo) {
  return `puerto:${normalizarPuerto(puerto)}:${modulo}`;
}

function esSalaValida(sala) {
  return typeof sala === 'string' && PATRON_SALA_PUERTO.test(sala);
}

module.exports = { SALA_OPERACION, MODULOS, normalizarPuerto, salaPuerto, esSalaValida };
