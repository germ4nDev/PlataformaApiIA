/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Aprovisionamiento de bases por suscriptor (OT-030)
    Description: Lo que vive en plataformaBD (PTL_Aprovisionamientos, PTL_ConexionesBD, aplicaciones del paquete) y lo que se hace en el
    servidor SQL (crear la base, correr un lote en ella). La conexión a la base del suscriptor usa APROV_DB_SERVER/PORT/USER/PWD si están,
    si no las mismas DB_* del API (ese usuario necesita CREATE DATABASE). Nunca se imprimen ni se guardan credenciales.
      aplicacionesDePaquete(codigoPaquete)    [{ codigoAplicacion, nombreAplicacion, prefijoBD }] de los módulos activos del paquete
      filas({ codigoSuscriptor? })            filas de PTL_Aprovisionamientos
      registrar(f)                            crea la fila PENDIENTE si no existe (suscriptor + aplicación); devuelve la fila
      marcar(codigo, cambios)                 estado, mensaje, version, intentos
      existeBD(nombre) / crearBD(nombre)      en el servidor (QUOTENAME)
      versionesAplicadas(nombre)              versiones en dbo.EsquemaVersiones de esa base ([] si no existe la tabla)
      ejecutar(nombre, lotes)                 corre los lotes en la base del suscriptor, en una transacción
      registrarConexion(f)                    PTL_ConexionesBD (sin usuario ni clave: usa las credenciales del API)
*/
const { QueryTypes, Sequelize } = require('sequelize');
const { db } = require('../../database/connection');

const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const ejecutarPrincipal = (sql, replacements = {}) => db.sequelize.query(sql, { replacements });

const aplicacionesDePaquete = (codigoPaquete) => q(`SELECT DISTINCT a.codigoAplicacion, a.nombreAplicacion, a.prefijoBD
  FROM dbo.PTL_ModulosPQ m INNER JOIN dbo.PTL_Aplicaciones a ON a.codigoAplicacion = m.codigoAplicacion
  WHERE m.codigoPaquete = :codigoPaquete AND COALESCE(m.estadoModuloPQ, 1) = 1 AND COALESCE(a.estadoAplicacion, 1) = 1`, { codigoPaquete });

const filas = ({ codigoSuscriptor = '' } = {}) => q(`SELECT p.*, a.nombreAplicacion, a.prefijoBD
  FROM dbo.PTL_Aprovisionamientos p LEFT JOIN dbo.PTL_Aplicaciones a ON a.codigoAplicacion = p.codigoAplicacion
  WHERE (:codigoSuscriptor = '' OR p.codigoSuscriptor = :codigoSuscriptor)
  ORDER BY p.fechaCreacion`, { codigoSuscriptor });

async function registrar({ codigoSuscriptor, codigoAplicacion, codigoPaquete, nombreBD }) {
  await ejecutarPrincipal(`IF NOT EXISTS (SELECT 1 FROM dbo.PTL_Aprovisionamientos WHERE codigoSuscriptor = :codigoSuscriptor AND codigoAplicacion = :codigoAplicacion)
    INSERT INTO dbo.PTL_Aprovisionamientos (codigoAprovisionamiento, codigoSuscriptor, codigoAplicacion, codigoPaquete, nombreBD, version, estado, mensaje, intentos)
    VALUES (LOWER(CONVERT(NVARCHAR(36), NEWID())), :codigoSuscriptor, :codigoAplicacion, :codigoPaquete, :nombreBD, 0, N'PENDIENTE', NULL, 0)`,
  { codigoSuscriptor, codigoAplicacion, codigoPaquete, nombreBD });
  const [f] = await q('SELECT * FROM dbo.PTL_Aprovisionamientos WHERE codigoSuscriptor = :codigoSuscriptor AND codigoAplicacion = :codigoAplicacion',
    { codigoSuscriptor, codigoAplicacion });
  return f || null;
}

