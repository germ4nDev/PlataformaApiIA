/*
  PORTTOS · Migración 024 · Zona portuaria de Supertransporte de cada puerto (OT-009, autorizada por el usuario 2026-10-29)
  Para qué: el conjunto público de Supertransporte (datos.gov.co 5r3g-zv5z) nombra las zonas a su manera: Coveñas es
  'G. MORROSQUILLO', La Guajira es 'GUAJIRA' y Puerto Antioquia es 'TURBO'. Con la clave del selector esos puertos no
  encontraban nada (tráfico, participación, mezcla, históricos). Es dato, no código: se corrige aquí sin tocar el API.
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_MaestroPuertos + zona_supertransporte NVARCHAR(100) NULL.
    2. La zona de los 8 puertos del selector, solo donde está en NULL (nombres tal como los publica la fuente).
  Sin valor, el API usa la clave del puerto como antes.
  Reversa: ALTER TABLE dbo.TCL_MaestroPuertos DROP COLUMN zona_supertransporte;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

BEGIN TRANSACTION;
IF COL_LENGTH(N'dbo.TCL_MaestroPuertos', N'zona_supertransporte') IS NULL
  ALTER TABLE dbo.TCL_MaestroPuertos ADD zona_supertransporte NVARCHAR(100) NULL;
COMMIT TRANSACTION;

BEGIN TRANSACTION;
EXEC (N'
  UPDATE p SET zona_supertransporte = v.zona
  FROM dbo.TCL_MaestroPuertos p
  JOIN (VALUES
    (N''BARRANQUILLA'', N''BARRANQUILLA''),
    (N''BUENAVENTURA'', N''BUENAVENTURA''),
    (N''CARTAGENA'',    N''CARTAGENA''),
    (N''COVENAS'',      N''G. MORROSQUILLO''),
    (N''GUAJIRA'',      N''GUAJIRA''),
    (N''SANTA_MARTA'',  N''SANTA MARTA''),
    (N''TUMACO'',       N''TUMACO''),
    (N''TURBO'',        N''TURBO'')
  ) v (id_puerto, zona) ON v.id_puerto = p.id_puerto
  WHERE p.zona_supertransporte IS NULL;
');
COMMIT TRANSACTION;

PRINT 'Migración 024 aplicada: TCL_MaestroPuertos.zona_supertransporte.';
