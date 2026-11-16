/*
  PLATAFORMA · Migración 040 · Dominio de Sistemas (OT-034, CC-201; usuario 2026-11-15: «el dominio de sistemas es qplusnube2.co»)
  Cada aplicación se publica en su propio dominio con su compilación aislada. Esta migración registra el de Sistemas en
  PTL_DominiosAP para que el API lo acepte (CORS) y la web entre directo a Sistemas y a su inicio:
    qplusnube2.co y www.qplusnube2.co → tipo 'aplicacion', Sistemas, rutaInicio /sistemas/inicio, marca 'Sistemas', sin portal.
  Qué hace (idempotente; solo agrega, no pisa lo editado): busca Sistemas en PTL_Aplicaciones por su código
  (0e69b547-b410-496d-a651-eb6a4d605325, el de app.manifest.json) o, si no está, por nombreAplicacion = 'Sistemas'; si no la encuentra,
  avisa y no registra nada (agréguelo a mano). Requiere la 026 (tabla) y la 038 (nombres PTL_).
  El API toma las filas nuevas en máximo 5 minutos o al reiniciar. Reversa: DELETE de las dos filas por dominio.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_DominiosAP', N'U') IS NULL
BEGIN
  RAISERROR('Falta la tabla dbo.PTL_DominiosAP: corra antes la 026 y la 038.', 16, 1);
  RETURN;
END

DECLARE @sistemas NVARCHAR(200) =
  (SELECT TOP 1 codigoAplicacion FROM dbo.PTL_Aplicaciones WHERE codigoAplicacion = N'0e69b547-b410-496d-a651-eb6a4d605325');
IF @sistemas IS NULL
  SET @sistemas = (SELECT TOP 1 codigoAplicacion FROM dbo.PTL_Aplicaciones WHERE nombreAplicacion = N'Sistemas');

IF @sistemas IS NULL
BEGIN
  PRINT 'Aviso: la aplicación Sistemas no está en PTL_Aplicaciones; qplusnube2.co no se registró (agréguelo a mano).';
  RETURN;
END
IF @sistemas <> N'0e69b547-b410-496d-a651-eb6a4d605325'
  PRINT 'Aviso: en esta base Sistemas tiene otro código (' + @sistemas + '): ponga ese en apps/sistemas/app.manifest.json (web y API).';

BEGIN TRANSACTION;
IF NOT EXISTS (SELECT 1 FROM dbo.PTL_DominiosAP WHERE dominio = N'qplusnube2.co')
  INSERT INTO dbo.PTL_DominiosAP (dominio, tipo, codigoAplicacion, rutaPortal, rutaInicio, nombreMarca)
  VALUES (N'qplusnube2.co', N'aplicacion', @sistemas, NULL, N'/sistemas/inicio', N'Sistemas');
IF NOT EXISTS (SELECT 1 FROM dbo.PTL_DominiosAP WHERE dominio = N'www.qplusnube2.co')
  INSERT INTO dbo.PTL_DominiosAP (dominio, tipo, codigoAplicacion, rutaPortal, rutaInicio, nombreMarca)
  VALUES (N'www.qplusnube2.co', N'aplicacion', @sistemas, NULL, N'/sistemas/inicio', N'Sistemas');
COMMIT TRANSACTION;

SELECT dominio, tipo, codigoAplicacion, rutaInicio, nombreMarca, estado FROM dbo.PTL_DominiosAP WHERE dominio LIKE N'%qplusnube2.co';
