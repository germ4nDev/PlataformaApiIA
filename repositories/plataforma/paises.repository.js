/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Países (PTL_Paises, migración 039)
      listar() / obtener(codigo) / crear(p, usuario) / modificar(codigo, p, usuario) / eliminar(codigo)
      listasQueLoUsan(codigo)   cuántas listas de precios tienen ese país (no se puede eliminar; se inactiva)
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const ejecutar = (sql, replacements = {}) => db.sequelize.query(sql, { replacements });
const COLUMNAS = 'codigoPais, codigoIso3, codigoNumerico, nombrePais, moneda, simboloMoneda, decimalesMoneda, indicativo, zonaHoraria, idioma, descripcion, estadoPais';

const listar = () => q(`SELECT ${COLUMNAS} FROM dbo.PTL_Paises ORDER BY nombrePais`);

async function obtener(codigoPais) {
  const [f] = await q(`SELECT ${COLUMNAS} FROM dbo.PTL_Paises WHERE codigoPais = :codigoPais`, { codigoPais });
  return f || null;
}

const crear = (p, usuario) => ejecutar(`INSERT INTO dbo.PTL_Paises (${COLUMNAS}, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (:codigoPais, :codigoIso3, :codigoNumerico, :nombrePais, :moneda, :simboloMoneda, :decimalesMoneda, :indicativo, :zonaHoraria, :idioma, :descripcion, :estadoPais,
          :usuario, SYSUTCDATETIME(), :usuario, SYSUTCDATETIME())`, { ...p, estadoPais: p.estadoPais ? 1 : 0, usuario });

const modificar = (codigoPais, p, usuario) => ejecutar(`UPDATE dbo.PTL_Paises SET codigoIso3 = :codigoIso3, codigoNumerico = :codigoNumerico,
  nombrePais = :nombrePais, moneda = :moneda, simboloMoneda = :simboloMoneda, decimalesMoneda = :decimalesMoneda, indicativo = :indicativo,
  zonaHoraria = :zonaHoraria, idioma = :idioma, descripcion = :descripcion, estadoPais = :estadoPais, codigoUsuarioModificacion = :usuario, fechaModificacion = SYSUTCDATETIME()
  WHERE codigoPais = :codigoPais`, { ...p, codigoPais, estadoPais: p.estadoPais ? 1 : 0, usuario });

const eliminar = (codigoPais) => ejecutar('DELETE FROM dbo.PTL_Paises WHERE codigoPais = :codigoPais', { codigoPais });

async function listasQueLoUsan(codigoPais) {
  const [f] = await q('SELECT COUNT(*) AS n FROM dbo.PTL_ListasPrecios WHERE paisAplica = :codigoPais', { codigoPais });
  return Number(f?.n || 0);
}

module.exports = { listar, obtener, crear, modificar, eliminar, listasQueLoUsan };
