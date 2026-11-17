/*
  PLATAFORMA · Migración 045 · Utilidades › Dominios (CC-224, usuario 2026-11-16)
  Qué hace (idempotente; no borra nada):
    1. PTL_DominiosAP: columnas de auditoría (codigoUsuarioCreacion, codigoUsuarioModificacion) y descripcion NVARCHAR(4000)
       (estándar de las tablas maestras).
    2. Menú «Dominios» (translateKey DOMINIOS, ruta /utilidades/dominios, sin ícono) hermano de Utilidades › Países y en sus paquetes.
    3. Actividades ACT_DOM_CREAR / MODIFICAR / ELIMINAR al ROLE_ADMINISTRADOR de Plataforma.
  Requiere la 026 (PTL_DominiosAP), la 038 (tablas PTL_) y la 039 (módulo Países). Va antes del API con /api/dominios (CRUD).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_DominiosAP', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL
BEGIN
  RAISERROR('Faltan la 026 (PTL_DominiosAP) o la 038 (tablas PTL_). Córralas primero.', 16, 1);
  RETURN;
END

-- 1. Columnas
IF COL_LENGTH(N'dbo.PTL_DominiosAP', N'codigoUsuarioCreacion') IS NULL ALTER TABLE dbo.PTL_DominiosAP ADD codigoUsuarioCreacion NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.PTL_DominiosAP', N'codigoUsuarioModificacion') IS NULL ALTER TABLE dbo.PTL_DominiosAP ADD codigoUsuarioModificacion NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.PTL_DominiosAP', N'descripcion') IS NULL ALTER TABLE dbo.PTL_DominiosAP ADD descripcion NVARCHAR(4000) NULL;

DECLARE @paises NVARCHAR(200) = N'e330c96f-466e-4338-9162-df62e0787030';  -- Utilidades › Países (039)
DECLARE @modulo NVARCHAR(200) = N'c5ea117d-7b6b-40af-952d-33f2f2fbdc6e';  -- Utilidades › Dominios (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @paises)
BEGIN
  RAISERROR('Falta la 039 (Utilidades › Países). Córrala primero.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 2. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Dominios', m.precioModulo, N'/utilidades/dominios',
       N'CC-224 · Dominios de la plataforma: qué abre cada uno (consola o aplicación), su portal, inicio y marca', 0, N'', N'DOMINIOS', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @paises
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
WHERE pq.codigoModulo = @paises
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 3. Actividades
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_DOM_CREAR', N'Crear dominios'), (N'ACT_DOM_MODIFICAR', N'Modificar dominios'), (N'ACT_DOM_ELIMINAR', N'Inactivar dominios');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-224 · Plataforma · Utilidades › Dominios', 1, NULL, @ahora, NULL, @ahora
FROM @nuevas n
CROSS JOIN (SELECT codigoAplicacion, codigoSuite FROM dbo.PTL_ModulosAP WHERE codigoModulo = @modulo) m
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTL_Actividades a WHERE a.llavePermiso = n.llavePermiso);
DECLARE @creadas INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ActividadesRoles (codigoActividadRole, codigoActividad, codigoRole, permiso,
                                      codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), a.codigoActividad, r.codigoRole, 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_Actividades a
INNER JOIN dbo.PTL_RolesAP r ON r.codigoAplicacion = a.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
WHERE a.llavePermiso IN (SELECT llavePermiso FROM @nuevas) AND a.estadoActividad = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ActividadesRoles ar WHERE ar.codigoActividad = a.codigoActividad AND ar.codigoRole = r.codigoRole);
DECLARE @asignadas INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Módulo creado: ', @modulos, ' · en paquetes: ', @paquetes, ' · actividades creadas: ', @creadas, ' · asignadas al ADMINISTRADOR: ', @asignadas);
