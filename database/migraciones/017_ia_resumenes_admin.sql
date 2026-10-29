/*
  PORTTOS · Migración 017 · Capa de análisis con IA, fase 4: resúmenes y administración por puerto y tarea
  Requiere la 015. Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_IAHallazgos.contenido (NVARCHAR(MAX), JSON): el detalle de los resúmenes (lo que pasó, lo que viene,
       qué vigilar, tendencias explicadas) y el origen (modelo o automático). Índice para buscar resúmenes por periodo.
    2. dbo.TCL_IAConfig pasa a «NULL = hereda del .env»: activo, modoSombra, topes y confianza aceptan NULL y se
       agrega tiposPublicar (lista separada por comas, NULL = hereda IA_TIPOS_PUBLICAR). La fila semilla de la 015
       ('*', analista_turno, apagada) se deja heredando si nadie la ha tocado (modificadoPor IS NULL), para que
       IA_ENABLED / IA_MODO_SOMBRA del .env sigan mandando hasta que se configure desde el panel.
  Prioridad al resolver: fila del puerto > fila '*' > .env. IA_ENABLED=false apaga todo igual.
  Reversa:
    DROP INDEX IX_TCL_IAHallazgos_Resumenes ON dbo.TCL_IAHallazgos;
    ALTER TABLE dbo.TCL_IAHallazgos DROP COLUMN contenido;
    ALTER TABLE dbo.TCL_IAConfig DROP COLUMN tiposPublicar;   (las columnas siguen aceptando NULL)
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_IAHallazgos', N'U') IS NULL OR OBJECT_ID(N'dbo.TCL_IAConfig', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 015_analisis_ia.sql: córrela primero.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 1. Contenido de los resúmenes
IF COL_LENGTH(N'dbo.TCL_IAHallazgos', N'contenido') IS NULL
BEGIN
  ALTER TABLE dbo.TCL_IAHallazgos ADD contenido NVARCHAR(MAX) NULL;
  PRINT N'✔ TCL_IAHallazgos.contenido';
END
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_IAHallazgos_Resumenes' AND object_id = OBJECT_ID(N'dbo.TCL_IAHallazgos'))
BEGIN
  CREATE INDEX IX_TCL_IAHallazgos_Resumenes ON dbo.TCL_IAHallazgos (puerto, clase, tipo, fecha) INCLUDE (entidad, estado);
  PRINT N'✔ IX_TCL_IAHallazgos_Resumenes';
END

-- 2. Configuración por puerto y tarea: NULL = hereda del .env
ALTER TABLE dbo.TCL_IAConfig ALTER COLUMN activo BIT NULL;
ALTER TABLE dbo.TCL_IAConfig ALTER COLUMN modoSombra BIT NULL;
ALTER TABLE dbo.TCL_IAConfig ALTER COLUMN topeTokensDia INT NULL;
ALTER TABLE dbo.TCL_IAConfig ALTER COLUMN topeLlamadasDia INT NULL;
ALTER TABLE dbo.TCL_IAConfig ALTER COLUMN confianzaMinima DECIMAL(3,2) NULL;
IF COL_LENGTH(N'dbo.TCL_IAConfig', N'tiposPublicar') IS NULL
BEGIN
  ALTER TABLE dbo.TCL_IAConfig ADD tiposPublicar NVARCHAR(400) NULL;
  PRINT N'✔ TCL_IAConfig.tiposPublicar';
END

COMMIT TRANSACTION;

-- La fila semilla de la 015 hereda del .env mientras nadie la haya configurado desde el panel
UPDATE dbo.TCL_IAConfig
SET activo = NULL, modoSombra = NULL, topeTokensDia = NULL, topeLlamadasDia = NULL, confianzaMinima = NULL
WHERE puerto = N'*' AND codigoTarea = N'analista_turno' AND modificadoPor IS NULL;
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' fila semilla dejada en «hereda del .env»');

PRINT N'✔ Migración 017 aplicada. Reinicia el API.';
SELECT id, puerto, codigoTarea, activo, modoSombra, topeTokensDia, topeLlamadasDia, confianzaMinima, modificadoPor FROM dbo.TCL_IAConfig;
