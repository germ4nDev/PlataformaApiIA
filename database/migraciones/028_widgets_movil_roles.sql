/*
  PLATAFORMA · Migración 028 · Widgets móviles y permisos por rol al día (aprobado por el usuario el 2026-11-02)
  Qué hace (idempotente; no borra nada):
    1. dbo.PTLWidgetsMaestro: columna movil BIT NOT NULL DEFAULT 0. Tabla compartida de la plataforma: con 0 todo sigue igual
       para las otras aplicaciones. movil = 1 → widget para el teléfono: solo lo muestra la app en el teléfono; la web y la
       tableta no lo ofrecen. Se gestiona en Utilidades → Widgets.
    2. dbo.PTLWidgetsRoles de la aplicación @codigoAplicacion (Porttos):
       a. Inactiva (estadoRelacion = 0) las relaciones de sus roles con códigos que ya no están en el maestro (los WDG_PORT_*
          antiguos). Se quedan en la tabla como historia.
       b. A cada rol activo de la aplicación le da cada widget activo de la aplicación que aún no tenga relación con ese rol
          (ni activa ni inactiva: lo que un administrador apagó a mano no se vuelve a prender). Así nadie pierde widgets
          cuando el tablero empiece a filtrar por rol; después se segmenta en Utilidades → Widgets por rol.
  REQUISITO: correrla ANTES de desplegar el API con el campo movil (sin la columna fallan las consultas del maestro).
  Reversa: 1) UPDATE dbo.PTLWidgetsRoles SET estadoRelacion = 1 WHERE codigoUsuarioModificacion = N'MIGRACION_028';
           2) DELETE FROM dbo.PTLWidgetsRoles WHERE codigoUsuarioCreacion = N'MIGRACION_028';
           3) ALTER TABLE dbo.PTLWidgetsMaestro DROP CONSTRAINT DF_PTLWidgetsMaestro_movil; ... DROP COLUMN movil;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

-- Aplicación Porttos (mismo código que environment.codigoAplicacion de la app móvil).
DECLARE @codigoAplicacion NVARCHAR(200) = N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa';
DECLARE @ahora NVARCHAR(100) = CONVERT(NVARCHAR(100), SYSUTCDATETIME(), 127) + N'Z';

IF NOT EXISTS (SELECT 1 FROM dbo.PTLRolesAP WHERE codigoAplicacion = @codigoAplicacion)
  PRINT 'Aviso: la aplicación no tiene roles en PTLRolesAP; solo se agrega la columna movil.';

BEGIN TRANSACTION;

-- 1. Columna movil (en EXEC para que el resto del lote compile antes de que exista).
IF COL_LENGTH(N'dbo.PTLWidgetsMaestro', N'movil') IS NULL
  EXEC (N'ALTER TABLE dbo.PTLWidgetsMaestro ADD movil BIT NOT NULL CONSTRAINT DF_PTLWidgetsMaestro_movil DEFAULT (0);');

-- 2a. Relaciones con códigos que ya no existen en el maestro (solo roles de la aplicación).
UPDATE wr SET estadoRelacion = 0, codigoUsuarioModificacion = N'MIGRACION_028', fechaModificacion = @ahora
FROM dbo.PTLWidgetsRoles wr
JOIN dbo.PTLRolesAP r ON r.codigoRole = wr.codigoRole AND r.codigoAplicacion = @codigoAplicacion
WHERE wr.estadoRelacion = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro w WHERE w.codigoWidget = wr.codigoWidget);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' relaciones con códigos antiguos inactivadas');

-- 2b. Roles activos × widgets activos de la aplicación, sin relación previa.
INSERT INTO dbo.PTLWidgetsRoles (codigoWidgetRole, codigoWidget, codigoRole, estadoRelacion, codigoUsuarioCreacion, fechaCreacion)
SELECT CONVERT(NVARCHAR(200), NEWID()), w.codigoWidget, r.codigoRole, 1, N'MIGRACION_028', @ahora
FROM dbo.PTLWidgetsMaestro w
JOIN dbo.PTLRolesAP r ON r.codigoAplicacion = w.codigoAplicacion AND r.estadoRole = 1
WHERE w.codigoAplicacion = @codigoAplicacion AND w.estadoWidget = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsRoles x WHERE x.codigoWidget = w.codigoWidget AND x.codigoRole = r.codigoRole);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' permisos nuevos (rol × widget)');

COMMIT TRANSACTION;
PRINT 'Migración 028 aplicada: columna movil en PTLWidgetsMaestro y permisos por rol de Porttos con los códigos actuales.';

-- Resumen por rol de la aplicación.
EXEC (N'
SELECT r.codigoRole, r.nombreRole,
       SUM(CASE WHEN wr.estadoRelacion = 1 AND w.codigoWidget IS NOT NULL THEN 1 ELSE 0 END) AS widgetsActivos,
       SUM(CASE WHEN wr.estadoRelacion = 1 AND w.movil = 1 THEN 1 ELSE 0 END) AS widgetsMovil,
       SUM(CASE WHEN wr.estadoRelacion = 0 THEN 1 ELSE 0 END) AS relacionesInactivas
FROM dbo.PTLRolesAP r
LEFT JOIN dbo.PTLWidgetsRoles wr ON wr.codigoRole = r.codigoRole
LEFT JOIN dbo.PTLWidgetsMaestro w ON w.codigoWidget = wr.codigoWidget
WHERE r.codigoAplicacion = N''3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa''
GROUP BY r.codigoRole, r.nombreRole
ORDER BY r.nombreRole;');
