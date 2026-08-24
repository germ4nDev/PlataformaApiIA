/*
    Author: John Castañeda
    Ruta: /api/sitio-ap
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getSitios,
    getSitioById,
    createSitio,
    updateSitio,
    deleteSitio
} = require("../controllers/sitios-ap");

const router = Router();

router.use(validarJWT);

router.get("/", getSitios);
router.get("/:id", getSitioById);

router.post("/", [
    check('nombreSitio', 'El nombre es obligatorio').not().isEmpty(),
    check('urlSitio', 'La URL del sitio es obligatoria').not().isEmpty(),
    validarCampos
], createSitio);

router.put("/:id", [
    validarCampos
], updateSitio);

router.delete("/:id", deleteSitio);

module.exports = router;