/*
    Author: German Valencia
    ruta: api/uploads/
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const { validarSesion } = require("../middlewares/validar-sesion");

const {
    createFolder,
    uploadResource,
    showResource,
    deleteResource,
    clearCategoryFolder
} = require("../controllers/uploads.controller");

const router = Router();
// router.use(validarSesion);

router.post("/folder", [validarJWT, validarSesion], createFolder);

router.post("/:suc/:type/:usu", [validarJWT, validarSesion], uploadResource);

router.get("/:suc/:type/:fileName", showResource);

router.delete("/:suc/:type/:usu/:fileName", [validarJWT, validarSesion], deleteResource);

router.delete("/file/:suc/:type/:usu/:fileName", [validarJWT, validarSesion], deleteResource);

router.delete("/clear/:suc/:usu/:type", [validarJWT, validarSesion], clearCategoryFolder);

module.exports = router;