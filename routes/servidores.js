/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getServidores,
    getServidorById,
    createServidor,
    updateServidor,
    deleteServidor
} = require("../controllers/servidores");

const router = Router();

router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getServidores);

router.get("/:id", getServidorById);

router.post("/", [validarJWT, validarSesion], createServidor);

router.put("/:id", [validarJWT, validarSesion], updateServidor);

router.delete("/:id", [validarJWT, validarSesion], deleteServidor);

module.exports = router;