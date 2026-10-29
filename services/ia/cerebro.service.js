/*
    Author: German Valencia
    Pattern: PORTTOS Service - Cerebro IA (puerto CerebroIA): el único que llama al modelo
    Description: Toda llamada al modelo pasa por ejecutar(), en este orden:
        1. IA_ENABLED (si está apagado no se llama)   2. cortacircuito   3. presupuesto del día por puerto y tarea
        4. caché (misma huella y misma versión de prompt, 15 min)   5. llamada con tiempo límite y 2 reintentos
        6. validación del esquema; si falla, UN reintento con los errores devueltos al modelo
        7. registro en TCL_IAEjecuciones (tokens, costo estimado, latencia, estado)
      Adaptadores: adapters/ia/anthropic.adapter.js (IA_PROVEEDOR=anthropic) y adapters/ia/simulador.adapter.js.
      Estados: OK · INVALIDA · ERROR · OMITIDA_APAGADA · OMITIDA_PRESUPUESTO · OMITIDA_CACHE · CORTACIRCUITO.
      conversar() (fase 5, asistente): mismos controles 1, 2, 3, 5 y 7, en varios turnos con herramientas de lectura;
      la respuesta final se valida y, si no cumple, se le devuelven los errores una vez.
      Inyectable (config, repositorio, adaptadores, dormir) para las pruebas.
*/
const { configIA } = require('../../config/ia.config');
const AnalisisRepo = require('../../repositories/ia/analisis-ia.repository');
const AnthropicAdapter = require('../../adapters/ia/anthropic.adapter');
const SimuladorAdapter = require('../../adapters/ia/simulador.adapter');
const { costoUsd, evaluarPresupuesto, Cortacircuito, esReintentable, esperaReintento } = require('../../utils/ia/control-llamadas');
const { inicioDiaColombia } = require('../../utils/tablero-comun');

const CACHE_MS = 15 * 60000;
const TIMEOUT_MS = 60000;
const REINTENTOS = 2;

class CerebroService {
  constructor({ config = configIA, repo = AnalisisRepo, adaptadores = { anthropic: AnthropicAdapter, simulador: SimuladorAdapter }, dormir } = {}) {
    this.config = config;
    this.repo = repo;
    this.adaptadores = adaptadores;
    this.dormir = dormir || ((ms) => new Promise((r) => setTimeout(r, ms)));
    this.cortacircuito = new Cortacircuito();
    this.cache = new Map();          // `${tarea}|${puerto}|${version}|${hash}` → { hasta, valor }
    this.ultima = null;              // última ejecución (para /estado)
    this.avisoPresupuesto = new Set();
  }

  get adaptador() {
    return this.adaptadores[this.config.proveedor] || this.adaptadores.anthropic;
  }

  estado(ahoraMs = Date.now()) {
    return { proveedor: this.config.proveedor, cortacircuito: this.cortacircuito.estado(ahoraMs), ultima: this.ultima };
  }

  async _registrar(e) {
    const fila = { proveedor: this.adaptador.nombre, ...e };
    this.ultima = { ...fila, fecha: new Date().toISOString() };
    try {
      return await this.repo.registrarEjecucion(fila);
    } catch (error) {
      console.error('[IA] No se pudo registrar la ejecución:', error?.msg || error?.message);
      return null;
    }
  }

