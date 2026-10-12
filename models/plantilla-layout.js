/*
    Author: German Valencia
    DTO para formatear la respuesta del Layout Metadata-Driven hacia Angular
*/
class PlantillaLayoutDTO {
  static formatearRespuesta(dataServicio) {
    if (!dataServicio) return null;

    const configBD = dataServicio.configuracion || {};
    const estaticosBD = Array.isArray(configBD.widgetsEstaticos) ? configBD.widgetsEstaticos : (dataServicio.widgetsEstaticos || []);

    // 🟢 EL TRADUCTOR: Busca cómo se llama tu campo en la BD y lo mapea a 'estrategia'
    // Puedes poner aquí el nombre exacto de tu columna (ej. tipoPestana, codigoTipo, etc.)
    const estrategiaBD = dataServicio.estrategia || dataServicio.tipoPestana || dataServicio.codigoTipo || 'ESTATICO_ANALITICO';

    const respuestaAngular = {
      estrategia: estrategiaBD, // <-- Angular siempre recibirá 'estrategia'
      configuracion: {
        widgetsEstaticos: estaticosBD,
        zonaDinamica: null
      }
    };

    // 3. Si la estrategia tiene motor dinámico, adjuntamos sus metadatos
    if (respuestaAngular.estrategia === 'CASCADA_DINAMICA' && configBD.zonaDinamica) {
      const zona = configBD.zonaDinamica;

      respuestaAngular.configuracion.zonaDinamica = {
        activa: true,
        codigoMolde: zona.codigoMolde || 'PTT_MAE_WGT_TERMINAL',
        inicioX: parseInt(zona.inicioX) || 0,
        inicioY: parseInt(zona.inicioY) || 5,
        colsPorItem: parseInt(zona.colsPorItem) || 4,
        rowsPorItem: parseInt(zona.rowsPorItem) || 3,
        // Angular agradece que le enviemos el cálculo de cuántos caben por fila listo
        maxItemsPorFila: Math.floor(12 / (parseInt(zona.colsPorItem) || 4))
      };
    }

    return respuestaAngular;
  }
}

module.exports = { PlantillaLayoutDTO };