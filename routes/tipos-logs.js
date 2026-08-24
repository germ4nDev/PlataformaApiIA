/*
    Author: German Valirncia
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getTiposLogs,
  getTipoLogById,
  createTipoLog,
  updateTipoLog,
  deleteTipoLog
} = require("../controllers/tipos-logs");

const router = Router();

router.use(validarJWT);

router.get("/", getTiposLogs);
router.get("/:id", getTipoLogById);

router.post("/", [
  check('nombreTipoLog', 'El nombre del tipo de log es obligatorio').not().isEmpty(),
  validarCampos
], createTipoLog);

router.put("/:id", [
  validarCampos
], updateTipoLog);

router.delete("/:id", deleteTipoLog);

module.exports = router;