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
} = require("../controllers/roles.controller");

const router = Router();

// router.use(validarJWT);

router.get("/", getRoles);
router.get("/:id", getRoleById);
router.get("/app/:appCode", getRolesByApp);

router.post("/", createRole);

router.put("/:id", updateRole);

router.delete("/:id", deleteRole);

module.exports = router;