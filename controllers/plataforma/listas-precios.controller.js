/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Listas de precios (OT-029)
    Rutas (routes/lista-precios.routes.js; lectura con JWT + sesión, escritura con su llave ACT_PRECIO_*):
      GET    /api/lista-precios                          [listas]
      GET    /api/lista-precios/vigente?pais&moneda&fecha { lista, detalles }
      GET    /api/lista-precios/cotizar?codigoPaquete&codigoTipoPaquete&codigoLista   foto del precio para vender
      GET    /api/lista-precios/paquete/:codigoPaquete?codigoLista                    { lista, precio, sumaItems }
      GET    /api/lista-precios/:codigoLista             { lista, detalles }
      POST   /api/lista-precios                          crear lista                  ACT_PRECIO_CREAR
      PUT    /api/lista-precios/:codigoLista             modificar (o inactivar)      ACT_PRECIO_MODIFICAR
      POST   /api/lista-precios/:codigoLista/duplicar    copia con otra vigencia      ACT_PRECIO_CREAR
      POST   /api/lista-precios/:codigoLista/detalles    agregar precio               ACT_PRECIO_CREAR
      PUT    /api/lista-precios/detalles/:codigoDetalle  modificar precio             ACT_PRECIO_MODIFICAR
      DELETE /api/lista-precios/detalles/:codigoDetalle  quitar precio                ACT_PRECIO_ELIMINAR
*/
const Servicio = require('../../services/plataforma/listas-precios.service');
const { manejar, contextoUsuario } = require('../../helpers/controlador.helper');

const usuario = (req) => contextoUsuario(req).codigoUsuario;

module.exports = {
  getListas: manejar('ListasPrecios.listar', async (req, res) => res.json({ ok: true, listas: await Servicio.listar() })),
  getVigente: manejar('ListasPrecios.vigente', async (req, res) => res.json({ ok: true, ...(await Servicio.vigente(req.query)) })),
  getCotizacion: manejar('ListasPrecios.cotizar', async (req, res) => res.json({ ok: true, cotizacion: await Servicio.cotizar(req.query) })),
  getReferenciaPaquete: manejar('ListasPrecios.paquete', async (req, res) =>
    res.json({ ok: true, ...(await Servicio.referenciaPaquete(req.params.codigoPaquete, req.query)) })),
  getLista: manejar('ListasPrecios.obtener', async (req, res) => res.json({ ok: true, ...(await Servicio.obtener(req.params)) })),
  crearLista: manejar('ListasPrecios.crear', async (req, res) => res.status(201).json({ ok: true, lista: await Servicio.crear(req.body, usuario(req)) })),
  modificarLista: manejar('ListasPrecios.modificar', async (req, res) =>
    res.json({ ok: true, lista: await Servicio.modificar(req.params.codigoLista, req.body, usuario(req)) })),
  duplicarLista: manejar('ListasPrecios.duplicar', async (req, res) =>
    res.status(201).json({ ok: true, ...(await Servicio.duplicar(req.params.codigoLista, req.body, usuario(req))) })),
  agregarPrecio: manejar('ListasPrecios.agregarPrecio', async (req, res) =>
    res.status(201).json({ ok: true, detalle: await Servicio.agregarPrecio(req.params.codigoLista, req.body, usuario(req)) })),
  modificarPrecio: manejar('ListasPrecios.modificarPrecio', async (req, res) =>
    res.json({ ok: true, detalle: await Servicio.modificarPrecio(req.params.codigoDetalle, req.body, usuario(req)) })),
  eliminarPrecio: manejar('ListasPrecios.eliminarPrecio', async (req, res) =>
    res.json({ ok: true, ...(await Servicio.eliminarPrecio(req.params.codigoDetalle)) })),
};
