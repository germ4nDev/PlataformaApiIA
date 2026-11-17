/*
  PORTTOS · Migración 049 · Administración de Nodos de monitoreo vial (CC-228, usuario 2026-11-16, maestros de Porttos 4 de 6)
  Qué hace (idempotente; no borra nada; la tabla no cambia: TCL_MaestroNodosMonitoreo ya tiene auditoría):
    1. Módulo de menú «Nodos de monitoreo» de Porttos (/porttos/nodos-monitoreo-panel, translateKey NODOS_MONITOREO, sin ícono), hermano de Faros en
       la administración de Porttos y en sus paquetes.
    2. Actividades ACT_NODOSMON_CREAR / MODIFICAR / ELIMINAR (eliminar = estado INACTIVO: sale del ETL de clima) al ROLE_ADMINISTRADOR de Porttos.
  Requiere la 038 (tablas PTL_). Va antes del API con /api/nodos-monitoreo.
  Reversa: estadoModulo = 0 del módulo y estadoActividad = 0 de las tres actividades.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_MaestroNodosMonitoreo', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL
BEGIN
  RAISERROR('Faltan TCL_MaestroNodosMonitoreo o las tablas PTL_ (038). Revise la base.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

DECLARE @faros NVARCHAR(200) = N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi';   -- Porttos › Administración › Faros
DECLARE @modulo NVARCHAR(200) = N'0a90a46b-d854-4261-9b2a-bd8110f4e85a';  -- Porttos › Administración › Nodos de monitoreo (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @faros)
BEGIN
  RAISERROR('No está el módulo Porttos › Faros (hermano del menú nuevo). Revise la base.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 2. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Nodos de monitoreo', m.precioModulo, N'/porttos/nodos-monitoreo-panel',
       N'CC-228 · Puntos de la red vial donde el ETL consulta el clima (corredor, sector, coordenadas, estado)',
       0, N'', N'NODOS_MONITOREO', 1, NULL, @ahora, NULL, @ahora
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
INSERT INTO @nuevas VALUES (N'ACT_NODOSMON_CREAR', N'Crear nodos de monitoreo vial'), (N'ACT_NODOSMON_MODIFICAR', N'Modificar nodos de monitoreo vial'),
                           (N'ACT_NODOSMON_ELIMINAR', N'Inactivar nodos de monitoreo vial');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-228 · Porttos · Nodos de monitoreo vial', 1, NULL, @ahora, NULL, @ahora
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
