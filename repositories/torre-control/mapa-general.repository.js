/*
    Author: German Valencia
    Pattern: QPLUS Repository - Mapa General (Gemelo Digital)
    Descripción: Consultas espaciales y extracción de datos georreferenciados.
*/

class MapaGeneralRepository {
  constructor(sequelize) {
    this.sequelize = sequelize; // Inyección de la conexión de Sequelize
  }

  async getInfraestructuraActiva() {
    const query = `
        SELECT 
            id_puerto, 
            nombre,
            imagen_url, 
            ubicacion_geo.STY AS lat, 
            ubicacion_geo.STX AS lon
        FROM dbo.T_Maestro_Puertos 
        WHERE estado = 1
    `;

    return await this.sequelize.query(query, {
      type: this.sequelize.QueryTypes.SELECT
    });
  }

  async getInfraestructuraJerarquica() {
    const query = `
        SELECT 
            p.id_puerto,
            p.nombre AS nombre_puerto,
            p.imagen_url,
            p.ubicacion_geo.STAsText() AS puerto_wkt,
            p.geocerca_geo.STAsText() AS puerto_geocerca_wkt,
            (
                SELECT 
                    t.id_terminal,
                    t.nombre AS nombre_terminal,
                    t.geocerca_geo.STAsText() AS terminal_geocerca_wkt,
                    
                    -- 1. Array de Muelles anidado por id_terminal
                    (
                        SELECT 
                            m.id_interno,
                            m.codigo_muelle AS nombre_muelle,
                            m.geocerca_geo.STAsText() AS muelle_wkt
                        FROM T_Maestro_Muelles m
                        WHERE m.id_terminal = t.id_terminal
                        FOR JSON PATH
                    ) AS muelles,
                    
                    -- 2. Array de Infraestructura anidado por id_terminal
                    (
    SELECT 
        i.id_infraestructura,
        i.nombre AS nombre_infra,
        i.tipo AS tipo_infra,
        -- Eliminamos latitud y longitud porque no existen en el esquema
        i.geocerca_geo.STAsText() AS infra_geocerca_wkt,
        i.ubicacion_geo.STAsText() AS infra_ubicacion_wkt
    FROM T_Maestro_Infraestructura i
    WHERE i.id_terminal = t.id_terminal
    FOR JSON PATH
) AS infraestructuras

                FROM T_Maestro_Terminales t
                WHERE t.id_puerto = p.id_puerto
                FOR JSON PATH
            ) AS terminales
        FROM T_Maestro_Puertos p
        WHERE p.estado = 1
        FOR JSON PATH;
    `;

    const result = await this.sequelize.query(query, {
      type: this.sequelize.QueryTypes.SELECT
    });

    // Parseo seguro del JSON devuelto por SQL Server
    if (result && result.length > 0) {
      // SQL Server devuelve el FOR JSON en una columna generada (usualmente concatenada si es muy larga)
      // Extraemos los valores y los unimos por si SQL Server lo dividió en varios chunks
      const jsonString = result.map(row => Object.values(row)[0]).join('');
      return jsonString ? JSON.parse(jsonString) : [];
    }

    return [];
  }

