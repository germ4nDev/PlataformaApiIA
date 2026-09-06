const { Router } = require('express');
const { validarJWT } = require("../middlewares/validar-jwt");

const {
  getTiposRole,
  getTipoRoleById,
  crearTipoRole,
  actualizarTipoRole,
  eliminarTipoRole } = require('../controllers/tipos-roles.controller');

const router = Router();

// router.use(validarJWT);

router.get('/', getTiposRole);
router.get('/:id', getTipoRoleById);
router.post('/', crearTipoRole);
router.put('/:id', actualizarTipoRole);
router.delete('/:id', eliminarTipoRole);

module.exports = router;