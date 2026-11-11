/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Listas de precios (OT-029)
    Description: La lista de precios es el único lugar del precio de venta (decisión del usuario, 2026-11-10). Reglas en
    utils/plataforma/listas-precios.js (vigencias que no se cruzan, una referencia por lista, foto del precio al vender).
      listar()                                 [listas con numPrecios]
      obtener({ codigoLista })                 { lista, detalles }
      crear(body, usuario) / modificar(codigoLista, body, usuario)
      duplicar(codigoLista, body, usuario)     copia la lista y su detalle con otro código y vigencia (± porcentajeAjuste)
      agregarPrecio(codigoLista, body, usuario) / modificarPrecio(codigoDetalle, body, usuario) / eliminarPrecio(codigoDetalle)
      vigente({ pais, moneda, fecha })         { lista, detalles } o { lista: null, detalles: [] }
      referenciaPaquete(codigoPaquete, {codigoLista}) { lista, precio, sumaItems } para la gestión del paquete
      cotizar({ codigoPaquete, codigoTipoPaquete, codigoLista })  la foto del precio (la usa la venta al suscriptor)
*/
const Repo = require('../../repositories/plataforma/listas-precios.repository');
const N = require('../../utils/plataforma/listas-precios');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const M = require('../../models/plataforma/listas-precios.model');

const MENSAJES = {
  FECHAS: 'La fecha final no puede ser anterior a la inicial.',
  VIGENCIA_CRUZADA: 'Ya hay una lista activa de ese país y moneda con fechas que se cruzan. Cambie la vigencia o inactive la otra.',
  DUPLICADO: 'Ese paquete o ítem ya tiene precio en esta lista.',
};
const ahora = () => new Date().toISOString();
const aDia = (d) => (d ? new Date(d) : null);
const ajustar = (v, pct) => Math.round(Number(v || 0) * (1 + pct / 100) * 100) / 100;

class ListasPreciosService {
  constructor({ repo = Repo, emitir = null, paises = null } = {}) {
    this.repo = repo;
    // Utilidades › Países: el país de la lista es su código ISO y debe existir (vacío = todos los países)
    this.paises = paises || require('../../repositories/plataforma/paises.repository');
    this.emitir = emitir || ((evento, datos) => { try { require('../../helpers/socket.helper').getIO().emit(evento, datos); } catch { /* sin socket (pruebas) */ } });
  }

  async revisar(lista) {
    if (lista.paisAplica) {
      const pais = await this.paises.obtener(String(lista.paisAplica).trim().toUpperCase());
      if (!pais) throw { statusCode: 400, msg: 'El país no existe en Utilidades › Países.', codigo: 'PAIS_INVALIDO' };
      lista.paisAplica = String(pais.codigoPais).trim();
      // la moneda de una lista con país es la del país (usuario, 2026-11-10); solo la lista general (sin país) elige su moneda
      lista.moneda = String(pais.moneda).trim().toUpperCase();
    }
    const motivo = N.revisarLista(lista, await this.repo.listas());
    if (motivo) throw { statusCode: 409, msg: MENSAJES[motivo], codigo: motivo };
  }

  async existente(codigoLista) {
    const l = await this.repo.lista(codigoLista);
    if (!l) throw crearError(404, 'No existe la lista de precios.', 'NO_EXISTE');
    return l;
  }

  avisar(action, codigoLista) { this.emitir('listas-precios-actualizadas', { action, codigoLista }); }

  listar() { return this.repo.listas(); }

  async obtener({ codigoLista }) {
    const lista = await this.existente(codigoLista);
    return { lista, detalles: await this.repo.detalles(codigoLista) };
  }

  async crear(body, usuario) {
    const l = validarCon(M.ListaSchema, body);
    if (await this.repo.lista(l.codigoLista)) throw { statusCode: 409, msg: 'Ya existe una lista con ese código.', codigo: 'DUPLICADO' };
    l.fechaInicio = aDia(l.fechaInicio); l.fechaFin = aDia(l.fechaFin);
    await this.revisar(l);
    const fila = await this.repo.crearLista({ ...l, codigoUsuarioCreacion: usuario, fechaCreacion: ahora(), codigoUsuarioModificacion: usuario, fechaModificacion: ahora() });
    this.avisar('create', l.codigoLista);
    return fila;
  }

  async modificar(codigoLista, body, usuario) {
    await this.existente(codigoLista);
    const l = validarCon(M.ListaSchema, { ...body, codigoLista });
    l.fechaInicio = aDia(l.fechaInicio); l.fechaFin = aDia(l.fechaFin);
    await this.revisar(l);
    const { codigoLista: _c, ...cambios } = l;
    await this.repo.modificarLista(codigoLista, { ...cambios, codigoUsuarioModificacion: usuario, fechaModificacion: ahora() });
    this.avisar('update', codigoLista);
    return this.repo.lista(codigoLista);
  }

