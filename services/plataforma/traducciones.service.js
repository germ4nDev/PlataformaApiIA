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
      idiomasMaestro()        { maestro, conArchivo, faltan }: los idiomas activos del maestro y cuáles no tienen archivo (CC-208)
      sincronizarIdiomas({ modo })  CC-215: cada idioma activo del maestro sin archivo se crea con todas sus llaves TRADUCIDAS por la IA
                              (trabajo en segundo plano, por lotes, retomable); modo 'espanol' lo crea copiando el español (sin traductor)
      idiomasEditables()      CC-215, regla única: { idiomas: ['es', …activos con archivo], nombres, sinArchivo, trabajos, traductor }
                              (editor del portal, selector público y Traducciones usan esta misma lista)
    Contrato de i18n para las aplicaciones (regla 27, OT-036 fase 3): textosDe(prefijo) · escribirTextos({ llave: { es, en… } }) ·
      quitarTextos([llaves]). Escriben en todos los idiomas con archivo; un idioma sin texto toma el del español.
    Llaves protegidas: config/i18n-llaves-usadas.json (las que usa el código; la genera _memoria/datos/ot027-llaves-usadas.js) y
    translateKey de las tablas del menú.
*/
const Repo = require('../../repositories/plataforma/traducciones.repository');
const { validarCon } = require('../../helpers/errores.helper');
const M = require('../../models/plataforma/traducciones.model');
const N = require('../../utils/plataforma/traducciones');
const LLAVES_CODIGO = require('../../config/i18n-llaves-usadas.json');
const TI = require('../../utils/plataforma/traduccion-ia');

const MOTIVOS = {
  FORMATO: 'Cada parte de la llave va en MAYÚSCULAS, con letras, números o _ (MODULO.SUBMODULO.LLAVE).',
  SIN_MODULO: 'La llave debe empezar por su módulo (MODULO.LLAVE o MODULO.SUBMODULO.LLAVE).',
  YA_EXISTE: 'Ya existe una llave con ese nombre.',
  ES_GRUPO: 'Ese nombre es un grupo de llaves, no una llave.',
  PADRE_ES_TEXTO: 'Una parte de la llave ya es un texto: no puede tener llaves dentro.',
};

class TraduccionesService {
  constructor({ repo = Repo, llavesCodigo = LLAVES_CODIGO, traductor = null, emitir = null } = {}) {
    this.repo = repo;
    this.llavesCodigo = new Set(llavesCodigo.llaves || llavesCodigo);
    this._traductor = traductor;
    this.trabajos = {}; // CC-215: sigla → { estado: traduciendo | listo | error, total, hechas, sinTraducir, motivo, inicio, fin, uso }
    this.emitir = emitir || ((d) => { try { require('../../helpers/socket.helper').getIO().emit('traducciones-actualizadas', d); } catch { /* sin socket */ } });
  }

  get traductor() {
    return this._traductor || (this._traductor = require('./traductor-ia.service'));
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
    let faltan = [];
    try { faltan = (await this.idiomasMaestro()).faltan; } catch { /* sin base: no se sabe qué falta */ }
    return { idiomas, ramas: N.ramas(arboles[idiomas[0]] || {}), filas, faltan, trabajos: this.trabajos, traductor: this.traductor.disponible() };
  }

  // ---------- Maestro de idiomas (CC-208) ----------
  async idiomasMaestro() {
    const maestro = await this.repo.idiomasDelMaestro();
    const conArchivo = this.repo.idiomas();
    return { maestro: [...new Set(maestro.map(N.siglaArchivo).filter(Boolean))].sort(), conArchivo, faltan: N.idiomasPorCrear(maestro, conArchivo) };
  }

  /** CC-215: activos del maestro con su nombre (si el repositorio no da el nombre, la sigla) */
  async maestro() {
    const filas = this.repo.maestroConNombre ? await this.repo.maestroConNombre() : (await this.repo.idiomasDelMaestro()).map((sigla) => ({ sigla, nombre: '' }));
    return filas.map((f) => ({ sigla: N.siglaArchivo(f.sigla), nombre: f.nombre || '' })).filter((f) => f.sigla);
  }

  /** CC-215, regla única de idiomas: lo que se edita y se publica = activos en el maestro con archivo; el español siempre */
  async idiomasEditables() {
    const conArchivo = this.repo.idiomas();
    let maestro = [];
    try { maestro = await this.maestro(); } catch { /* sin base: solo español */ }
    const idiomas = TI.idiomasEditables(maestro, conArchivo);
    const nombres = Object.fromEntries(maestro.map((m) => [m.sigla, m.nombre || m.sigla.toUpperCase()]));
    if (!nombres.es) nombres.es = 'Español';
    const sinArchivo = maestro.filter((m) => !conArchivo.includes(m.sigla)).map((m) => ({ ...m, trabajo: this.trabajos[m.sigla] || null }));
    return { idiomas, nombres, sinArchivo, trabajos: this.trabajos, traductor: this.traductor.disponible() };
  }

