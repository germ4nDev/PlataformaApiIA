/*
  PORTTOS · Migración 016 · Widget «Analista IA» en todas las pestañas del tablero (capa de análisis con IA, fase 3)
  Qué hace (idempotente, se puede correr varias veces):
    1. Por cada pestaña del tablero (codigoPestana TLC_<PESTAÑA>_001 con al menos un widget) registra en
       dbo.PTLWidgetsMaestro el widget PTT_IA_ANALISTA_<PESTAÑA>, copiando tipo, aplicación, suite e imágenes de un
       widget de esa misma pestaña (el de menor código). Una pestaña nueva queda cubierta al volver a correrla.
    2. Le da los mismos roles que tiene ese widget de referencia en dbo.PTLWidgetsRoles.
  El front resuelve cualquier PTT_IA_ANALISTA_* con el mismo componente (WIDGET_MAP, por prefijo) y filtra las
  alertas por los tipos de la pestaña (en Mapa y Noticias muestra todas).
  Por defecto quedan DISPONIBLES en el selector de widgets (inicial = 0), sin mover el tablero de nadie.
  Con @mostrarEnLayoutInicial = 1 también aparecen en el layout base, debajo de los widgets actuales.
  Requiere la 015 para tener datos (sin ella el widget dice «no disponible»).
  Reversa: DELETE FROM dbo.PTLWidgetsRoles   WHERE codigoUsuarioCreacion = N'MIGRACION_016';
           DELETE FROM dbo.PTLWidgetsMaestro WHERE codigoUsuarioCreacion = N'MIGRACION_016';
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @mostrarEnLayoutInicial BIT = 0;          -- 1 = aparece solo en el layout base de cada pestaña
DECLARE @ahora NVARCHAR(100) = FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd\THH:mm:ss.fff\Z');
DECLARE @nombre NVARCHAR(150) = N'Analista IA';
DECLARE @descripcion NVARCHAR(4000) = N'Alertas tempranas del analista IA para el puerto del filtro: qué puede pasar, en cuántas horas, con qué confianza y con qué evidencia. Tendencias, resumen del turno y botones «Útil» / «No era».';

-- Pestaña → código del widget y widget de referencia (el de menor código de la pestaña, sin contar los de IA)
DECLARE @pestanas TABLE (codigoPestana NVARCHAR(200), codigo NVARCHAR(200), referencia NVARCHAR(200), baseY INT);
INSERT INTO @pestanas (codigoPestana, codigo, referencia, baseY)
SELECT p.codigoPestana,
       LEFT(CONCAT(N'PTT_IA_ANALISTA_', REPLACE(REPLACE(p.codigoPestana, N'TLC_', N''), N'_001', N'')), 200),
       (SELECT TOP (1) w.codigoWidget FROM dbo.PTLWidgetsMaestro w
        WHERE w.codigoPestana = p.codigoPestana AND w.codigoWidget NOT LIKE N'PTT[_]IA[_]%' ORDER BY w.codigoWidget),
       (SELECT ISNULL(MAX(w.pos_y + w.defaultRows), 0) FROM dbo.PTLWidgetsMaestro w
        WHERE w.codigoPestana = p.codigoPestana AND w.codigoWidget NOT LIKE N'PTT[_]IA[_]%')
FROM (SELECT DISTINCT codigoPestana FROM dbo.PTLWidgetsMaestro WHERE codigoPestana LIKE N'TLC[_]%') p;

IF NOT EXISTS (SELECT 1 FROM @pestanas WHERE referencia IS NOT NULL)
BEGIN
  RAISERROR('No hay pestañas TLC_* con widgets para usar como referencia.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

INSERT INTO dbo.PTLWidgetsMaestro
  (codigoWidget, codigoTipo, codigoPestana, codigoAplicacion, codigoSuite, nombreWidget, descripcionWidget,
   imagenWidget_light, imagenWidget_dark, defaultCols, defaultRows, pos_x, pos_y, layoutVersion, inicial,
   anclajeTipo, offsetY, estadoWidget, codigoUsuarioCreacion, fechaCreacion)
SELECT p.codigo, r.codigoTipo, p.codigoPestana, r.codigoAplicacion, r.codigoSuite, @nombre, @descripcion,
       r.imagenWidget_light, r.imagenWidget_dark, 4, 6, 0, p.baseY, 1, @mostrarEnLayoutInicial,
       N'RELATIVO', 0, 1, N'MIGRACION_016', @ahora
FROM @pestanas p
JOIN dbo.PTLWidgetsMaestro r ON r.codigoWidget = p.referencia
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro w WHERE w.codigoWidget = p.codigo);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' widgets Analista IA registrados');

INSERT INTO dbo.PTLWidgetsRoles (codigoWidgetRole, codigoWidget, codigoRole, estadoRelacion, codigoUsuarioCreacion, fechaCreacion)
SELECT LEFT(CONCAT(p.codigo, N'_', wr.codigoRole), 200), p.codigo, wr.codigoRole, 1, N'MIGRACION_016', @ahora
FROM @pestanas p
JOIN dbo.PTLWidgetsRoles wr ON wr.codigoWidget = p.referencia AND wr.estadoRelacion = 1
WHERE EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro w WHERE w.codigoWidget = p.codigo)
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsRoles x WHERE x.codigoWidget = p.codigo AND x.codigoRole = wr.codigoRole);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' permisos por rol copiados');

COMMIT TRANSACTION;

SELECT w.codigoPestana, w.codigoWidget, w.nombreWidget, w.defaultCols, w.defaultRows, w.pos_y, w.inicial,
       (SELECT COUNT(*) FROM dbo.PTLWidgetsRoles r WHERE r.codigoWidget = w.codigoWidget AND r.estadoRelacion = 1) AS roles
FROM dbo.PTLWidgetsMaestro w
WHERE w.codigoWidget LIKE N'PTT[_]IA[_]ANALISTA[_]%'
ORDER BY w.codigoPestana;
