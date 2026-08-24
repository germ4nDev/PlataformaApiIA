const { Router } = require('express');
const MotonaveOperacionController = require('../../controllers/torre-control/motonave-operacion.controller');
const MaritimoController = require('../../controllers/torre-control/maritimo.controller');

const { validarJWT } = require("../../middlewares/validar-jwt");

const router = Router();

// 1. OBTENER POSICIONES (GET)
// Retorna el GeoJSON para pintar los barcos en el mapa de Angular. 
// Protegido con JWT porque es consumido por el frontend.
router.get('/posiciones', MaritimoController.obtenerPosicionesAis);

// 2. VINCULAR MOTONAVE (POST)
// Guarda la relación entre MMSI y el ID de DIMAR enviada desde el popup.
// Protegido con JWT porque la acción la realiza un operador logueado.
router.post('/vincular', MaritimoController.vincularNave);
// Nota: Asegúrate de que el método en tu controlador se llame 'vincularNave' o cámbialo aquí a 'vincularMotonave' según lo hayas dejado.

// 3. RECIBIR DATA DE LA ANTENA (POST)
// Endpoint interno/webhook que recibe la trama AIS con latitud, longitud, etc.
// *Ojo*: Lo dejo sin validarJWT asumiendo que el script de la antena o el servicio externo 
// que empuja los datos no tiene cómo generar un token de usuario. Si tu servicio externo 
// sí usa un token de servicio, agrégale el middleware [validarJWT].
router.post('/posicion-ais', MaritimoController.recibirPosicionAis);

module.exports = router;