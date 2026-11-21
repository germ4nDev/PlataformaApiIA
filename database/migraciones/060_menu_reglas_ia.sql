/*
  PORTTOS · Migración 060 · Menú de Reglas de alertas y Administración IA (CC-264; usuario 2026-11-19, al hacer el manual del administrador)
  Las dos pantallas existían (/porttos/reglas-alertas-panel y /porttos/ia-admin-panel, solo ROLE_ADMINISTRADOR) pero no tenían opción
  en el menú: solo se abrían escribiendo la dirección.
  Qué hace (idempotente; no borra nada):
    1. Dos módulos en PTL_ModulosAP, hermanos de «Monitor Cron» (Administración › Configuraciones): «Reglas de alertas» (translateKey
       REGLAS_ALERTAS) y «Administración IA» (translateKey IA_ADMIN). El hermano se busca por su ruta, no por código.
    2. En los mismos paquetes (PTL_ModulosPQ) que Monitor Cron.
  Si un módulo con esa ruta ya existe (activo o no), no lo vuelve a crear.
  Requiere la 038 (tablas PTL_) y el módulo Monitor Cron (/porttos/cron-monitor).
  Reversa: estadoModulo = 0 de los dos módulos.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_ModulosPQ', N'U') IS NULL
BEGIN
  RAISERROR('Faltan las tablas PTL_ (038). Revise la base.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';
DECLARE @porttos NVARCHAR(200) = N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa';   -- codigoAplicacion de Porttos (app.manifest.json)
DECLARE @cron NVARCHAR(200) = (SELECT TOP (1) codigoModulo FROM dbo.PTL_ModulosAP
                               WHERE rutaModulo = N'/porttos/cron-monitor' AND codigoAplicacion = @porttos ORDER BY estadoModulo DESC);
IF @cron IS NULL
BEGIN
  RAISERROR('No está el módulo Monitor Cron de Porttos (/porttos/cron-monitor), hermano de los menús nuevos. Revise la base.', 16, 1);
  RETURN;
END

DECLARE @nuevos TABLE (codigoModulo NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, nombre NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
                       ruta NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL, llave NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
                       descripcion NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevos VALUES
  (N'5d0c3a7e-9b21-4f6a-8e3d-2c7f1a9b4e60', N'Reglas de alertas', N'/porttos/reglas-alertas-panel', N'REGLAS_ALERTAS',
   N'CC-264 · Reglas de alertas del mapa: encendido, umbrales y tiempo de no repetir, globales o por puerto'),
  (N'b8e41f2d-6a37-4c95-9d0e-7f3a5c1e8b24', N'Administración IA', N'/porttos/ia-admin-panel', N'IA_ADMIN',
   N'CC-264 · Capa de IA: encendido por puerto y tarea, modo sombra, presupuesto, prompts y métricas');

BEGIN TRANSACTION;

INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT n.codigoModulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, n.nombre, m.precioModulo, n.ruta,
       n.descripcion, 0, N'', n.llave, 1, NULL, @ahora, NULL, @ahora
FROM @nuevos n
CROSS JOIN (SELECT * FROM dbo.PTL_ModulosAP WHERE codigoModulo = @cron) m
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = n.codigoModulo OR (x.rutaModulo = n.ruta AND x.codigoAplicacion = m.codigoAplicacion));
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, n.codigoModulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
CROSS JOIN @nuevos n
WHERE pq.codigoModulo = @cron
  AND EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = n.codigoModulo)
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = n.codigoModulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Módulos creados: ', @modulos, ' · en paquetes: ', @paquetes, ' (0 y 0 = ya estaban).');
