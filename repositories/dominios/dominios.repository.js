/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Dominios de la plataforma (OT-012, migración 026)
      dominios()                  filas de PTL_DominiosAP (todas: el núcleo descarta las inactivas). Sin la 026 → [] (todo neutro, como hoy)
      aplicacionesDeUsuario(cod)  códigos de aplicación que el suscriptor le asigna al usuario: las de los paquetes con licencia activa
                                  de sus vínculos (PTL_UsuariosSC → PTL_PaquetesSC → PTL_ModulosPQ), lo mismo que lista la web al entrar.
                                  CC-145 (usuario, 2026-11-08): el acceso lo da el suscriptor, no el rol; sin permisos entra pero no hace nada.
      aplicacion(cod)             { codigoAplicacion, nombreAplicacion } de PTL_Aplicaciones o null (CC-202)
      aplicarPlanDominios(cod, plan, marca)
                                  en una transacción: inserta los nuevos (tipo aplicacion, marca = nombre de la app), reactiva y
                                  desactiva (estado 0; nunca borra) según el plan del núcleo (CC-202, Aplicaciones › gestión)
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esTablaInexistente, esColumnaInexistente } = require('../../helpers/errores.helper');

async function dominios() {
  try {
    return await db.sequelize.query(`
      SELECT dominio, tipo, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, nombreMarca, logoMarca, estado
      FROM dbo.PTL_DominiosAP`, { type: QueryTypes.SELECT });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) return [];
    throw error;
  }
}

async function aplicacion(codigoAplicacion) {
  const filas = await db.sequelize.query(
    `SELECT TOP 1 codigoAplicacion, nombreAplicacion FROM dbo.PTL_Aplicaciones WHERE codigoAplicacion = :cod`,
    { type: QueryTypes.SELECT, replacements: { cod: codigoAplicacion } });
  return filas[0] || null;
}

async function aplicarPlanDominios(codigoAplicacion, plan, nombreMarca) {
  await db.sequelize.transaction(async (transaction) => {
    for (const dominio of plan.insertar) {
      await db.sequelize.query(
        `INSERT INTO dbo.PTL_DominiosAP (dominio, tipo, codigoAplicacion, nombreMarca) VALUES (:dominio, N'aplicacion', :cod, :marca)`,
        { transaction, replacements: { dominio, cod: codigoAplicacion, marca: nombreMarca || null } });
    }
    for (const [lista, estado] of [[plan.activar, 1], [plan.desactivar, 0]]) {
      for (const dominio of lista) {
        await db.sequelize.query(
          `UPDATE dbo.PTL_DominiosAP SET estado = :estado, fechaModificacion = SYSUTCDATETIME()
           WHERE dominio = :dominio AND tipo = N'aplicacion' AND codigoAplicacion = :cod`,
          { transaction, replacements: { estado, dominio, cod: codigoAplicacion } });
      }
    }
  });
}

// OT-026: la regla de «aplicación asignada» vive en un solo lugar (aplicaciones-suscriptor.repository)
const { aplicacionesDeUsuario } = require('../plataforma/aplicaciones-suscriptor.repository');

module.exports = { dominios, aplicacionesDeUsuario, aplicacion, aplicarPlanDominios };
