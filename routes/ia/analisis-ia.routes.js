/*
    Author: German Valencia
    Rutas de la capa de análisis con IA (diagnóstico, analista, tendencias, resúmenes y administración). Todas con JWT.
*/
const express = require('express');
const { validarJWT } = require('../../middlewares/validar-jwt');
const { validarPermiso } = require('../../middlewares/validar-permiso');
const { configIA } = require('../../config/ia.config');
const AnalisisIA = require('../../controllers/ia/analisis-ia.controller');

const router = express.Router();
router.use(validarJWT);

// Administración: JWT y, si IA_PERMISO_ADMIN está definido, esa llavePermiso (PTLActividades)
const admin = configIA.permisoAdmin ? [validarPermiso(configIA.permisoAdmin)] : [];
router.get('/admin/resumen', admin, AnalisisIA.adminResumen);
router.get('/admin/config', admin, AnalisisIA.adminConfig);
router.put('/admin/config', admin, AnalisisIA.adminGuardarConfig);
router.post('/admin/config/restablecer', admin, AnalisisIA.adminRestablecerConfig);
router.get('/admin/prompts', admin, AnalisisIA.adminPrompts);
router.post('/admin/prompts', admin, AnalisisIA.adminCrearPrompt);
router.put('/admin/prompts/:id/estado', admin, AnalisisIA.adminEstadoPrompt);

router.get('/admin/asistente', admin, AnalisisIA.adminAsistente);
router.get('/admin/alcance', admin, AnalisisIA.adminAlcance);
router.put('/admin/alcance', admin, AnalisisIA.adminGuardarAlcance);
router.post('/admin/alcance/probar', admin, AnalisisIA.adminProbarAlcance);

// Asistente (fase 5): cualquier usuario con sesión; tope por usuario y día
router.post('/asistente/preguntar', AnalisisIA.preguntar);
router.post('/asistente/preguntas/:id/feedback', AnalisisIA.feedbackPregunta);

router.get('/estado', AnalisisIA.obtenerEstado);
router.get('/uso', AnalisisIA.obtenerUso);
router.post('/hallazgos/:id/feedback', AnalisisIA.registrarFeedback);
router.post('/:puerto/analizar', AnalisisIA.analizar);
router.get('/:puerto/hallazgos', AnalisisIA.obtenerHallazgos);
router.get('/:puerto/sombra', AnalisisIA.obtenerSombra);
router.get('/:puerto/panel', AnalisisIA.obtenerPanel);
router.get('/:puerto/tendencias', AnalisisIA.obtenerTendencias);
router.get('/:puerto/resumenes', AnalisisIA.obtenerResumenes);
router.post('/:puerto/resumenes', AnalisisIA.generarResumen);
router.get('/:puerto/foto', AnalisisIA.obtenerFoto);
router.get('/:puerto/senales', AnalisisIA.obtenerSenales);
router.get('/:puerto/serie', AnalisisIA.obtenerSerie);

module.exports = router;