const marcar = (codigoAprovisionamiento, { estado, mensaje = null, version = null, sumarIntento = false }) => ejecutarPrincipal(`
  UPDATE dbo.PTL_Aprovisionamientos SET estado = :estado, mensaje = :mensaje, version = COALESCE(:version, version),
    intentos = intentos + :sumar, fechaModificacion = SYSUTCDATETIME()
  WHERE codigoAprovisionamiento = :codigoAprovisionamiento`,
{ codigoAprovisionamiento, estado, mensaje: mensaje ? String(mensaje).slice(0, 2000) : null, version, sumar: sumarIntento ? 1 : 0 });

async function existeBD(nombre) {
  const [f] = await q('SELECT name FROM sys.databases WHERE name = :nombre', { nombre });
  return !!f;
}

// nombre ya validado por el núcleo; QUOTENAME por si acaso. CREATE DATABASE no va dentro de una transacción.
const crearBD = (nombre) => ejecutarPrincipal(`DECLARE @sql NVARCHAR(400) = N'CREATE DATABASE ' + QUOTENAME(:nombre); EXEC (@sql);`, { nombre });

function conexionSuscriptor(nombre) {
  const e = process.env;
  return new Sequelize(nombre, e.APROV_DB_USER || e.DB_USER, e.APROV_DB_PWD || e.DB_PWD, {
    host: e.APROV_DB_SERVER || e.DB_SERVER, port: e.APROV_DB_PORT || e.DB_PORT, dialect: 'mssql', logging: false,
    pool: { max: 1, min: 0, idle: 5000 },
    dialectOptions: { options: { requestTimeout: 120000, encrypt: false, trustServerCertificate: true } },
  });
}

async function versionesAplicadas(nombre) {
  const s = conexionSuscriptor(nombre);
  try {
    const filasV = await s.query(`IF OBJECT_ID(N'dbo.EsquemaVersiones') IS NULL SELECT CAST(NULL AS INT) AS version WHERE 1 = 0
      ELSE SELECT version FROM dbo.EsquemaVersiones`, { type: QueryTypes.SELECT });
    return filasV.map((f) => Number(f.version));
  } finally { await s.close(); }
}

async function ejecutar(nombre, lotes) {
  const s = conexionSuscriptor(nombre);
  try {
    await s.transaction(async (transaction) => { for (const sql of lotes) await s.query(sql, { transaction }); });
  } finally { await s.close(); }
}

const registrarConexion = ({ codigoSuscriptor, codigoAplicacion, codigoPaquete, nombreBD, nombreAplicacion }) => ejecutarPrincipal(`
  IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ConexionesBD WHERE codigoSuscriptor = :codigoSuscriptor AND codigoAplicacion = :codigoAplicacion AND BDNombre = :nombreBD)
  INSERT INTO dbo.PTL_ConexionesBD (codigoConexion, codigoSuscriptor, codigoServidor, codigoPaquete, codigoAplicacion, nombreConexion, nombreServidor,
    BDNombre, BDUser, BDPassword, BDPort, descripcionConexion, estadoConexion, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (LOWER(CONVERT(NVARCHAR(36), NEWID())), :codigoSuscriptor, N'', :codigoPaquete, :codigoAplicacion, :nombreConexion, N'API',
    :nombreBD, N'(credenciales del API)', N'', 0, N'OT-030 · Base del suscriptor creada por el aprovisionamiento; se conecta con las credenciales del API.', 1,
    N'APROVISIONAMIENTO', CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), N'APROVISIONAMIENTO', CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126))`,
{ codigoSuscriptor, codigoAplicacion, codigoPaquete: codigoPaquete || '', nombreBD, nombreConexion: `${nombreAplicacion || codigoAplicacion} · ${nombreBD}`.slice(0, 200) });

module.exports = { aplicacionesDePaquete, filas, registrar, marcar, existeBD, crearBD, versionesAplicadas, ejecutar, registrarConexion };
