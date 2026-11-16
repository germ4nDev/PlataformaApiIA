/*
  PORTTOS · Migración 043 · Administración del portal porttos.co, fase 1 (OT-036, CC-206; usuario 2026-11-15)
  Qué hace (idempotente; no borra nada):
    1. Auditoría: TCL_PortalConfig.codigoUsuarioModificacion; TCL_PortalMensajes.notaInterna, codigoUsuarioModificacion y
       fechaModificacion (quién cambió el estado de un mensaje y cuándo).
    2. Módulo de menú «Portal porttos.co» de Porttos (/porttos/portal-panel, translateKey PORTAL_PORTTOS), hermano de Faros en la
       administración de Porttos y en sus paquetes. Queda INACTIVO (estadoModulo = 0): la pantalla llega en la fase 2, que lo activa.
    3. Actividades de Porttos al ROLE_ADMINISTRADOR de Porttos:
         ACT_PORTAL_CONFIG     configuración del portal (correo, rutas, tiendas, planes activos)
         ACT_PORTAL_MENSAJES   bandeja de Contáctenos (ver y cambiar el estado)
         ACT_PORTAL_CONTENIDO  páginas, secciones, elementos y preguntas (fases 3 y 4)
         ACT_PORTAL_PLANES     planes, características y comparativo (fase 5)
  Requiere la 025 (tablas del portal) y la 038 (tablas PTL_). Reversa: estadoActividad = 0 de las cuatro actividades; las columnas
  nuevas admiten nulos y no estorban.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 038 (tablas PTL_). Córrala primero.', 16, 1);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_PortalMensajes', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 025 (tablas del portal). Córrala primero.', 16, 1);
  RETURN;
END

-- 1. Auditoría
IF COL_LENGTH(N'dbo.TCL_PortalConfig', N'codigoUsuarioModificacion') IS NULL
  ALTER TABLE dbo.TCL_PortalConfig ADD codigoUsuarioModificacion NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.TCL_PortalMensajes', N'notaInterna') IS NULL
  ALTER TABLE dbo.TCL_PortalMensajes ADD notaInterna NVARCHAR(1000) NULL;
IF COL_LENGTH(N'dbo.TCL_PortalMensajes', N'codigoUsuarioModificacion') IS NULL
  ALTER TABLE dbo.TCL_PortalMensajes ADD codigoUsuarioModificacion NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.TCL_PortalMensajes', N'fechaModificacion') IS NULL
  ALTER TABLE dbo.TCL_PortalMensajes ADD fechaModificacion DATETIME2(0) NULL;

DECLARE @faros NVARCHAR(200) = N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi';   -- Porttos › Administración › Faros
DECLARE @modulo NVARCHAR(200) = N'7c1e2a4d-5b3f-4e8a-9d61-0f2c3b4a5e04';
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @faros)
BEGIN
  PRINT 'Aviso: no está el módulo Porttos › Faros; se hicieron las columnas, pero no el menú ni las actividades (agréguelos a mano).';
  RETURN;
END

BEGIN TRANSACTION;

-- 2. Módulo (inactivo hasta la fase 2)
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Portal porttos.co', m.precioModulo, N'/porttos/portal-panel',
       N'OT-036 · Contenido, configuración y mensajes del portal porttos.co', 0, N'', N'PORTAL_PORTTOS', 0, NULL, @ahora, NULL, @ahora
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
INSERT INTO @nuevas VALUES
  (N'ACT_PORTAL_CONFIG', N'Configurar el portal porttos.co'),
  (N'ACT_PORTAL_MENSAJES', N'Atender los mensajes de Contáctenos del portal'),
  (N'ACT_PORTAL_CONTENIDO', N'Editar páginas, secciones y preguntas del portal'),
  (N'ACT_PORTAL_PLANES', N'Editar los planes del portal');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'OT-036 · Porttos · Portal porttos.co', 1, NULL, @ahora, NULL, @ahora
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

PRINT CONCAT('Módulo creado (inactivo): ', @modulos, ' · en paquetes: ', @paquetes, ' · actividades creadas: ', @creadas,
             ' · asignadas al ADMINISTRADOR de Porttos: ', @asignadas);
