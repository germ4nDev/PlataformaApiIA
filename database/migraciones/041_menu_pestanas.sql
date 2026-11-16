/*
  PLATAFORMA · Migración 041 · Menú de Utilidades › Pestañas y Tipos de pestaña (CC-203; usuario 2026-11-15: administrar desde la web
  las tablas que tienen API y no tienen pantalla, con el patrón de los módulos de administración)
  Qué hace (idempotente; no borra nada):
    1. Dos módulos de menú hermanos de Utilidades › Widgets (misma aplicación, suite y padre):
         Pestañas          /utilidades/pestanas        translateKey PESTANAS
         Tipos de pestaña  /utilidades/tipos-pestana   translateKey TIPOS_PESTANA
    2. Los agrega a los mismos paquetes que tienen Widgets (PTL_ModulosPQ).
  Las actividades ACT_PESTANAS_* y ACT_TIPOSPEST_* ya existen (033) y están asignadas al ROLE_ADMINISTRADOR: no se tocan.
  Requiere la 038 (tablas PTL_). Reversa: UPDATE estadoModulo = 0 de los dos módulos y estadoModuloPQ = 0 de sus filas en paquetes.
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

DECLARE @widgets NVARCHAR(200) = N'46f2fc3b-de76-4113-9ee6-574be349f93e';   -- Utilidades › Widgets
DECLARE @pestanas NVARCHAR(200) = N'7c1e2a4d-5b3f-4e8a-9d61-0f2c3b4a5e01';
DECLARE @tipos NVARCHAR(200) = N'7c1e2a4d-5b3f-4e8a-9d61-0f2c3b4a5e02';
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @widgets)
BEGIN
  PRINT 'Aviso: no está el módulo Utilidades › Widgets; no se creó el menú (agréguelo a mano).';
  RETURN;
END

DECLARE @nuevos TABLE (codigo NVARCHAR(200) COLLATE DATABASE_DEFAULT, nombre NVARCHAR(100) COLLATE DATABASE_DEFAULT,
                       ruta NVARCHAR(200) COLLATE DATABASE_DEFAULT, llave NVARCHAR(100) COLLATE DATABASE_DEFAULT, descripcion NVARCHAR(400) COLLATE DATABASE_DEFAULT);
INSERT INTO @nuevos VALUES
  (@pestanas, N'Pestañas', N'/utilidades/pestanas', N'PESTANAS', N'CC-203 · Pestañas de los tableros: nombre, tipo, aplicación, suite, orden, ícono y color'),
  (@tipos, N'Tipos de pestaña', N'/utilidades/tipos-pestana', N'TIPOS_PESTANA', N'CC-203 · Tipos de pestaña y su estrategia del motor de tableros');

BEGIN TRANSACTION;

INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT n.codigo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, n.nombre, m.precioModulo, n.ruta,
       n.descripcion, 0, N'', n.llave, 1, NULL, @ahora, NULL, @ahora
FROM @nuevos n
CROSS JOIN (SELECT * FROM dbo.PTL_ModulosAP WHERE codigoModulo = @widgets) m
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = n.codigo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, n.codigo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
CROSS JOIN @nuevos n
WHERE pq.codigoModulo = @widgets
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = n.codigo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Módulos de menú creados: ', @modulos, ' · filas en paquetes: ', @paquetes);
