/*
    Author: German Valencia
    Configuración de las notificaciones push de la app móvil (fase 3). Se envían con Firebase Cloud Messaging
    (FCM HTTP v1): Android directo y iOS a través de Firebase con la llave APNs cargada en la consola de Firebase.
      PUSH_ENABLED        true | false (por defecto false)
      FCM_PROJECT_ID      id del proyecto de Firebase
      FCM_CLIENT_EMAIL    correo de la cuenta de servicio
      FCM_PRIVATE_KEY     llave privada de la cuenta de servicio (con \n escritos como \\n en el .env)
      PUSH_MAX_POR_TURNO  tope de alertas por notificación individual; más que eso van en un solo resumen (3)
    Nunca se imprimen los valores: estado() solo dice si cada llave está presente.
*/
const bool = (v, d = false) => (v === undefined || v === null || v === '' ? d : /^(1|true|si|sí|on)$/i.test(String(v).trim()));
const entero = (v, d) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Math.floor(Number(v)) : d);

function leerConfigPush(env = process.env) {
  const llave = String(env.FCM_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  return Object.freeze({
    habilitado: bool(env.PUSH_ENABLED, false),
    proyecto: String(env.FCM_PROJECT_ID || '').trim(),
    correo: String(env.FCM_CLIENT_EMAIL || '').trim(),
    llave,
    maxPorTurno: entero(env.PUSH_MAX_POR_TURNO, 3),
    get configurado() { return !!(this.proyecto && this.correo && this.llave); },
  });
}

/** Estado sin secretos (para el endpoint de estado). */
const estadoPush = (c) => ({
  habilitado: c.habilitado,
  configurado: c.configurado,
  llaves: { FCM_PROJECT_ID: !!c.proyecto, FCM_CLIENT_EMAIL: !!c.correo, FCM_PRIVATE_KEY: !!c.llave },
});

const configPush = leerConfigPush();

module.exports = { leerConfigPush, estadoPush, configPush };
