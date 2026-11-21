/*
  PORTTOS · Migración 062 · Faros unificados en Elementos de infraestructura (CC-280; usuario 2026-11-20: «son lo mismo, es confuso»)
  Un faro era una geocerca del corredor de llegada (peaje, acceso, zona) con conteo de camiones y naves; un elemento de infraestructura
  es lo mismo dentro del terminal, con métricas configurables (puntos de control). Desde aquí todo es Elementos de infraestructura.
  Qué hace (idempotente; no borra nada):
    1. TCL_MaestroInfraestructura: id_puerto (elementos del corredor, sin terminal), radio_metros (geocerca circular alrededor del
       punto), proximidad (CRITICO | MEDIO | LARGO: anillo del corredor) e id_faro_origen (trazabilidad). id_terminal pasa a opcional,
       con la regla «terminal o puerto».
    2. Tipos de infraestructura del corredor: peaje, punto_control_vial, zona_terrestre, zona_maritima.
    3. Copia los faros activos que no se hayan copiado: puerto = el más cercano a su punto, nombre sin « - Crítico/Medio/Largo» (eso va
       a proximidad), tipo corregido (el nombre con «Peaje» → peaje; PEAJE y PUNTO_CONTROL → punto_control_vial; ZONA_TERRESTRE →
       zona_terrestre; ZONA_MARITIMA → zona_maritima), geocerca = círculo de radio_metros alrededor del punto (si el faro tenía
       polígono, se conserva y radio_metros queda NULL), con el SRID que ya usa la tabla.
    4. A cada copia le asigna las métricas CAMIONES_DENTRO y NAVES_DENTRO con umbrales 20/50 (los fijos que tenía el radar de faros);
       el aviso de NAVES_DENTRO = genera_alerta_toast del faro (regla «Nave entra a una zona vigilada»).
    5. El menú «Faros» (/porttos/faros-panel) queda inactivo. TCL_MaestroFaros se conserva sin cambios (reversa y verificación).
  Base: plataformaBD. Requiere la 038 y la 051 (métricas de control). Puede ir antes o después del API: sin ella el API lee los faros como antes.
  Reversa: DELETE de las infraestructuras con id_faro_origen (y sus TCL_InfraestructuraMetricas); estadoModulo = 1 del menú Faros.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Con un error de requisitos no corre nada más (SET NOEXEC ON atraviesa los GO)
DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  SET NOEXEC ON;
END
IF OBJECT_ID(N'dbo.TCL_MaestroInfraestructura', N'U') IS NULL OR OBJECT_ID(N'dbo.TCL_MaestroFaros', N'U') IS NULL
   OR OBJECT_ID(N'dbo.TCL_TiposInfraestructura', N'U') IS NULL OR OBJECT_ID(N'dbo.TCL_MaestroPuertos', N'U') IS NULL
BEGIN
  RAISERROR('Faltan tablas de Porttos (infraestructura, faros, tipos o puertos). Revise la base.', 16, 1);
  SET NOEXEC ON;
END
IF OBJECT_ID(N'dbo.TCL_InfraestructuraMetricas', N'U') IS NULL OR OBJECT_ID(N'dbo.TCL_MetricasControl', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 051 (métricas de control). Córrala primero.', 16, 1);
  SET NOEXEC ON;
END

-- 1. Columnas nuevas ------------------------------------------------------------------------------------------------------------
IF COL_LENGTH(N'dbo.TCL_MaestroInfraestructura', N'id_puerto') IS NULL
  ALTER TABLE dbo.TCL_MaestroInfraestructura ADD id_puerto NVARCHAR(50) NULL;
IF COL_LENGTH(N'dbo.TCL_MaestroInfraestructura', N'radio_metros') IS NULL
  ALTER TABLE dbo.TCL_MaestroInfraestructura ADD radio_metros INT NULL;
IF COL_LENGTH(N'dbo.TCL_MaestroInfraestructura', N'proximidad') IS NULL
  ALTER TABLE dbo.TCL_MaestroInfraestructura ADD proximidad NVARCHAR(20) NULL;
IF COL_LENGTH(N'dbo.TCL_MaestroInfraestructura', N'id_faro_origen') IS NULL
  ALTER TABLE dbo.TCL_MaestroInfraestructura ADD id_faro_origen INT NULL;
GO

-- id_terminal opcional (mismo tipo que hoy)
DECLARE @tipo NVARCHAR(200) = (
  SELECT TOP (1) CASE WHEN t.name IN (N'nvarchar', N'nchar') THEN t.name + N'(' + CASE WHEN c.max_length = -1 THEN N'MAX' ELSE CAST(c.max_length / 2 AS NVARCHAR(10)) END + N')'
                      WHEN t.name IN (N'varchar', N'char') THEN t.name + N'(' + CASE WHEN c.max_length = -1 THEN N'MAX' ELSE CAST(c.max_length AS NVARCHAR(10)) END + N')'
                      ELSE t.name END
  FROM sys.columns c JOIN sys.types t ON t.user_type_id = c.user_type_id
  WHERE c.object_id = OBJECT_ID(N'dbo.TCL_MaestroInfraestructura') AND c.name = N'id_terminal' AND c.is_nullable = 0);
IF @tipo IS NOT NULL
BEGIN
  DECLARE @sql NVARCHAR(400) = N'ALTER TABLE dbo.TCL_MaestroInfraestructura ALTER COLUMN id_terminal ' + @tipo + N' NULL;';
  EXEC sp_executesql @sql;
  PRINT N'✔ id_terminal ahora es opcional (' + @tipo + N')';
END
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_TCL_MaestroInfraestructura_terminal_o_puerto')
  EXEC (N'ALTER TABLE dbo.TCL_MaestroInfraestructura WITH NOCHECK ADD CONSTRAINT CK_TCL_MaestroInfraestructura_terminal_o_puerto
         CHECK (id_terminal IS NOT NULL OR id_puerto IS NOT NULL);');
IF NOT EXISTS (SELECT 1 FROM sys.check_constraints WHERE name = N'CK_TCL_MaestroInfraestructura_proximidad')
  EXEC (N'ALTER TABLE dbo.TCL_MaestroInfraestructura WITH NOCHECK ADD CONSTRAINT CK_TCL_MaestroInfraestructura_proximidad
         CHECK (proximidad IS NULL OR proximidad IN (N''CRITICO'', N''MEDIO'', N''LARGO''));');
GO

-- 2. Tipos del corredor ---------------------------------------------------------------------------------------------------------
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';
DECLARE @tipos TABLE (codigo NVARCHAR(100) COLLATE DATABASE_DEFAULT, nombre NVARCHAR(200) COLLATE DATABASE_DEFAULT,
                      descripcion NVARCHAR(500) COLLATE DATABASE_DEFAULT, color NVARCHAR(20) COLLATE DATABASE_DEFAULT);
INSERT INTO @tipos VALUES
  (N'peaje', N'Peaje', N'Peaje del corredor de llegada al puerto (CC-280, antes faro)', N'#b31930'),
  (N'punto_control_vial', N'Punto de control vial', N'Acceso, cruce o punto de paso del corredor terrestre (CC-280, antes faro)', N'#346BA6'),
  (N'zona_terrestre', N'Zona del corredor terrestre', N'Tramo o zona de la vía de llegada al puerto (CC-280, antes faro)', N'#b14206'),
  (N'zona_maritima', N'Zona marítima de aproximación', N'Canal, fondeadero o zona de aproximación por mar (CC-280, antes faro)', N'#07c7ed');
INSERT INTO dbo.TCL_TiposInfraestructura (codigo_tipo, nombre, descripcion, color_ui, estado, usuario_cargue, fecha_cargue)
SELECT t.codigo, t.nombre, t.descripcion, t.color, 1, N'MIGRACION_062', @ahora
FROM @tipos t
WHERE NOT EXISTS (SELECT 1 FROM dbo.TCL_TiposInfraestructura x WHERE LOWER(x.codigo_tipo) = t.codigo);
PRINT CONCAT(N'✔ Tipos del corredor creados: ', @@ROWCOUNT, N' (0 = ya estaban)');
GO

-- 3 y 4. Faros → infraestructura con sus métricas --------------------------------------------------------------------------------
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';
DECLARE @srid INT = ISNULL((SELECT TOP (1) geocerca_geo.STSrid FROM dbo.TCL_MaestroInfraestructura WHERE geocerca_geo IS NOT NULL AND id_faro_origen IS NULL), 0);

BEGIN TRANSACTION;

;WITH f AS (
  SELECT fa.*,
    -- punto del faro (si es polígono, su centro)
    CASE WHEN fa.geocerca_geo.STGeometryType() = N'Point' THEN fa.geocerca_geo ELSE fa.geocerca_geo.STCentroid() END AS punto,
    UPPER(LTRIM(RTRIM(CASE WHEN CHARINDEX(N' - ', fa.nombre_faro) > 0 THEN RIGHT(fa.nombre_faro, CHARINDEX(N' - ', REVERSE(fa.nombre_faro)) - 1) END))) AS anillo
  FROM dbo.TCL_MaestroFaros fa
  WHERE fa.estado = 1 AND fa.geocerca_geo IS NOT NULL
    AND NOT EXISTS (SELECT 1 FROM dbo.TCL_MaestroInfraestructura i WHERE i.id_faro_origen = fa.id_faro)
), g AS (
  SELECT f.*,
    CASE WHEN f.anillo IN (N'CRÍTICO', N'CRITICO') THEN N'CRITICO' WHEN f.anillo = N'MEDIO' THEN N'MEDIO' WHEN f.anillo = N'LARGO' THEN N'LARGO' END AS proximidad,
    CASE WHEN f.nombre_faro LIKE N'%peaje%' THEN N'peaje'
         WHEN f.tipo_faro IN (N'PEAJE', N'PUNTO_CONTROL') THEN N'punto_control_vial'
         WHEN f.tipo_faro = N'ZONA_MARITIMA' THEN N'zona_maritima'
         ELSE N'zona_terrestre' END AS codigo_tipo,
    (SELECT TOP (1) p.id_puerto FROM dbo.TCL_MaestroPuertos p
     WHERE p.ubicacion_geo IS NOT NULL
     ORDER BY geometry::STGeomFromWKB(p.ubicacion_geo.STAsBinary(), 4326).STDistance(geometry::STGeomFromWKB(f.punto.STAsBinary(), 4326))) AS id_puerto
  FROM f
)
INSERT INTO dbo.TCL_MaestroInfraestructura (id_terminal, id_puerto, id_tipo, tipo, nombre, ubicacion_geo, geocerca_geo, color_ui, descripcion,
                                            estado, fecha_cargue, radio_metros, proximidad, id_faro_origen)
SELECT NULL, g.id_puerto, ti.id_tipo, g.codigo_tipo,
  CASE WHEN g.proximidad IS NOT NULL THEN LTRIM(RTRIM(LEFT(g.nombre_faro, LEN(g.nombre_faro) - CHARINDEX(N' - ', REVERSE(g.nombre_faro)) - 2))) ELSE g.nombre_faro END,
  geometry::STGeomFromWKB(g.punto.STAsBinary(), @srid),
  CASE WHEN g.geocerca_geo.STGeometryType() = N'Point'
       THEN geometry::STGeomFromText(geography::Point(g.punto.STY, g.punto.STX, 4326).STBuffer(ISNULL(NULLIF(g.radio_metros, 0), 500)).STAsText(), @srid).MakeValid()
       ELSE geometry::STGeomFromWKB(g.geocerca_geo.STAsBinary(), @srid).MakeValid() END,
  g.color_ui,
  CASE WHEN g.descripcion IS NULL OR g.descripcion LIKE N'%Sin Descripci%' THEN NULL ELSE g.descripcion END,
  1, @ahora,
  CASE WHEN g.geocerca_geo.STGeometryType() = N'Point' THEN ISNULL(NULLIF(g.radio_metros, 0), 500) END,
  g.proximidad, g.id_faro
FROM g
JOIN dbo.TCL_TiposInfraestructura ti ON LOWER(ti.codigo_tipo) = g.codigo_tipo;
DECLARE @copiados INT = @@ROWCOUNT;

INSERT INTO dbo.TCL_InfraestructuraMetricas (id_infraestructura, id_metrica, activa, umbral_amarillo, umbral_rojo, alerta,
                                             codigoUsuarioCreacion, fechaCreacion)
SELECT i.id_infraestructura, m.id, 1, 20, 50,
       CASE WHEN m.codigo = N'NAVES_DENTRO' AND fa.genera_alerta_toast = 1 THEN 1 ELSE 0 END,
       N'MIGRACION_062', @ahora
FROM dbo.TCL_MaestroInfraestructura i
JOIN dbo.TCL_MaestroFaros fa ON fa.id_faro = i.id_faro_origen
JOIN dbo.TCL_MetricasControl m ON m.codigo IN (N'CAMIONES_DENTRO', N'NAVES_DENTRO')
WHERE NOT EXISTS (SELECT 1 FROM dbo.TCL_InfraestructuraMetricas x WHERE x.id_infraestructura = i.id_infraestructura AND x.id_metrica = m.id);
DECLARE @metricas INT = @@ROWCOUNT;

COMMIT TRANSACTION;
PRINT CONCAT(N'✔ Faros copiados a infraestructura: ', @copiados, N' · métricas asignadas: ', @metricas, N' (0 y 0 = ya estaban)');

-- Revisión: cada copia con su puerto, tipo y proximidad (el faro 17 «ACCESO CARRETERA - MEDIO» tiene la geocerca junto a Loboguerrero)
SELECT i.id_faro_origen, i.id_infraestructura, i.id_puerto, i.tipo, i.proximidad, i.nombre, i.radio_metros
FROM dbo.TCL_MaestroInfraestructura i WHERE i.id_faro_origen IS NOT NULL ORDER BY i.id_faro_origen;
GO

-- 5. Menú Faros inactivo ----------------------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NOT NULL
BEGIN
  UPDATE dbo.PTL_ModulosAP SET estadoModulo = 0,
         fechaModificacion = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z'
  WHERE rutaModulo = N'/porttos/faros-panel' AND estadoModulo = 1;
  PRINT CONCAT(N'✔ Menú Faros inactivo: ', @@ROWCOUNT, N' (0 = ya estaba)');
END
ELSE PRINT N'⚠ No está dbo.PTL_ModulosAP (038): desactive el menú Faros (/porttos/faros-panel) a mano.';
GO
SET NOEXEC OFF;
