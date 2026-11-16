/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Administración de pestañas (PTL_Pestanas) y tipos de pestaña (PTL_TiposPestana), CC-203
      listar() / obtener(codigo) / crear(p, usuario) / modificar(codigo, p, usuario) / inactivar(codigo, usuario)
      suiteDeAplicacion(codigoSuite, codigoAplicacion)   ¿la suite es de esa aplicación?
      tipos: listarTipos() / obtenerTipo(codigo) / tipoPorEstrategia(estrategia) / crearTipo / modificarTipo / inactivarTipo
      pestanasDelTipo(codigoTipo)                          cuántas pestañas activas usan ese tipo
    Ícono y color (migración 020) son opcionales: sin las columnas se guarda lo demás. Las fechas de auditoría de estas tablas son
    texto ISO (así las escribe el resto de la plataforma). Retirar = estado 0; nunca se borra.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente } = require('../../helpers/errores.helper');

const q = (sql, replacements = {}, transaction) => db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT, transaction });
const ejecutar = (sql, replacements = {}, transaction) => db.sequelize.query(sql, { replacements, transaction });
const ahora = () => new Date().toISOString();
const BASE = 'codigoPestana, codigoTipoPestana, codigoAplicacion, codigoSuite, nombrePestana, orden, descripcion, estado';

async function conEstilo(sqlCon, sqlSin, rep) {
  try {
    return await q(sqlCon, rep);
  } catch (error) {
    if (!esColumnaInexistente(error)) throw error;
    return (await q(sqlSin, rep)).map((f) => ({ ...f, icono: null, color: null }));
  }
}

const listar = () => conEstilo(
  `SELECT ${BASE}, icono, color FROM dbo.PTL_Pestanas ORDER BY codigoAplicacion, codigoSuite, orden, nombrePestana`,
  `SELECT ${BASE} FROM dbo.PTL_Pestanas ORDER BY codigoAplicacion, codigoSuite, orden, nombrePestana`);

async function obtener(codigoPestana) {
  const [f] = await conEstilo(`SELECT ${BASE}, icono, color FROM dbo.PTL_Pestanas WHERE codigoPestana = :codigoPestana`,
    `SELECT ${BASE} FROM dbo.PTL_Pestanas WHERE codigoPestana = :codigoPestana`, { codigoPestana });
  return f || null;
}

async function guardarEstilo(p, transaction) {
  try {
    await ejecutar('UPDATE dbo.PTL_Pestanas SET icono = :icono, color = :color WHERE codigoPestana = :codigoPestana',
      { icono: p.icono, color: p.color, codigoPestana: p.codigoPestana }, transaction);
    return true;
  } catch (error) {
    if (esColumnaInexistente(error)) return false; // sin la 020: se guarda lo demás
    throw error;
  }
}

const datos = (p) => ({ ...p, estado: p.estado ? 1 : 0, descripcion: p.descripcion });

async function crear(p, usuario) {
  return db.sequelize.transaction(async (t) => {
    await ejecutar(`INSERT INTO dbo.PTL_Pestanas (${BASE}, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
      VALUES (:codigoPestana, :codigoTipoPestana, :codigoAplicacion, :codigoSuite, :nombrePestana, :orden, :descripcion, :estado,
              :usuario, :fecha, :usuario, :fecha)`, { ...datos(p), usuario, fecha: ahora() }, t);
    return guardarEstilo(p, t);
  });
}

async function modificar(codigoPestana, p, usuario) {
  return db.sequelize.transaction(async (t) => {
    await ejecutar(`UPDATE dbo.PTL_Pestanas SET codigoTipoPestana = :codigoTipoPestana, codigoAplicacion = :codigoAplicacion,
      codigoSuite = :codigoSuite, nombrePestana = :nombrePestana, orden = :orden, descripcion = :descripcion, estado = :estado,
      codigoUsuarioModificacion = :usuario, fechaModificacion = :fecha WHERE codigoPestana = :codigoPestana`,
    { ...datos(p), codigoPestana, usuario, fecha: ahora() }, t);
    return guardarEstilo({ ...p, codigoPestana }, t);
  });
}

const inactivar = (codigoPestana, usuario) => ejecutar(`UPDATE dbo.PTL_Pestanas SET estado = 0, codigoUsuarioModificacion = :usuario,
  fechaModificacion = :fecha WHERE codigoPestana = :codigoPestana`, { codigoPestana, usuario, fecha: ahora() });

async function suiteDeAplicacion(codigoSuite, codigoAplicacion) {
  const [f] = await q('SELECT COUNT(*) AS n FROM dbo.PTL_SuitesAP WHERE codigoSuite = :codigoSuite AND codigoAplicacion = :codigoAplicacion',
    { codigoSuite, codigoAplicacion });
  return Number(f?.n || 0) > 0;
}

// Tipos de pestaña
const TIPO = 'codigoTipo, estrategia, descripcion, estado';
const listarTipos = () => q(`SELECT ${TIPO} FROM dbo.PTL_TiposPestana ORDER BY codigoTipo`);
async function obtenerTipo(codigoTipo) {
  const [f] = await q(`SELECT ${TIPO} FROM dbo.PTL_TiposPestana WHERE codigoTipo = :codigoTipo`, { codigoTipo });
  return f || null;
}
async function tipoPorEstrategia(estrategia) {
  const [f] = await q(`SELECT ${TIPO} FROM dbo.PTL_TiposPestana WHERE estrategia = :estrategia`, { estrategia });
  return f || null;
}
const crearTipo = (t, usuario) => ejecutar(`INSERT INTO dbo.PTL_TiposPestana (${TIPO}, codigoUsuarioCreacion, fechaCreacion,
  codigoUsuarioModificacion, fechaModificacion) VALUES (:codigoTipo, :estrategia, :descripcion, :estado, :usuario, :fecha, :usuario, :fecha)`,
{ ...t, estado: t.estado ? 1 : 0, usuario, fecha: ahora() });
const modificarTipo = (codigoTipo, t, usuario) => ejecutar(`UPDATE dbo.PTL_TiposPestana SET estrategia = :estrategia,
  descripcion = :descripcion, estado = :estado, codigoUsuarioModificacion = :usuario, fechaModificacion = :fecha WHERE codigoTipo = :codigoTipo`,
{ ...t, codigoTipo, estado: t.estado ? 1 : 0, usuario, fecha: ahora() });
const inactivarTipo = (codigoTipo, usuario) => ejecutar(`UPDATE dbo.PTL_TiposPestana SET estado = 0, codigoUsuarioModificacion = :usuario,
  fechaModificacion = :fecha WHERE codigoTipo = :codigoTipo`, { codigoTipo, usuario, fecha: ahora() });
async function pestanasDelTipo(codigoTipo) {
  const [f] = await q('SELECT COUNT(*) AS n FROM dbo.PTL_Pestanas WHERE codigoTipoPestana = :codigoTipo AND estado = 1', { codigoTipo });
  return Number(f?.n || 0);
}

module.exports = {
  listar, obtener, crear, modificar, inactivar, suiteDeAplicacion,
  listarTipos, obtenerTipo, tipoPorEstrategia, crearTipo, modificarTipo, inactivarTipo, pestanasDelTipo,
};
