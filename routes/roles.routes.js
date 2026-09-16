/*
    Author: German Valencia
    Ruta: /api/roles
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    getRoles,
    getRoleById,
    getRolesByApp,
    createRole,
    updateRole,
    deleteRole
} = require("../controllers/roles.controller");

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getRoles);

router.get("/:id", getRoleById);

router.get("/app/:appCode", getRolesByApp);

router.post("/", [validarJWT, validarSesion], createRole);

router.put("/:id", [validarJWT, validarSesion], updateRole);

router.delete("/:id", [validarJWT, validarSesion], deleteRole);

module.exports = router;