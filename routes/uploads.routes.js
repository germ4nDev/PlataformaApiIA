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
// router.use(validarSesion);[validarJWT, validarSesion], 

router.post("/folder", createFolder);

router.post("/:suc/:type/:usu", uploadResource);

router.get("/:suc/:type/:fileName", showResource);

router.delete("/:suc/:type/:usu/:fileName", deleteResource);

router.delete("/file/:suc/:type/:usu/:fileName", deleteResource);

router.delete("/clear/:suc/:usu/:type", clearCategoryFolder);

module.exports = router;