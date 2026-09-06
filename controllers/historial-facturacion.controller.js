/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection, Webhooks & Error Handling
*/
const { response } = require("express");
const HistorialFacturacionService = require("../services/historial-facturacion.service");

const service = new HistorialFacturacionService();

// =========================================================================
// 1. MÉTODOS CRUD ESTÁNDAR
// =========================================================================

const getHistoriales = async (req, res = response) => {
    try {
        const historiales = await service.getHistoriales();
        return res.status(200).json({ ok: true, historiales });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error interno al obtener los historiales."
        });
    }
};

const getHistorialById = async (req, res = response) => {
    try {
        const { id } = req.params;
        const historial = await service.getHistorialById(id);
        return res.status(200).json({ ok: true, historial });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al obtener el historial solicitado."
        });
    }
};

const createHistorial = async (req, res = response) => {
    try {
        const dataDTO = {
            ...req.body
        };

        const historial = await service.createHistorial(dataDTO);

        return res.status(201).json({ ok: true, historial });
    } catch (error) {
        if (error.type === 'ValidationError') return res.status(400).json({ ok: false, msg: "Error validación", errores: error.details });
        return res.status(error.statusCode || 400).json({ ok: false, msg: error.msg || "Error al crear." });
    }
};

const updateHistorial = async (req, res = response) => {
    try {
        const { id } = req.params;
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

        const dataDTO = {
            ...req.body,
            codigoUsuarioModificacion: usuarioAccion
        };

        const historial = await service.updateHistorial(id, dataDTO);
        return res.status(200).json({ ok: true, historial });
    } catch (error) {
        if (error.type === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                msg: "Error de validación de datos.",
                errores: error.details
            });
        }
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al actualizar el historial."
        });
    }
};

const deleteHistorial = async (req, res = response) => {
    try {
        const { id } = req.params;
        await service.deleteHistorial(id);

        return res.status(200).json({
            ok: true,
            msg: "Historial eliminado correctamente."
        });
    } catch (error) {
        return res.status(error.statusCode || 400).json({
            ok: false,
            msg: error.msg || "Error al eliminar el historial."
        });
    }
};


// =========================================================================
// 2. MÉTODOS DE TRANSACCIONES Y PAGOS (MERCADO PAGO / MANUALES)
// =========================================================================
const createHistorialManual = async (req, res = response) => {
    try {

        const dataDTO = { ...req.body };

        const historial = await service.createHistorialManual(dataDTO);

        return res.status(201).json({ ok: true, historial });
    } catch (error) {
        if (error.type === 'ValidationError') return res.status(400).json({ ok: false, errores: error.details });
        return res.status(error.statusCode || 400).json({ ok: false, msg: error.msg || "Error al crear el registro manual." });
    }
};

// Cobra a través de Mercado Pago y, si es aprobado, crea el registro en la BD
const procesarPagoCrear = async (req, res = response) => {
    try {
        const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';

        // Angular envía: facturaData (info BD) y formData (token de tarjeta)
        const { facturaData, formData } = req.body;

        const dataDTO = {
            ...facturaData,
            codigoUsuarioCreacion: usuarioAccion,
            codigoUsuarioModificacion: usuarioAccion
        };

        const resultado = await service.procesarYCrearHistorial(dataDTO, formData);

        return res.status(200).json({
            ok: true,
            respuestaMP: resultado
        });
    } catch (error) {
        if (error.type === 'ValidationError') {
            return res.status(400).json({
                ok: false,
                msg: "Error de validación de datos.",
                errores: error.details
            });
        }
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error al procesar el pago y crear el historial.",
            detalle: error.detalle || null
        });
    }
};

// Variante alternativa: Procesa el pago de una factura que ya existe como pendiente
const cobrarConBrick = async (req, res = response) => {
    try {
        const { id } = req.params; // codigoHistorial
        const formData = req.body; // Token de tarjeta del Brick

        const resultado = await service.procesarPagoEnLinea(id, formData);

        return res.status(200).json({
            ok: true,
            respuestaMP: resultado
        });
    } catch (error) {
        return res.status(error.statusCode || 500).json({
            ok: false,
            msg: error.msg || "Error procesando el pago de Mercado Pago."
        });
    }
};

// Webhook oculto que recibe notificaciones de Mercado Pago (PSE/Nequi)
const recibirWebhookMP = async (req, res = response) => {
    res.status(200).send('OK'); // MP exige un 200 inmediato

    try {
        const queryParams = req.query;

        if (queryParams.type === 'payment') {
            const paymentId = queryParams['data.id'];

            const MercadoPagoService = require('../services/mercadopago.service');
            const mpServiceLocal = new MercadoPagoService();
            const infoPago = await mpServiceLocal.consultarPago(paymentId);

            if (infoPago.status === 'approved') {
                const codigoHistorial = infoPago.external_reference;

                const historialDb = await service.getHistorialById(codigoHistorial);

                const dataActualizada = {
                    ...historialDb.dataValues,
                    estadoPPago: true,
                    codigoUsuarioModificacion: 'MERCADO_PAGO'
                };

                await service.updateHistorial(codigoHistorial, dataActualizada);
                console.log(`✅ Pago aprobado y procesado para historial: ${codigoHistorial}`);
            }
        }
    } catch (error) {
        console.error("Error procesando Webhook de Mercado Pago:", error);
    }
};

// =========================================================================
// 3. EXPORTACIONES
// =========================================================================

module.exports = {
    getHistoriales,
    getHistorialById,
    createHistorial,
    updateHistorial,
    deleteHistorial,
    createHistorialManual,
    procesarPagoCrear,
    cobrarConBrick,
    recibirWebhookMP
};