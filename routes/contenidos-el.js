/*
    Author: John Castañeda
    Ruta: /api/contenidos-st
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getContenidos,
    getContenidoByCode,
    createContenido,
    updateContenido,
    deleteContenido,
} = require("../controllers/contenidos-el");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

router.get("/", validarJWT, getContenidos);

router.get("/:id", validarJWT, getContenidoByCode);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_CONTENIDOS_CREAR')], createContenido);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_CONTENIDOS_MODIFICAR')], updateContenido);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_CONTENIDOS_ELIMINAR')], deleteContenido);

module.exports = router;