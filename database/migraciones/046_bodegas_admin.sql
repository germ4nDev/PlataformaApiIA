/*
  PORTTOS · Migración 046 · Administración de Bodegas y silos (CC-225, usuario 2026-11-16, punto 4 «maestros de Porttos»)
  Qué hace (idempotente; no borra nada):
    1. Módulo de menú «Bodegas» de Porttos (/porttos/bodegas-panel, translateKey BODEGAS, sin ícono), hermano de Faros en la
       administración de Porttos y en sus paquetes.
    2. Actividad ACT_BODEGAS_ELIMINAR (inactivar bodegas: nunca se borran) al ROLE_ADMINISTRADOR de Porttos.
    3. ACT_BODEGAS_CREAR y ACT_BODEGAS_MODIFICAR (033, colgadas de Configuración › Ingesta) pasan al módulo nuevo, para que la
       pantalla de permisos las muestre donde se usan. ACT_BODEGAS_MOVIMIENTO se queda en Ingesta (es de la operación).
  Requiere la 033 (actividades) y la 038 (tablas PTL_). Va antes del API con DELETE /api/bodegas/maestro/:idBodega.
  Reversa: estadoModulo = 0 del módulo y estadoActividad = 0 de ACT_BODEGAS_ELIMINAR; el paso 3 se deshace devolviendo
  codigoModulo = '733e3cfb-db6e-4eba-baa3-456d18c62b9b' a las dos actividades.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_Actividades', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 038 (tablas PTL_). Córrala primero.', 16, 1);
  RETURN;
END

DECLARE @faros NVARCHAR(200) = N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi';   -- Porttos › Administración › Faros
DECLARE @modulo NVARCHAR(200) = N'7e1532ca-e07f-48d9-b638-c151cc380159';  -- Porttos › Administración › Bodegas (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @faros)
BEGIN
  RAISERROR('No está el módulo Porttos › Faros (hermano del menú nuevo). Revise la base antes de seguir.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 1. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Bodegas', m.precioModulo, N'/porttos/bodegas-panel',
       N'CC-225 · Maestro de bodegas y silos de cada puerto (capacidad, tipo, condiciones); el inventario solo se mueve con movimientos',
       0, N'', N'BODEGAS', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @faros
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
WHERE pq.codigoModulo = @faros
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 2. Actividad nueva
INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, N'ACT_BODEGAS_ELIMINAR', N'Inactivar bodegas',
       N'CC-225 · Porttos · Bodegas', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @modulo
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_Actividades a WHERE a.llavePermiso = N'ACT_BODEGAS_ELIMINAR');
DECLARE @creadas INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ActividadesRoles (codigoActividadRole, codigoActividad, codigoRole, permiso,
                                      codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), a.codigoActividad, r.codigoRole, 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_Actividades a
INNER JOIN dbo.PTL_RolesAP r ON r.codigoAplicacion = a.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
WHERE a.llavePermiso = N'ACT_BODEGAS_ELIMINAR' AND a.estadoActividad = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ActividadesRoles ar WHERE ar.codigoActividad = a.codigoActividad AND ar.codigoRole = r.codigoRole);
DECLARE @asignadas INT = @@ROWCOUNT;

-- 3. Crear y modificar pasan al módulo nuevo
UPDATE dbo.PTL_Actividades
SET codigoModulo = @modulo, codigoUsuarioModificacion = N'MIGRACION_046', fechaModificacion = @ahora
WHERE llavePermiso IN (N'ACT_BODEGAS_CREAR', N'ACT_BODEGAS_MODIFICAR') AND codigoModulo <> @modulo
  AND EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @movidas INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Módulo creado: ', @modulos, ' · en paquetes: ', @paquetes, ' · actividad creada: ', @creadas,
             ' · asignada al ADMINISTRADOR de Porttos: ', @asignadas, ' · actividades movidas al módulo: ', @movidas);
