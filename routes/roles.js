/*
    Author: German Valencia
    Ruta: /api/roles
*/
const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    getRoles,
    getRoleById,
    getRolesByApp,
    createRole,
    updateRole,
    deleteRole
} = require("../controllers/roles");

const router = Router();

// router.use(validarJWT);

router.get("/", getRoles);
router.get("/:id", validarJWT, getRoleById);
router.get("/app/:appCode", validarJWT, getRolesByApp);

router.post("/", [
    check('nombreRole', 'El nombre del rol es obligatorio').not().isEmpty(),
    check('codigoAplicacion', 'El código de aplicación es obligatorio').not().isEmpty(),
    validarJWT,
    validarCampos
], createRole);

router.put("/:id", [
    validarJWT,
    validarCampos
], updateRole);

router.delete("/:id", validarJWT, deleteRole);

module.exports = router;