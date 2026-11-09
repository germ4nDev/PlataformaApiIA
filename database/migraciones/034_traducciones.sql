/*
  PLATAFORMA · Migración 034 · Utilidades › Traducciones (OT-027, CC-154)
  Qué hace (idempotente; no borra nada, no toca otros roles):
    1. Crea el módulo de menú «Traducciones» (dbo.PTLModulosAP) como hermano de Utilidades › Idiomas: misma aplicación, suite y padre; sin ícono (hijos = 0: el ícono es solo de los módulos padre, como guarda gestion-modulo);
       ruta /utilidades/traducciones; translateKey PLATAFORMA.MODULOS.TRADUCCIONES.
    2. Lo agrega (dbo.PTLModulosPQ) a cada paquete que ya incluye Idiomas, para que salga en el menú de quien tiene ese paquete.
    3. Crea las actividades ACT_TRAD_CREAR, ACT_TRAD_MODIFICAR y ACT_TRAD_ELIMINAR (tipo CRUD) colgadas del módulo nuevo y se las asigna al
       ROLE_ADMINISTRADOR de Plataforma con permiso = 1 (como la 033).
  Va ANTES de publicar el API con /api/traducciones: sin ella, crear, modificar y eliminar responden 403 a todos.
  Reversa: módulo y actividades llevan descripcion N'OT-027 · …'; borrar sus filas de PTLActividadesRoles, PTLActividades, PTLModulosPQ y PTLModulosAP.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @idiomas NVARCHAR(200) = N'4699b32f-5476-4b15-b86e-e2e0472722fd';   -- Utilidades › Idiomas
DECLARE @modulo NVARCHAR(200) = N'0f7a2c4e-3b1d-4e8a-9c27-5d6e7f8a9b01';    -- Utilidades › Traducciones (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

IF NOT EXISTS (SELECT 1 FROM dbo.PTLModulosAP WHERE codigoModulo = @idiomas)
BEGIN
  RAISERROR('No existe el módulo Utilidades › Idiomas en esta base. No se cambió nada.', 16, 1);
  RETURN;
END
IF NOT EXISTS (SELECT 1 FROM dbo.PTLTiposActividad WHERE codigoTipoActividad = @tipoCrud)
BEGIN
  RAISERROR('No existe el tipo de actividad CRUD esperado. No se cambió nada.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 1. Módulo de menú
INSERT INTO dbo.PTLModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                              descripcionModulo, hijos, icon, translateKey, estadoModulo,
                              codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Traducciones', m.precioModulo,
       REPLACE(m.rutaModulo, N'idiomas', N'traducciones'), N'OT-027 · Llaves de traducción de los idiomas (es.json, en.json…)',
       0, N'', N'PLATAFORMA.MODULOS.TRADUCCIONES', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTLModulosAP m
WHERE m.codigoModulo = @idiomas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

-- 2. En los paquetes que ya tienen Idiomas
INSERT INTO dbo.PTLModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                              codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTLModulosPQ pq
WHERE pq.codigoModulo = @idiomas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 3. Actividades y su asignación al ADMINISTRADOR de la aplicación
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_TRAD_CREAR', N'Crear traducciones'), (N'ACT_TRAD_MODIFICAR', N'Modificar traducciones'), (N'ACT_TRAD_ELIMINAR', N'Eliminar traducciones');

INSERT INTO dbo.PTLActividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'OT-027 · Plataforma · Utilidades › Traducciones', 1, NULL, @ahora, NULL, @ahora
FROM @nuevas n
CROSS JOIN (SELECT codigoAplicacion, codigoSuite FROM dbo.PTLModulosAP WHERE codigoModulo = @modulo) m
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLActividades a WHERE a.llavePermiso = n.llavePermiso);
DECLARE @creadas INT = @@ROWCOUNT;

INSERT INTO dbo.PTLActividadesRoles (codigoActividadRole, codigoActividad, codigoRole, permiso,
                                     codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), a.codigoActividad, r.codigoRole, 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTLActividades a
INNER JOIN dbo.PTLRolesAP r ON r.codigoAplicacion = a.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
WHERE a.llavePermiso IN (SELECT llavePermiso FROM @nuevas) AND a.estadoActividad = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLActividadesRoles ar WHERE ar.codigoActividad = a.codigoActividad AND ar.codigoRole = r.codigoRole);
DECLARE @asignadas INT = @@ROWCOUNT;

-- Corrección (2026-11-09): si la 034 ya corrió con el ícono feather icon-globe, el menú pinta un guion. Un módulo sin hijos no lleva ícono.
UPDATE dbo.PTLModulosAP SET icon = N'' WHERE codigoModulo = @modulo AND hijos = 0 AND ISNULL(icon, N'') <> N'';

COMMIT TRANSACTION;

PRINT CONCAT('Módulo creado: ', @modulos, ' · en paquetes: ', @paquetes, ' · actividades creadas: ', @creadas, ' · asignadas al ADMINISTRADOR: ', @asignadas);
