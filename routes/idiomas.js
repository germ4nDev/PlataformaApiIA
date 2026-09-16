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

const router = Router();

// router.use(validarSesion);
// router.use(validarJWT);

router.get("/", getIdiomas);

router.get("/:id", getIdiomaById);

router.post("/", [validarJWT, validarSesion], createIdioma);

router.put("/:id", [validarJWT, validarSesion], updateIdioma);

router.delete("/:id", [validarJWT, validarSesion], deleteIdioma);

module.exports = router;
