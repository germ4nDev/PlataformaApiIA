/*
  PORTTOS · Migración 050 · Administración de Equipos portuarios (CC-229, usuario 2026-11-16, maestros de Porttos 5 de 6)
  Qué hace (idempotente; no borra nada):
    1. TCL_EquiposPortuarios (013): columna activo BIT NOT NULL DEFAULT 1 (todos quedan activos) y codigoUsuarioModificacion
       NVARCHAR(200) (quién cambió el maestro). Un equipo inactivo sale de los tableros; la ingesta lo sigue actualizando.
    2. Módulo de menú «Equipos portuarios» de Porttos (/porttos/equipos-panel, translateKey EQUIPOS_PORTUARIOS, sin ícono), hermano de
       Faros en la administración de Porttos y en sus paquetes.
    3. Actividades ACT_EQUIPOS_MODIFICAR y ACT_EQUIPOS_ELIMINAR (inactivar) al ROLE_ADMINISTRADOR de Porttos. Sin crear: los equipos
       llegan por la ingesta o el simulador.
  Requiere la 013 (tabla) y la 038 (tablas PTL_). Va antes del API con /api/equipos-portuarios (sin ella ese API responde 503; los
  tableros siguen funcionando sin el filtro de activo).
  Reversa: estadoModulo = 0 del módulo y estadoActividad = 0 de las dos actividades; activo = 1 en todos deja los tableros como antes.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_EquiposPortuarios', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL
BEGIN
  RAISERROR('Faltan TCL_EquiposPortuarios (013) o las tablas PTL_ (038). Córralas primero.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

-- 1. Columnas
IF COL_LENGTH(N'dbo.TCL_EquiposPortuarios', N'activo') IS NULL
  ALTER TABLE dbo.TCL_EquiposPortuarios ADD activo BIT NOT NULL CONSTRAINT DF_TCL_EquiposPortuarios_activo DEFAULT (1);
IF COL_LENGTH(N'dbo.TCL_EquiposPortuarios', N'codigoUsuarioModificacion') IS NULL
  ALTER TABLE dbo.TCL_EquiposPortuarios ADD codigoUsuarioModificacion NVARCHAR(200) NULL;

DECLARE @faros NVARCHAR(200) = N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi';   -- Porttos › Administración › Faros
DECLARE @modulo NVARCHAR(200) = N'1b8c8157-2551-4680-9aa5-89758109fa46';  -- Porttos › Administración › Equipos portuarios (nuevo)
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
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Equipos portuarios', m.precioModulo, N'/porttos/equipos-panel',
       N'CC-229 · Campos del maestro de los equipos (descripción, terminal, capacidades, activo); el estado vivo es de la ingesta',
       0, N'', N'EQUIPOS_PORTUARIOS', 1, NULL, @ahora, NULL, @ahora
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
INSERT INTO @nuevas VALUES (N'ACT_EQUIPOS_MODIFICAR', N'Modificar equipos portuarios (campos del maestro)'),
                           (N'ACT_EQUIPOS_ELIMINAR', N'Inactivar equipos portuarios');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-229 · Porttos · Equipos portuarios', 1, NULL, @ahora, NULL, @ahora
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