  async duplicar(codigoLista, body, usuario) {
    const origen = await this.existente(codigoLista);
    const d = validarCon(M.DuplicarSchema, body);
    if (await this.repo.lista(d.codigoLista)) throw { statusCode: 409, msg: 'Ya existe una lista con ese código.', codigo: 'DUPLICADO' };
    const nueva = { codigoLista: d.codigoLista, nombreLista: d.nombreLista, moneda: origen.moneda, paisAplica: origen.paisAplica || '',
      fechaInicio: aDia(d.fechaInicio), fechaFin: aDia(d.fechaFin), estadoLista: true };
    await this.revisar(nueva);
    const precios = await this.repo.detalles(codigoLista);
    const auditoria = { codigoUsuarioCreacion: usuario, fechaCreacion: ahora(), codigoUsuarioModificacion: usuario, fechaModificacion: ahora() };
    await this.repo.enTransaccion(async (t) => {
      await this.repo.crearLista({ ...nueva, ...auditoria }, t);
      if (precios.length) await this.repo.crearDetalles(precios.map((p, i) => ({
        codigoDetalle: `${d.codigoLista}-${i + 1}-${Date.now().toString(36)}`, codigoLista: d.codigoLista, tipoReferencia: p.tipoReferencia,
        codigoReferencia: p.codigoReferencia, valorMensual: ajustar(p.valorMensual, d.porcentajeAjuste), valorAnual: ajustar(p.valorAnual, d.porcentajeAjuste),
        precioSetup: ajustar(p.precioSetup, d.porcentajeAjuste), estadoDetalle: p.estadoDetalle !== false && p.estadoDetalle !== 0, ...auditoria,
      })), t);
    });
    this.avisar('create', d.codigoLista);
    return this.obtener({ codigoLista: d.codigoLista });
  }

  async agregarPrecio(codigoLista, body, usuario) {
    await this.existente(codigoLista);
    const p = validarCon(M.DetalleSchema, body);
    const motivo = N.revisarDetalle(p, await this.repo.detalles(codigoLista));
    if (motivo) throw { statusCode: 409, msg: MENSAJES[motivo], codigo: motivo };
    await this.repo.crearDetalles([{ ...p, codigoLista, codigoUsuarioCreacion: usuario, fechaCreacion: ahora(), codigoUsuarioModificacion: usuario, fechaModificacion: ahora() }]);
    this.avisar('update', codigoLista);
    return this.repo.detalle(p.codigoDetalle);
  }

  async modificarPrecio(codigoDetalle, body, usuario) {
    const actual = await this.repo.detalle(codigoDetalle);
    if (!actual) throw crearError(404, 'No existe ese precio en la lista.', 'NO_EXISTE');
    const cambios = validarCon(M.DetalleCambiosSchema, body);
    await this.repo.modificarDetalle(codigoDetalle, { ...cambios, codigoUsuarioModificacion: usuario, fechaModificacion: ahora() });
    this.avisar('update', actual.codigoLista);
    return this.repo.detalle(codigoDetalle);
  }

  async eliminarPrecio(codigoDetalle) {
    const actual = await this.repo.detalle(codigoDetalle);
    if (!actual) throw crearError(404, 'No existe ese precio en la lista.', 'NO_EXISTE');
    await this.repo.eliminarDetalle(codigoDetalle);
    this.avisar('update', actual.codigoLista);
    return { codigoDetalle };
  }

  async vigente(params) {
    const v = validarCon(M.VigenteSchema, params);
    const lista = N.listaVigente(await this.repo.listas(), v);
    return { lista, detalles: lista ? await this.repo.detalles(lista.codigoLista) : [] };
  }

  async listaElegida(codigoLista) {
    if (!codigoLista) return (await this.vigente({})).lista;
    const l = await this.existente(codigoLista);
    if (l.estadoLista === false || l.estadoLista === 0) throw { statusCode: 409, msg: 'La lista de precios está inactiva.', codigo: 'LISTA_INACTIVA' };
    return l;
  }

  async referenciaPaquete(codigoPaquete, { codigoLista = '' } = {}) {
    const lista = await this.listaElegida(codigoLista);
    if (!lista) return { lista: null, precio: null, sumaItems: null };
    const detalles = await this.repo.detalles(lista.codigoLista);
    return { lista, precio: N.precio(detalles, 'PAQUETE', codigoPaquete), sumaItems: N.sumaItems(await this.repo.itemsDePaquete(codigoPaquete), detalles) };
  }

  async cotizar(params) {
    const c = validarCon(M.CotizarSchema, params);
    const tipo = await this.repo.tipoPaquete(c.codigoTipoPaquete);
    if (!tipo) throw crearError(404, 'No existe el tipo de paquete.', 'NO_EXISTE');
    const lista = await this.listaElegida(c.codigoLista);
    if (!lista) throw { statusCode: 409, msg: 'No hay una lista de precios vigente.', codigo: 'SIN_LISTA' };
    const detalle = N.precio(await this.repo.detalles(lista.codigoLista), 'PAQUETE', c.codigoPaquete);
    return N.fotoPrecio({ lista, detalle, numMeses: Number(tipo.numMeses) || 1, porcentajeDescuento: Number(tipo.descuentoMeses) || 0 });
  }
}

module.exports = new ListasPreciosService();
module.exports.ListasPreciosService = ListasPreciosService;
