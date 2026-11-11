/*
    Author: German Valencia
    Pattern: PLATAFORMA Controller - Países
    Rutas (routes/paises.js): GET / y GET /:codigoPais con JWT y sesión; POST / ACT_PAIS_CREAR; PUT /:codigoPais ACT_PAIS_MODIFICAR;
    DELETE /:codigoPais ACT_PAIS_ELIMINAR (409 si lo usa una lista de precios).
*/
const Servicio = require('../../services/plataforma/paises.service');
const { manejar, contextoUsuario } = require('../../helpers/controlador.helper');

const usuario = (req) => contextoUsuario(req).codigoUsuario;

module.exports = {
  getPaises: manejar('Paises.listar', async (req, res) => res.json({ ok: true, paises: await Servicio.listar() })),
  getPais: manejar('Paises.obtener', async (req, res) => res.json({ ok: true, pais: await Servicio.obtener(req.params) })),
  crearPais: manejar('Paises.crear', async (req, res) => res.status(201).json({ ok: true, pais: await Servicio.crear(req.body, usuario(req)) })),
  modificarPais: manejar('Paises.modificar', async (req, res) => res.json({ ok: true, pais: await Servicio.modificar(req.params.codigoPais, req.body, usuario(req)) })),
  eliminarPais: manejar('Paises.eliminar', async (req, res) => res.json({ ok: true, ...(await Servicio.eliminar(req.params)) })),
};