  /**
   * @param {object} p
   * @param {string} p.tarea          codigoTarea (analista_turno, ...)
   * @param {string} p.puerto
   * @param {{version:number, idPrompt:number|null, temperatura:number, maxTokens:number}} p.prompt
   * @param {string} p.modelo
   * @param {{sistema, mensajes, herramienta}} p.solicitud   armada por la tarea (utils/ia/*)
   * @param {string} p.hash           huella de la entrada (caché)
   * @param {(entrada:any) => {ok:boolean, valor:any, errores:string[]}} p.validar
   * @param {object} [p.contexto]     solo para el simulador (p. ej. { foto })
   * @param {{llamadas?:number, tokens?:number}} [p.topes]  topes del puerto y la tarea (TCL_IAConfig); si no, los del .env
   * @returns {Promise<{estado:string, valor?:any, idEjecucion?:number|null, motivo?:string, uso?:object, desdeCache?:boolean}>}
   */
  async ejecutar({ tarea, puerto, prompt, modelo, solicitud, hash, validar, contexto = {}, topes = {} }, ahora = new Date()) {
    const base = { codigoTarea: tarea, puerto, idPrompt: prompt.idPrompt ?? null, modelo, hashFoto: hash };
    if (!this.config.habilitada) return { estado: 'OMITIDA_APAGADA', motivo: 'IA_ENABLED=false en el .env' };

    if (this.cortacircuito.abierto(ahora.getTime())) {
      const motivo = `cortacircuito abierto hasta ${this.cortacircuito.estado(ahora.getTime()).hasta}`;
      await this._registrar({ ...base, estado: 'CORTACIRCUITO', error: motivo });
      return { estado: 'CORTACIRCUITO', motivo };
    }

    const claveCache = `${tarea}|${puerto}|${prompt.version}|${hash}`;
    const enCache = this.cache.get(claveCache);
    if (enCache && enCache.hasta > ahora.getTime()) {
      await this._registrar({ ...base, estado: 'OMITIDA_CACHE' });
      return { estado: 'OK', valor: enCache.valor, desdeCache: true, idEjecucion: enCache.idEjecucion };
    }

    const desde = new Date(inicioDiaColombia(ahora.getTime())).toISOString();
    const presupuesto = evaluarPresupuesto(await this.repo.usoDelDia(puerto, tarea, desde),
      { llamadas: topes.llamadas ?? this.config.topeLlamadasDia, tokens: topes.tokens ?? this.config.topeTokensDia });
    if (!presupuesto.permitido) {
      await this._registrar({ ...base, estado: 'OMITIDA_PRESUPUESTO', error: presupuesto.motivo });
      return { estado: 'OMITIDA_PRESUPUESTO', motivo: presupuesto.motivo };
    }
    const claveAviso = `${puerto}|${tarea}|${desde}`;
    if (presupuesto.aviso && !this.avisoPresupuesto.has(claveAviso)) {
      this.avisoPresupuesto.add(claveAviso);
      console.warn(`[IA] ${puerto} · ${tarea}: va en el ${Math.round(presupuesto.pct * 100)} % del tope diario.`);
    }

    const pedir = async (mensajes) => {
      let ultimoError = null;
      for (let intento = 0; intento <= REINTENTOS; intento++) {
        if (intento > 0) await this.dormir(esperaReintento(intento));
        try {
          return await this.adaptador.generar({
            modelo, sistema: solicitud.sistema, mensajes, herramienta: solicitud.herramienta,
            maxTokens: prompt.maxTokens, temperatura: prompt.temperatura, timeoutMs: TIMEOUT_MS, contexto,
          });
        } catch (error) {
          ultimoError = error;
          if (!esReintentable(error)) break;
        }
      }
      throw ultimoError;
    };

    const inicio = Date.now();
    const uso = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 };
    const sumar = (u = {}) => Object.keys(uso).forEach((k) => { uso[k] += Number(u[k]) || 0; });
    let respuesta;
    try {
      respuesta = await pedir(solicitud.mensajes);
      sumar(respuesta.uso);
    } catch (error) {
      this.cortacircuito.fallo(ahora.getTime());
      const id = await this._registrar({ ...base, estado: 'ERROR', latenciaMs: Date.now() - inicio, error: error?.message || String(error) });
      return { estado: 'ERROR', motivo: error?.message || 'error del proveedor', idEjecucion: id };
    }

    let validacion = validar(respuesta.toolInput);
    if (!validacion.ok) {
      // Un reintento: se le devuelven al modelo los errores de su propia salida
      try {
        const correccion = await pedir([
          ...solicitud.mensajes,
          { role: 'assistant', content: [{ type: 'tool_use', id: respuesta.toolUseId || 'salida', name: solicitud.herramienta.name, input: respuesta.toolInput || {} }] },
          { role: 'user', content: [{ type: 'tool_result', tool_use_id: respuesta.toolUseId || 'salida', is_error: true, content: `La salida no cumple el esquema: ${validacion.errores.slice(0, 15).join(' | ')}. Corrige y vuelve a llamar ${solicitud.herramienta.name}.` }] },
        ]);
        sumar(correccion.uso);
        respuesta = correccion;
        validacion = validar(correccion.toolInput);
      } catch (error) {
        validacion = { ok: false, errores: [...validacion.errores, `reintento: ${error?.message || error}`] };
      }
    }

