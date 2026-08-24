/*
    Author: German Valencia
    Ruta: api/paquetes/tipos-paquete
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getTiposPaquete,
  getTipoPaqueteById,
  createTipoPaquete,
  updateTipoPaquete,
  deleteTipoPaquete
} = require("../controllers/tipos-paquete.controller");

const router = Router();

// Middleware central
// router.use(validarJWT);

// Rutas CRUD
router.get("/", getTiposPaquete);
router.get("/:id", getTipoPaqueteById);
router.post("/", createTipoPaquete);
router.put("/:id", updateTipoPaquete);
router.delete("/:id", deleteTipoPaquete);

module.exports = router;