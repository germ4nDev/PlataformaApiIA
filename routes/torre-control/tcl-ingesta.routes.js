/* routes/tcl-ingesta.js */
const express = require('express');
const router = express.Router();
const multer = require('multer');
const tclIngestaController = require('../../controllers/torre-control/tcl-ingesta.controller');

// Usamos almacenamiento en memoria para procesar el texto directamente
const upload = multer({ storage: multer.memoryStorage() });

// Ruta POST: /api/tcl/procesar-documento
router.post('/procesar-documento', upload.single('archivo'), tclIngestaController.procesarDocumento);

module.exports = router;