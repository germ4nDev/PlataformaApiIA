const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getConexiones,
    getConexionById,
    createConexion,
    updateConexion,
    deleteConexion
} = require("../controllers/conexiones-bd");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getConexiones);

router.get("/:id", getConexionById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_CONEXIONES_CREAR')], createConexion);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_CONEXIONES_MODIFICAR')], updateConexion);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_CONEXIONES_ELIMINAR')], deleteConexion);

module.exports = router;