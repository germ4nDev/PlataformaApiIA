/*
    Author: German Valencia
    Autenticación para integraciones máquina a máquina (GPS, sensores, sistemas externos).
    El integrador envía el header x-api-key. Las claves válidas se definen en
    INGESTA_API_KEYS=clave1,clave2 (una por integrador, para poder revocarlas por separado).

    Si INGESTA_API_KEYS no está definida, el endpoint queda ABIERTO (modo transición) y se avisa en log.
*/
const crypto = require('crypto');

const clavesValidas = () => (process.env.INGESTA_API_KEYS || '')
  .split(',').map((c) => c.trim()).filter(Boolean);

const comparar = (a, b) => {
  const ba = Buffer.from(a), bb = Buffer.from(b);
  return ba.length === bb.length && crypto.timingSafeEqual(ba, bb);
};

let avisoMostrado = false;

function validarApiKeyIngesta(req, res, next) {
  const claves = clavesValidas();
  if (claves.length === 0) {
    if (!avisoMostrado) {
      console.warn('⚠️ [INGESTA] INGESTA_API_KEYS no definida: los endpoints de ingesta están abiertos (modo transición).');
      avisoMostrado = true;
    }
    return next();
  }

  const clave = req.header('x-api-key') || '';
  if (!claves.some((c) => comparar(c, clave))) {
    return res.status(401).json({ ok: false, msg: 'API key inválida o ausente' });
  }
  next();
}

/** Bloquea endpoints de simulación/diagnóstico en producción. */
function soloFueraDeProduccion(req, res, next) {
  if (process.env.NODE_ENV === 'production') {
    return res.status(404).json({ ok: false, msg: 'No disponible' });
  }
  next();
}

module.exports = { validarApiKeyIngesta, soloFueraDeProduccion };
