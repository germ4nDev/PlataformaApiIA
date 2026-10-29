/*
    Author: German Valencia
    Pattern: PORTTOS Service - Panel de administración de la capa de IA (fase 4)
    Description: Lo que necesita el panel «Administración IA», para todos los puertos activos:
      - resumen(query)                       estado general, uso y costo, precisión y última actividad por puerto
      - configuracion()                      filas de TCL_IAConfig y la configuración efectiva puerto × tarea (con su origen)
      - guardarConfig(body, usuario)         encender/apagar, modo sombra, topes, confianza y tipos por puerto ('*' = todos)
      - restablecerConfig(body, usuario)     deja la fila heredando (todo NULL); no borra
      - prompts(query) / crearPrompt(body, usuario) / cambiarEstadoPrompt(params, body)   versiones: activar o revertir
      Toda escritura invalida la caché de config-ia, así que el cambio aplica en el siguiente turno sin reiniciar.
*/
const { configIA } = require('../../config/ia.config');
const AdminRepo = require('../../repositories/ia/admin-ia.repository');
const AnalisisRepo = require('../../repositories/ia/analisis-ia.repository');
const ConfigIA = require('./config-ia.service');
const PuertosIA = require('./puertos-ia.service');
const Analista = require('./analista.service');
const Resumenes = require('./resumenes-ia.service');
const Cerebro = require('./cerebro.service');
const { TAREAS, CODIGOS_TAREA, resolverConfig } = require('../../utils/ia/config-efectiva');
const { INCORPORADOS } = require('../../utils/ia/prompts');
const { TIPOS_ALERTA } = require('../../utils/ia/analista');
const { resumirUso, precisionTotal } = require('../../utils/ia/admin');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const {
  AdminQuerySchema, ConfigIASchema, PromptParamsSchema, PromptsQuerySchema, PromptSchema, EstadoPromptSchema,
} = require('../../models/ia/analisis-ia.model');

const DIA = 86400000;
const sinMigracion = (error) => error?.codigo === 'MIGRACION_PENDIENTE';

class AdminIAService {
  constructor({ config = configIA, repo = AdminRepo, analisis = AnalisisRepo, ajustes = ConfigIA, puertos = PuertosIA,
    analista = Analista, resumenesSrv = Resumenes, cerebro = Cerebro } = {}) {
    Object.assign(this, { config, repo, analisis, ajustes, puertos, analista, resumenesSrv, cerebro });
  }

  _env() {
    const c = this.config;
    return {
      habilitada: c.habilitada, fotos: c.fotosHabilitadas, proveedor: c.proveedor, modeloAnalista: c.modeloAnalista, modeloResumen: c.modeloResumen,
      modoSombra: c.modoSombra, tiposPublicar: c.tiposPublicar, intervaloMin: c.intervaloAnalistaMin, latidoMin: c.latidoMin,
      topeLlamadasDia: c.topeLlamadasDia, topeTokensDia: c.topeTokensDia, confianzaMinima: c.confianzaMinima,
      resumenes: c.resumenesHabilitados, turnos: c.turnos, puertos: c.puertos, permisoAdmin: c.permisoAdmin,
      asistente: c.asistenteHabilitado, modeloAsistente: c.modeloAsistente, modeloFiltro: c.modeloFiltro, topePreguntasUsuarioDia: c.topePreguntasUsuarioDia,
    };
  }

  async resumen(query = {}, ahora = new Date()) {
    const { dias } = validarCon(AdminQuerySchema, query);
    const desde = new Date(ahora.getTime() - dias * DIA).toISOString();
    const activos = await this.puertos.activos();
    let uso = [];
    let disponible = true;
    try { uso = await this.analisis.uso(desde); } catch (error) { if (!sinMigracion(error)) throw error; disponible = false; }
    const consumo = resumirUso(uso);
    const puertos = await Promise.all(activos.map(async (p) => {
      const [precision, conteos, ...efectivas] = await Promise.all([
        disponible ? this.analisis.precision(p.clave, desde).catch(() => []) : [],
        disponible ? this.analisis.resumenHallazgos(p.clave, desde).catch(() => []) : [],
        ...CODIGOS_TAREA.map((t) => this.ajustes.efectiva(p.clave, t)),
      ]);
      const contar = (pred) => conteos.filter(pred).reduce((t, f) => t + (Number(f.cantidad) || 0), 0);
      const turno = this.analista.ultimoTurno?.resultados?.find((r) => r.puerto === p.clave) || null;
      return {
        puerto: p.clave, nombre: p.nombre || p.clave,
        tareas: Object.fromEntries(CODIGOS_TAREA.map((t, i) => [t, { ...efectivas[i], uso: consumo.porPuerto[p.clave]?.[t] || null }])),
        hallazgos: {
          alertas: contar((f) => f.clase === 'ALERTA'), publicadas: contar((f) => f.clase === 'ALERTA' && ['PUBLICADO', 'CONFIRMADO', 'FALSO'].includes(f.estado)),
          descartadas: contar((f) => f.clase === 'ALERTA' && f.estado === 'DESCARTADO'), resumenes: contar((f) => f.clase === 'RESUMEN'),
        },
        precision: precisionTotal(precision), precisionPorTipo: precision,
        ultimoTurno: turno ? { fecha: this.analista.ultimoTurno.fecha, estado: turno.estado, motivo: turno.motivo || null } : null,
      };
    }));
    return {
      generadoEn: ahora.toISOString(), dias, disponible, env: this._env(), cerebro: this.cerebro.estado(),
      verificacion: this.analista.ultimaVerificacion, resumenes: this.resumenesSrv.estado(),
      consumo: { total: consumo.total, porDia: consumo.porDia }, puertos,
    };
  }

