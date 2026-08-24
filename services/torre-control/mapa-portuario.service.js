const MaritimoRepository = require('../../repositories/torre-control/maritimo.repository');

class MapaPortuarioService {

  async obtenerMapaFormatoFrontend() {
    try {
      const dataPlana = await MaritimoRepository.getMapaPortuarioJerarquia();
      const mapaFormateado = {};

      // Parser universal para WKT (Point o Polygon)
      const parseWKT = (wkt) => {
        if (!wkt) return null;
        // Extrae lo que hay dentro de los paréntesis
        const match = wkt.match(/\(([^)]+)\)/);
        if (!match || !match[1]) return null;

        // Si es POINT(lon lat), devuelve un objeto {lat, lon}
        if (wkt.startsWith('POINT')) {
          const [lon, lat] = match[1].split(' ');
          return { lat: parseFloat(lat), lon: parseFloat(lon) };
        }
        // Si es POLYGON((...)), devuelve el arreglo de coordenadas
        const puntos = match[1].replace('(', '').replace(')', '').split(', ');
        return puntos.map(p => {
          const [lon, lat] = p.split(' ');
          return [parseFloat(lat), parseFloat(lon)];
        });
      };

      dataPlana.forEach(row => {
        if (!row.puerto_nombre) return;
        const llavePuerto = row.puerto_nombre.toUpperCase();

        if (!mapaFormateado[llavePuerto]) {
          mapaFormateado[llavePuerto] = {
            nombre: row.puerto_nombre,
            region: row.region,
            coordenadas: parseWKT(row.ubicacion_wkt) || { lat: 0, lon: 0 },
            geocerca: parseWKT(row.puerto_wkt), // ✅ Geocerca del puerto
            infraestructura: {}
          };
        }

        if (row.id_terminal) {
          if (!mapaFormateado[llavePuerto].infraestructura[row.id_terminal]) {
            mapaFormateado[llavePuerto].infraestructura[row.id_terminal] = {
              nombre: row.terminal_nombre,
              sub: row.subtitulo,
              desc: row.descripcion,
              unidad: row.unidad_medida,
              capacidadReefer: row.capacidad_reefer,
              geocerca: parseWKT(row.terminal_wkt),
              muelles: []
            };
          }

          if (row.codigo_muelle) {
            mapaFormateado[llavePuerto].infraestructura[row.id_terminal].muelles.push({
              id: row.codigo_muelle,
              dbId: row.db_id_origen,
              esp: row.especialidad,
              calado: row.calado_metros ? `${row.calado_metros} m` : 'N/A',
              estadoMantenimiento: !!row.estado_mantenimiento,
              poligono: parseWKT(row.muelle_wkt)
            });
          }
        }
      });

      return mapaFormateado;
    } catch (error) {
      console.error('🔥 Error ensamblando el mapa:', error);
      throw error;
    }
  }
}

module.exports = new MapaPortuarioService();