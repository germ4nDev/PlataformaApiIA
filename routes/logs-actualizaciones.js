/*
    Author: German Valencia
    Ruta: /api/logs-actualizaviones
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { getLogs, getLogById, createLog } = require("../controllers/logs-actualizaciones");

const router = Router();

router.use(validarJWT);

router.get("/", getLogs);
router.get("/:id", getLogById);

router.post("/", [
    check('version', 'La versión de la actualización es obligatoria').not().isEmpty(),
    check('descripcion', 'La descripción es obligatoria').not().isEmpty(),
    validarCampos
], createLog);

// Por seguridad, no se definen rutas para actualizar ni eliminar logs.

module.exports = router;