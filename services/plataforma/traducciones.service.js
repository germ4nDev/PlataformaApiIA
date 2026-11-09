/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Administración de las llaves de traducción (Utilidades › Traducciones, OT-027)
    Description:
      arbol(params)           árbol de un idioma tal como está en su JSON (la web lo mezcla encima del que trae su build; público)
      listar()                { idiomas, ramas, filas: [{ llave, modulo, textos, protegida }] }
      crear(datos)            llave nueva en su rama del árbol, con su texto en cada idioma (todos los idiomas con las mismas llaves)
      modificar(datos)        cambia el texto de una llave que ya existe (no convierte grupos en texto ni al revés)
      eliminar(datos)         borra la llave de todos los idiomas; no se puede si la usa el código o una tabla (menú)
      sembrar(datos)          crea el JSON de un idioma que el API todavía no tiene (producción) con el que trae la web
    Llaves protegidas: config/i18n-llaves-usadas.json (las que usa el código; la genera _memoria/datos/ot027-llaves-usadas.js) y
    translateKey de las tablas del menú.
*/
const Repo = require('../../repositories/plataforma/traducciones.repository');
const { validarCon } = require('../../helpers/errores.helper');
const M = require('../../models/plataforma/traducciones.model');
const N = require('../../utils/plataforma/traducciones');
const LLAVES_CODIGO = require('../../config/i18n-llaves-usadas.json');

const MOTIVOS = {
  FORMATO: 'Cada parte de la llave va en MAYÚSCULAS, con letras, números o _ (MODULO.SUBMODULO.LLAVE).',
  SIN_MODULO: 'La llave debe empezar por su módulo (MODULO.LLAVE o MODULO.SUBMODULO.LLAVE).',
  YA_EXISTE: 'Ya existe una llave con ese nombre.',
  ES_GRUPO: 'Ese nombre es un grupo de llaves, no una llave.',
  PADRE_ES_TEXTO: 'Una parte de la llave ya es un texto: no puede tener llaves dentro.',
};

class TraduccionesService {
  constructor({ repo = Repo, llavesCodigo = LLAVES_CODIGO } = {}) {
    this.repo = repo;
    this.llavesCodigo = new Set(llavesCodigo.llaves || llavesCodigo);
  }

  arboles() {
    return Object.fromEntries(this.repo.idiomas().map((i) => [i, this.repo.leer(i) || {}]));
  }

  async arbol(params) {
    const { idioma } = validarCon(M.IdiomaParamsSchema, params);
    return this.repo.leer(idioma) || {};
  }

  async protegidas() {
    const tablas = await this.repo.llavesDeTablas();
    return new Set([...this.llavesCodigo, ...tablas]);
  }

  async listar() {
    const arboles = this.arboles();
    const idiomas = Object.keys(arboles);
    let protegidas = this.llavesCodigo;
    try { protegidas = await this.protegidas(); } catch { /* sin base: solo las del código */ }
    const filas = N.filas(arboles).map((f) => ({ ...f, protegida: protegidas.has(f.llave) }))
      .sort((a, b) => a.llave.localeCompare(b.llave));
    return { idiomas, ramas: N.ramas(arboles[idiomas[0]] || {}), filas };
  }

  async crear(datos) {
    const { llave, textos } = validarCon(M.LlaveTextosSchema, datos);
    const arboles = this.arboles();
    const idiomas = Object.keys(arboles);
    if (!idiomas.length) throw { statusCode: 409, msg: 'No hay archivos de traducción en el API: siémbrelos primero.' };
    for (const i of idiomas) {
      const motivo = N.revisarLlaveNueva(arboles[i], llave);
      if (motivo) throw { statusCode: motivo === 'YA_EXISTE' ? 409 : 400, msg: MOTIVOS[motivo], codigo: `TRADUCCION_${motivo}` };
      if (!String(textos[i] ?? '').trim()) throw { statusCode: 400, msg: `Falta el texto en el idioma ${i}.`, codigo: 'TRADUCCION_SIN_TEXTO' };
    }
    for (const i of idiomas) this.repo.escribir(i, N.poner(arboles[i], llave, textos[i]));
    return { llave, textos: Object.fromEntries(idiomas.map((i) => [i, textos[i]])) };
  }

  async modificar(datos) {
    const { llave, textos } = validarCon(M.LlaveTextosSchema, datos);
    const arboles = this.arboles();
    const existe = Object.values(arboles).some((a) => typeof N.plano(a)[llave] === 'string');
    if (!existe) throw { statusCode: 404, msg: 'No existe esa llave.', codigo: 'TRADUCCION_NO_EXISTE' };
    for (const [i, texto] of Object.entries(textos)) {
      if (!arboles[i]) continue; // idioma sin archivo
      let nuevo;
      try { nuevo = N.poner(arboles[i], llave, texto); } catch (e) { throw { statusCode: 400, msg: MOTIVOS[e.message] || e.message }; }
      this.repo.escribir(i, nuevo);
    }
    return { llave, textos };
  }

  async eliminar(datos) {
    const { llave } = validarCon(M.LlaveSchema, datos);
    let protegidas;
    try { protegidas = await this.protegidas(); } catch {
      throw { statusCode: 503, msg: 'No se pudo revisar si una tabla usa la llave; inténtelo de nuevo.', codigo: 'TRADUCCION_SIN_BASE' };
    }
    if (protegidas.has(llave)) throw { statusCode: 409, msg: 'La llave la usa el sistema (una pantalla o el menú): no se puede eliminar.', codigo: 'TRADUCCION_EN_USO' };
    const arboles = this.arboles();
    let estaba = false;
    for (const [i, a] of Object.entries(arboles)) {
      if (typeof N.plano(a)[llave] !== 'string') continue;
      estaba = true;
      this.repo.escribir(i, N.quitar(a, llave));
    }
    if (!estaba) throw { statusCode: 404, msg: 'No existe esa llave.', codigo: 'TRADUCCION_NO_EXISTE' };
    return { llave };
  }

  async sembrar(datos) {
    const { idioma, arbol } = validarCon(M.SembrarSchema, datos);
    if (this.repo.leer(idioma)) throw { statusCode: 409, msg: 'El API ya tiene ese idioma.', codigo: 'TRADUCCION_YA_SEMBRADO' };
    this.repo.escribir(idioma, arbol);
    return { idioma, llaves: Object.keys(N.plano(arbol)).length };
  }
}

module.exports = new TraduccionesService();
module.exports.TraduccionesService = TraduccionesService;
