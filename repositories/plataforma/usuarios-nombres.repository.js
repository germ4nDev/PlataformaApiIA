/*
    Author: German Valencia
    Repositorio de nombres de usuario (CC-253): contrato del módulo «identidad» para las apps (regla 27). Una app guarda el codigoUsuario
    de quien actuó (auditoría del token) y, para mostrarlo en un informe, pide aquí su nombre sin hacer JOIN con PTL_ (regla 26).
    Solo lectura; solo el nombre, ningún dato de contacto.
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');

/**
 * @param {string[]} codigos codigoUsuario
 * @returns {Promise<Record<string, string>>} codigoUsuario → nombreUsuario
 */
async function nombresDeUsuarios(codigos = []) {
  const limpios = [...new Set(codigos.map((c) => String(c || '').trim()).filter(Boolean))].slice(0, 500);
  if (!limpios.length) return {};
  const filas = await sequelize.query(`SELECT codigoUsuario, nombreUsuario FROM dbo.PTL_Usuarios WHERE codigoUsuario IN (:limpios)`,
    { replacements: { limpios }, type: QueryTypes.SELECT });
  return Object.fromEntries(filas.map((f) => [String(f.codigoUsuario), String(f.nombreUsuario || '').trim()]).filter(([, n]) => n));
}

module.exports = { nombresDeUsuarios };
