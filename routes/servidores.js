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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getServidores);

router.get("/:id", getServidorById);

router.post("/", [validarJWT, validarPermiso('ACT_SERVIDORES_CREAR')], createServidor);

router.put("/:id", [validarJWT, validarPermiso('ACT_SERVIDORES_MODIFICAR')], updateServidor);

router.delete("/:id", [validarJWT, validarPermiso('ACT_SERVIDORES_ELIMINAR')], deleteServidor);

module.exports = router;