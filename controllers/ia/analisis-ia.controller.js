/*
    Author: German Valencia
    Pattern: PORTTOS Controller - Capa de análisis con IA (fase 1 diagnóstico · 2 modo sombra · 3 publicación · 4 tendencias, resúmenes y administración)
    Rutas (con JWT, en routes/ia/analisis-ia.routes.js):
      GET  /api/analisis-ia/estado                        interruptores, fotos, analista, cortacircuito y último turno
      GET  /api/analisis-ia/uso?dias=14                   llamadas, tokens y costo por día, tarea y estado
      POST /api/analisis-ia/:puerto/analizar              análisis manual (respeta IA_ENABLED y el presupuesto)
      GET  /api/analisis-ia/:puerto/hallazgos?estado=&dias=7&limite=100
      GET  /api/analisis-ia/:puerto/sombra?dias=14        revisión del modo sombra: hallazgos por tipo y estado, precisión + uso
      GET  /api/analisis-ia/:puerto/panel                 widget Analista IA: alertas y tendencias vigentes, resumen, estado
      POST /api/analisis-ia/hallazgos/:id/feedback        { util: true|false, comentario? } → CONFIRMADO / FALSO
      GET  /api/analisis-ia/:puerto/tendencias?ventana=24h|7d|30d&modulo=maritimo,gate&relevantes=1
      GET  /api/analisis-ia/:puerto/resumenes?tipo=cierre_turno|resumen_diario&dias=7
      POST /api/analisis-ia/:puerto/resumenes             { tipo } rehace el último periodo cerrado
      POST /api/analisis-ia/asistente/preguntar           { pregunta, puerto?, pestana?, historial? } asistente (fase 5)
      POST /api/analisis-ia/asistente/preguntas/:id/feedback  { util, comentario? }
      Administración (JWT + IA_PERMISO_ADMIN si está definido):
      GET  /api/analisis-ia/admin/resumen?dias=7          estado, uso, costo y precisión por puerto
      GET  /api/analisis-ia/admin/config                  · PUT /admin/config { puerto|'*', codigoTarea, campos o null }
      POST /api/analisis-ia/admin/config/restablecer      { puerto, codigoTarea } → todo hereda
      GET  /api/analisis-ia/admin/prompts?tarea=          · POST /admin/prompts (nueva versión BORRADOR)
      PUT  /api/analisis-ia/admin/prompts/:id/estado      { estado: ACTIVO | RETIRADO }
      GET  /api/analisis-ia/admin/asistente?dias=&decision=   preguntas, conteos por decisión y tema, votos
      GET  /api/analisis-ia/admin/alcance                 · PUT /admin/alcance (un tema) · POST /admin/alcance/probar { pregunta }
      GET /api/analisis-ia/:puerto/foto                   foto operativa del momento (lo que verá el analista)
      GET /api/analisis-ia/:puerto/senales                señales deterministas activas
      GET /api/analisis-ia/:puerto/serie?kpi=&horas=24    serie guardada de un KPI
    Respuesta: { ok: true, data }.
*/
const FotoOperativa = require('../../services/ia/foto-operativa.service');
const Analista = require('../../services/ia/analista.service');
const Tendencias = require('../../services/ia/tendencias-ia.service');
const Resumenes = require('../../services/ia/resumenes-ia.service');
const AdminIA = require('../../services/ia/admin-ia.service');
const Asistente = require('../../services/ia/asistente.service');
const { responderError } = require('../../helpers/errores.helper');

const responder = (fn, contexto) => async (req, res) => {
  try {
    return res.status(200).json({ ok: true, data: await fn(req) });
  } catch (error) {
    return responderError(res, error, contexto);
  }
};

const usuarioDe = (req) => req.userNameUsuario || req.correoUsuario || req.codigoUsuario || 'desconocido';

module.exports = {
  obtenerEstado: responder(async () => ({ ...(await FotoOperativa.estado()), analista: Analista.estado(), resumenes: Resumenes.estado() }), 'AnalisisIA.estado'),
  obtenerUso: responder((req) => Analista.uso(req.query), 'AnalisisIA.uso'),
  analizar: responder((req) => Analista.analizarAhora(req.params), 'AnalisisIA.analizar'),
  obtenerHallazgos: responder((req) => Analista.hallazgos(req.params, req.query), 'AnalisisIA.hallazgos'),
  obtenerSombra: responder((req) => Analista.resumenSombra(req.params, req.query), 'AnalisisIA.sombra'),
  obtenerPanel: responder((req) => Analista.panel(req.params), 'AnalisisIA.panel'),
  registrarFeedback: responder((req) => Analista.feedback(req.params, req.body, usuarioDe(req)), 'AnalisisIA.feedback'),
  obtenerTendencias: responder((req) => Tendencias.tendencias(req.params, req.query), 'AnalisisIA.tendencias'),
  obtenerResumenes: responder((req) => Resumenes.resumenes(req.params, req.query), 'AnalisisIA.resumenes'),
  generarResumen: responder((req) => Resumenes.generarAhora(req.params, req.body), 'AnalisisIA.generarResumen'),
  preguntar: responder((req) => Asistente.preguntar(req.body, usuarioDe(req)), 'AnalisisIA.asistente.preguntar'),
  feedbackPregunta: responder((req) => Asistente.feedback(req.params, req.body, usuarioDe(req)), 'AnalisisIA.asistente.feedback'),
  adminAsistente: responder((req) => Asistente.adminPreguntas(req.query), 'AnalisisIA.admin.asistente'),
  adminAlcance: responder(() => Asistente.adminTemas(), 'AnalisisIA.admin.alcance'),
  adminGuardarAlcance: responder((req) => Asistente.guardarTema(req.body, usuarioDe(req)), 'AnalisisIA.admin.guardarAlcance'),
  adminProbarAlcance: responder((req) => Asistente.probarAlcance(req.body), 'AnalisisIA.admin.probarAlcance'),
  adminResumen: responder((req) => AdminIA.resumen(req.query), 'AnalisisIA.admin.resumen'),
  adminConfig: responder(() => AdminIA.configuracion(), 'AnalisisIA.admin.config'),
  adminGuardarConfig: responder((req) => AdminIA.guardarConfig(req.body, usuarioDe(req)), 'AnalisisIA.admin.guardarConfig'),
  adminRestablecerConfig: responder((req) => AdminIA.restablecerConfig(req.body, usuarioDe(req)), 'AnalisisIA.admin.restablecerConfig'),
  adminPrompts: responder((req) => AdminIA.prompts(req.query), 'AnalisisIA.admin.prompts'),
  adminCrearPrompt: responder((req) => AdminIA.crearPrompt(req.body, usuarioDe(req)), 'AnalisisIA.admin.crearPrompt'),
  adminEstadoPrompt: responder((req) => AdminIA.cambiarEstadoPrompt(req.params, req.body), 'AnalisisIA.admin.estadoPrompt'),
  obtenerFoto: responder((req) => FotoOperativa.foto(req.params), 'AnalisisIA.foto'),
  obtenerSenales: responder((req) => FotoOperativa.senales(req.params), 'AnalisisIA.senales'),
  obtenerSerie: responder((req) => FotoOperativa.serieKpi(req.params, req.query), 'AnalisisIA.serie'),
};