  async configuracion() {
    const { filas, esquema017 } = await this.ajustes.filas();
    const activos = await this.puertos.activos();
    const claves = ['*', ...activos.map((p) => p.clave)];
    return {
      esquema017, tareas: TAREAS, tiposAlerta: TIPOS_ALERTA, env: this._env(),
      filas: filas.map((f) => ({ ...f, tiposPublicar: f.tiposPublicar ? String(f.tiposPublicar).split(',') : null })),
      puertos: activos.map((p) => ({ clave: p.clave, nombre: p.nombre || p.clave })),
      efectiva: claves.map((puerto) => ({
        puerto, tareas: Object.fromEntries(CODIGOS_TAREA.map((t) => [t, resolverConfig(filas, puerto === '*' ? '__todos__' : puerto, t, this.config)])),
      })),
    };
  }

  async _clavePuerto(puerto) {
    if (puerto === '*') return '*';
    const { clave } = await this.puertos.resolver(puerto);   // 404 si no existe
    return clave;
  }

  async guardarConfig(body, usuario) {
    const v = validarCon(ConfigIASchema, body);
    const { esquema017 } = await this.ajustes.filas();
    if (!esquema017) throw crearError(503, 'Falta aplicar la migración 017_ia_resumenes_admin.sql para configurar por puerto', 'MIGRACION_PENDIENTE');
    const fila = { ...v, puerto: await this._clavePuerto(v.puerto), tiposPublicar: v.tiposPublicar ? v.tiposPublicar.join(',') : null };
    await this.repo.guardarConfig(fila, usuario);
    this.ajustes.invalidar();
    return this.configuracion();
  }

  async restablecerConfig(body, usuario) {
    const { puerto, codigoTarea } = validarCon(ConfigIASchema, { puerto: body?.puerto, codigoTarea: body?.codigoTarea });
    return this.guardarConfig({ puerto, codigoTarea }, usuario);
  }

  async prompts(query = {}) {
    const { tarea } = validarCon(PromptsQuerySchema, query);
    let versiones = [];
    let disponible = true;
    try { versiones = await this.repo.prompts(tarea || null); } catch (error) { if (!sinMigracion(error)) throw error; disponible = false; }
    const incorporados = Object.values(INCORPORADOS).filter((p) => !tarea || p.codigoTarea === tarea).map((p) => ({
      codigoTarea: p.codigoTarea, version: p.version, origen: 'incorporado', temperatura: p.temperatura, maxTokens: p.maxTokens,
      modelo: { resumen_turno: this.config.modeloResumen, asistente: this.config.modeloAsistente, filtro: this.config.modeloFiltro }[p.codigoTarea] || this.config.modeloAnalista,
      sistema: p.sistema, esquemaSalida: JSON.stringify(p.herramienta, null, 2),
    }));
    const activos = Object.fromEntries(CODIGOS_TAREA.map((t) => {
      const activo = versiones.find((v) => v.codigoTarea === t && v.estado === 'ACTIVO');
      return [t, activo ? { origen: 'TCL_IAPrompts', id: activo.id, version: activo.version } : { origen: 'incorporado', version: INCORPORADOS[t]?.version ?? 1 }];
    }));
    return { disponible, tareas: TAREAS, incorporados, versiones, activos };
  }

  async crearPrompt(body, usuario) {
    const v = validarCon(PromptSchema, body);
    const r = await this.repo.crearPrompt(v, usuario);
    return { ...(await this.prompts({ tarea: v.codigoTarea })), creado: r };
  }

  async cambiarEstadoPrompt(params, body) {
    const { id } = validarCon(PromptParamsSchema, params);
    const { estado } = validarCon(EstadoPromptSchema, body);
    const p = await this.repo.obtenerPrompt(id);
    if (!p) throw crearError(404, `No existe la versión de prompt ${id}`, 'PROMPT_NO_EXISTE');
    await this.repo.cambiarEstadoPrompt(id, estado);
    return this.prompts({ tarea: p.codigoTarea });
  }
}

module.exports = new AdminIAService();
module.exports.AdminIAService = AdminIAService;
