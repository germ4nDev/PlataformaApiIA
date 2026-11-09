/*
    Author: German Valirncia
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getTiposLogs,
  getTipoLogById,
  createTipoLog,
  updateTipoLog,
  deleteTipoLog
} = require("../controllers/tipos-logs");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposLogs);

router.get("/:id", getTipoLogById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSLOG_CREAR')], createTipoLog);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSLOG_MODIFICAR')], updateTipoLog);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSLOG_ELIMINAR')], deleteTipoLog);

module.exports = router;