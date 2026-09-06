const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getActividadesRoles,
  getActividadByCodeActividad,
  createBulkActividadesRoles,
  getActividadByCodeRole,
  createActividadRole,
  updateActividadRole,
  deleteActividadRole,
} = require("../controllers/actividades-roles.controller");

const router = Router();
//router.use(validarJWT);

router.get("/", getActividadesRoles);

router.get("/acti/:ac", getActividadByCodeActividad);

router.get("/role/:ro", getActividadByCodeRole);

router.post("/bulk/:id", createBulkActividadesRoles);

router.post("/", [
  check('codigoActividad', 'El código de actividad es obligatorio').not().isEmpty(),
  check('codigoRole', 'El código de rol es obligatorio').not().isEmpty(),
  validarCampos
], createActividadRole);

router.put("/:id", [
  validarCampos
], updateActividadRole);

router.delete("/:id", deleteActividadRole);

module.exports = router;