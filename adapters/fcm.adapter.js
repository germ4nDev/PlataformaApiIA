/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Firebase Cloud Messaging (HTTP v1)
    Description: Envía una notificación a un token. Obtiene el token de acceso OAuth2 de la cuenta de servicio
      (google-auth-library, alcance firebase.messaging) y lo reutiliza hasta 1 minuto antes de vencer.
        enviar(config, { token, titulo, cuerpo, datos, plataforma }) → { ok, tokenInvalido?, error? }
      Un token que FCM ya no reconoce (UNREGISTERED / INVALID_ARGUMENT del token) vuelve con tokenInvalido = true,
      para que el servicio lo desactive. No escribe en la base.
*/
const axios = require('axios');
const { JWT } = require('google-auth-library');

const ALCANCE = 'https://www.googleapis.com/auth/firebase.messaging';
const TIEMPO_MS = 10000;

let acceso = { token: null, vence: 0, llave: '' };

async function tokenAcceso(config) {
  const llave = `${config.proyecto}|${config.correo}`;
  if (acceso.token && acceso.llave === llave && Date.now() < acceso.vence - 60000) return acceso.token;
  const cliente = new JWT({ email: config.correo, key: config.llave, scopes: [ALCANCE] });
  const r = await cliente.authorize();
  acceso = { token: r.access_token, vence: r.expiry_date || Date.now() + 50 * 60000, llave };
  return acceso.token;
}

/** Los datos de FCM deben ser texto. */
const comoTexto = (datos = {}) => Object.fromEntries(Object.entries(datos).filter(([, v]) => v !== undefined && v !== null).map(([k, v]) => [k, String(v)]));

async function enviar(config, { token, titulo, cuerpo, datos = {}, plataforma = 'android' }) {
  if (!config?.configurado) return { ok: false, error: 'FCM sin configurar' };
  try {
    const bearer = await tokenAcceso(config);
    const message = {
      token,
      notification: { title: String(titulo).slice(0, 120), body: String(cuerpo).slice(0, 400) },
      data: comoTexto(datos),
      android: { priority: 'HIGH', notification: { channel_id: 'alertas-ia', color: '#346BA6' } },
      apns: { payload: { aps: { sound: 'default' } } },
    };
    if (plataforma === 'ios') delete message.android;
    await axios.post(`https://fcm.googleapis.com/v1/projects/${encodeURIComponent(config.proyecto)}/messages:send`, { message }, {
      headers: { Authorization: `Bearer ${bearer}` }, timeout: TIEMPO_MS,
    });
    return { ok: true };
  } catch (error) {
    const det = error?.response?.data?.error;
    const codigo = det?.details?.find?.((d) => d.errorCode)?.errorCode || det?.status || '';
    const tokenInvalido = ['UNREGISTERED', 'INVALID_ARGUMENT'].includes(codigo) && /token/i.test(det?.message || 'token');
    return { ok: false, tokenInvalido, error: String(det?.message || error?.message || 'error FCM').slice(0, 300) };
  }
}

module.exports = { enviar };
