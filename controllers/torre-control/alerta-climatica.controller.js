/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Alertas climáticas
*/
const { AlertaClimaticaDTO } = require('../../models/torre-control/alerta-climatica.model');
const AlertaClimaticaService = require('../../services/torre-control/alertas-climaticas.service');
const { manejar, contextoUsuario } = require('../../helpers/controlador.helper');

const AlertaClimaticaController = {
  crearAlerta: manejar('AlertasClimaticas.crear', async (req, res) => {
    const alerta = AlertaClimaticaDTO(req.body, contextoUsuario(req));
    const nuevaAlerta = await AlertaClimaticaService.persistirAlerta(alerta);
    res.status(201).json({ success: true, data: nuevaAlerta });
  }),

  obtenerAlertasActivas: manejar('AlertasClimaticas.activas', async (req, res) => {
    res.status(200).json({ success: true, data: await AlertaClimaticaService.alertasActivas() });
  }),
};

module.exports = AlertaClimaticaController;
