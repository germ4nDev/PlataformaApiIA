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
} = require("../controllers/empresas-sc.controller");

const router = Router();

// router.use(validarJWT);

router.get("/", getEmpresasSC);

router.get("/:id", getEmpresaSCById);

router.post("/", createEmpresaSC);

router.put("/:id", updateEmpresaSC);

router.delete("/:id", deleteEmpresaSC);

module.exports = router;