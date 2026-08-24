const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { inicializarBaseDeDatos } = require("../controllers/db-setup");

const router = Router();

/**
 * ¡ATENCIÓN!: Esta es una ruta administrativa de alto riesgo.
 * Debe estar protegida por JWT y, preferiblemente, validar un rol de SuperAdmin.
 */
router.post("/run-init", [
  validarJWT
  // Aquí podrías añadir validarRole('ADMIN_ROLE')
], inicializarBaseDeDatos);

module.exports = router;