const { Router } = require("express");
const { check } = require("express-validator");
const { validarCampos } = require("../middlewares/validar-campos");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
  getEmpresasSC,
  getEmpresaSCById,
  createEmpresaSC,
  updateEmpresaSC,
  deleteEmpresaSC
} = require("../controllers/empresas-sc");

const router = Router();

// router.use(validarJWT);

router.get("/", getEmpresasSC);

router.get("/:id", validarJWT, getEmpresaSCById);

router.post("/", [
  check('codigoEmpresaSC', 'El código de empresa es obligatorio').not().isEmpty(),
  check('nombreEmpresa', 'El nombre de la empresa es obligatorio').not().isEmpty(),
  check('nitEmpresa', 'El NIT es obligatorio').not().isEmpty(),
  validarJWT,
  validarCampos
], createEmpresaSC);

router.put("/:id", [
  validarJWT,
  validarCampos
], updateEmpresaSC);

router.delete("/:id", validarJWT, deleteEmpresaSC);

module.exports = router;