/*
    Author: German Valencia
    Ruta: /api/suscriptores-paquetes
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSuscriptoresPaquetes,
    getSuscriptoresPaquetesById,
    createSuscriptorPaquete,
    updateSuscriptorPaquete,
    deleteSuscriptorPaquete,
} = require("../controllers/suscriptor-paquetes");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

router.get("/", getSuscriptoresPaquetes);

router.get("/:id", getSuscriptoresPaquetesById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_CREAR')], createSuscriptorPaquete);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_MODIFICAR')], updateSuscriptorPaquete);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSCPAQ_ELIMINAR')], deleteSuscriptorPaquete);

module.exports = router;