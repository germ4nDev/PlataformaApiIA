const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getConexiones,
    getConexionById,
    createConexion,
    updateConexion,
    deleteConexion
} = require("../controllers/conexiones-bd");

const router = Router();

router.use(validarJWT);

router.get("/", getConexiones);
router.get("/:id", getConexionById);

router.post("/", [
    check('codigoConexion', 'El código de conexión es obligatorio').not().isEmpty(),
    check('nombreConexion', 'El nombre descriptivo es obligatorio').not().isEmpty(),
    check('stringConexion', 'El string de conexión es obligatorio').not().isEmpty(),
    validarCampos
], createConexion);

router.put("/:id", [
    validarCampos
], updateConexion);

router.delete("/:id", deleteConexion);

module.exports = router;