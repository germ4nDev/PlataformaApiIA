/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Audit Standards
*/
const { response } = require("express");
const WidgetsService = require("../services/widgets.service");

const service = new WidgetsService();

const getWidgetsActivos = async (req, res = response) => {
    try {
        const widgets = await service.getWidgetsActivos();
        return res.status(200).json({ ok: true, widgets });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los widgets activos."
        });
    }
};

const getWidgetById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const widget = await service.getWidgetById(id);
        return res.status(200).json({ ok: true, widget });
    } catch (error) {
        return res.status(error.statusCode || 404).json({
            ok: false,
            msg: error.msg || "Error al obtener el widget solicitado."
        });
    }
};

const createWidget = async (req, res = response) => {
    try {
        // QPLUS: Auditoría inicial e hidratación del payload
        const dataDTO = { ...req.body };
        console.log('widget dto', dataDTO);

        const widget = await service.createWidget(dataDTO);
        console.log('widget creado', widget);

        return res.status(201).json({
            ok: true,
            widget,
            msg: "Widget creado exitosamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al crear el widget.",
            detalle: error.detalle || null
        });
    }
};

const updateWidget = async (req, res = response) => {
    try {
        const { id } = req.params;
        console.log('actualizar antes', req.body);

        // QPLUS: Hidratación del payload de auditoría
        const dataDTO = { ...req.body };

        const widget = await service.updateWidget(id, dataDTO);

        return res.status(200).json({
            ok: true,
            widget,
            msg: "Widget actualizado exitosamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el widget."
        });
    }
};

const deleteWidget = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteWidget(id);

        return res.status(200).json({
            ok: true,
            msg: "Widget eliminado/desactivado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el widget."
        });
    }
};

module.exports = {
    getWidgetsActivos,
    getWidgetById,
    createWidget,
    updateWidget,
    deleteWidget
};