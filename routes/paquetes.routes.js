/*
    Author: German Valencia
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getPaquetes,
    getPaqueteById,
    createPaquete,
    updatePaquete,
    deletePaquete
} = require("../controllers/paquetes.controller");

const router = Router();

//router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getPaquetes);

router.get("/:id", getPaqueteById);

router.post("/", [validarJWT, validarSesion], createPaquete);

router.put("/:id", [validarJWT, validarSesion], updatePaquete);

router.delete("/:id", [validarJWT, validarSesion], deletePaquete);

module.exports = router;