    this.cortacircuito.exito();
    const fila = {
      ...base, modelo: respuesta.modelo || modelo,
      tokensEntrada: uso.entrada, tokensSalida: uso.salida, tokensCache: uso.cacheLectura + uso.cacheEscritura,
      costoUsd: costoUsd(modelo, uso), latenciaMs: Date.now() - inicio,
      estado: validacion.ok ? 'OK' : 'INVALIDA', error: validacion.ok ? null : validacion.errores.slice(0, 15).join(' | '),
    };
    const idEjecucion = await this._registrar(fila);
    if (!validacion.ok) return { estado: 'INVALIDA', motivo: fila.error, idEjecucion, uso };
    this.cache.set(claveCache, { hasta: ahora.getTime() + CACHE_MS, valor: validacion.valor, idEjecucion });
    return { estado: 'OK', valor: validacion.valor, idEjecucion, uso, costoUsd: fila.costoUsd };
  }

  // ── Fase 5: conversación con herramientas (asistente) ─────────────────────────────────────────────

  /** Revisa interruptor, cortacircuito y presupuesto antes de una tarea. null = puede seguir. */
  async _puedeLlamar(base, puerto, tarea, topes, ahora) {
    if (!this.config.habilitada) return { estado: 'OMITIDA_APAGADA', motivo: 'IA_ENABLED=false en el .env' };
    if (this.cortacircuito.abierto(ahora.getTime())) {
      const motivo = `cortacircuito abierto hasta ${this.cortacircuito.estado(ahora.getTime()).hasta}`;
      await this._registrar({ ...base, estado: 'CORTACIRCUITO', error: motivo });
      return { estado: 'CORTACIRCUITO', motivo };
    }
    const desde = new Date(inicioDiaColombia(ahora.getTime())).toISOString();
    const presupuesto = evaluarPresupuesto(await this.repo.usoDelDia(puerto, tarea, desde),
      { llamadas: topes.llamadas ?? this.config.topeLlamadasDia, tokens: topes.tokens ?? this.config.topeTokensDia });
    if (!presupuesto.permitido) {
      await this._registrar({ ...base, estado: 'OMITIDA_PRESUPUESTO', error: presupuesto.motivo });
      return { estado: 'OMITIDA_PRESUPUESTO', motivo: presupuesto.motivo };
    }
    return null;
  }

  /**
   * Conversación con herramientas de lectura: el modelo pide datos (una o varias herramientas por turno), se le
   * devuelven los resultados y al final llama la herramienta 'final' (validada). El último turno la fuerza.
   * Una sola fila en TCL_IAEjecuciones con todos los tokens. Sin caché (cada pregunta es distinta).
   * @param {object} p
   * @param {{sistema, mensajes, herramientas, final:string}} p.solicitud
   * @param {(nombre:string, entrada:object) => Promise<string>} p.ejecutar   ejecuta una herramienta de datos (texto JSON)
   * @param {(entrada:any) => {ok, valor, errores}} p.validar               valida la entrada de la herramienta final
   * @returns {Promise<{estado, valor?, motivo?, herramientas:Array<{nombre, entrada, ok, ms}>, resultados:string[], idEjecucion?, uso?, costoUsd?, pasos:number}>}
   */
  async conversar({ tarea, puerto, prompt, modelo, solicitud, ejecutar, validar, maxPasos = 6, topes = {}, contexto = {} }, ahora = new Date()) {
    const base = { codigoTarea: tarea, puerto, idPrompt: prompt.idPrompt ?? null, modelo, hashFoto: null };
    const usadas = [];
    const resultados = [];
    const bloqueo = await this._puedeLlamar(base, puerto, tarea, topes, ahora);
    if (bloqueo) return { ...bloqueo, herramientas: usadas, resultados, pasos: 0 };

    const adaptador = this.adaptador;
    if (typeof adaptador.conversar !== 'function') return { estado: 'ERROR', motivo: `el proveedor ${adaptador.nombre} no conversa con herramientas`, herramientas: usadas, resultados, pasos: 0 };
    const inicio = Date.now();
    const uso = { entrada: 0, salida: 0, cacheLectura: 0, cacheEscritura: 0 };
    const sumar = (u = {}) => Object.keys(uso).forEach((k) => { uso[k] += Number(u[k]) || 0; });
    const mensajes = [...solicitud.mensajes];
    let modeloUsado = modelo;
    let correcciones = 0;
    let final = null;
    let errores = [];
    let pasos = 0;

    const pedir = async (eleccion) => {
      let ultimoError = null;
      for (let intento = 0; intento <= REINTENTOS; intento++) {
        if (intento > 0) await this.dormir(esperaReintento(intento));
        try {
          return await adaptador.conversar({
            modelo, sistema: solicitud.sistema, mensajes, herramientas: solicitud.herramientas, eleccion,
            maxTokens: prompt.maxTokens, temperatura: prompt.temperatura, timeoutMs: TIMEOUT_MS, contexto,
          });
        } catch (error) {
          ultimoError = error;
          if (!esReintentable(error)) break;
        }
      }
      throw ultimoError;
    };

    try {
      for (pasos = 1; pasos <= maxPasos && !final; pasos++) {
        const r = await pedir(pasos === maxPasos ? { nombre: solicitud.final } : 'any');
        sumar(r.uso);
        modeloUsado = r.modelo || modeloUsado;
        const contenido = r.contenido || [];
        const llamadas = contenido.filter((c) => c.type === 'tool_use');
        mensajes.push({ role: 'assistant', content: contenido.length ? contenido : [{ type: 'text', text: '(sin contenido)' }] });
        if (!llamadas.length) {
          mensajes.push({ role: 'user', content: `Responde llamando la herramienta ${solicitud.final}.` });
          continue;
        }
        const respuestas = await Promise.all(llamadas.map(async (c) => {
          if (c.name === solicitud.final) {
            const v = validar(c.input);
            if (v.ok) { final = v.valor; return { type: 'tool_result', tool_use_id: c.id, content: 'recibido' }; }
            errores = v.errores;
            correcciones++;
            return { type: 'tool_result', tool_use_id: c.id, is_error: true, content: `La respuesta no cumple el esquema: ${v.errores.slice(0, 10).join(' | ')}. Corrige y vuelve a llamar ${solicitud.final}.` };
          }
          const t0 = Date.now();
          let texto;
          let ok = true;
          try {
            texto = await ejecutar(c.name, c.input || {});
          } catch (error) {
            ok = false;
            texto = JSON.stringify({ error: String(error?.msg || error?.message || 'no se pudo consultar').slice(0, 300) });
          }
          usadas.push({ nombre: c.name, entrada: c.input || {}, ok, ms: Date.now() - t0 });
          resultados.push(texto);
          return { type: 'tool_result', tool_use_id: c.id, content: texto, ...(ok ? {} : { is_error: true }) };
        }));
        if (final) break;
        if (correcciones > 1) break;
        mensajes.push({ role: 'user', content: respuestas });
      }
    } catch (error) {
      this.cortacircuito.fallo(ahora.getTime());
      const id = await this._registrar({ ...base, estado: 'ERROR', latenciaMs: Date.now() - inicio, error: error?.message || String(error),
        tokensEntrada: uso.entrada, tokensSalida: uso.salida, tokensCache: uso.cacheLectura + uso.cacheEscritura, costoUsd: costoUsd(modelo, uso) });
      return { estado: 'ERROR', motivo: error?.message || 'error del proveedor', idEjecucion: id, herramientas: usadas, resultados, pasos };
    }

    this.cortacircuito.exito();
    const fila = {
      ...base, modelo: modeloUsado, tokensEntrada: uso.entrada, tokensSalida: uso.salida, tokensCache: uso.cacheLectura + uso.cacheEscritura,
      costoUsd: costoUsd(modelo, uso), latenciaMs: Date.now() - inicio, estado: final ? 'OK' : 'INVALIDA',
      error: final ? null : (errores.length ? errores.slice(0, 10).join(' | ') : `sin respuesta final en ${maxPasos} pasos`),
    };
    const idEjecucion = await this._registrar(fila);
    if (!final) return { estado: 'INVALIDA', motivo: fila.error, idEjecucion, uso, herramientas: usadas, resultados, pasos };
    return { estado: 'OK', valor: final, idEjecucion, uso, costoUsd: fila.costoUsd, herramientas: usadas, resultados, pasos };
  }
}

module.exports = new CerebroService();
module.exports.CerebroService = CerebroService;
