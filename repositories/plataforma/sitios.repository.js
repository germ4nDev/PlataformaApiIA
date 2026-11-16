/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Sitios (PTL_SitiosAP; rutaAdministracion desde la 044)
      listar() / obtener(id) (sitioId o codigoSitio) / crear(s, usuario) / modificar(codigo, s, usuario) / inactivar(codigo, usuario)
      aplicacion(codigo)       la aplicación (o null)
      enlacesDelSitio(codigo)  cuántos enlaces (páginas) tiene el sitio
    Fechas de auditoría en texto ISO, como el resto de la plataforma.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const ejecutar = (sql, replacements = {}) => db.sequelize.query(sql, { replacements });
const ahora = () => new Date().toISOString();
const COLS = `s.sitioId, s.codigoSitio, s.codigoAplicacion, a.nombreAplicacion, s.nombreSitio, s.descripcionSitio, s.urlSitio, s.puertoSitio,
  s.estadoSitio, s.rutaAdministracion, s.fechaModificacion`;
const DESDE = 'dbo.PTL_SitiosAP s LEFT JOIN dbo.PTL_Aplicaciones a ON a.codigoAplicacion = s.codigoAplicacion';

const listar = () => q(`SELECT ${COLS} FROM ${DESDE} ORDER BY a.nombreAplicacion, s.nombreSitio`);

async function obtener(id) {
  const porNumero = /^\d+$/.test(String(id));
  const [f] = await q(`SELECT ${COLS} FROM ${DESDE} WHERE ${porNumero ? 's.sitioId = :id' : 's.codigoSitio = :id'}`, { id: porNumero ? Number(id) : String(id) });
  return f || null;
}

async function aplicacion(codigo) {
  const [f] = await q('SELECT TOP 1 codigoAplicacion, nombreAplicacion FROM dbo.PTL_Aplicaciones WHERE codigoAplicacion = :codigo', { codigo });
  return f || null;
}

const crear = (s, usuario) => ejecutar(`INSERT INTO dbo.PTL_SitiosAP (codigoSitio, codigoAplicacion, nombreSitio, descripcionSitio, urlSitio, puertoSitio,
  estadoSitio, rutaAdministracion, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (:codigoSitio, :codigoAplicacion, :nombreSitio, :descripcionSitio, :urlSitio, :puertoSitio, :estadoSitio, :rutaAdministracion,
          :usuario, :fecha, :usuario, :fecha)`, { ...s, estadoSitio: s.estadoSitio ? 1 : 0, usuario, fecha: ahora() });

const modificar = (codigo, s, usuario) => ejecutar(`UPDATE dbo.PTL_SitiosAP SET codigoAplicacion = :codigoAplicacion, nombreSitio = :nombreSitio,
  descripcionSitio = :descripcionSitio, urlSitio = :urlSitio, puertoSitio = :puertoSitio, estadoSitio = :estadoSitio,
  rutaAdministracion = :rutaAdministracion, codigoUsuarioModificacion = :usuario, fechaModificacion = :fecha WHERE codigoSitio = :codigo`,
{ ...s, estadoSitio: s.estadoSitio ? 1 : 0, usuario, fecha: ahora(), codigo });

const inactivar = (codigo, usuario) => ejecutar(`UPDATE dbo.PTL_SitiosAP SET estadoSitio = 0, codigoUsuarioModificacion = :usuario,
  fechaModificacion = :fecha WHERE codigoSitio = :codigo`, { codigo, usuario, fecha: ahora() });

async function enlacesDelSitio(codigo) {
  const [f] = await q('SELECT COUNT(*) AS n FROM dbo.PTL_EnlacesST WHERE codigoSitio = :codigo AND estadoEnlace = 1', { codigo });
  return Number(f?.n || 0);
}

module.exports = { listar, obtener, aplicacion, crear, modificar, inactivar, enlacesDelSitio };
