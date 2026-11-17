/*
  PORTTOS · Migración 047 · Administración de Fuentes de información (CC-226, usuario 2026-11-16, maestros de Porttos 2 de 6)
  Qué hace (idempotente; no borra nada):
    1. TCL_FuentesInformacion (013): columnas de auditoría codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion y
       fechaModificacion (NVARCHAR, ISO 8601 UTC como el resto de Porttos). Las filas de la 013 quedan con fecha de hoy y usuario
       MIGRACION_013.
    2. Módulo de menú «Fuentes de información» de Porttos (/porttos/fuentes-panel, translateKey FUENTES_INFORMACION, sin ícono),
       hermano de Faros en la administración de Porttos y en sus paquetes.
    3. Actividades ACT_FUENTES_CREAR / MODIFICAR / ELIMINAR (eliminar = inactivar) al ROLE_ADMINISTRADOR de Porttos.
  Requiere la 013 (tabla) y la 038 (tablas PTL_). Va antes del API con /api/fuentes-informacion (sin ella el API responde 503).
  Reversa: estadoModulo = 0 del módulo y estadoActividad = 0 de las tres actividades; las columnas admiten nulos y no estorban.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_FuentesInformacion', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 013 (TCL_FuentesInformacion). Córrala primero.', 16, 1);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 038 (tablas PTL_). Córrala primero.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

-- 1. Auditoría
IF COL_LENGTH(N'dbo.TCL_FuentesInformacion', N'codigoUsuarioCreacion') IS NULL ALTER TABLE dbo.TCL_FuentesInformacion ADD codigoUsuarioCreacion NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.TCL_FuentesInformacion', N'fechaCreacion') IS NULL ALTER TABLE dbo.TCL_FuentesInformacion ADD fechaCreacion NVARCHAR(100) NULL;
IF COL_LENGTH(N'dbo.TCL_FuentesInformacion', N'codigoUsuarioModificacion') IS NULL ALTER TABLE dbo.TCL_FuentesInformacion ADD codigoUsuarioModificacion NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.TCL_FuentesInformacion', N'fechaModificacion') IS NULL ALTER TABLE dbo.TCL_FuentesInformacion ADD fechaModificacion NVARCHAR(100) NULL;
EXEC (N'UPDATE dbo.TCL_FuentesInformacion SET codigoUsuarioCreacion = N''MIGRACION_013'', fechaCreacion = ''' + @ahora + N'''
       WHERE codigoUsuarioCreacion IS NULL AND fechaCreacion IS NULL;');

DECLARE @faros NVARCHAR(200) = N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi';   -- Porttos › Administración › Faros
DECLARE @modulo NVARCHAR(200) = N'ddf11e60-456a-4560-897a-45eb132e3cd8';  -- Porttos › Administración › Fuentes de información (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @faros)
BEGIN
  RAISERROR('Se hicieron las columnas, pero no está el módulo Porttos › Faros (hermano del menú nuevo). Revise la base.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 2. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Fuentes de información', m.precioModulo, N'/porttos/fuentes-panel',
       N'CC-226 · Enlaces del widget de Noticias por grupo (oficiales, transporte, comercio e industria, gobierno y medios)',
       0, N'', N'FUENTES_INFORMACION', 1, NULL, @ahora, NULL, @ahora
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

-- 3. Actividades
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_FUENTES_CREAR', N'Crear fuentes de información'), (N'ACT_FUENTES_MODIFICAR', N'Modificar fuentes de información'),
                           (N'ACT_FUENTES_ELIMINAR', N'Inactivar fuentes de información');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-226 · Porttos · Fuentes de información', 1, NULL, @ahora, NULL, @ahora
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

PRINT CONCAT('Módulo creado: ', @modulos, ' · en paquetes: ', @paquetes, ' · actividades creadas: ', @creadas,
             ' · asignadas al ADMINISTRADOR de Porttos: ', @asignadas);
