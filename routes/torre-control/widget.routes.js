const express = require('express');
const router = express.Router();
const { validarJWT } = require("../../middlewares/validar-jwt");
const KpisController = require('../../controllers/torre-control/kpis.controller')
const {
  getWidgets,
  getWidgetByCode,
  crearWidget,
  updateWidget,
  deleteWidget
} = require("../../controllers/torre-control/widgets.controller");
const {
  consultarLineUp
} = require('../../controllers/torre-control/line-up-maritimo.controller');
const {
  obtenerTablero,
  guardarTablero
} = require('../../controllers/torre-control/layout.controller');
const { validarSesion } = require('../../middlewares/validar-sesion');
const { validarPermiso } = require('../../middlewares/validar-permiso');

router.get('/kpis', KpisController.obtenerDashboard);

router.get('/lineup', consultarLineUp);

router.get('/', getWidgets);

router.get('/:codigo_widget', getWidgetByCode);

router.post('/', [validarJWT, validarSesion, validarPermiso('ACT_WDGT_CREAR')], crearWidget);

router.get('/obtener/:codigo_usuario', obtenerTablero);

router.post('/layout', guardarTablero);

router.put('/:codigo_widget', [validarJWT, validarSesion, validarPermiso('ACT_WDGT_MODIFICAR')], updateWidget);

router.delete('/:codigo_widget', [validarJWT, validarSesion, validarPermiso('ACT_WDGT_ELIMINAR')], deleteWidget);

module.exports = router;
