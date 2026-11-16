/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Catálogos simples (Utilidades › Catálogos, CC-204)
    para(clave, anterior) da los cuatro manejadores (obtener, crear, modificar, eliminar) de un catálogo; los controladores de siempre
    (tipos-roles, tipos-widget, tipos-pago, tipos-paquete, tipos-actividad, tipos-estados, estados) los exportan en sus mismas rutas y
    permisos. La respuesta trae `registro` y conserva la forma anterior (anterior(r) da las llaves que ya leía la web). Auditoría del token.
*/
const Catalogos = require('../../services/plataforma/catalogos.service');
const { manejar, contextoUsuario } = require('../../helpers/controlador.helper');

const usuarioDe = (req) => contextoUsuario(req).codigoUsuario;

function para(clave, anterior = () => ({})) {
  const con = (registro) => ({ ok: true, registro, ...anterior(registro) });
  return {
    obtener: manejar(`Catalogos.${clave}.obtener`, async (req, res) => res.json(con(await Catalogos.obtener(clave, req.params)))),
    crear: manejar(`Catalogos.${clave}.crear`, async (req, res) => res.status(201).json(con(await Catalogos.crear(clave, req.body, usuarioDe(req))))),
    modificar: manejar(`Catalogos.${clave}.modificar`, async (req, res) => res.json(con(await Catalogos.modificar(clave, req.params.id, req.body, usuarioDe(req))))),
    eliminar: manejar(`Catalogos.${clave}.eliminar`, async (req, res) => res.json({ ok: true, ...(await Catalogos.eliminar(clave, req.params, usuarioDe(req))) })),
  };
}

module.exports = { para };
