/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Joi Validation & Handlebars
*/
const EmailService = require('../services/email.service');
const Joi = require('joi');

// Mantenemos el esquema esperando lo que Angular ya te envía
const EmailSchema = Joi.object({
  correo: Joi.string().email().required()
    .messages({
      'any.required': 'El correo electrónico es obligatorio.',
      'string.email': 'El formato del correo electrónico no es válido.'
    }),
  clave: Joi.string().required()
    .messages({
      'any.required': 'La clave plana es obligatoria para enviar el correo.'
    })
});

const enviarClave = async (req, res) => {
  try {
    const { error, value } = EmailSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        ok: false,
        msg: 'Error de validación en los datos del correo.',
        errores: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
      });
    }

    const resultado = await EmailService.despacharCorreo(
      value.correo,
      'NUEVA_CLAVE',
      {
        nombre: 'Usuario',
        clave: value.clave
      }
    );

    return res.status(200).json({
      ok: true,
      msg: 'Correo de nueva clave enviado con éxito.',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en EmailController.enviarClave:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Ocurrió un error interno al intentar enviar el correo.',
      error: error.message || error
    });
  }
};

const enviarNuevaClave = async (req, res) => {
  try {
    const { error, value } = EmailSchema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      return res.status(400).json({
        ok: false,
        msg: 'Error de validación en los datos del correo.',
        errores: error.details.map(d => ({ campo: d.context.key, mensaje: d.message }))
      });
    }

    const resultado = await EmailService.despacharCorreo(
      value.correo,
      'CAMBIO_CLAVE',
      {
        nombre: 'Usuario',
        clave: value.clave
      }
    );

    return res.status(200).json({
      ok: true,
      msg: 'Correo de nueva clave enviado con éxito.',
      data: resultado
    });

  } catch (error) {
    console.error('❌ Error en EmailController.enviarClave:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Ocurrió un error interno al intentar enviar el correo.',
      error: error.message || error
    });
  }
};

module.exports = {
  enviarClave,
  enviarNuevaClave
};