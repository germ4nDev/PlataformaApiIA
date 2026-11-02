/*
  PORTTOS · Migración 022 · Punto de fondeo de cada puerto (OT-009, decisión del usuario 2026-10-29)
  Para qué: el simulador de buques ubica las naves fondeadas simuladas en el fondeadero del puerto; sin este punto quedarían
  junto a los muelles o en tierra. Es dato, no código: cada puerto se corrige aquí sin tocar el API.
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_MaestroPuertos + fondeo_geo GEOMETRY NULL (punto, SRID 4326) y fondeo_fuente NVARCHAR(60) NULL.
    2. Un punto APROXIMADO por puerto (rada o bahía de cada uno), solo donde fondeo_geo está en NULL, con
       fondeo_fuente = 'APROXIMADO_VALIDAR_CARTA_DIMAR'. Hay que validarlos con la carta náutica de DIMAR y, al corregirlos,
       cambiar fondeo_fuente (p. ej. 'CARTA_DIMAR'). Cartagena coincide con las naves fondeadas que reportó el AIS real.
  Un puerto sin punto de fondeo: el simulador no dibuja fondeadas en el mapa para ese puerto (sí las cuenta en los widgets).
  Reversa: ALTER TABLE dbo.TCL_MaestroPuertos DROP COLUMN fondeo_geo, fondeo_fuente;
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
IF COL_LENGTH(N'dbo.TCL_MaestroPuertos', N'fondeo_geo') IS NULL
  ALTER TABLE dbo.TCL_MaestroPuertos ADD fondeo_geo GEOMETRY NULL;
IF COL_LENGTH(N'dbo.TCL_MaestroPuertos', N'fondeo_fuente') IS NULL
  ALTER TABLE dbo.TCL_MaestroPuertos ADD fondeo_fuente NVARCHAR(60) NULL;
COMMIT TRANSACTION;

-- Las columnas nuevas solo se ven en un lote aparte (por eso el UPDATE va con EXEC)
BEGIN TRANSACTION;
EXEC (N'
  UPDATE p SET
    fondeo_geo = geometry::Point(v.lon, v.lat, 4326),
    fondeo_fuente = N''APROXIMADO_VALIDAR_CARTA_DIMAR''
  FROM dbo.TCL_MaestroPuertos p
  JOIN (VALUES
    (N''BARRANQUILLA'', 11.1150, -74.8700),
    (N''BUENAVENTURA'',  3.8500, -77.1200),
    (N''CARTAGENA'',    10.3250, -75.5300),
    (N''COVENAS'',       9.4400, -75.7200),
    (N''GUAJIRA'',      12.2600, -71.9900),
    (N''SANTA_MARTA'',  11.2550, -74.2350),
    (N''TUMACO'',        1.8500, -78.7900),
    (N''TURBO'',         8.0800, -76.7600)
  ) v (id_puerto, lat, lon) ON v.id_puerto = p.id_puerto
  WHERE p.fondeo_geo IS NULL;
');
COMMIT TRANSACTION;

PRINT 'Migración 022 aplicada: TCL_MaestroPuertos.fondeo_geo y fondeo_fuente.';