  async getUltimasPosicionesNaves() {
    const query = `
      SELECT 
          ais.mmsi,
          ais.nombre_motonave, -- 👈 En AIS se llama así
          ais.latitud,
          ais.longitud,
          ais.velocidad,
          ais.rumbo,
          ais.destino AS destino_ais,
          ais.fechaCreacion AS ultima_posicion,
          
          -- Datos Administrativos
          perfiles.estado_nave,
          perfiles.omi,
          perfiles.bandera,
          perfiles.eta,
          perfiles.tipo_nave,
          perfiles.eslora,
          perfiles.calado,
          perfiles.agencia,
          perfiles.instalacion_portuaria,
          perfiles.puerto_procedencia
      FROM TCLAisUltimaPosicion ais WITH(NOLOCK)
      
      LEFT JOIN (
          -- Usamos estrictamente las columnas que SÍ existen en tus tablas
          SELECT motonave, 'AVISADAS' as estado_nave, omi, bandera, eta, tipo_nave, eslora, calado, agencia, instalacion_portuaria, puerto_procedencia FROM TLCNaves_Avisadas WITH(NOLOCK)
          UNION ALL
          SELECT motonave, 'ARRIBADAS' as estado_nave, omi, bandera, eta, tipo_nave, eslora, calado, agencia, instalacion_portuaria, puerto_procedencia FROM TLCNaves_Arribadas WITH(NOLOCK)
          UNION ALL
          SELECT motonave, 'FONDEADAS' as estado_nave, omi, bandera, NULL as eta, tipo_nave, eslora, calado, agencia, instalacion_portuaria, puerto_procedencia FROM TLCNaves_Fondeadas WITH(NOLOCK)
          UNION ALL
          SELECT motonave, 'ZARPADAS' as estado_nave, omi, bandera, NULL as eta, tipo_nave, eslora, calado, agencia, instalacion_portuaria, puerto_procedencia FROM TLCNaves_Zarpadas WITH(NOLOCK)
      ) perfiles 
      
      -- 🔥 EL PUENTE CORRECTO: Cruzamos por nombre ignorando nulos y espacios
      ON LTRIM(RTRIM(UPPER(ISNULL(ais.nombre_motonave, '')))) = LTRIM(RTRIM(UPPER(ISNULL(perfiles.motonave, ''))))
      
      WHERE ais.latitud IS NOT NULL AND ais.longitud IS NOT NULL
    `;

    try {
      const resultados = await this.sequelize.query(query, { type: this.sequelize.QueryTypes.SELECT });

      return {
        type: 'FeatureCollection',
        features: resultados.map(nave => ({
          type: 'Feature',
          geometry: {
            type: 'Point',
            coordinates: [parseFloat(nave.longitud), parseFloat(nave.latitud)]
          },
          properties: {
            nombre_motonave: nave.nombre_motonave,
            mmsi: nave.mmsi,
            velocidad: nave.velocidad,
            rumbo: nave.rumbo,
            destino_ais: nave.destino_ais,
            estado_nave: nave.estado_nave,
            omi: nave.omi,
            bandera: nave.bandera,
            eta: nave.eta,
            tipo_nave: nave.tipo_nave,
            eslora: nave.eslora,
            calado: nave.calado,
            agencia: nave.agencia,
            instalacion_portuaria: nave.instalacion_portuaria,
            puerto_procedencia: nave.puerto_procedencia
          }
        }))
      };
    } catch (error) {
      console.error('❌ [ERROR OBTENIENDO CAPA GEOJSON DE NAVES]:', error?.message || error);
      return {
        type: 'FeatureCollection',
        features: []
      };
    }
  }

  async getFlotaTerrestreActiva() {
    const query = `
        SELECT placa, estado, conductor, latitud, longitud, velocidad
        FROM dbo.TLCFlotaTerrestre 
        WHERE estado != 'MANTENIMIENTO' 
          AND latitud IS NOT NULL 
          AND longitud IS NOT NULL
    `;
    return await this.sequelize.query(query, { type: this.sequelize.QueryTypes.SELECT });
  }

  async actualizarPosicionesSimuladas() {
    const query = `
      UPDATE dbo.TLCFlotaTerrestre 
      SET 
          latitud = latitud + (RAND() * 0.002 - 0.001),
          longitud = longitud + (RAND() * 0.004 - 0.002),
          ultima_actualizacion = GETDATE()
      WHERE estado = 'EN_RUTA';
    `;
    return await this.sequelize.query(query);
  }

  async getBuquesConEstadoOperativo() {
    const query = `
            SELECT 
                d.motonave,
                d.id_aviso,
                ais.latitud,
                ais.longitud,
                muelle.nombre_muelle,
                CASE 
                    WHEN muelle.nombre_muelle IS NOT NULL THEN 'En Muelle'
                    ELSE 'En Fondeo/Navegación'
                END AS estado_operativo
            FROM dbo.TLCNaves_Arribadas d
            LEFT JOIN dbo.TCL_Homologacion_MMSI hom ON d.id_aviso = hom.id_aviso
            LEFT JOIN dbo.TCLAisUltimaPosicion ais ON hom.mmsi = ais.mmsi
            LEFT JOIN dbo.T_Maestro_Muelles muelle ON 
                ais.latitud IS NOT NULL AND 
                ais.longitud IS NOT NULL AND
                muelle.geometria.STIntersects(
                    geography::Point(ais.latitud, ais.longitud, 4326)
                ) = 1
        `;

    try {
      return await sequelize.query(query, { type: QueryTypes.SELECT });
    } catch (error) {
      console.error('SQL Error en MapaLogisticoRepository.getBuquesConEstadoOperativo:', error);
      throw new Error('Error al ejecutar consulta espacial de buques');
    }
  }

  async upsertEventoVial(evento) {
    return await TCLEventosViales.upsert(evento, {
      conflictFields: ['idEventoExterno']
    });
  }

  async upsertAlertaClimatica(alerta) {
    return await this.TCLAlertasClimaticas.upsert(alerta, {
      conflictAttributes: ['codigoAlerta']
    });
  }
}

module.exports = MapaGeneralRepository;