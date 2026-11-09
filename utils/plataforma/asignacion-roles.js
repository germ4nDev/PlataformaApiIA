/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Asignación de roles del usuario (OT-026, AD-16; sin base ni red)
    Description:
      La llave de un rol asignado (PTLUsuariosRole) = vínculo usuario–suscriptor (codigoUsuarioSC) + empresa (codigoEmpresaSC) + rol.
      alcanceBorrado(payload)       qué filas reemplaza una sincronización: las del vínculo, solo los roles del contexto (los de la
                                    aplicación en pantalla) y, si llega la empresa, solo en esa empresa (antes borraba en todas)
      normalizarAplicaciones(filas) aplicaciones del suscriptor sin repetidos ni vacíos, ordenadas por nombre
*/

function alcanceBorrado({ codigoUsuarioSC, codigoEmpresaSC, rolesContexto } = {}) {
  const roles = [...new Set((rolesContexto || []).map((r) => String(r || '').trim()).filter(Boolean))];
  if (!codigoUsuarioSC || !roles.length) return null; // nada que reemplazar
  const filtro = { codigoUsuarioSC: String(codigoUsuarioSC).trim(), roles };
  const empresa = String(codigoEmpresaSC || '').trim();
  if (empresa) filtro.codigoEmpresaSC = empresa;
  return filtro;
}

function normalizarAplicaciones(filas) {
  const vistas = new Map();
  for (const f of filas || []) {
    const codigo = String(f?.codigoAplicacion || '').trim();
    if (!codigo || vistas.has(codigo)) continue;
    vistas.set(codigo, { codigoAplicacion: codigo, nombreAplicacion: String(f?.nombreAplicacion || '').trim() || codigo });
  }
  return [...vistas.values()].sort((a, b) => a.nombreAplicacion.localeCompare(b.nombreAplicacion, 'es'));
}

module.exports = { alcanceBorrado, normalizarAplicaciones };
