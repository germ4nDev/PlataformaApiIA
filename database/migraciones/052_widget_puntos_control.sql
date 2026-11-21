/*
  PORTTOS · Migración 052 · Widget «Puntos de control» en la pestaña Capacidad (CC-239, fase 2 de puntos de control)
  Pestaña elegida por el usuario el 2026-11-17 (Capacidad). Qué hace (idempotente; no borra nada):
    1. dbo.PTL_WidgetsMaestro: el widget PTT_CAP_TAB_PUNTOS_CONTROL (tabla, 8 × 4, canal 'web' = web y tableta) con el tipo,
       la aplicación, la suite y las imágenes del widget PTT_CAP_TAB_NODOS de la misma pestaña, debajo de los widgets actuales.
       Queda DISPONIBLE en el selector de widgets (inicial = 0): no mueve el tablero de nadie. Con @mostrarEnLayoutInicial = 1
       entra también en el layout base de la pestaña. El teléfono tiene su versión (lista) en utils/movil/widgets-movil.js;
       para verlo dentro del teléfono embebido, cambiar el canal a 'ambos' en Utilidades → Widgets.
    2. dbo.PTL_WidgetsRoles: el widget a CADA rol activo de la aplicación del widget (Porttos), uno por uno; lo que un
       administrador haya apagado a mano no se vuelve a prender. Después se segmenta en Utilidades → Widgets por rol.
  Requiere la 038 (tablas PTL_) y, para tener datos, la 051 (sin ella el widget dice «Sin dato»).
  Reversa: DELETE FROM dbo.PTL_WidgetsRoles   WHERE codigoUsuarioCreacion = N'MIGRACION_052';
           DELETE FROM dbo.PTL_WidgetsMaestro WHERE codigoUsuarioCreacion = N'MIGRACION_052';
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_WidgetsMaestro', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_WidgetsRoles', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_RolesAP', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 038 (tablas PTL_).', 16, 1);
  RETURN;
END

DECLARE @mostrarEnLayoutInicial BIT = 0;          -- 1 = aparece también en el layout base de la pestaña Capacidad
DECLARE @codigo NVARCHAR(200) = N'PTT_CAP_TAB_PUNTOS_CONTROL';
DECLARE @referencia NVARCHAR(200) = N'PTT_CAP_TAB_NODOS';
DECLARE @ahora NVARCHAR(100) = FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd\THH:mm:ss.fff\Z');
DECLARE @nombre NVARCHAR(150) = N'Puntos de control';
DECLARE @descripcion NVARCHAR(4000) = N'Estado de cada punto de control del puerto (infraestructura con métricas activas): crítico, atención, sin dato o normal, y la métrica que lo puso así con su valor. Ordenado del peor al mejor. En la vista ampliada, la serie de 24, 72 o 168 horas de cada métrica con sus umbrales. Fuente: el motor de puntos de control (cada 5 minutos); lo simulado va rotulado.';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_WidgetsMaestro WHERE codigoWidget = @referencia)
BEGIN
  RAISERROR('No existe el widget de referencia %s (pestaña Capacidad, migración 013).', 16, 1, @referencia);
  RETURN;
END

BEGIN TRANSACTION;

INSERT INTO dbo.PTL_WidgetsMaestro
  (codigoWidget, codigoTipo, codigoPestana, codigoAplicacion, codigoSuite, nombreWidget, descripcionWidget,
   imagenWidget_light, imagenWidget_dark, defaultCols, defaultRows, pos_x, pos_y, layoutVersion, inicial,
   anclajeTipo, offsetY, estadoWidget, movil, canal, codigoUsuarioCreacion, fechaCreacion)
SELECT @codigo, r.codigoTipo, r.codigoPestana, r.codigoAplicacion, r.codigoSuite, @nombre, @descripcion,
       r.imagenWidget_light, r.imagenWidget_dark, 8, 4, 0,
       (SELECT ISNULL(MAX(w.pos_y + w.defaultRows), 0) FROM dbo.PTL_WidgetsMaestro w WHERE w.codigoPestana = r.codigoPestana AND w.estadoWidget = 1),
       1, @mostrarEnLayoutInicial, N'RELATIVO', 0, 1, 0, N'web', N'MIGRACION_052', @ahora
FROM dbo.PTL_WidgetsMaestro r
WHERE r.codigoWidget = @referencia
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_WidgetsMaestro w WHERE w.codigoWidget = @codigo);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' widget registrado');

INSERT INTO dbo.PTL_WidgetsRoles (codigoWidgetRole, codigoWidget, codigoRole, estadoRelacion, codigoUsuarioCreacion, fechaCreacion)
SELECT CONVERT(NVARCHAR(200), NEWID()), w.codigoWidget, r.codigoRole, 1, N'MIGRACION_052', @ahora
FROM dbo.PTL_WidgetsMaestro w
JOIN dbo.PTL_RolesAP r ON r.codigoAplicacion = w.codigoAplicacion AND r.estadoRole = 1
WHERE w.codigoWidget = @codigo
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_WidgetsRoles x WHERE x.codigoWidget = w.codigoWidget AND x.codigoRole = r.codigoRole);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' permisos por rol');

COMMIT TRANSACTION;

SELECT w.codigoPestana, w.codigoWidget, w.nombreWidget, w.defaultCols, w.defaultRows, w.pos_y, w.inicial, w.canal,
       (SELECT COUNT(*) FROM dbo.PTL_WidgetsRoles r WHERE r.codigoWidget = w.codigoWidget AND r.estadoRelacion = 1) AS roles
FROM dbo.PTL_WidgetsMaestro w
WHERE w.codigoWidget = @codigo;
