/*
    Author: German Valencia
    Refactored for: QPLUS Architecture Pattern & Strict Validations
    Ruta: /api/sesiones
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarPermiso } = require('../middlewares/validar-permiso');
const { validarSesion } = require("../middlewares/validar-sesion");
const { actualizarContextoSesion } = require('../controllers/contexto.controller');

const {
  getSesionesActivas,
  getSesionById,
  registrarSesion,
  actualizarContextoNavegacion,
  cerrarSesion
} = require("../controllers/sesiones.controller");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);
// , [ validarPermiso('ACT_SESIONES_VER') ],

router.get("/", getSesionesActivas);

router.get("/activaas", getSesionesActivas);

router.get("/:id", getSesionById);

router.post("/", registrarSesion);

router.post('/contexto', actualizarContextoSesion);

router.put("/contexto/:id", [validarJWT, validarSesion], actualizarContextoNavegacion);

router.delete("/:id", [validarJWT, validarSesion], cerrarSesion);

module.exports = router;