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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposLogs);

router.get("/:id", getTipoLogById);

router.post("/", [validarJWT, validarSesion], createTipoLog);

router.put("/:id", [validarJWT, validarSesion], updateTipoLog);

router.delete("/:id", [validarJWT, validarSesion], deleteTipoLog);

module.exports = router;