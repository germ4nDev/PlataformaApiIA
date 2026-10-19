/*
    Author: German Valencia
    Pattern: PORTTOS Service - Inventario de contenedores en patio
    Description: Ingreso, cargue masivo (Excel), reubicación y retiro de contenedores.
      Un contenedor no puede estar dos veces EN_PATIO. Acceso a datos en inventario-contenedores.repository.js.
*/
const crypto = require('crypto');
const xlsx = require('xlsx');
const { InventarioContenedoresDTO } = require('../../models/torre-control/inventario-contenedores.model');
const repositorio = require('../../repositories/torre-control/inventario-contenedores.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { crearError } = require('../../helpers/errores.helper');

const EVENTO = 'inventario-actualizado';

class InventarioContenedoresService {
  async getInventarios(filtros = {}) {
    return repositorio.listar({ where: filtros });
  }

  async getInventarioById(id_inventario) {
    const contenedor = await repositorio.obtener(id_inventario);
    if (!contenedor) throw crearError(404, 'No existe el contenedor solicitado.', 'NO_ENCONTRADO');
    return contenedor;
  }

  async createInventario(rawData) {
    const dto = InventarioContenedoresDTO({ ...rawData, id_inventario: rawData.id_inventario || crypto.randomUUID() });
    const creado = await conTransaccion(async (t) => {
      const enPatio = await repositorio.buscarUno({ sigla_numero: dto.sigla_numero, estado_operativo: 'EN_PATIO' }, { transaction: t });
      if (enPatio) {
        throw crearError(400, `El contenedor ${dto.sigla_numero} ya se encuentra registrado físicamente en patio.`, 'YA_EN_PATIO', { contenedor: enPatio });
      }
      return repositorio.crear(dto, { transaction: t });
    });
    emitir(EVENTO, { action: 'create', msg: `Nuevo ingreso: ${creado.sigla_numero} (${creado.naviera})`, id_puerto: creado.id_puerto });
    return creado;
  }

  async cargueMasivoExcel(fileBuffer, usuarioCreador) {
    const libro = xlsx.read(fileBuffer, { type: 'buffer' });
    const filas = xlsx.utils.sheet_to_json(libro.Sheets[libro.SheetNames[0]]);
    if (!filas || filas.length === 0) {
      throw crearError(400, 'El archivo Excel de contenedores está vacío o inválido.', 'ARCHIVO_VACIO');
    }

    const ahora = new Date().toISOString();
    const limpios = [];
    const errores = [];
    filas.forEach((fila, index) => {
      try {
        limpios.push(InventarioContenedoresDTO({
          id_inventario: fila.id_inventario || crypto.randomUUID(),
          id_puerto: fila.id_puerto || 'BUENAVENTURA',
          sigla_numero: fila.sigla_numero,
          codigo_iso: fila.codigo_iso,
          naviera: fila.naviera,
          estado_carga: fila.estado_carga || 'FCL',
          peso_tara_kg: fila.peso_tara_kg,
          peso_bruto_kg: fila.peso_bruto_kg,
          ubicacion_bloque: fila.ubicacion_bloque || null,
          ubicacion_bahia: fila.ubicacion_bahia || null,
          ubicacion_fila: fila.ubicacion_fila || null,
          ubicacion_altura: fila.ubicacion_altura || null,
          es_reefer: fila.es_reefer === 'SI' || fila.es_reefer === true,
          temp_requerida_celsius: fila.temp_requerida_celsius || null,
          codigo_imo: fila.codigo_imo || null,
          fecha_ingreso: fila.fecha_ingreso || ahora,
          fecha_limite_freetime: fila.fecha_limite_freetime || null,
          estado_operativo: fila.estado_operativo || 'EN_PATIO',
          codigoUsuarioCreacion: usuarioCreador,
          fechaCreacion: ahora,
          codigoUsuarioModificacion: usuarioCreador,
          fechaModificacion: ahora,
        }));
      } catch (error) {
        errores.push({ filaExcel: index + 2, detalles: error.details || error });
      }
    });
    if (errores.length) throw crearError(400, 'Errores de validación en el archivo Excel.', 'VALIDACION', errores);

    let resultado;
    try {
      resultado = await conTransaccion((t) => repositorio.crearVarios(limpios, { transaction: t }));
    } catch (error) {
      throw crearError(409, 'Error de integridad en BD al importar contenedores.', 'INTEGRIDAD', { detalle: error.message });
    }
    emitir(EVENTO, { action: 'update_masivo', msg: 'Cargue masivo de contenedores completado. Recalculando patios...' });
    return resultado;
  }

  async updateInventario(id_inventario, rawData) {
    const dto = InventarioContenedoresDTO(rawData);
    const actualizado = await conTransaccion(async (t) => {
      if (!(await repositorio.obtener(id_inventario, { transaction: t }))) {
        throw crearError(404, 'No existe el contenedor con ese ID para actualizar.', 'NO_ENCONTRADO');
      }
      return repositorio.actualizar(id_inventario, dto, { transaction: t });
    });
    emitir(EVENTO, { action: 'update', msg: `Contenedor reubicado/actualizado: ${actualizado.sigla_numero}` });
    return actualizado;
  }

  async deleteInventario(id_inventario) {
    const { sigla, resultado } = await conTransaccion(async (t) => {
      const contenedor = await repositorio.obtener(id_inventario, { transaction: t });
      if (!contenedor) throw crearError(404, 'No existe el contenedor con ese ID para eliminar.', 'NO_ENCONTRADO');
      return { sigla: contenedor.sigla_numero, resultado: await repositorio.eliminar(id_inventario, { transaction: t }) };
    });
    emitir(EVENTO, { action: 'delete', msg: `Contenedor eliminado del registro: ${sigla}` });
    return resultado;
  }
}

module.exports = InventarioContenedoresService;
