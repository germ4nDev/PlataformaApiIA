const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");
const {
  getActividadesRoles,
  getActividadByCodeActividad,
  createBulkActividadesRoles,
  getActividadByCodeRole,
  createActividadRole,
  updateActividadRole,
  deleteActividadRole,
} = require("../controllers/actividades-roles.controller");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
//router.use(validarJWT);
// router.use(validarSesion);

router.get("/", getActividadesRoles);

router.get("/acti/:ac", getActividadByCodeActividad);

router.get("/role/:ro", getActividadByCodeRole);

router.post("/bulk/:id", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_PERMISOS')], createBulkActividadesRoles);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_PERMISOS')], createActividadRole);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_PERMISOS')], updateActividadRole);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_ROLES_PERMISOS')], deleteActividadRole);

module.exports = router;