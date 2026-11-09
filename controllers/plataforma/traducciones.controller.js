/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Llaves de traducción (Utilidades › Traducciones, OT-027)
    Rutas (routes/traducciones.js):
      GET    /api/traducciones/:idioma           público: árbol del idioma (la web lo mezcla con el de su build al cargar)
      GET    /api/traducciones                   JWT + sesión: { idiomas, ramas, filas }
      POST   /api/traducciones                   ACT_TRAD_CREAR      { llave, textos: { es, en } }
      PUT    /api/traducciones                   ACT_TRAD_MODIFICAR  { llave, textos }
      DELETE /api/traducciones?llave=A.B         ACT_TRAD_ELIMINAR
      POST   /api/traducciones/:idioma/sembrar   ACT_TRAD_MODIFICAR  { arbol }  (solo si el API no tiene ese idioma)
*/
const Servicio = require('../../services/plataforma/traducciones.service');
const { responderError } = require('../../helpers/errores.helper');

const getArbol = async (req, res) => {
  try {
    const traducciones = await Servicio.arbol(req.params);
    res.set('Cache-Control', 'no-cache');
    return res.status(200).json({ ok: true, traducciones });
  } catch (error) { return responderError(res, error, 'Traducciones.arbol'); }
};

const getTraducciones = async (req, res) => {
  try { return res.status(200).json({ ok: true, ...(await Servicio.listar()) }); } catch (error) { return responderError(res, error, 'Traducciones.listar'); }
};

const crearTraduccion = async (req, res) => {
  try { return res.status(201).json({ ok: true, traduccion: await Servicio.crear(req.body) }); } catch (error) { return responderError(res, error, 'Traducciones.crear'); }
};

const modificarTraduccion = async (req, res) => {
  try { return res.status(200).json({ ok: true, traduccion: await Servicio.modificar(req.body) }); } catch (error) { return responderError(res, error, 'Traducciones.modificar'); }
};

const eliminarTraduccion = async (req, res) => {
  try { return res.status(200).json({ ok: true, traduccion: await Servicio.eliminar(req.query) }); } catch (error) { return responderError(res, error, 'Traducciones.eliminar'); }
};

const sembrarIdioma = async (req, res) => {
  try { return res.status(201).json({ ok: true, ...(await Servicio.sembrar({ ...req.body, idioma: req.params.idioma })) }); } catch (error) { return responderError(res, error, 'Traducciones.sembrar'); }
};

module.exports = { getArbol, getTraducciones, crearTraduccion, modificarTraduccion, eliminarTraduccion, sembrarIdioma };
