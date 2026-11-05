/*
    Author: German Valencia
    Pattern: PORTTOS Adapter - Envío de correo por SMTP (portal, 2026-10-30)
    Description: Correo de texto plano o HTML con nodemailer (también lo usa services/email.service, 2026-11-05). Toda la configuración sale del .env (nunca del código):
      SMTP_HOST, SMTP_PORT (587 por defecto), SMTP_SECURE ('true' para 465), SMTP_USER, SMTP_PWD, SMTP_FROM.
      Sin SMTP_HOST no envía nada: configurado() = false y enviar() responde { enviado: false, razon }.
      No escribe en la base (regla de adaptadores).
*/
const nodemailer = require('nodemailer');

let transporte = null;

const configurado = () => Boolean(process.env.SMTP_HOST && process.env.SMTP_FROM);

function obtenerTransporte() {
  if (transporte) return transporte;
  transporte = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: parseInt(process.env.SMTP_PORT, 10) || 587,
    secure: process.env.SMTP_SECURE === 'true',
    auth: process.env.SMTP_USER ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PWD } : undefined,
  });
  return transporte;
}

/** @param {{ para: string, asunto: string, texto?: string, html?: string, responderA?: string }} c */
async function enviar({ para, asunto, texto, html, responderA }) {
  if (!configurado()) return { enviado: false, razon: 'SMTP sin configurar (SMTP_HOST / SMTP_FROM en el .env)' };
  await obtenerTransporte().sendMail({ from: process.env.SMTP_FROM, to: para, subject: asunto, text: texto, html, replyTo: responderA });
  return { enviado: true, razon: null };
}

module.exports = { configurado, enviar };
