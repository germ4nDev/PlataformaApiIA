`
DECLARE @SegundosDeSimulacion FLOAT = 10.0; 
DECLARE @Horas FLOAT = @SegundosDeSimulacion / 3600.0;
DECLARE @GradosPorKm FLOAT = 1.0 / 111.32; 

WITH MovimientoBase AS (
    SELECT
        _id,
        ubicacion_geo.STX AS X_Actual,
        ubicacion_geo.STY AS Y_Actual,
        punto_destino.STX AS X_Destino,
        punto_destino.STY AS Y_Destino,
        velocidad AS Velocidad_Nominal,
        estado_camion,
        ubicacion_geo
    FROM TLC_CamionesOperaciones
    WHERE estado_camion IN ('EN_RUTA', 'DETENIDO_POR_TRAFICO')
      AND ubicacion_geo IS NOT NULL 
      AND punto_destino IS NOT NULL
),
-- MAGIA ESPACIAL: Evaluamos el entorno del camión
ImpactoTrafico AS (
    SELECT 
        m.*,
        ISNULL(Incidente.Multiplicador, 1.0) AS Multiplicador_Velocidad
    FROM MovimientoBase m
    OUTER APPLY (
        -- Busca el evento más cercano en un radio de ~2.2 km (0.02 grados)
        SELECT TOP 1
            CASE
                WHEN e.tipoEvento = 'CIERRE_VIAL' THEN 0.0 -- Freno total
                WHEN e.nivelSeveridad >= 3 THEN 0.1        -- Tráfico parado (10% vel)
                WHEN e.nivelSeveridad = 2 THEN 0.5         -- Tráfico lento (50% vel)
                ELSE 0.8                                   -- Afectación leve (80% vel)
            END AS Multiplicador
        FROM TCLEventosViales e
        WHERE e.estadoEvento = 'ACTIVO'
          AND e.ubicacion_geo IS NOT NULL
          AND e.ubicacion_geo.STDistance(m.ubicacion_geo) < 0.02 
        ORDER BY e.ubicacion_geo.STDistance(m.ubicacion_geo) ASC
    ) Incidente
),
Vectores AS (
    SELECT
        _id,
        X_Actual, Y_Actual, X_Destino, Y_Destino,
        estado_camion,
        (X_Destino - X_Actual) AS DX,
        (Y_Destino - Y_Actual) AS DY,
        -- Velocidad real afectada por el entorno TomTom
        (Velocidad_Nominal * Multiplicador_Velocidad) AS Velocidad_Efectiva,
        SQRT(SQUARE(X_Destino - X_Actual) + SQUARE(Y_Destino - Y_Actual)) AS Distancia_Total,
        -- El paso se calcula con la velocidad efectiva
        ((Velocidad_Nominal * Multiplicador_Velocidad * @Horas) * @GradosPorKm) AS Distancia_Paso,
        Multiplicador_Velocidad
    FROM ImpactoTrafico
)
UPDATE T
SET
    -- Lógica de Posición
    ubicacion_geo = CASE
        WHEN V.Distancia_Paso >= V.Distancia_Total THEN T.punto_destino
        WHEN V.Velocidad_Efectiva = 0 THEN T.ubicacion_geo -- No se mueve si el multiplicador es 0
        ELSE geometry::Point(
            V.X_Actual + (V.DX / V.Distancia_Total) * V.Distancia_Paso, 
            V.Y_Actual + (V.DY / V.Distancia_Total) * V.Distancia_Paso, 
            4326)
    END,
    
    -- Lógica de Estado Inteligente
    estado_camion = CASE 
        WHEN V.Distancia_Paso >= V.Distancia_Total THEN 'DESCARGANDO' 
        WHEN V.Multiplicador_Velocidad = 0.0 THEN 'DETENIDO_POR_TRAFICO'
        WHEN V.Multiplicador_Velocidad < 1.0 AND V.estado_camion != 'EN_RUTA' THEN 'EN_RUTA' -- Si se libera, vuelve a en ruta
        ELSE T.estado_camion 
    END,
    
    ultima_actualizacion = GETDATE()
FROM TLC_CamionesOperaciones T
INNER JOIN Vectores V ON T._id = V._id
WHERE V.Distancia_Total > 0 AND (T.velocidad > 0 OR T.estado_camion = 'DETENIDO_POR_TRAFICO');

`