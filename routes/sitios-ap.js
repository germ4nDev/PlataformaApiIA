/*
    Author: John Castañeda
    Ruta: /api/sitio-ap
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSitios,
    getSitioById,
    createSitio,
    updateSitio,
    deleteSitio
} = require("../controllers/sitios-ap");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSitios);

router.get("/:id", getSitioById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SITIOS_CREAR')], createSitio);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SITIOS_MODIFICAR')], updateSitio);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SITIOS_ELIMINAR')], deleteSitio);

module.exports = router;