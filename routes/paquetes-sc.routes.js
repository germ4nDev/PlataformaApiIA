/*
    Author: German Valencia
    Actualización: John Castañeda
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
} = require("../controllers/paquetes-sc.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getPaquetes);

router.get("/:id", getPaqueteById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_CREAR')], createPaquete);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_MODIFICAR')], updatePaquete);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_ELIMINAR')], deletePaquete);

module.exports = router;