const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getActividadesRoles,
  getActividadByCodeActividad,
  getActividadByCodeRole,
  createActividadRole,
  updateActividadRole,
  deleteActividadRole,
} = require("../controllers/actividades-roles");

const router = Router();
router.use(validarJWT);

router.get("/", getActividadesRoles);

router.get("/acti/:ac", getActividadByCodeActividad);

router.get("/role/:ro", getActividadByCodeRole);

router.post("/", [
  check('codigoActividad', 'El código de actividad es obligatorio').not().isEmpty(),
  check('codigoRole', 'El código de rol es obligatorio').not().isEmpty(),
  validarCampos
], createActividadRole);

router.put("/:ac/:ro", [
  validarCampos
], updateActividadRole);

router.delete("/:ac/:ro", deleteActividadRole);

module.exports = router;