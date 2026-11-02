/*
  PLATAFORMA · Migración 027 · Login por aplicación (aprobado por el usuario el 2026-10-31, CC-104)
  El login de un dominio de aplicación (porttos.co) toma el diseño de su portal y sus propios slides.
  Qué hace (idempotente; solo agrega, no borra ni cambia lo que ya existe):
    1. dbo.PTLSliderInicio: columna opcional codigoAplicacion (NULL = slide general, para todos los dominios).
       Tabla compartida de la plataforma (AD-01): la columna es opcional y nadie más la necesita; sin ella todo sigue igual.
       El API muestra en el login de una aplicación sus slides propios activos; si no tiene, los generales.
    2. dbo.PTLDominiosAP: logo de la marca Porttos en porttos.co y www.porttos.co, solo si aún no tienen logo.
  El API funciona antes de correrla: sin la columna, todos los slides son generales (como hoy).
  Reversa: ALTER TABLE dbo.PTLSliderInicio DROP COLUMN codigoAplicacion (y logoMarca = NULL si se quiere).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.PTLSliderInicio', N'codigoAplicacion') IS NULL
  ALTER TABLE dbo.PTLSliderInicio ADD codigoAplicacion NVARCHAR(200) NULL;   -- mismo largo que PTLAplicaciones.codigoAplicacion

IF OBJECT_ID(N'dbo.PTLDominiosAP', N'U') IS NOT NULL
  UPDATE dbo.PTLDominiosAP SET logoMarca = N'assets/images/porttos/porttos-principal-negativo.png'
  WHERE dominio IN (N'porttos.co', N'www.porttos.co') AND logoMarca IS NULL;
ELSE
  PRINT 'Aviso: falta la 026 (PTLDominiosAP); el logo de Porttos se pone al correr esta migración después de la 026.';

COMMIT TRANSACTION;
PRINT 'Migración 027 aplicada: slides por aplicación (PTLSliderInicio.codigoAplicacion) y logo de Porttos en su login.';
SELECT COUNT(*) AS slides, SUM(CASE WHEN codigoAplicacion IS NULL THEN 1 ELSE 0 END) AS generales FROM dbo.PTLSliderInicio;
