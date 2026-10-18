/*
  PORTTOS · Migración 005 · Estado de navegación AIS
  Qué hace (idempotente, se puede correr varias veces):
    1. Agrega a dbo.TCL_AisUltimaPosicion:
         estado_nav_ais       TINYINT        Estado declarado por la nave (0-15, ITU-R M.1371)
         id_puerto            NVARCHAR(50)   Zona donde está la nave según las geocercas de Porttos
         id_terminal          NVARCHAR(50)
         codigo_muelle        NVARCHAR(50)
         fecha_cambio_estado  NVARCHAR(100)  Desde cuándo está en el estado actual (estado_inferido)
    2. Crea dbo.TCL_EventosEstadoNave: bitácora de cada transición confirmada
       (FONDEADO → EN MANIOBRA → ATRACADO ...). Base de los KPIs de tiempo en fondeo,
       tiempo atracado y congestión por puerto/terminal.

  Convención de fechas Porttos: NVARCHAR(100) con ISO 8601 UTC (JS toISOString(): 2026-10-17T16:25:16.319Z).
    - Ordenan bien como texto: los índices y filtros por rango funcionan comparando cadenas.
    - Para operar en SQL: CONVERT(DATETIMEOFFSET, fecha, 127)  → hora Colombia: SWITCHOFFSET(..., '-05:00').
  Si una versión previa de este script dejó columnas DATETIMEOFFSET, se convierten a texto ISO sin perder datos.
  El motor AIS detecta estas columnas al arrancar; sin esta migración funciona igual, pero sin bitácora.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Protección: solo corre sobre la base de Porttos
DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF OBJECT_ID(N'dbo.TCL_AisUltimaPosicion', N'U') IS NULL
BEGIN
  RAISERROR('No existe dbo.TCL_AisUltimaPosicion. ¿Corriste la migración 001?', 16, 1);
  RETURN;
END

DECLARE @sql nvarchar(max), @tabla sysname, @columna sysname, @nulo bit, @df sysname;

BEGIN TRANSACTION;

-- 0. Compatibilidad: columnas DATETIMEOFFSET de la primera versión → NVARCHAR(100) ISO ----
DECLARE @conv TABLE (tabla sysname, columna sysname, nulo bit);
INSERT INTO @conv
SELECT OBJECT_NAME(c.object_id), c.name, c.is_nullable
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE t.name = 'datetimeoffset'
  AND c.object_id IN (OBJECT_ID(N'dbo.TCL_AisUltimaPosicion'), OBJECT_ID(N'dbo.TCL_EventosEstadoNave'))
  AND c.name IN ('fecha_cambio_estado', 'fecha_evento', 'fechaCreacion');

IF EXISTS (SELECT 1 FROM @conv WHERE tabla = 'TCL_EventosEstadoNave')
BEGIN
  DROP INDEX IF EXISTS IX_TCL_EventosEstadoNave_Mmsi_Fecha ON dbo.TCL_EventosEstadoNave;
  DROP INDEX IF EXISTS IX_TCL_EventosEstadoNave_Puerto_Estado_Fecha ON dbo.TCL_EventosEstadoNave;
END

DECLARE cc CURSOR LOCAL FAST_FORWARD FOR SELECT tabla, columna, nulo FROM @conv;
OPEN cc; FETCH NEXT FROM cc INTO @tabla, @columna, @nulo;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @df = (SELECT d.name FROM sys.default_constraints d
             JOIN sys.columns c ON c.object_id = d.parent_object_id AND c.column_id = d.parent_column_id
             WHERE d.parent_object_id = OBJECT_ID(N'dbo.' + @tabla) AND c.name = @columna);
  IF @df IS NOT NULL
  BEGIN
    SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' DROP CONSTRAINT ' + QUOTENAME(@df); EXEC sp_executesql @sql;
  END
  SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD ' + QUOTENAME(@columna + N'_tmp') + N' NVARCHAR(100) NULL;';
  EXEC sp_executesql @sql;
  SET @sql = N'UPDATE dbo.' + QUOTENAME(@tabla) + N' SET ' + QUOTENAME(@columna + N'_tmp')
           + N' = FORMAT(SWITCHOFFSET(' + QUOTENAME(@columna) + N', ''+00:00''), ''yyyy-MM-dd\THH:mm:ss.fff\Z'');';
  EXEC sp_executesql @sql;
  SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' DROP COLUMN ' + QUOTENAME(@columna) + N';';
  EXEC sp_executesql @sql;
  SET @sql = N'dbo.' + @tabla + N'.' + @columna + N'_tmp';
  EXEC sp_rename @sql, @columna, 'COLUMN';
  IF @nulo = 0
  BEGIN
    SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ALTER COLUMN ' + QUOTENAME(@columna) + N' NVARCHAR(100) NOT NULL;';
    EXEC sp_executesql @sql;
  END
  PRINT CONCAT(N'↻ ', @tabla, N'.', @columna, N' convertida a NVARCHAR(100) ISO');
  FETCH NEXT FROM cc INTO @tabla, @columna, @nulo;
END
CLOSE cc; DEALLOCATE cc;

-- 1. Columnas extendidas ------------------------------------------------------------
IF COL_LENGTH('dbo.TCL_AisUltimaPosicion', 'estado_nav_ais') IS NULL
  ALTER TABLE dbo.TCL_AisUltimaPosicion ADD estado_nav_ais TINYINT NULL;
IF COL_LENGTH('dbo.TCL_AisUltimaPosicion', 'id_puerto') IS NULL
  ALTER TABLE dbo.TCL_AisUltimaPosicion ADD id_puerto NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.TCL_AisUltimaPosicion', 'id_terminal') IS NULL
  ALTER TABLE dbo.TCL_AisUltimaPosicion ADD id_terminal NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.TCL_AisUltimaPosicion', 'codigo_muelle') IS NULL
  ALTER TABLE dbo.TCL_AisUltimaPosicion ADD codigo_muelle NVARCHAR(50) NULL;
IF COL_LENGTH('dbo.TCL_AisUltimaPosicion', 'fecha_cambio_estado') IS NULL
  ALTER TABLE dbo.TCL_AisUltimaPosicion ADD fecha_cambio_estado NVARCHAR(100) NULL;
PRINT N'✔ Columnas de estado en TCL_AisUltimaPosicion';

-- 2. Bitácora de transiciones --------------------------------------------------------
IF OBJECT_ID(N'dbo.TCL_EventosEstadoNave', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_EventosEstadoNave (
    id_evento                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_EventosEstadoNave PRIMARY KEY,
    mmsi                       NVARCHAR(20)   NOT NULL,
    nombre_motonave            NVARCHAR(100)  NULL,
    estado_anterior            NVARCHAR(30)   NULL,
    estado_nuevo               NVARCHAR(30)   NOT NULL,
    id_puerto                  NVARCHAR(50)   NULL,
    id_terminal                NVARCHAR(50)   NULL,
    codigo_muelle              NVARCHAR(50)   NULL,
    latitud                    DECIMAL(9,6)   NULL,
    longitud                   DECIMAL(9,6)   NULL,
    velocidad                  DECIMAL(5,1)   NULL,
    estado_nav_ais             TINYINT        NULL,
    duracion_anterior_min      INT            NULL,  -- cuánto duró el estado anterior
    fecha_evento               NVARCHAR(100)  NOT NULL,
    codigoUsuarioCreacion      NVARCHAR(50)   NOT NULL,
    fechaCreacion              NVARCHAR(100)  NOT NULL,
    codigoUsuarioModificacion  NVARCHAR(50)   NULL,
    fechaModificacion          NVARCHAR(100)  NULL
  );
  PRINT N'✔ Tabla TCL_EventosEstadoNave creada';
END
ELSE
BEGIN
  IF COL_LENGTH('dbo.TCL_EventosEstadoNave', 'codigoUsuarioModificacion') IS NULL
    ALTER TABLE dbo.TCL_EventosEstadoNave ADD codigoUsuarioModificacion NVARCHAR(50) NULL;
  IF COL_LENGTH('dbo.TCL_EventosEstadoNave', 'fechaModificacion') IS NULL
    ALTER TABLE dbo.TCL_EventosEstadoNave ADD fechaModificacion NVARCHAR(100) NULL;
  PRINT N'· TCL_EventosEstadoNave ya existía';
END

-- Respaldo por si alguien inserta a mano sin auditoría (el motor siempre las envía)
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_TCL_EventosEstadoNave_usuario')
  ALTER TABLE dbo.TCL_EventosEstadoNave ADD CONSTRAINT DF_TCL_EventosEstadoNave_usuario
    DEFAULT ('SYS_AIS_ENGINE') FOR codigoUsuarioCreacion;
IF NOT EXISTS (SELECT 1 FROM sys.default_constraints WHERE name = 'DF_TCL_EventosEstadoNave_fecha')
  ALTER TABLE dbo.TCL_EventosEstadoNave ADD CONSTRAINT DF_TCL_EventosEstadoNave_fecha
    DEFAULT (FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd\THH:mm:ss.fff\Z')) FOR fechaCreacion;

-- Historial de una nave
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TCL_EventosEstadoNave_Mmsi_Fecha' AND object_id = OBJECT_ID(N'dbo.TCL_EventosEstadoNave'))
  CREATE INDEX IX_TCL_EventosEstadoNave_Mmsi_Fecha
    ON dbo.TCL_EventosEstadoNave (mmsi, fecha_evento DESC);

-- KPIs por puerto: llegadas a fondeo, atraques, tiempos promedio
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = 'IX_TCL_EventosEstadoNave_Puerto_Estado_Fecha' AND object_id = OBJECT_ID(N'dbo.TCL_EventosEstadoNave'))
  CREATE INDEX IX_TCL_EventosEstadoNave_Puerto_Estado_Fecha
    ON dbo.TCL_EventosEstadoNave (id_puerto, estado_nuevo, fecha_evento)
    INCLUDE (estado_anterior, duracion_anterior_min, id_terminal, mmsi);

COMMIT TRANSACTION;

-- Verificación ----------------------------------------------------------------------
SELECT OBJECT_NAME(c.object_id) AS tabla, c.name AS columna, t.name AS tipo, c.max_length
FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
WHERE (c.object_id = OBJECT_ID(N'dbo.TCL_AisUltimaPosicion')
       AND c.name IN ('estado_nav_ais','id_puerto','id_terminal','codigo_muelle','fecha_cambio_estado'))
   OR (c.object_id = OBJECT_ID(N'dbo.TCL_EventosEstadoNave') AND c.name LIKE 'fecha%')
ORDER BY tabla, c.column_id;

/*
  Consultas útiles una vez el motor lleve unas horas corriendo:

  -- Foto actual por puerto
  SELECT id_puerto, estado_inferido, COUNT(*) AS naves,
         AVG(DATEDIFF(MINUTE, CONVERT(DATETIMEOFFSET, fecha_cambio_estado, 127), SYSDATETIMEOFFSET())) AS min_promedio_en_estado
  FROM dbo.TCL_AisUltimaPosicion
  GROUP BY id_puerto, estado_inferido ORDER BY id_puerto, naves DESC;

  -- Tiempo de fondeo antes de atracar (últimos 30 días) = indicador adelantado de congestión
  -- El rango se compara como texto ISO, así usa el índice.
  DECLARE @desde NVARCHAR(100) = FORMAT(DATEADD(DAY, -30, SYSUTCDATETIME()), 'yyyy-MM-dd\THH:mm:ss.fff\Z');
  SELECT id_puerto, COUNT(*) AS fondeos, AVG(duracion_anterior_min) / 60.0 AS horas_promedio_fondeo
  FROM dbo.TCL_EventosEstadoNave
  WHERE estado_anterior = 'FONDEADO' AND fecha_evento >= @desde
  GROUP BY id_puerto;
*/
