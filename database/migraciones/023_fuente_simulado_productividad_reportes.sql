/*
  PORTTOS · Migración 023 · fuente y simulado en productividad, reportes operativos e histórico de productividad (OT-009)
  Autorizada por el usuario (2026-10-29: «Sí, la 023»). Misma convención que la 021:
    fuente   NVARCHAR(40) NOT NULL DEFAULT 'INGESTA_API'
    simulado BIT          NOT NULL DEFAULT 0
  Qué hace (idempotente, se puede correr varias veces; no borra nada): agrega las columnas que falten en
  TCL_ProductividadTerminales, TCL_ReportesOperativos y TCL_HistoricoProductividad. Lo que ya está queda como real.
  El API funciona antes de correrla: el simulador de productividad y reportes avisa una vez en consola y no escribe nada.
  Reversa (por tabla): ALTER TABLE dbo.<tabla> DROP CONSTRAINT DF_<tabla>_fuente, DF_<tabla>_simulado; ALTER TABLE dbo.<tabla> DROP COLUMN fuente, simulado;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @tablas TABLE (tabla sysname COLLATE DATABASE_DEFAULT PRIMARY KEY);
INSERT INTO @tablas (tabla) VALUES (N'TCL_ProductividadTerminales'), (N'TCL_ReportesOperativos'), (N'TCL_HistoricoProductividad');

DECLARE @tabla sysname, @sql NVARCHAR(MAX);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tabla FROM @tablas;
OPEN c;
FETCH NEXT FROM c INTO @tabla;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @tabla, N'U') IS NULL
    PRINT 'No existe dbo.' + @tabla + ': se omite.';
  ELSE
  BEGIN
    BEGIN TRANSACTION;
    IF COL_LENGTH(N'dbo.' + @tabla, N'fuente') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD fuente NVARCHAR(40) NOT NULL CONSTRAINT '
               + QUOTENAME(N'DF_' + @tabla + N'_fuente') + N' DEFAULT (N''INGESTA_API'') WITH VALUES;';
      EXEC (@sql);
    END
    IF COL_LENGTH(N'dbo.' + @tabla, N'simulado') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD simulado BIT NOT NULL CONSTRAINT '
               + QUOTENAME(N'DF_' + @tabla + N'_simulado') + N' DEFAULT (0) WITH VALUES;';
      EXEC (@sql);
    END
    COMMIT TRANSACTION;
  END
  FETCH NEXT FROM c INTO @tabla;
END
CLOSE c;
DEALLOCATE c;

PRINT 'Migración 023 aplicada: fuente y simulado en productividad, reportes e histórico de productividad.';
