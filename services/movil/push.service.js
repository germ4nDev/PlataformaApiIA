/*
    Author: German Valencia
    Pattern: PORTTOS Service - Notificaciones push de la app móvil (fase 3)
    Description:
      - registrar(body, { codigoUsuario, codigoSesion })  alta del teléfono con sus preferencias (puertos, severidad, idioma)
      - baja(body, { codigoUsuario })                      al cerrar sesión o desactivar las notificaciones
      - misDispositivos({ codigoUsuario })                 lo registrado por el usuario (sin tokens)
      - probar({ codigoUsuario, codigoSesion })            notificación de prueba al dispositivo de la sesión activa
      - notificarHallazgos(puerto, hallazgos)              la llama el Analista IA al publicar alertas tempranas
      - estado()                                           habilitado / configurado, sin secretos
      Una sola sesión por usuario: solo recibe el dispositivo cuya sesión sigue activa (repositorio.destinatarios).
      Sin PUSH_ENABLED, sin credenciales de FCM o sin la migración 019, notificarHallazgos no hace nada y no falla.
*/
const { configPush, estadoPush } = require('../../config/push.config');
const Dispositivos = require('../../repositories/movil/dispositivos.repository');
const FCM = require('../../adapters/fcm.adapter');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const { RegistroDispositivoSchema, BajaDispositivoSchema } = require('../../models/movil/dispositivos.model');
const P = require('../../utils/movil/push');

const ENVIOS_A_LA_VEZ = 10;

class PushService {
  constructor({ config = configPush, repo = Dispositivos, fcm = FCM } = {}) {
    Object.assign(this, { config, repo, fcm });
    this.ultimo = null;
  }

  estado() {
    return { ...estadoPush(this.config), ultimoEnvio: this.ultimo };
  }

  async registrar(body, { codigoUsuario, codigoSesion }) {
    const d = validarCon(RegistroDispositivoSchema, body);
    if (!codigoSesion) throw crearError(400, 'Falta la sesión (x-sesion-id) para registrar el dispositivo', 'SIN_SESION');
    const pref = P.normalizarPreferencias(d);
    const id = await this.repo.registrar({ token: d.token, plataforma: d.plataforma, codigoUsuario, codigoSesion, ...pref });
    return { id, ...pref, notificacionesActivas: this.config.habilitado && this.config.configurado };
  }

  async baja(body, { codigoUsuario }) {
    const { token } = validarCon(BajaDispositivoSchema, body);
    return { desactivados: await this.repo.baja(token, codigoUsuario) };
  }

  async misDispositivos({ codigoUsuario }) {
    return { dispositivos: await this.repo.deUsuario(codigoUsuario), ...estadoPush(this.config) };
  }

  async _enviar(d, msg, extra) {
    const r = await this.fcm.enviar(this.config, { token: d.token, plataforma: d.plataforma, ...msg });
    const estado = r.ok ? 'ENVIADO' : r.tokenInvalido ? 'TOKEN_INVALIDO' : 'ERROR';
    if (r.tokenInvalido) await this.repo.invalidar(d.id);
    else if (!r.ok) await this.repo.contarFallo(d.id);
    for (const idHallazgo of extra.ids || [null]) {
      await this.repo.registrarEnvio({ idDispositivo: d.id, idHallazgo, puerto: extra.puerto, tipo: extra.tipo, estado, error: r.error });
    }
    return estado;
  }

  async probar({ codigoUsuario }) {
    if (!this.config.habilitado) throw crearError(409, 'Las notificaciones están apagadas en el servidor (PUSH_ENABLED)', 'PUSH_APAGADO');
    if (!this.config.configurado) throw crearError(409, 'Falta configurar Firebase (FCM_PROJECT_ID, FCM_CLIENT_EMAIL, FCM_PRIVATE_KEY)', 'PUSH_SIN_CONFIGURAR');
    const destinos = await this.repo.destinatarios({ codigoUsuario });
    if (!destinos.length) throw crearError(404, 'No hay un dispositivo registrado con tu sesión activa', 'SIN_DISPOSITIVO');
    const resultados = [];
    for (const d of destinos) resultados.push(await this._enviar(d, P.mensajePrueba(d.idioma), { tipo: 'prueba' }));
    return { enviados: resultados.filter((r) => r === 'ENVIADO').length, total: resultados.length };
  }

  /** Alertas tempranas publicadas por el Analista IA → notificación a cada dispositivo interesado. Nunca lanza. */
  async notificarHallazgos(puerto, hallazgos = []) {
    if (!this.config.habilitado || !this.config.configurado || !hallazgos.length) return { enviados: 0, omitido: true };
    try {
      const [destinos, previos] = await Promise.all([this.repo.destinatarios(), this.repo.yaEnviados(hallazgos.map((h) => h.id))]);
      const plan = P.planEnvios(destinos, puerto, hallazgos, previos, this.config.maxPorTurno);
      // Los mensajes de un mismo dispositivo van en orden (si su token resulta inválido, no se insiste);
      // los dispositivos, de a ENVIOS_A_LA_VEZ en paralelo.
      const porDispositivo = [...plan.reduce((m, p) => m.set(p.dispositivo.id, [...(m.get(p.dispositivo.id) || []), p]), new Map()).values()];
      let enviados = 0;
      for (let i = 0; i < porDispositivo.length; i += ENVIOS_A_LA_VEZ) {
        const r = await Promise.all(porDispositivo.slice(i, i + ENVIOS_A_LA_VEZ).map(async (mensajes) => {
          let ok = 0;
          for (const p of mensajes) {
            const estado = await this._enviar(p.dispositivo, P.mensaje(p.hallazgos, puerto, p.dispositivo.idioma, p.resumen),
              { tipo: 'ia-alerta', puerto, ids: p.hallazgos.map((h) => h.id) });
            if (estado === 'ENVIADO') ok++;
            if (estado === 'TOKEN_INVALIDO') break;
          }
          return ok;
        }));
        enviados += r.reduce((a, b) => a + b, 0);
      }
      this.ultimo = { fecha: new Date().toISOString(), puerto, mensajes: plan.length, enviados };
      return { enviados, mensajes: plan.length };
    } catch (error) {
      if (error?.codigo !== 'MIGRACION_PENDIENTE') console.error('[PUSH] No se pudieron enviar las notificaciones:', error?.message || error);
      return { enviados: 0, error: true };
    }
  }
}

module.exports = new PushService();
module.exports.PushService = PushService;