  async sincronizarIdiomas({ modo } = {}) {
    const { faltan } = await this.idiomasMaestro();
    if (!faltan.length) return { creados: [], enCurso: [], trabajos: this.trabajos };
    if (modo === 'espanol') { // sin traductor: copia del español para traducir a mano (CC-208)
      const base = N.baseParaIdioma(this.arboles());
      for (const i of faltan) { this.repo.escribir(i, base); delete this.trabajos[i]; }
      return { creados: faltan, enCurso: [], llaves: Object.keys(N.plano(base)).length, trabajos: this.trabajos };
    }
    const disp = this.traductor.disponible();
    if (!disp.ok) throw { statusCode: 409, msg: disp.motivo, codigo: 'TRADUCCION_SIN_TRADUCTOR' };
    const nombres = Object.fromEntries((await this.maestro()).map((m) => [m.sigla, m.nombre]));
    const enCurso = [];
    for (const i of faltan) {
      if (this.trabajos[i]?.estado === 'traduciendo') { enCurso.push(i); continue; }
      enCurso.push(i);
      this.trabajos[i] = { estado: 'traduciendo', total: 0, hechas: 0, sinTraducir: 0, motivo: null, inicio: new Date().toISOString(), fin: null, uso: { entrada: 0, salida: 0 } };
      this.promesa = this.traducirIdioma(i, nombres[i] || '');
    }
    return { creados: [], enCurso, trabajos: this.trabajos };
  }

  /** CC-215: traduce por lotes lo que falta (lo ya hecho queda en el parcial) y al final escribe el archivo completo */
  async traducirIdioma(sigla, nombre) {
    const t = this.trabajos[sigla];
    try {
      const planoEs = N.plano(this.repo.leer('es') || {});
      const hechas = this.repo.leerParcial(sigla) || {};
      const pendientes = TI.porTraducir(planoEs, hechas);
      t.total = pendientes.length + Object.keys(hechas).filter((k) => k in planoEs).length;
      t.hechas = t.total - pendientes.length;
      this.emitir({ action: 'traduciendo', idioma: sigla, hechas: t.hechas, total: t.total });
      for (const lote of TI.lotes(pendientes)) {
        const r = await this.traductor.traducirLote({ sigla, nombre, lote });
        Object.assign(hechas, r.buenas);
        t.uso.entrada += r.uso.entrada; t.uso.salida += r.uso.salida;
        t.hechas += lote.length;
        this.repo.escribirParcial(sigla, hechas);
        this.emitir({ action: 'traduciendo', idioma: sigla, hechas: t.hechas, total: t.total });
      }
      const { arbol, sinTraducir } = TI.ensamblar(this.repo.leer('es') || {}, hechas); // el español de ahora: incluye llaves creadas mientras tanto
      this.repo.escribir(sigla, arbol);
      this.repo.quitarParcial(sigla);
      Object.assign(t, { estado: 'listo', sinTraducir: sinTraducir.length, fin: new Date().toISOString() });
      console.log(`[Traducciones] ${sigla}: ${t.total - sinTraducir.length} de ${t.total} llaves traducidas (tokens ${t.uso.entrada}/${t.uso.salida})`);
    } catch (e) {
      Object.assign(t, { estado: 'error', motivo: String(e?.msg || e?.message || 'Error al traducir').slice(0, 300), fin: new Date().toISOString() });
      console.error(`[Traducciones] ${sigla}: la traducción se detuvo (${t.motivo}); lo traducido queda guardado y se retoma al reintentar`);
    }
    this.emitir({ action: t.estado, idioma: sigla, hechas: t.hechas, total: t.total });
    return t;
  }

  // ---------- Contrato para las aplicaciones (OT-036 fase 3) ----------
  textosDe(prefijo) {
    return N.textosDePrefijo(this.arboles(), prefijo);
  }

  escribirTextos(textos) {
    const arboles = this.arboles();
    const idiomas = Object.keys(arboles);
    if (!idiomas.length) throw { statusCode: 409, msg: 'No hay archivos de traducción en el API: siémbrelos primero.', codigo: 'TRADUCCION_SIN_ARCHIVOS' };
    const { porIdioma, errores } = N.textosPorIdioma(textos, idiomas);
    if (errores.length) throw { statusCode: 400, msg: errores[0].mensaje, codigo: 'VALIDACION', details: errores.map((e) => ({ campo: e.llave, mensaje: e.mensaje })) };
    for (const i of idiomas) {
      let a = arboles[i];
      try { for (const [llave, texto] of Object.entries(porIdioma[i])) a = N.poner(a, llave, texto); } catch (e) {
        throw { statusCode: 400, msg: MOTIVOS[e.message] || e.message, codigo: 'VALIDACION' };
      }
      this.repo.escribir(i, a);
    }
    return { llaves: Object.keys(porIdioma[idiomas[0]]).length, idiomas };
  }

  quitarTextos(llaves) {
    const arboles = this.arboles();
    let quitadas = 0;
    for (const [i, a] of Object.entries(arboles)) {
      let nuevo = a;
      for (const llave of llaves || []) if (typeof N.plano(nuevo)[llave] === 'string') { nuevo = N.quitar(nuevo, llave); quitadas++; }
      if (nuevo !== a) this.repo.escribir(i, nuevo);
    }
    return { quitadas };
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
