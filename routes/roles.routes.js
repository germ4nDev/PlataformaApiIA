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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getRoles);

router.get("/:id", getRoleById);

router.get("/app/:appCode", getRolesByApp);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_CREAR')], createRole);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_MODIFICAR')], updateRole);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_ELIMINAR')], deleteRole);

module.exports = router;