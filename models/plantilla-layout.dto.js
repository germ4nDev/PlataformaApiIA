/*
    Author: German Valencia
    DTO para formatear la respuesta del Layout Metadata-Driven hacia Angular
*/
class PlantillaLayoutDTO {
  static formatearRespuesta(dataServicio) {
    if (!dataServicio) return null;

    // Estructura base requerida por Angular
    const respuestaAngular = {
      estrategia: dataServicio.estrategia,
      configuracion: {
        widgetsEstaticos: dataServicio.configuracion.widgetsEstaticos || []
      }
    };

    // Si la estrategia tiene motor dinámico, adjuntamos sus metadatos
    if (dataServicio.estrategia === 'CASCADA_DINAMICA' && dataServicio.configuracion.zonaDinamica) {
      const zona = dataServicio.configuracion.zonaDinamica;
      respuestaAngular.configuracion.zonaDinamica = {
        activa: true,
        codigoMolde: zona.codigoMolde,
        inicioX: zona.inicioX,
        inicioY: zona.inicioY,
        colsPorItem: zona.colsPorItem,
        rowsPorItem: zona.rowsPorItem,
        // Angular agradece que le enviemos el cálculo de cuántos caben por fila listo
        maxItemsPorFila: Math.floor(12 / zona.colsPorItem)
      };
    }

    return respuestaAngular;
  }
}

module.exports = { PlantillaLayoutDTO };