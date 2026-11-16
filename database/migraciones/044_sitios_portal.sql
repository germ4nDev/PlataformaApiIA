/*
  PLATAFORMA · Migración 044 · Sitios como catálogo de websites y panel del portal porttos.co (OT-036 fase 2, CC-207; usuario 2026-11-15)
  Qué hace (idempotente; no borra nada):
    1. PTL_SitiosAP.rutaAdministracion NVARCHAR(200) NULL: ruta de la plataforma donde la aplicación administra el contenido del sitio
       (la declara el manifiesto de la aplicación en websites[].administracion). Sitios abre esa ruta con «Administrar contenido».
    2. Siembra el sitio porttos.co de Porttos (https://porttos.co, puerto 443, /porttos/portal-panel) si no existe un sitio con esa url.
    3. Activa el módulo «Portal porttos.co» de Porttos que dejó inactivo la 043 (la pantalla ya existe).
  Requiere la 038 y la 043. Reversa: estadoSitio = 0 del sitio y estadoModulo = 0 del módulo.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_SitiosAP', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 038 (tablas PTL_). Córrala primero.', 16, 1);
  RETURN;
END

IF COL_LENGTH(N'dbo.PTL_SitiosAP', N'rutaAdministracion') IS NULL
  ALTER TABLE dbo.PTL_SitiosAP ADD rutaAdministracion NVARCHAR(200) NULL;
GO

SET NOCOUNT ON;
SET XACT_ABORT ON;
DECLARE @porttos NVARCHAR(200) = N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa';
DECLARE @modulo NVARCHAR(200) = N'7c1e2a4d-5b3f-4e8a-9d61-0f2c3b4a5e04';   -- de la 043
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

BEGIN TRANSACTION;

INSERT INTO dbo.PTL_SitiosAP (codigoSitio, codigoAplicacion, nombreSitio, descripcionSitio, urlSitio, puertoSitio, estadoSitio, rutaAdministracion,
                              codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT N'PORTTOS_PORTAL', @porttos, N'porttos.co', N'Portal público de Porttos: solución, puertos en vivo, app móvil y contacto (OT-036)',
       N'https://porttos.co', 443, 1, N'/porttos/portal-panel', N'SISTEMA', @ahora, N'SISTEMA', @ahora
WHERE EXISTS (SELECT 1 FROM dbo.PTL_Aplicaciones WHERE codigoAplicacion = @porttos)
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_SitiosAP WHERE codigoSitio = N'PORTTOS_PORTAL' OR urlSitio = N'https://porttos.co');
DECLARE @sitios INT = @@ROWCOUNT;

UPDATE dbo.PTL_SitiosAP SET rutaAdministracion = N'/porttos/portal-panel'
WHERE urlSitio = N'https://porttos.co' AND rutaAdministracion IS NULL;

UPDATE dbo.PTL_ModulosAP SET estadoModulo = 1, fechaModificacion = @ahora WHERE codigoModulo = @modulo AND estadoModulo = 0;
DECLARE @modulos INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Sitio porttos.co sembrado: ', @sitios, ' · módulo del portal activado: ', @modulos);
IF @sitios = 0 AND NOT EXISTS (SELECT 1 FROM dbo.PTL_SitiosAP WHERE urlSitio = N'https://porttos.co')
  PRINT 'Aviso: no está la aplicación Porttos con su código; registre el sitio a mano en Sitios.';
