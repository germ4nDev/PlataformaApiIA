/*
    Author: German Valencia
    ruta: api/uploads/
*/
const { Router } = require("express");
const { validarJWT } = require("../middlewares/validar-jwt");
const {
    createFolder,
    uploadResource,
    showResource,
    deleteResource,
    clearCategoryFolder
} = require("../controllers/uploads.controller");

const router = Router();

router.post("/folder", createFolder);

router.post("/:suc/:type/:usu", [validarJWT], uploadResource);

router.get("/:suc/:type/:fileName", showResource);

router.delete("/:suc/:type/:usu/:fileName", [validarJWT], deleteResource);

router.delete("/file/:suc/:type/:usu/:fileName", [validarJWT], deleteResource);

router.delete("/clear/:suc/:usu/:type", [validarJWT], clearCategoryFolder);

module.exports = router;