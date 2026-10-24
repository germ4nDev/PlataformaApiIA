/*
  PORTTOS · Migración 014 · Ciclo de vida de los eventos viales
  Qué hace (idempotente, se puede correr varias veces):
    1. Respaldo de la tabla tal como está: dbo.TCL_EventosViales_respaldo014 (solo la primera vez).
    2. Columnas nuevas en dbo.TCL_EventosViales:
         fuente              TOMTOM | MANUAL (por defecto MANUAL: lo que inserte la ingesta u otro proceso)
         zonaFuente          zona de la consulta TomTom donde vino (Pacífico, Cafetero, Centro, Antioquia, Caribe)
         fechaUltimoReporte  última vez que la fuente lo reportó (mismo tipo de dato que fechaModificacion)
         ausencias           sincronizaciones seguidas en que no se reportó
         motivoCierre        NO_REPORTADO | FIN_PROGRAMADO | MANUAL | DEPURACION_014
    3. Completa las filas que ya existen: fuente por el usuario que las creó (SYS_CRON_TOMTOM → TOMTOM) y
       fechaUltimoReporte = fechaModificacion (o fechaCreacion).
    4. Corrige el tipo mal escrito VEHICULO_AVERIDADO → VEHICULO_AVERIADO.
    5. Depuración: los ACTIVO de TomTom que no se reportan hace más de 1 hora pasan a DESPEJADO
       (motivo DEPURACION_014, fechaFin = su último reporte). Antes nada los cerraba y la tabla acumulaba
       eventos de días atrás como ACTIVO. No borra filas.
    6. Índice para la consulta del mapa (estado + último reporte).
  Reglas del ciclo de vida: PlataformaApiIA/utils/eventos-viales.js.
  El API funciona antes de correrla (regla anterior: reportados hoy, sin despeje automático); después, reiniciar el API.
  Reversa (deja la tabla como antes; los despejados por la 014 vuelven a ACTIVO desde el respaldo):
    DROP INDEX IX_TCL_EventosViales_Vigentes ON dbo.TCL_EventosViales;
    ALTER TABLE dbo.TCL_EventosViales DROP CONSTRAINT DF_TCL_EventosViales_fuente, DF_TCL_EventosViales_ausencias;
    ALTER TABLE dbo.TCL_EventosViales DROP COLUMN fuente, zonaFuente, fechaUltimoReporte, ausencias, motivoCierre;
    UPDATE e SET e.estadoEvento = r.estadoEvento, e.fechaFin = r.fechaFin, e.tipoEvento = r.tipoEvento
      FROM dbo.TCL_EventosViales e JOIN dbo.TCL_EventosViales_respaldo014 r ON r.codigoEvento = e.codigoEvento;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF OBJECT_ID(N'dbo.TCL_EventosViales', N'U') IS NULL
BEGIN
  RAISERROR('No existe dbo.TCL_EventosViales.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 1. Respaldo
IF OBJECT_ID(N'dbo.TCL_EventosViales_respaldo014', N'U') IS NULL
BEGIN
  SELECT * INTO dbo.TCL_EventosViales_respaldo014 FROM dbo.TCL_EventosViales;
  PRINT 'Respaldo creado: dbo.TCL_EventosViales_respaldo014';
END

-- 2. Columnas (fechaUltimoReporte con el mismo tipo que fechaModificacion)
IF COL_LENGTH(N'dbo.TCL_EventosViales', N'fuente') IS NULL
  ALTER TABLE dbo.TCL_EventosViales ADD fuente NVARCHAR(20) NOT NULL CONSTRAINT DF_TCL_EventosViales_fuente DEFAULT (N'MANUAL');
IF COL_LENGTH(N'dbo.TCL_EventosViales', N'zonaFuente') IS NULL
  ALTER TABLE dbo.TCL_EventosViales ADD zonaFuente NVARCHAR(40) NULL;
IF COL_LENGTH(N'dbo.TCL_EventosViales', N'ausencias') IS NULL
  ALTER TABLE dbo.TCL_EventosViales ADD ausencias INT NOT NULL CONSTRAINT DF_TCL_EventosViales_ausencias DEFAULT (0);
IF COL_LENGTH(N'dbo.TCL_EventosViales', N'motivoCierre') IS NULL
  ALTER TABLE dbo.TCL_EventosViales ADD motivoCierre NVARCHAR(30) NULL;
IF COL_LENGTH(N'dbo.TCL_EventosViales', N'fechaUltimoReporte') IS NULL
BEGIN
  DECLARE @tipo NVARCHAR(60) = (
    SELECT CASE WHEN t.name IN (N'datetime2', N'datetimeoffset', N'time') THEN t.name + N'(' + CAST(c.scale AS NVARCHAR(5)) + N')'
                WHEN t.name IN (N'nvarchar', N'varchar') THEN t.name + N'(' + CASE WHEN c.max_length = -1 THEN N'max' ELSE CAST(c.max_length / CASE WHEN t.name = N'nvarchar' THEN 2 ELSE 1 END AS NVARCHAR(5)) END + N')'
                ELSE t.name END
    FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.TCL_EventosViales') AND c.name = N'fechaModificacion');
  DECLARE @sql NVARCHAR(400) = N'ALTER TABLE dbo.TCL_EventosViales ADD fechaUltimoReporte ' + ISNULL(@tipo, N'datetimeoffset(7)') + N' NULL;';
  EXEC sys.sp_executesql @sql;
  PRINT 'Columna fechaUltimoReporte creada como ' + ISNULL(@tipo, N'datetimeoffset(7)');
END
COMMIT TRANSACTION;

-- 3 a 6 con SQL dinámico: en este mismo lote las columnas nuevas aún no existen para el compilador
BEGIN TRANSACTION;

EXEC sys.sp_executesql N'
UPDATE dbo.TCL_EventosViales
   SET fuente = CASE WHEN codigoUsuarioCreacion = N''SYS_CRON_TOMTOM'' THEN N''TOMTOM'' ELSE N''MANUAL'' END,
       fechaUltimoReporte = ISNULL(fechaModificacion, fechaCreacion)
 WHERE fechaUltimoReporte IS NULL;';

UPDATE dbo.TCL_EventosViales SET tipoEvento = N'VEHICULO_AVERIADO' WHERE tipoEvento = N'VEHICULO_AVERIDADO';

DECLARE @depurados INT;
EXEC sys.sp_executesql N'
UPDATE dbo.TCL_EventosViales
   SET estadoEvento = N''DESPEJADO'',
       motivoCierre = N''DEPURACION_014'',
       fechaFin = ISNULL(fechaFin, fechaUltimoReporte),
       codigoUsuarioModificacion = N''MIGRACION_014''
 WHERE estadoEvento = N''ACTIVO''
   AND fuente = N''TOMTOM''
   AND CAST(fechaUltimoReporte AS DATETIME2) < DATEADD(HOUR, -1, SYSUTCDATETIME());
SET @n = @@ROWCOUNT;', N'@n INT OUTPUT', @n = @depurados OUTPUT;
PRINT 'Eventos de TomTom sin reporte hace más de 1 h pasados a DESPEJADO: ' + CAST(ISNULL(@depurados, 0) AS NVARCHAR(10));

COMMIT TRANSACTION;

-- 6. Índice
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_EventosViales_Vigentes' AND object_id = OBJECT_ID(N'dbo.TCL_EventosViales'))
  EXEC sys.sp_executesql N'CREATE INDEX IX_TCL_EventosViales_Vigentes ON dbo.TCL_EventosViales (estadoEvento, fechaUltimoReporte)
    INCLUDE (fuente, zonaFuente, ausencias, tipoEvento, fechaFin);';

PRINT N'✔ Migración 014 aplicada. Reinicia el API para que la sincronización despeje los eventos que dejan de reportarse.';
