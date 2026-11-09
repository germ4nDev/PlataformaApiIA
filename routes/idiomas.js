/*
    Author: German Valencia
    Ruta: /api/idiomas
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
  getIdiomas,
  getIdiomaById,
  createIdioma,
  updateIdioma,
  deleteIdioma
} = require("../controllers/idiomas");
const { validarPermiso } = require('../middlewares/validar-permiso');

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getIdiomas);

router.get("/:id", getIdiomaById);

router.post("/", [validarJWT, validarSesion, validarPermiso('ACT_IDIOMAS_CREAR')], createIdioma);

router.put("/:id", [validarJWT, validarSesion, validarPermiso('ACT_IDIOMAS_MODIFICAR')], updateIdioma);

router.delete("/:id", [validarJWT, validarSesion, validarPermiso('ACT_IDIOMAS_ELIMINAR')], deleteIdioma);

module.exports = router;
