const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

const correo = require('../adapters/correo.adapter');

/*
    Correos de clave (NUEVA_CLAVE, CAMBIO_CLAVE) con plantilla Handlebars.
    El envío va por adapters/correo.adapter: servidor, cuenta, clave y remitente salen del .env (SMTP_*), nunca del código
    (2026-11-05; antes la cuenta y la clave estaban escritas aquí).
*/
class EmailService {
  async despacharCorreo(destinatario, tipoCorreo, datos) {
    let asunto = '';
    let nombreArchivoTemplate = '';

    switch (tipoCorreo) {
      case 'NUEVA_CLAVE':
        asunto = 'Tu nueva clave de acceso';
        nombreArchivoTemplate = 'nueva-clave.hbs';
        break;
      case 'CAMBIO_CLAVE':
        asunto = 'Cambio de clave de acceso';
        nombreArchivoTemplate = 'cambio-clave.hbs';
        break;
      default:
        throw new Error('Tipo de correo no soportado por el sistema');
    }

    const rutaTemplate = path.join(__dirname, '../templates/emails', nombreArchivoTemplate);

    try {
      const archivoHtml = await fs.readFile(rutaTemplate, 'utf-8');
      const templateCompilado = handlebars.compile(archivoHtml);
      const htmlFinal = templateCompilado(datos);

      if (!correo.configurado()) {
        throw new Error('El envío de correo no está configurado (SMTP_HOST / SMTP_FROM en el .env).');
      }
      return await correo.enviar({ para: destinatario, asunto, html: htmlFinal });

    } catch (error) {
      console.error(`Error al procesar la plantilla ${nombreArchivoTemplate}:`, error);
      throw error;
    }
  }
}

module.exports = new EmailService();