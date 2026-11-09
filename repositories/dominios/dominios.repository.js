/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Dominios de la plataforma (OT-012, migración 026)
      dominios()                  filas de PTLDominiosAP (todas: el núcleo descarta las inactivas). Sin la 026 → [] (todo neutro, como hoy)
      aplicacionesDeUsuario(cod)  códigos de aplicación que el suscriptor le asigna al usuario: las de los paquetes con licencia activa
                                  de sus vínculos (PTLUsuariosSC → PTLPaquetesSC → PTLModulosPQ), lo mismo que lista la web al entrar.
                                  CC-145 (usuario, 2026-11-08): el acceso lo da el suscriptor, no el rol; sin permisos entra pero no hace nada.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esTablaInexistente, esColumnaInexistente } = require('../../helpers/errores.helper');

async function dominios() {
  try {
    return await db.sequelize.query(`
      SELECT dominio, tipo, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, nombreMarca, logoMarca, estado
      FROM dbo.PTLDominiosAP`, { type: QueryTypes.SELECT });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) return [];
    throw error;
  }
}

// OT-026: la regla de «aplicación asignada» vive en un solo lugar (aplicaciones-suscriptor.repository)
const { aplicacionesDeUsuario } = require('../plataforma/aplicaciones-suscriptor.repository');

module.exports = { dominios, aplicacionesDeUsuario };
