/*
    Author: German Valencia
    Pattern: PORTTOS Service - Recorrido del mapa (modo reproducir las últimas horas)
    Description:
      - muestrear(): proceso 'recorrido-muestreo' (cada minuto). Lee las posiciones actuales de naves y camiones y
        guarda solo lo que cambió (utils/recorrido-mapa.js → filtrarCambios). Sin la migración 012 se apaga solo.
      - recorrido(puerto, { horas }): trayectorias compactas de la ventana + línea de tiempo (alertas del mapa y
        cambios de estado AIS). Naves con la caja marítima del puerto, camiones con la terrestre (igual que el mapa).
      - limpiar(): proceso 'recorrido-limpieza' (diario). Retención RECORRIDO_RETENCION_DIAS (3 por defecto).
*/
const RecorridoMapaRepository = require('../../repositories/torre-control/recorrido-mapa.repository');
const AlertasMapaRepository = require('../../repositories/torre-control/alertas-mapa.repository');
const MaritimoVivoRepository = require('../../repositories/torre-control/maritimo-vivo.repository');
const AlertasMapaService = require('./alertas-mapa.service');
const { normalizarPuerto } = require('../../helpers/salas.helper');
const { cajaPuerto, MARGEN } = require('../../helpers/caja-puerto.helper');
const { noEncontrado } = require('../../helpers/errores.helper');
const R = require('../../utils/recorrido-mapa');

const RETENCION_DIAS_DEFECTO = 3;
const VIGENCIA_AIS_MIN = 30;

const retencionDias = () => {
  const n = Number(process.env.RECORRIDO_RETENCION_DIAS);
  return Number.isInteger(n) && n >= 1 && n <= 30 ? n : RETENCION_DIAS_DEFECTO;
};
const sinMigracion = (e) => e?.codigo === 'MIGRACION_PENDIENTE';

class RecorridoMapaService {
  constructor(repositorio = RecorridoMapaRepository) {
    this.repositorio = repositorio;
    this.ultimas = new Map();   // tipo:id → última muestra guardada
    this.activo = null;         // null = sin saber; false = falta la migración 012 (hasta reiniciar el API)
  }

  /** Guarda las posiciones que cambiaron desde la última muestra. Devuelve cuántas filas guardó. */
  async muestrear(ahora = new Date()) {
    if (this.activo === false) return 0;
    const posiciones = await this.repositorio.posicionesActuales(VIGENCIA_AIS_MIN);
    // Se filtra sobre una copia: si la escritura falla, la próxima vuelta lo intenta de nuevo con todo
    const copia = new Map(this.ultimas);
    const cambios = R.filtrarCambios(posiciones, copia, ahora.getTime());
    if (!cambios.length) { this.ultimas = copia; return 0; }
    try {
      const n = await this.repositorio.guardar(cambios);
      this.ultimas = copia;
      this.activo = true;
      return n;
    } catch (error) {
      if (!sinMigracion(error)) throw error;
      console.warn('[RecorridoMapa] Falta la migración 012_recorrido_mapa.sql: muestreo apagado hasta reiniciar el API.');
      this.activo = false;
      return 0;
    }
  }

  /** Recorrido de las últimas :horas del puerto, listo para el modo reproducir del mapa. */
  async recorrido(puerto, { horas = 24 } = {}, ahora = new Date()) {
    const clave = normalizarPuerto(puerto || '');
    const [cajaNaves, cajaCamiones] = await Promise.all([cajaPuerto(clave, MARGEN.MARITIMO), cajaPuerto(clave, MARGEN.TERRESTRE)]);
    if (!cajaNaves || !cajaCamiones) throw noEncontrado(`El puerto ${clave} no existe o no tiene geocerca`);

    const hastaMs = ahora.getTime();
    const desdeMs = hastaMs - horas * 3600000;
    const desde = new Date(desdeMs).toISOString();
    const hasta = new Date(hastaMs).toISOString();

    const filas = await this.repositorio.recorrido({ naves: cajaNaves, camiones: cajaCamiones }, desde, hasta);
    const [alertas, transiciones] = await Promise.all([this._alertas(clave, desde, hasta, desdeMs), this._transiciones(clave, desde, hasta)]);

    const recorrido = R.armarRecorrido(filas, { desdeMs, hastaMs, pasoSeg: R.pasoPara(horas), puerto: clave });
    return { ...recorrido, eventos: R.lineaDeTiempo({ alertas, transiciones }, desdeMs, hastaMs) };
  }

  /** Alertas de la ventana: de TCL_AlertasMapa; sin la migración 011, las que el API tenga en memoria. */
  async _alertas(clave, desde, hasta, desdeMs) {
    try {
      return await AlertasMapaRepository.entre(clave, desde, hasta);
    } catch (error) {
      if (error?.codigo !== 'SIN_MIGRACION_011') console.warn('[RecorridoMapa] Alertas no disponibles:', error.message);
      const memoria = await AlertasMapaService.bitacora(clave, 50).catch(() => []);
      return memoria.filter((a) => Date.parse(a.fecha) >= desdeMs);
    }
  }

  /** Cambios de estado AIS del puerto; sin la migración 005 la línea de tiempo sale solo con alertas. */
  async _transiciones(clave, desde, hasta) {
    try {
      const puerto = await MaritimoVivoRepository.buscarPuerto(clave);
      return puerto ? await this.repositorio.transiciones(puerto.idPuerto, desde, hasta) : [];
    } catch (error) {
      if (!sinMigracion(error)) console.warn('[RecorridoMapa] Cambios de estado no disponibles:', error.message);
      return [];
    }
  }

  async limpiar(ahora = new Date()) {
    if (this.activo === false) return 0;
    const antes = new Date(ahora.getTime() - retencionDias() * 86400000).toISOString();
    try {
      await this.repositorio.purgar(antes);
    } catch (error) {
      if (!sinMigracion(error)) throw error;
      this.activo = false;
    }
    return 0;
  }
}

module.exports = new RecorridoMapaService();
module.exports.RecorridoMapaService = RecorridoMapaService;
