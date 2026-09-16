const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { inicializarBaseDeDatos } = require("../controllers/db-setup");
const { validarSesion } = require("../middlewares/validar-sesion");

const router = Router();
// router.use(validarSesion);

/**
 * ¡ATENCIÓN!: Esta es una ruta administrativa de alto riesgo.
 * Debe estar protegida por JWT y, preferiblemente, validar un rol de SuperAdmin.
 */
router.post("/run-init", [validarJWT, validarSesion], inicializarBaseDeDatos);

module.exports = router;