const { Router } = require('express');
const {
  getTiposActividades,
  getTipoActividad,
  postTipoActividad,
  putTipoActividad,
  deleteTipoActividad
} = require('../controllers/tipos-actividad.controller');

const router = Router();

router.get('/', getTiposActividades);
router.get('/:id', getTipoActividad);
router.post('/', postTipoActividad);
router.put('/:id', putTipoActividad);
router.delete('/:id', deleteTipoActividad);

module.exports = router;