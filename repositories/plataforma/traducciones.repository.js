/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Archivos de traducción (es.json, en.json…) y llaves que usan las tablas (OT-027)
    Description:
      Carpeta de los JSON (en este orden): I18N_DIR del .env; si no, la de la web del repositorio (local: se edita el mismo
      PlataformaIA/src/assets/i18n que va a git); si no existe (producción), datos/i18n del API, que el despliegue de la web no toca.
      idiomas()            siglas con archivo (es, en…)
      leer(idioma)         árbol del JSON o null si no hay archivo
      escribir(idioma, a)  guarda el árbol con el mismo formato del repositorio (4 espacios y salto final)
      llavesDeTablas()     MENU.MODULES.<translateKey> y MENU.SUITES.<translateKey> (el menú las traduce: no se pueden borrar)
*/
const fs = require('fs');
const path = require('path');
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');

const WEB_I18N = path.join(__dirname, '..', '..', '..', 'PlataformaIA', 'src', 'assets', 'i18n');
const PROPIA = path.join(__dirname, '..', '..', 'datos', 'i18n');
const ARCHIVO = /^([a-z]{2}(?:-[A-Z]{2})?)\.json$/;

function carpeta() {
  if (process.env.I18N_DIR) return path.resolve(process.env.I18N_DIR);
  return fs.existsSync(WEB_I18N) ? WEB_I18N : PROPIA;
}

function idiomas() {
  const dir = carpeta();
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((f) => (f.match(ARCHIVO) || [])[1]).filter(Boolean).sort();
}

function leer(idioma) {
  const f = path.join(carpeta(), `${idioma}.json`);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : null;
}

function escribir(idioma, arbol) {
  const dir = carpeta();
  fs.mkdirSync(dir, { recursive: true });
  // regla 23: el JSON se guarda en orden alfabético (igual que lo deja _memoria/datos/ot028-aplicar.js)
  const ordenar = (o) => (o && typeof o === 'object' ? Object.fromEntries(Object.keys(o).sort().map((k) => [k, ordenar(o[k])])) : o);
  fs.writeFileSync(path.join(dir, `${idioma}.json`), JSON.stringify(ordenar(arbol), null, 4) + '\n', 'utf8');
}

// Regla 23 (OT-028): el menú arma la llave con un prefijo + el translateKey de la tabla (navigation.service): MENU.MODULES.<x> y MENU.SUITES.<x>
async function llavesDeTablas() {
  const filas = await db.sequelize.query(`
    SELECT N'MENU.MODULES.' + LTRIM(RTRIM(translateKey)) AS llave FROM dbo.PTL_ModulosAP WHERE NULLIF(LTRIM(RTRIM(translateKey)), N'') IS NOT NULL
    UNION SELECT N'MENU.SUITES.' + LTRIM(RTRIM(translateKey)) FROM dbo.PTL_SuitesAP WHERE NULLIF(LTRIM(RTRIM(translateKey)), N'') IS NOT NULL`, { type: QueryTypes.SELECT });
  return filas.map((f) => String(f.llave || '').trim()).filter(Boolean);
}

module.exports = { carpeta, idiomas, leer, escribir, llavesDeTablas };
