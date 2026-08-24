/*
    Author: German Valencia
    Service: Integración Mercado Pago (SDK v2) - Payment Bricks
*/
const { MercadoPagoConfig, Payment } = require('mercadopago');

// Inicializamos el cliente con el token del .env
const client = new MercadoPagoConfig({ accessToken: process.env.MP_ACCESS_TOKEN });

class MercadoPagoService {

    async procesarPagoBrick(formData, codigoHistorial) {
        try {
            const payment = new Payment(client);

            // El objeto formData ya viene estructurado perfectamente desde el Brick de Angular
            const requestBody = {
                ...formData,
                description: `Pago de Suscripción - Historial: ${codigoHistorial}`,
                external_reference: codigoHistorial
            };

            // Ejecutamos el cobro real en el banco/franquicia
            const response = await payment.create({
                body: requestBody
            });

            return response;

        } catch (error) {
            console.error("Error al procesar el cobro en Mercado Pago:", error);
            throw { statusCode: 500, msg: "Error al comunicarse con el banco o pasarela." };
        }
    }
}

module.exports = MercadoPagoService;