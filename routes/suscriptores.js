/*
    Author: German Valencia
    Ruta: /api/suscriptores
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getSuscriptores,
    getSuscriptorById,
    createSuscriptor,
    updateSuscriptor,
    deleteSuscriptor
} = require("../controllers/suscriptores");
const { validarPermiso } = require('../middlewares/validar-permiso');
const { getAplicacionesSuscriptor } = require('../controllers/plataforma/aplicaciones-suscriptor.controller');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getSuscriptores);

router.get("/:id", [validarJWT, validarSesion], getSuscriptorById);

// OT-026: aplicaciones con licencia del suscriptor (asignación de roles del usuario: suscriptor → empresa → aplicación → roles)
router.get('/:codigoSuscriptor/aplicaciones', [validarJWT, validarSesion], getAplicacionesSuscriptor);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SUSC_CREAR')], createSuscriptor);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSC_MODIFICAR')], updateSuscriptor);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSC_ELIMINAR')], deleteSuscriptor);

module.exports = router;