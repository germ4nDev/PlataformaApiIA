/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Service Layer Sanitization & Transactional Integrity
*/
const { ListaPreciosModel, ListaPreciosDTO, ListaPreciosDetalleModel, ListaPreciosDetalleDTO } = require('../models/lista-precios.model');
const { sequelize } = require('../database/connection');
const { getIO } = require('../helpers/socket.helper');

// 🟢 CORRECCIÓN ARQUITECTÓNICA: 
// Declaramos los modelos y sus relaciones UNA SOLA VEZ fuera de la clase.
// Esto evita que Sequelize explote por "Relaciones Duplicadas" si el servicio se instancia varias veces.
const CabeceraModel = ListaPreciosModel(sequelize);
const DetalleModel = ListaPreciosDetalleModel(sequelize);

if (!CabeceraModel.associations.detalles) {
    CabeceraModel.hasMany(DetalleModel, { foreignKey: 'codigoLista', as: 'detalles' });
    DetalleModel.belongsTo(CabeceraModel, { foreignKey: 'codigoLista', as: 'cabecera' });
}

class ListaPreciosService {
    constructor() {
        // Asignamos los modelos ya relacionados a la instancia actual
        this.Cabecera = CabeceraModel;
        this.Detalle = DetalleModel;
    }

    // ==========================================
    // 🟢 MÉTODOS DE LA CABECERA (Listas)
    // ==========================================

    async getListasPrecios(filtros = {}) {
        try {
            return await this.Cabecera.findAll({
                where: filtros,
                include: [{ model: this.Detalle, as: 'detalles' }],
                order: [['fechaCreacion', 'DESC']] // Me aseguro de usar una columna estándar de QPLUS
            });
        } catch (error) {
            console.error("Error en ListaPreciosService (getListasPrecios):", error);
            throw error;
        }
    }

    async createListaCompleta(rawData) {
        const cabeceraDTO = ListaPreciosDTO(rawData);
        console.log('crear lista', cabeceraDTO);

        return await sequelize.transaction(async (t) => {
            const existente = await this.Cabecera.findOne({ where: { codigoLista: cabeceraDTO.codigoLista }, transaction: t });
            if (existente) throw { statusCode: 400, msg: "Ya existe una lista con este código." };

            // 1. Crear Cabecera
            const nuevaLista = await this.Cabecera.create(cabeceraDTO, { transaction: t });

            // 2. Si vienen detalles, los insertamos
            if (rawData.detalles && Array.isArray(rawData.detalles)) {
                const detallesValidados = rawData.detalles.map(d => {
                    d.codigoLista = nuevaLista.codigoLista; // Forzamos la relación
                    return ListaPreciosDetalleDTO(d);
                });
                await this.Detalle.bulkCreate(detallesValidados, { transaction: t });
            }

            // 3. Consultamos el resultado final
            const listaCompletaDB = await this.Cabecera.findOne({
                where: { codigoLista: nuevaLista.codigoLista },
                include: [{ model: this.Detalle, as: 'detalles' }],
                transaction: t
            });

            // 🟢 Emitimos el Socket
            getIO().emit("listas-precios-actualizadas", {
                action: "create",
                msg: `Lista de precios creada: ${listaCompletaDB.nombreLista}`,
            });

            return listaCompletaDB;
        });
    }

    async updateLista(codigoLista, rawData) {
        const payload = { ...rawData, codigoLista };
        const cabeceraDTO = ListaPreciosDTO(payload);
        console.log('actualizar lista', cabeceraDTO);

        return await sequelize.transaction(async (t) => {
            const listaDB = await this.Cabecera.findByPk(codigoLista, { transaction: t });
            if (!listaDB) throw { statusCode: 404, msg: 'Lista de precios no encontrada para actualizar.' };

            await this.Cabecera.update(cabeceraDTO, { where: { codigoLista }, transaction: t });

            const actualizada = await this.Cabecera.findByPk(codigoLista, { transaction: t });

            // 🟢 Emitimos el Socket
            getIO().emit("listas-precios-actualizadas", {
                action: "update",
                msg: `Lista de precios actualizada: ${actualizada.nombreLista}`,
            });

            return actualizada;
        });
    }

    // ==========================================
    // 🟢 MÉTODOS ESPECÍFICOS PARA EL DETALLE (Precios asignados)
    // ==========================================

    async addDetalle(codigoLista, rawDetalle) {
        const payload = { ...rawDetalle, codigoLista };
        const detalleDTO = ListaPreciosDetalleDTO(payload);
        console.log('crear detalle precio', detalleDTO);

        return await sequelize.transaction(async (t) => {
            const listaDB = await this.Cabecera.findByPk(codigoLista, { transaction: t });
            if (!listaDB) throw { statusCode: 404, msg: 'La lista de precios base no existe.' };

            const existente = await this.Detalle.findOne({ where: { codigoDetalle: detalleDTO.codigoDetalle }, transaction: t });
            if (existente) throw { statusCode: 400, msg: "Ya existe un detalle con este código." };

            const nuevoDetalle = await this.Detalle.create(detalleDTO, { transaction: t });

            // 🟢 Notificamos al frontend que los precios cambiaron
            getIO().emit("listas-precios-actualizadas", {
                action: "update_detalle",
                msg: `Precio agregado a la lista.`,
            });

            return nuevoDetalle;
        });
    }

    async updateDetalle(codigoDetalle, rawDetalle) {
        console.log('actualizar detalle precio ID:', codigoDetalle);

        return await sequelize.transaction(async (t) => {
            const detalleDB = await this.Detalle.findByPk(codigoDetalle, { transaction: t });
            if (!detalleDB) throw { statusCode: 404, msg: 'Detalle de precio no encontrado.' };

            // 🟢 Blindaje: Forzamos el codigoLista original para que no lo muevan de lista
            const payload = { ...rawDetalle, codigoDetalle, codigoLista: detalleDB.codigoLista };
            const detalleDTO = ListaPreciosDetalleDTO(payload);

            await this.Detalle.update(detalleDTO, { where: { codigoDetalle }, transaction: t });

            const actualizado = await this.Detalle.findByPk(codigoDetalle, { transaction: t });

            // 🟢 Notificamos al frontend
            getIO().emit("listas-precios-actualizadas", {
                action: "update_detalle",
                msg: `Precio actualizado correctamente.`,
            });

            return actualizado;
        });
    }

    async deleteDetalle(codigoDetalle) {
        return await sequelize.transaction(async (t) => {
            const detalleDB = await this.Detalle.findByPk(codigoDetalle, { transaction: t });
            if (!detalleDB) throw { statusCode: 404, msg: 'Detalle de precio no encontrado para eliminar.' };

            await this.Detalle.destroy({ where: { codigoDetalle }, transaction: t });

            // 🟢 Notificamos al frontend
            getIO().emit("listas-precios-actualizadas", {
                action: "delete_detalle",
                msg: `Precio eliminado correctamente.`,
            });

            return true;
        });
    }
}

// 🟢 CORRECCIÓN ARQUITECTÓNICA: Exportar la clase, NO una instancia ('new')
module.exports = ListaPreciosService;