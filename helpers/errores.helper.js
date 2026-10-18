/*
    Author: German Valencia
    Pattern: PORTTOS Helper - Errores HTTP uniformes
    Description: Un solo lugar para traducir errores a respuestas HTTP. Los servicios lanzan
      { statusCode, msg, codigo?, details? } (o un ValidationError de los DTO Joi) y el controlador
      responde con responderError(res, error, 'contexto').

    Respuesta de error: { ok:false, success:false, msg, message, codigo, errores? }
      (msg/ok es la convención de faros/usuarios; message/success la del tablero: se envían ambas
       para que ningún consumidor del front tenga que cambiar).
*/

const crearError = (statusCode, msg, codigo = 'ERROR', details) => ({ statusCode, msg, codigo, details });

const noEncontrado = (msg) => crearError(404, msg, 'NO_ENCONTRADO');
const migracionPendiente = (archivo) =>
  crearError(503, `Falta aplicar la migración ${archivo} en la base de datos`, 'MIGRACION_PENDIENTE');

/** Número de error de SQL Server, venga de tedious directo o envuelto por Sequelize. */
const numeroErrorSql = (error) =>
  error?.original?.number ?? error?.parent?.number ?? error?.number ?? null;

const esColumnaInexistente = (error) => numeroErrorSql(error) === 207;
const esTablaInexistente = (error) => numeroErrorSql(error) === 208;

function traducir(error) {
  if (!error) return crearError(500, 'Error interno');
  if (error.type === 'ValidationError') {
    return crearError(400, 'Solicitud inválida', 'VALIDACION', error.details);
  }
  if (error.statusCode) return crearError(error.statusCode, error.msg || error.message || 'Error', error.codigo, error.details);

  switch (numeroErrorSql(error)) {
    case 2627:
    case 2601: return crearError(409, 'Ya existe un registro con esa llave', 'DUPLICADO');
    case 547: return crearError(409, 'El registro está referenciado o referencia uno inexistente', 'REFERENCIA');
    case 207:
    case 208: return crearError(503, 'La base de datos no tiene una columna o tabla esperada (¿migración pendiente?)', 'MIGRACION_PENDIENTE');
    default: break;
  }
  if (error.name === 'SequelizeUniqueConstraintError') return crearError(409, 'Ya existe un registro con esa llave', 'DUPLICADO');
  if (error.name === 'SequelizeForeignKeyConstraintError') return crearError(409, 'Referencia inválida', 'REFERENCIA');
  return crearError(500, 'Error interno. Hable con el administrador', 'ERROR');
}

/**
 * Responde un error de forma uniforme. Los 5xx se registran completos en consola;
 * al cliente nunca se le envía el mensaje interno de la base de datos.
 */
function responderError(res, error, contexto = 'API') {
  const t = traducir(error);
  if (t.statusCode >= 500) console.error(`❌ [${contexto}]`, error?.message || error);
  return res.status(t.statusCode).json({
    ok: false,
    success: false,
    msg: t.msg,
    message: t.msg,
    codigo: t.codigo,
    ...(t.details ? { errores: t.details } : {}),
  });
}

/**
 * Valida con un esquema Joi y devuelve el valor limpio (con defaults y conversiones).
 * Lanza el mismo ValidationError que usan los DTO del proyecto.
 */
function validarCon(esquema, datos) {
  const { error, value } = esquema.validate(datos, { abortEarly: false, stripUnknown: true, convert: true });
  if (error) {
    throw {
      type: 'ValidationError',
      statusCode: 400,
      details: error.details.map((d) => ({ campo: d.path.join('.'), mensaje: d.message })),
    };
  }
  return value;
}

module.exports = {
  crearError, noEncontrado, migracionPendiente, numeroErrorSql, esColumnaInexistente, esTablaInexistente,
  traducir, responderError, validarCon,
};
