/*
    Author: John Castañeda
    Ruta: /api/seguimientos
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getServidores,
    getServidorById,
    createServidor,
    updateServidor,
    deleteServidor
} = require("../controllers/servidores");

const router = Router();

router.use(validarJWT);

router.get("/", getServidores);
router.get("/:id", getServidorById);

router.post("/", [
    check('nombreServidor', 'El nombre es obligatorio').not().isEmpty(),
    check('ipServidor', 'La IP del servidor es obligatoria').not().isEmpty(),
    validarCampos
], createServidor);

router.put("/:id", [
    validarCampos
], updateServidor);

router.delete("/:id", deleteServidor);

module.exports = router;