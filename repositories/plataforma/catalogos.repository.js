/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Catálogos simples (Utilidades › Catálogos, CC-204)
      listar(def) / obtener(def, id) / porValor(def, columna, valor) / crear(def, p, usuario) / modificar(def, id, p, usuario)
      inactivar(def, id, usuario) / eliminar(def, id) / usos(def, registro)
    La tabla y las columnas salen de la definición del núcleo (utils/plataforma/catalogos.js, validadas al cargar); los valores van
    siempre como parámetros. Fechas de auditoría en texto ISO (como el resto de la plataforma). Las columnas de identidad
    (tipoRoleId…) las pone la base.
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { columnas } = require('../../utils/plataforma/catalogos');

const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const ejecutar = (sql, replacements = {}) => db.sequelize.query(sql, { replacements });
const ahora = () => new Date().toISOString();
const idDe = (def, id) => (def.autonumerica ? Number(id) : String(id));
const lectura = (def) => [...(def.autonumerica ? [def.llave] : []), ...columnas(def)];
const valores = (def, p) => {
  const r = {};
  for (const c of columnas(def)) r[c] = typeof p[c] === 'boolean' ? (p[c] ? 1 : 0) : p[c] === undefined ? null : p[c];
  return r;
};

const listar = (def) => q(`SELECT ${lectura(def).join(', ')} FROM dbo.${def.tabla} ORDER BY ${def.orden}`);

async function obtener(def, id) {
  const [f] = await q(`SELECT ${lectura(def).join(', ')} FROM dbo.${def.tabla} WHERE ${def.llave} = :id`, { id: idDe(def, id) });
  return f || null;
}

async function porValor(def, columna, valor) {
  if (!columnas(def).includes(columna)) throw new Error(`Columna ${columna} fuera del catálogo`);
  const [f] = await q(`SELECT TOP 1 ${lectura(def).join(', ')} FROM dbo.${def.tabla} WHERE ${columna} = :valor`, { valor });
  return f || null;
}

async function crear(def, p, usuario) {
  const cols = columnas(def);
  const fecha = ahora();
  const sql = `INSERT INTO dbo.${def.tabla} (${cols.join(', ')}, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
    ${def.autonumerica ? `OUTPUT INSERTED.${def.llave} AS id` : ''}
    VALUES (${cols.map((c) => ':' + c).join(', ')}, :usuario, :fecha, :usuario, :fecha)`;
  const rep = { ...valores(def, p), usuario, fecha };
  if (def.autonumerica) {
    const [f] = await q(sql, rep);
    return f?.id;
  }
  await ejecutar(sql, rep);
  return p[def.llave];
}

const modificar = (def, id, p, usuario) => {
  const cols = columnas(def).filter((c) => c !== def.llave);
  return ejecutar(`UPDATE dbo.${def.tabla} SET ${cols.map((c) => `${c} = :${c}`).join(', ')},
    codigoUsuarioModificacion = :usuario, fechaModificacion = :fecha WHERE ${def.llave} = :id`,
  { ...valores(def, p), usuario, fecha: ahora(), id: idDe(def, id) });
};

const inactivar = (def, id, usuario) => ejecutar(`UPDATE dbo.${def.tabla} SET ${def.estado} = 0, codigoUsuarioModificacion = :usuario,
  fechaModificacion = :fecha WHERE ${def.llave} = :id`, { usuario, fecha: ahora(), id: idDe(def, id) });

const eliminar = (def, id) => ejecutar(`DELETE FROM dbo.${def.tabla} WHERE ${def.llave} = :id`, { id: idDe(def, id) });

// [{ que, n }] de las tablas que usan el registro (por su llave o por la columna propia que indique el uso)
async function usos(def, registro) {
  const out = [];
  for (const u of def.usos) {
    const [f] = await q(`SELECT COUNT(*) AS n FROM dbo.${u.tabla} WHERE ${u.columna} = :valor`, { valor: registro[u.propia || def.llave] });
    out.push({ que: u.que, n: Number(f?.n || 0) });
  }
  return out;
}

module.exports = { listar, obtener, porValor, crear, modificar, inactivar, eliminar, usos };
