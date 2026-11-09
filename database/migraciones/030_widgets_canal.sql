/*
  PLATAFORMA · Migración 030 · Canal del widget: web, teléfono o ambos (OT-017, aprobado por el usuario el 2026-11-05)
  Qué hace (idempotente; no borra nada):
    1. dbo.PTLWidgetsMaestro: columna canal NVARCHAR(10) NOT NULL DEFAULT N'web' con CHECK (web | telefono | ambos).
       Tabla compartida de la plataforma: con 'web' todo sigue igual para las otras aplicaciones (excepción compatible de la
       regla 7 aprobada para el módulo de widgets).
         web      = web y tableta (como hoy).
         telefono = solo el teléfono (lo que era movil = 1).
         ambos    = web, tableta y teléfono (un widget de la web que también se ofrece en el teléfono).
    2. Al crear la columna la llena desde movil (1 → 'telefono', 0 → 'web'). movil se conserva para compatibilidad: el API la
       mantiene igual a (canal = 'telefono') hasta que nada la use.
  REQUISITO: correrla ANTES de desplegar el API con el campo canal (sin la columna fallan las consultas del maestro, también
  /api/layout). Requiere la 028 (columna movil).
  Reversa: ALTER TABLE dbo.PTLWidgetsMaestro DROP CONSTRAINT CK_PTLWidgetsMaestro_canal;
           ALTER TABLE dbo.PTLWidgetsMaestro DROP CONSTRAINT DF_PTLWidgetsMaestro_canal;
           ALTER TABLE dbo.PTLWidgetsMaestro DROP COLUMN canal;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF COL_LENGTH(N'dbo.PTLWidgetsMaestro', N'movil') IS NULL
BEGIN
  RAISERROR('Falta la migración 028 (columna movil de PTLWidgetsMaestro). Córrela antes de esta.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 1. Columna canal (en EXEC para que el resto del lote compile antes de que exista).
IF COL_LENGTH(N'dbo.PTLWidgetsMaestro', N'canal') IS NULL
BEGIN
  EXEC (N'ALTER TABLE dbo.PTLWidgetsMaestro ADD canal NVARCHAR(10) COLLATE DATABASE_DEFAULT NOT NULL
          CONSTRAINT DF_PTLWidgetsMaestro_canal DEFAULT (N''web'');');
  -- 2. Solo la primera vez: llenar desde movil.
  EXEC (N'UPDATE dbo.PTLWidgetsMaestro SET canal = N''telefono'' WHERE movil = 1;');
  PRINT CONCAT(N'✔ Columna canal creada; ', @@ROWCOUNT, N' widgets de teléfono pasados a canal = telefono');
END
ELSE
  PRINT N'· La columna canal ya existía: no se cambia ningún valor.';

IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_PTLWidgetsMaestro_canal')
  EXEC (N'ALTER TABLE dbo.PTLWidgetsMaestro ADD CONSTRAINT CK_PTLWidgetsMaestro_canal
          CHECK (canal IN (N''web'', N''telefono'', N''ambos''));');

COMMIT TRANSACTION;
PRINT 'Migración 030 aplicada: canal del widget (web | telefono | ambos) en PTLWidgetsMaestro.';
EXEC (N'SELECT canal, COUNT(*) AS widgets FROM dbo.PTLWidgetsMaestro GROUP BY canal ORDER BY canal;');
