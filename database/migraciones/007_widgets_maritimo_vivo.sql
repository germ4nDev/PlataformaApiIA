/*
  PORTTOS · Migración 007 · Widgets "Marítimo en vivo" en el catálogo de la pestaña Marítimo
  Qué hace (idempotente):
    1. Registra 5 widgets en dbo.PTLWidgetsMaestro copiando tipo, aplicación, suite e imágenes de un widget
       marítimo existente (@referencia).
    2. Les da los mismos roles que tiene @referencia en dbo.PTLWidgetsRoles.
  Por defecto quedan DISPONIBLES en el selector de widgets (inicial = 0), sin mover el tablero de nadie.
  Con @mostrarEnLayoutInicial = 1 también aparecen en el layout base, debajo de los widgets actuales.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @pestana NVARCHAR(200) = N'TLC_MARITIMO_001';
DECLARE @referencia NVARCHAR(200) = N'PTT_MAE_CHRT_ETA_ATA';
DECLARE @mostrarEnLayoutInicial BIT = 0;          -- 1 = aparecen solos en el layout base de la pestaña
DECLARE @ahora NVARCHAR(100) = FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd\THH:mm:ss.fff\Z');

-- Widget de referencia: el indicado o, si no existe, cualquiera de la pestaña
IF NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro WHERE codigoWidget = @referencia)
  SELECT TOP (1) @referencia = codigoWidget FROM dbo.PTLWidgetsMaestro WHERE codigoPestana = @pestana ORDER BY codigoWidget;
IF NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro WHERE codigoWidget = @referencia)
BEGIN
  RAISERROR('No hay widgets en la pestaña %s para usar como referencia.', 16, 1, @pestana);
  RETURN;
END

DECLARE @nuevos TABLE (codigo NVARCHAR(200), nombre NVARCHAR(150), descripcion NVARCHAR(4000), cols INT, filas INT, x INT, y INT);
INSERT INTO @nuevos VALUES
  (N'PTT_MAE_VIVO_KPIS',        N'Operación marítima en vivo',
   N'Fondeadas ahora, ocupación de muelles, llegadas 24 h, espera p90 en fondeo y naves en zona (AIS + DIMAR).', 12, 2, 0, 0),
  (N'PTT_MAE_VIVO_COLA_FONDEO', N'Cola de fondeo',
   N'Naves fondeadas esperando muelle, ordenadas por tiempo de espera, con semáforo 12 h / 24 h.', 4, 5, 0, 2),
  (N'PTT_MAE_VIVO_MUELLES',     N'Ocupación de muelles',
   N'Muelles ocupados, libres y en mantenimiento en tiempo real, con la nave y su tiempo atracada.', 8, 5, 4, 2),
  (N'PTT_MAE_VIVO_LLEGADAS',    N'Llegadas programadas',
   N'Avisos de arribo DIMAR de las próximas 72 h cruzados con AIS: en puerto, en radar, atrasadas o sin AIS.', 8, 5, 0, 7),
  (N'PTT_MAE_VIVO_TIEMPOS',     N'Espera en fondeo',
   N'Tiempo de espera en fondeo antes de atracar por día (promedio y p90) y estadía en muelle.', 4, 5, 8, 7);

-- Si se muestran en el layout inicial, van debajo de lo que ya existe en la pestaña
DECLARE @baseY INT = (SELECT ISNULL(MAX(pos_y + defaultRows), 0) FROM dbo.PTLWidgetsMaestro
                      WHERE codigoPestana = @pestana AND codigoWidget NOT IN (SELECT codigo FROM @nuevos));

BEGIN TRANSACTION;

INSERT INTO dbo.PTLWidgetsMaestro
  (codigoWidget, codigoTipo, codigoPestana, codigoAplicacion, codigoSuite, nombreWidget, descripcionWidget,
   imagenWidget_light, imagenWidget_dark, defaultCols, defaultRows, pos_x, pos_y, layoutVersion, inicial,
   anclajeTipo, offsetY, estadoWidget, codigoUsuarioCreacion, fechaCreacion)
SELECT n.codigo, r.codigoTipo, r.codigoPestana, r.codigoAplicacion, r.codigoSuite, n.nombre, n.descripcion,
       r.imagenWidget_light, r.imagenWidget_dark, n.cols, n.filas, n.x, @baseY + n.y, 1, @mostrarEnLayoutInicial,
       N'RELATIVO', 0, 1, N'MIGRACION_007', @ahora
FROM @nuevos n
CROSS JOIN (SELECT * FROM dbo.PTLWidgetsMaestro WHERE codigoWidget = @referencia) r
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro w WHERE w.codigoWidget = n.codigo);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' widgets registrados (referencia: ', @referencia, N')');

INSERT INTO dbo.PTLWidgetsRoles (codigoWidgetRole, codigoWidget, codigoRole, estadoRelacion, codigoUsuarioCreacion, fechaCreacion)
SELECT LEFT(CONCAT(n.codigo, N'_', wr.codigoRole), 200), n.codigo, wr.codigoRole, 1, N'MIGRACION_007', @ahora
FROM @nuevos n
CROSS JOIN dbo.PTLWidgetsRoles wr
WHERE wr.codigoWidget = @referencia AND wr.estadoRelacion = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsRoles x WHERE x.codigoWidget = n.codigo AND x.codigoRole = wr.codigoRole);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' permisos por rol copiados');

COMMIT TRANSACTION;

SELECT w.codigoWidget, w.nombreWidget, w.defaultCols, w.defaultRows, w.pos_x, w.pos_y, w.inicial,
       (SELECT COUNT(*) FROM dbo.PTLWidgetsRoles r WHERE r.codigoWidget = w.codigoWidget AND r.estadoRelacion = 1) AS roles
FROM dbo.PTLWidgetsMaestro w
WHERE w.codigoWidget LIKE N'PTT[_]MAE[_]VIVO[_]%'
ORDER BY w.pos_y, w.pos_x;
