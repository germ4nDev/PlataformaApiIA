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
      idiomasDelMaestro()  siglas de los idiomas activos de PTL_Idiomas (CC-208)
      maestroConNombre()   [{ sigla, nombre }] de los idiomas activos (CC-215: nombre para el editor y para el traductor)
      leerParcial(i) / escribirParcial(i, plano) / quitarParcial(i)   traducción en curso de un idioma nuevo (datos/i18n-parcial;
                           fuera de la carpeta de idiomas para que el idioma no aparezca hasta estar completo)
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

// OT-036 fase 3 (CC-208): siglas de los idiomas activos del maestro (Utilidades › Idiomas)
async function idiomasDelMaestro() {
  const filas = await db.sequelize.query('SELECT siglaIdioma FROM dbo.PTL_Idiomas WHERE estadoIdioma = 1', { type: QueryTypes.SELECT });
  return filas.map((f) => String(f.siglaIdioma || '').trim()).filter(Boolean);
}

// CC-215: con el nombre, para mostrarlo en el editor y decirle al traductor a qué idioma va
async function maestroConNombre() {
  const filas = await db.sequelize.query('SELECT siglaIdioma, nombreIdioma FROM dbo.PTL_Idiomas WHERE estadoIdioma = 1', { type: QueryTypes.SELECT });
  return filas.map((f) => ({ sigla: String(f.siglaIdioma || '').trim(), nombre: String(f.nombreIdioma || '').trim() })).filter((f) => f.sigla);
}

// CC-215: lo ya traducido de un idioma nuevo se guarda aparte hasta completarlo (si el API se reinicia, se retoma desde ahí)
const PARCIAL = path.join(__dirname, '..', '..', 'datos', 'i18n-parcial');
const archivoParcial = (idioma) => path.join(PARCIAL, `${idioma}.json`);

function leerParcial(idioma) {
  const f = archivoParcial(idioma);
  return fs.existsSync(f) ? JSON.parse(fs.readFileSync(f, 'utf8')) : {};
}

function escribirParcial(idioma, plano) {
  fs.mkdirSync(PARCIAL, { recursive: true });
  fs.writeFileSync(archivoParcial(idioma), JSON.stringify(plano, null, 2) + '\n', 'utf8');
}

function quitarParcial(idioma) {
  const f = archivoParcial(idioma);
  if (fs.existsSync(f)) fs.unlinkSync(f);
}

module.exports = { carpeta, idiomas, leer, escribir, llavesDeTablas, idiomasDelMaestro, maestroConNombre, leerParcial, escribirParcial, quitarParcial };
