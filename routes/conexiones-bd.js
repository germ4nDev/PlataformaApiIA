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

const router = Router();

// router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getConexiones);

router.get("/:id", getConexionById);

router.post("/", [validarJWT, validarSesion], createConexion);

router.put("/:id", [validarJWT, validarSesion], updateConexion);

router.delete("/:id", [validarJWT, validarSesion], deleteConexion);

module.exports = router;