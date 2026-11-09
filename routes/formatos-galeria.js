/*
    Author: German Valencia
    Ruta: /api/clasesTcket
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getFormatosGaleria,
    getFormatoGaleriaById,
    createFormatoGaleria,
    updateFormatoGaleria,
    deleteFormatoGaleria
} = require("../controllers/formatos-galeria");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getFormatosGaleria);

router.get("/:id", getFormatoGaleriaById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_FORMATOSGAL_CREAR')], createFormatoGaleria);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_FORMATOSGAL_MODIFICAR')], updateFormatoGaleria);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_FORMATOSGAL_ELIMINAR')], deleteFormatoGaleria);

module.exports = router;