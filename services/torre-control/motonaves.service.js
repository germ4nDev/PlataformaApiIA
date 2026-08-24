// Importamos el repositorio en lugar del modelo
const motonavesRepository = require('../../repositories/torre-control/motonaves.repository');

class MotonavesService {

  async getUltimasPosicionesNaves() {
    try {
      // 1. Delegamos la consulta a la base de datos al repositorio
      const resultados = await motonavesRepository.obtenerPosicionesConDimar();

      // 2. Lógica de negocio: Transformación a GeoJSON para Angular
      const features = resultados.map(nave => {
        const lat = nave.lat !== null ? parseFloat(nave.lat) : 0;
        const lon = nave.lon !== null ? parseFloat(nave.lon) : 0;

        return {
          type: "Feature",
          geometry: {
            type: "Point",
            coordinates: [lon, lat]
          },
          properties: {
            mmsi: nave.mmsi,
            nombreMotonave: nave.nombreMotonave,
            velocidad: nave.velocidad,
            rumbo: nave.rumbo,
            destino: nave.destino,
            estadoInferido: nave.estadoInferido,
            id_aviso: nave.id_aviso,
            eta: nave.eta,
            agencia: nave.agencia
          }
        };
      });

      return {
        type: "FeatureCollection",
        features: features
      };

    } catch (error) {
      console.error('❌ [MotonavesService] Error al obtener últimas posiciones:', error);
      throw error;
    }
  }

  async vincularMotonave(datosVinculacion) {
    try {
      const { mmsi, id_aviso, nombre_referencia } = datosVinculacion;

      // Delegamos la inserción al repositorio
      await motonavesRepository.guardarHomologacion(mmsi, id_aviso, nombre_referencia || '');

      return { success: true, message: 'Nave homologada correctamente' };

    } catch (error) {
      console.error('❌ [MotonavesService] Error al vincular motonave:', error);
      throw error;
    }
  }

  async guardarUltimaPosicionAIS(datosAIS) {
    try {
      // Ajustamos la desestructuración para que coincida exactamente con lo que envía el JSON del Postman / Antena
      const {
        mmsi,
        latitud, // Antes decía lat
        longitud, // Antes decía lon
        velocidad,
        rumbo,
        estado_inferido, // Antes decía estadoInferido
        nombre_motonave,
        destino
      } = datosAIS;

      if (latitud === null || longitud === null) {
        console.warn(`⚠️ [MotonavesService] Alerta: Coordenadas en NULL para MMSI ${mmsi}. Se guardarán como 0 temporalmente.`);
      }

      // Preparamos el objeto para el repositorio.
      // OJO AQUÍ: Las llaves de la izquierda deben coincidir EXACTAMENTE con los ":nombres" usados en la consulta SQL del repositorio.
      const payloadSeguro = {
        mmsi,
        lat: latitud || 0, // Mapeamos 'latitud' a ':lat' para SQL
        lon: longitud || 0, // Mapeamos 'longitud' a ':lon' para SQL
        velocidad,
        rumbo,
        estadoInferido: estado_inferido, // Mapeamos 'estado_inferido' a ':estadoInferido' para SQL
        nombre_motonave: nombre_motonave || '',
        destino
      };

      await motonavesRepository.upsertPosicionAis(payloadSeguro);

      return { success: true, message: 'Posición en antena actualizada' };

    } catch (error) {
      console.error('❌ [MotonavesService] Error al guardar posición AIS:', error);
      throw error;
    }
  }
}

module.exports = new MotonavesService();