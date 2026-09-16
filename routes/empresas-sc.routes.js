const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getEmpresasSC,
  getEmpresaSCById,
  createEmpresaSC,
  updateEmpresaSC,
  deleteEmpresaSC
} = require("../controllers/empresas-sc.controller");

const router = Router();
// router.use(validarSesion);

// router.use(validarJWT);

router.get("/", getEmpresasSC);

router.get("/:id", getEmpresaSCById);

router.post("/", [validarJWT, validarSesion], createEmpresaSC);

router.put("/:id", [validarJWT, validarSesion], updateEmpresaSC);

router.delete("/:id", [validarJWT, validarSesion], deleteEmpresaSC);

module.exports = router;