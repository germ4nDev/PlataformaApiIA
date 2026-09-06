const nodemailer = require('nodemailer');
const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');

class EmailService {
  constructor() {
    this.transporter = nodemailer.createTransport({
      service: 'gmail',
      auth: {
        user: 'g3rman.dev3loper@gmail.com',
        pass: 'vcprvrzjfhwfzsxv'
      }
    });
  }

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

      return await this.transporter.sendMail({
        from: '"Plataforma 2.0" <g3rman.dev3loper@gmail.com>',
        to: destinatario,
        subject: asunto,
        html: htmlFinal
      });

    } catch (error) {
      console.error(`Error al procesar la plantilla ${nombreArchivoTemplate}:`, error);
      throw error;
    }
  }
}

module.exports = new EmailService();