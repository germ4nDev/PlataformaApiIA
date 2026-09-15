const { Router } = require('express');
const { getLayoutByUsuario, saveOrUpdateLayout } = require('../controllers/usuarios-widgets.controller');

const router = Router();

router.get('/:codigoUsuario', getLayoutByUsuario);
router.post('/', saveOrUpdateLayout);

module.exports = router;