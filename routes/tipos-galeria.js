/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getTiposGaleria,
    getTipoGaleriaById,
    createTipoGaleria,
    updateTipoGaleria,
    deleteTipoGaleria
} = require("../controllers/tipos-galeria");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getTiposGaleria);

router.get("/:id", getTipoGaleriaById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSGAL_CREAR')], createTipoGaleria);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSGAL_MODIFICAR')], updateTipoGaleria);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_TIPOSGAL_ELIMINAR')], deleteTipoGaleria);

module.exports = router;