/*
    Author: John Castañeda
    Ruta: /api/contenidos-st
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getContenidos,
    getContenidoByCode,
    createContenido,
    updateContenido,
    deleteContenido,
} = require("../controllers/contenidos-el");

const router = Router();

router.get("/", validarJWT, getContenidos);

router.get("/:id", validarJWT, getContenidoByCode);

router.post("/", [
    check('codigoContenido', 'El código del contenido es obligatorio').not().isEmpty(),
    check('codigoEnlace', 'El código del emlace es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createContenido);

router.put("/:id", [
    check('codigoEnlace', 'El código del emlace es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], updateContenido);

router.delete("/:id", validarJWT, deleteContenido);

module.exports = router;