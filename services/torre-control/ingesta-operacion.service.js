/*
    Author: German Valencia
    Pattern: PORTTOS Service - Ingesta de operación portuaria (terminales y otros sistemas → Porttos)
    Description: POST /api/ingesta-operacion/:tipo con { puerto, fuente, registros }.
      1. Valida cada registro con su esquema Joi (models/torre-control/ingesta-operacion.model.js). Si alguno falla,
         no se guarda nada y la respuesta dice qué registro y qué campo (400).
      2. Escribe por upsert (reenviar un registro lo actualiza) con fuente INGESTA_API o ARCHIVO y simulado = 0.
      3. Avisa por socket a las salas puerto:{PUERTO}:{modulo} para que los tableros se refresquen.
      Desde el primer dato real de un segmento, el simulador deja de tocar ese puerto y ese segmento.
*/
const OperacionRepository = require('../../repositories/torre-control/operacion-portuaria.repository');
const CapacidadRepository = require('../../repositories/torre-control/capacidad.repository');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');
const { crearError } = require('../../helpers/errores.helper');
const { TIPOS_INGESTA } = require('../../models/torre-control/ingesta-operacion.model');

const inicioHoraIso = (fecha) => { const ms = Date.parse(fecha); return new Date(ms - (ms % 3600000)).toISOString(); };

class IngestaOperacionService {
  constructor({ operacion = OperacionRepository, capacidad = CapacidadRepository, contexto = contextoPuerto, avisar = emitir } = {}) {
    Object.assign(this, { operacion, capacidadRepo: capacidad, contexto, avisar });
  }

  /** Valida todos los registros; devuelve los valores normalizados o lanza 400 con los errores. */
  validar(tipo, registros) {
    const { esquema } = TIPOS_INGESTA[tipo];
    const errores = [];
    const valores = registros.map((r, i) => {
      const { error, value } = esquema.validate(r, { abortEarly: false, stripUnknown: true });
      if (error) errores.push(...error.details.map((d) => ({ registro: i, campo: d.path.join('.'), mensaje: d.message })));
      return value;
    });
    if (errores.length) throw crearError(400, `${errores.length} errores en los registros; no se guardó nada`, 'VALIDACION', errores.slice(0, 50));
    return valores;
  }

  async ingerir(tipo, { puerto, fuente = 'INGESTA_API', registros }, ahora = new Date()) {
    if (!TIPOS_INGESTA[tipo]) throw crearError(400, `Tipo de ingesta desconocido: ${tipo}`, 'VALIDACION');
    const p = await this.contexto(puerto);
    const valores = this.validar(tipo, registros);
    const marca = { id_puerto: p.idPuerto, fuente, simulado: false };
    const iso = ahora.toISOString();
    let guardados = 0;

    if (tipo === 'operaciones-buque') {
      for (const v of valores) { await this.operacion.guardarOperacion({ ...v, ...marca }, iso); guardados++; }
    } else if (tipo === 'avance') {
      const ids = await this.operacion.idsOperacion(p.idPuerto, [...new Set(valores.map((v) => v.codigo_externo))]);
      const porCodigo = new Map(ids.map((r) => [r.codigo_externo, r]));
      const faltan = valores.filter((v) => !porCodigo.has(v.codigo_externo)).map((v) => v.codigo_externo);
      if (faltan.length) throw crearError(400, 'Avance de operaciones que no existen; envíelas antes por operaciones-buque', 'VALIDACION', [...new Set(faltan)].slice(0, 50));
      guardados = await this.operacion.guardarAvance(valores.map((v) => ({
        id_operacion: porCodigo.get(v.codigo_externo).id_operacion, id_puerto: p.idPuerto, segmento: porCodigo.get(v.codigo_externo).segmento,
        hora: inicioHoraIso(v.hora), cantidad: v.cantidad, fuente, simulado: false,
      })), 'reemplazar');
    } else if (tipo === 'equipos') {
      const codigos = [...new Set(valores.map((v) => v.operacion_codigo_externo).filter(Boolean))];
      const ids = new Map((await this.operacion.idsOperacion(p.idPuerto, codigos)).map((r) => [r.codigo_externo, r.id_operacion]));
      for (const { operacion_codigo_externo: cod, ...v } of valores) {
        await this.operacion.guardarEquipo({ ...v, ...marca, id_operacion: cod ? ids.get(cod) ?? null : null }, iso); guardados++;
      }
    } else if (tipo === 'carga-suelta') {
      for (const v of valores) { await this.operacion.guardarFolio({ ...v, ...marca }, iso); guardados++; }
    } else if (tipo === 'vehiculos') {
      for (const v of valores) { await this.operacion.guardarVehiculos({ ...v, ...marca }); guardados++; }
    } else if (tipo === 'ocupacion-nodos') {
      guardados = await this.capacidadRepo.guardarOcupaciones(valores.map((v) => ({ ...v, ...marca })));
    } else if (tipo === 'nodos') {
      for (const v of valores) {
        await this.capacidadRepo.guardarNodo({ ...v, operaciones: v.operaciones.join('|'), id_puerto: p.idPuerto, fuente }, iso); guardados++;
      }
    }

    for (const modulo of TIPOS_INGESTA[tipo].modulos) {
      this.avisar('tablero-actualizado', { modulo, puerto: p.clave, tipo, registros: guardados }, salaPuerto(p.clave, modulo));
    }
    return { tipo, puerto: p.clave, recibidos: registros.length, guardados };
  }
}

module.exports = new IngestaOperacionService();
module.exports.IngestaOperacionService = IngestaOperacionService;
