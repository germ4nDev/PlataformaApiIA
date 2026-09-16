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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSitios);

router.get("/:id", getSitioById);

router.post("/", [validarJWT, validarSesion], createSitio);

router.put("/:id", [validarJWT, validarSesion], updateSitio);

router.delete("/:id", [validarJWT, validarSesion], deleteSitio);

module.exports = router;