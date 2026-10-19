/*
    Author: German Valencia
    Pattern: PORTTOS Controller Pattern - Line Up Marítimo
*/
const TLCLineUpMaritimoService = require('../../services/torre-control/line-up-maritimo.service');
const { LineUpMaritimoDTO } = require('../../models/torre-control/line-up-maritimo.model');

const { responderError } = require('../../helpers/errores.helper');
const { contextoUsuario } = require('../../helpers/controlador.helper');
class TLCLineUpMaritimoController {

    async consultarLineUp(req, res) {
        try {
            const { terminal } = req.query;

            // Llamamos al servicio para obtener los datos
            const lineUp = await TLCLineUpMaritimoService.obtenerLineUp(terminal);

            // Respondemos con el formato estándar de la API PORTTOS
            return res.status(200).json({
                success: true,
                message: 'Line Up Marítimo recuperado exitosamente.',
                data: lineUp
            });

        } catch (error) {
          return responderError(res, error, 'line-up-maritimo.consultarLineUp');
        }
    }

    async cargarLineUp(req, res) {
        try {
            // 1. Extraemos solo los registros (el súper-array que enviará Angular)
            const { registros } = req.body;
            // console.log('insertar registros', registros);

            if (!registros || !Array.isArray(registros) || registros.length === 0) {
                return res.status(400).json({
                    success: false,
                    message: 'Estructura inválida. Se requiere un array de naves para la ingesta.'
                });
            }

            // 2. Extraemos el contexto de seguridad del middleware JWT
            const userContext = contextoUsuario(req);

            // 3. Purificación y Ensamblaje Masivo (PORTTOS Pattern)
            // Joi verificará internamente que cada registro traiga su propia "terminal"
            const dtoDataArray = registros.map(rawData => LineUpMaritimoDTO(rawData, userContext));

            const barcoTest = dtoDataArray.find(b => b.muelle !== null);
            // console.log('🚢 BARCO POST-DTO:', barcoTest ? barcoTest.muelle : 'NINGÚN BARCO TIENE MUELLE');

            // 4. Persistencia: Ya no pasamos el nombre de la terminal como parámetro extra
            const registrosCreados = await TLCLineUpMaritimoService.registrarIngestaMasiva(
                dtoDataArray,
                userContext.codigoUsuario
            );

            // 5. Respuesta exitosa
            return res.status(201).json({
                success: true,
                message: 'Ingesta transaccional procesada correctamente.',
                recordsInserted: registrosCreados.length
            });

        } catch (error) {
          return responderError(res, error, 'line-up-maritimo.cargarLineUp');
        }
    }
}

module.exports = new TLCLineUpMaritimoController();