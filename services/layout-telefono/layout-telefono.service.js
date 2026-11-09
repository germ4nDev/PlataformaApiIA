/*
    Author: German Valencia
    Pattern: PORTTOS Service - Layout del teléfono (OT-017 fase 2)
    Description: El layout de la web embebida en el teléfono, por usuario y pestaña (rejilla de 4 columnas). Solo widgets con canal
      'telefono' o 'ambos' que permite el rol (regla común widgets-visibles, canal 'telefono'). La tableta y la web no lo usan.
        pestanas(codigoUsuario)                 [{ codigoPestana, widgets }]: las pestañas con al menos un widget de teléfono
        obtener(codigoUsuario, params)          { codigoPestana, columnas, origen: 'usuario'|'defecto', items, disponibles, ocultos,
                                                  version }; sin layout guardado = el por defecto (no se guarda hasta que edite)
        guardar(codigoUsuario, params, body)    sanea lo recibido, conserva lo oculto del guardado anterior y guarda
        restablecer(codigoUsuario, params)      borra el del usuario: vuelve al por defecto
      items lleva el nombre del widget para pintar el título. Sin usuario en el token → 401.
*/
const Repo = require('../../repositories/layout-telefono/layout-telefono.repository');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const { LayoutTelefonoParamsSchema, LayoutTelefonoBodySchema } = require('../../models/layout-telefono/layout-telefono.model');
const L = require('../../utils/layout/layout-telefono');
const { permisosDeWidgets, widgetVisible } = require('../../utils/layout/widgets-visibles');

class LayoutTelefonoService {
  constructor({ repo = Repo } = {}) {
    this.repo = repo;
  }

  usuario(codigoUsuario) {
    if (!codigoUsuario) throw crearError(401, 'Sesión sin usuario', 'SIN_USUARIO');
    return codigoUsuario;
  }

  /** Filas del maestro visibles en el teléfono para el usuario (y la pestaña, si se da). */
  async deTelefono(codigoUsuario, codigoPestana = null) {
    const filas = await this.repo.widgetsPermitidos(codigoUsuario, codigoPestana);
    const permisos = permisosDeWidgets(filas);
    return filas.filter((f) => widgetVisible(f.codigoWidget, permisos, 'telefono'));
  }

  async pestanas(codigoUsuario) {
    const widgets = await this.deTelefono(this.usuario(codigoUsuario));
    const cuenta = new Map();
    for (const w of widgets) {
      const set = cuenta.get(w.codigoPestana) || new Set();
      set.add(w.codigoWidget);
      cuenta.set(w.codigoPestana, set);
    }
    return [...cuenta.entries()]
      .map(([codigoPestana, set]) => ({ codigoPestana, widgets: set.size }))
      .sort((a, b) => a.codigoPestana.localeCompare(b.codigoPestana));
  }

  async obtener(codigoUsuario, params) {
    const usuario = this.usuario(codigoUsuario);
    const { pestana } = validarCon(LayoutTelefonoParamsSchema, params);
    const widgets = await this.deTelefono(usuario, pestana);
    const visibles = new Set(widgets.map((w) => w.codigoWidget));
    const guardado = await this.repo.guardado(usuario, pestana);
    let items;
    let ocultos = 0;
    if (guardado) {
      const partes = L.separar(guardado.items, (c) => visibles.has(c));
      items = L.acomodar(partes.visibles);
      ocultos = partes.ocultos.length;
    } else {
      items = L.layoutPorDefecto(widgets);
    }
    const nombres = new Map(widgets.map((w) => [w.codigoWidget, w.nombreWidget]));
    return {
      codigoPestana: pestana,
      columnas: L.COLUMNAS,
      origen: guardado ? 'usuario' : 'defecto',
      items: items.map((i) => ({ ...i, nombre: nombres.get(i.codigo) || i.codigo })),
      disponibles: L.disponibles(widgets, items),
      ocultos,
      version: guardado ? guardado.version : 0,
    };
  }

  async guardar(codigoUsuario, params, body) {
    const usuario = this.usuario(codigoUsuario);
    const { pestana } = validarCon(LayoutTelefonoParamsSchema, params);
    const { items } = validarCon(LayoutTelefonoBodySchema, body || {});
    const widgets = await this.deTelefono(usuario, pestana);
    const visibles = new Set(widgets.map((w) => w.codigoWidget));
    const saneados = L.sanear(items, visibles);
    const anterior = await this.repo.guardado(usuario, pestana);
    await this.repo.guardar(usuario, pestana, L.fusionar(saneados, anterior?.items, (c) => visibles.has(c)));
    return this.obtener(usuario, { pestana });
  }

  async restablecer(codigoUsuario, params) {
    const usuario = this.usuario(codigoUsuario);
    const { pestana } = validarCon(LayoutTelefonoParamsSchema, params);
    await this.repo.borrar(usuario, pestana);
    return this.obtener(usuario, { pestana });
  }
}

module.exports = new LayoutTelefonoService();
module.exports.LayoutTelefonoService = LayoutTelefonoService;
