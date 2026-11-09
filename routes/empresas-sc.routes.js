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
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();
// router.use(validarSesion);

// router.use(validarJWT);

router.get("/", getEmpresasSC);

router.get("/:id", getEmpresaSCById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_SUSCEMP_CREAR')], createEmpresaSC);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSCEMP_MODIFICAR')], updateEmpresaSC);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_SUSCEMP_ELIMINAR')], deleteEmpresaSC);

module.exports = router;