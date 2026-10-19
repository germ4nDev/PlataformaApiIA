/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Base para maestros (CRUD con geometría)
    Description: Acceso a datos común de los maestros (puertos, terminales, muelles, faros, infraestructura,
      tipos). Cada repositorio de dominio crea una instancia con su modelo, su llave y sus columnas de geometría.
      - Las geometrías se leen como texto WKT (alias <columna sin _geo>_text) y se escriben con
        literalGeometria (WKT construido solo con números validados).
      - Devuelve objetos planos, nunca instancias de Sequelize.
      - Toda escritura acepta { transaction } para que el servicio decida la unidad de trabajo.
*/
const { Sequelize } = require('sequelize');
const { literalGeometria, SRID_PORTTOS } = require('../../helpers/geometria-segura.helper');

const plano = (fila) => (fila && typeof fila.get === 'function' ? fila.get({ plain: true }) : fila);

class RepositorioMaestro {
  /**
   * @param {object} opciones
   * @param {import('sequelize').ModelStatic<any>} opciones.modelo
   * @param {string} opciones.llave columna llave primaria
   * @param {Record<string,string>} [opciones.geometrias] columna geometry → alias del texto WKT
   *        (p. ej. { ubicacion_geo: 'ubicacion_text', geocerca_geo: 'geocerca_text' })
   * @param {number} [opciones.srid] SRID con que se escriben las geometrías (4326 por defecto)
   */
  constructor({ modelo, llave, geometrias = {}, srid = SRID_PORTTOS }) {
    this.modelo = modelo;
    this.llave = llave;
    this.geometrias = geometrias;
    this.srid = srid;
  }

  _atributos() {
    const columnas = Object.entries(this.geometrias);
    if (!columnas.length) return undefined;
    return { include: columnas.map(([columna, alias]) => [Sequelize.literal(`${columna}.STAsText()`), alias]) };
  }

  /**
   * Convierte las geometrías GeoJSON del DTO en literales SQL seguros.
   * parcial = true (actualización): una geometría ausente no se toca; null la borra.
   */
  _prepararGeometrias(datos, parcial) {
    const salida = { ...datos };
    for (const columna of Object.keys(this.geometrias)) {
      if (salida[columna]) {
        salida[columna] = literalGeometria(Sequelize, salida[columna], this.srid, columna);
      } else if (salida[columna] === null && parcial) {
        salida[columna] = null;
      } else if (parcial || salida[columna] === undefined) {
        delete salida[columna];
      }
    }
    return salida;
  }

  async listar({ where, order, transaction } = {}) {
    const filas = await this.modelo.findAll({ where, order, attributes: this._atributos(), transaction });
    return filas.map(plano);
  }

  async obtener(id, { transaction } = {}) {
    const fila = await this.modelo.findOne({ where: { [this.llave]: id }, attributes: this._atributos(), transaction });
    return plano(fila);
  }

  async buscarUno(where, { transaction } = {}) {
    return plano(await this.modelo.findOne({ where, attributes: this._atributos(), transaction }));
  }

  async contar(where, { transaction } = {}) {
    return this.modelo.count({ where, transaction });
  }

  async crear(datos, { transaction } = {}) {
    return plano(await this.modelo.create(this._prepararGeometrias(datos, false), { transaction }));
  }

  async crearVarios(filas, { transaction } = {}) {
    const creadas = await this.modelo.bulkCreate(filas.map((f) => this._prepararGeometrias(f, false)), { transaction });
    return creadas.map(plano);
  }

  /** Actualiza y devuelve el registro como queda (sin columnas de texto WKT). */
  async actualizar(id, datos, { transaction } = {}) {
    await this.modelo.update(this._prepararGeometrias(datos, true), { where: { [this.llave]: id }, transaction });
    return plano(await this.modelo.findOne({ where: { [this.llave]: id }, transaction }));
  }

  async eliminar(id, { transaction } = {}) {
    return this.modelo.destroy({ where: { [this.llave]: id }, transaction });
  }
}

module.exports = { RepositorioMaestro, plano };
