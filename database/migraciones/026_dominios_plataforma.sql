/*
  PLATAFORMA · Migración 026 · Dominios de la plataforma (OT-012, aprobado por el usuario el 2026-10-30: tabla nueva)
  Un solo despliegue de la web y del API; el dominio por el que entra el navegador decide qué ve:
    - tipo 'consola'    → la consola de administración (aplicaciones, suscriptores, usuarios…) y todas las aplicaciones.
    - tipo 'aplicacion' → solo esa aplicación: su portal en la raíz, su login, su menú; el API rechaza al usuario sin rol en ella.
    - dominio sin fila  → todo igual que hoy (contexto neutro). Así QPlus y las demás siguen entrando como siempre.
  Qué hace (idempotente; solo agrega, no toca ninguna tabla existente):
    1. dbo.PTLDominiosAP  (dominio, tipo, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, nombreMarca, logoMarca, estado)
    2. Semilla, solo si el dominio no existe: plataforma.dymsites.co (consola); porttos.co y www.porttos.co (aplicación Porttos,
       portal /websites/porttos), estas dos solo si la aplicación existe en PTLAplicaciones.
  Agregar un dominio = una fila (el API la toma en máximo 5 minutos o al reiniciar). Apagar uno: estado = 0.
  El API funciona antes de correrla: sin la tabla, todos los dominios son neutros (como hoy).
  Reversa: DROP TABLE dbo.PTLDominiosAP.
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

IF OBJECT_ID(N'dbo.PTLDominiosAP', N'U') IS NULL
CREATE TABLE dbo.PTLDominiosAP (
  dominioId          INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_PTLDominiosAP PRIMARY KEY,
  dominio            NVARCHAR(253)  NOT NULL CONSTRAINT UQ_PTLDominiosAP_dominio UNIQUE,   -- en minúsculas, sin https:// ni puerto
  tipo               NVARCHAR(20)   NOT NULL CONSTRAINT CK_PTLDominiosAP_tipo CHECK (tipo IN (N'consola', N'aplicacion')),
  codigoAplicacion   NVARCHAR(200)  NULL,       -- obligatorio si tipo = 'aplicacion'
  codigoSuite        NVARCHAR(200)  NULL,       -- opcional: entra directo a esa suite
  rutaPortal         NVARCHAR(200)  NULL,       -- raíz sin sesión (p. ej. /websites/<app>); NULL = login
  rutaInicio         NVARCHAR(200)  NULL,       -- opcional: a dónde va con sesión; NULL = la rutaInicio de la suite
  nombreMarca        NVARCHAR(100)  NULL,       -- texto del login; NULL = el nombre de la aplicación
  logoMarca          NVARCHAR(300)  NULL,       -- ruta de un asset o URL; NULL = el logo de siempre
  estado             BIT            NOT NULL CONSTRAINT DF_PTLDominiosAP_estado DEFAULT (1),
  fechaCreacion      DATETIME2(0)   NOT NULL CONSTRAINT DF_PTLDominiosAP_fc DEFAULT (SYSUTCDATETIME()),
  fechaModificacion  DATETIME2(0)   NOT NULL CONSTRAINT DF_PTLDominiosAP_fm DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT CK_PTLDominiosAP_app CHECK (tipo = N'consola' OR codigoAplicacion IS NOT NULL)
);

-- Semilla (no pisa lo editado)
IF NOT EXISTS (SELECT 1 FROM dbo.PTLDominiosAP WHERE dominio = N'plataforma.dymsites.co')
  INSERT INTO dbo.PTLDominiosAP (dominio, tipo, nombreMarca) VALUES (N'plataforma.dymsites.co', N'consola', N'Plataforma DYM');

DECLARE @porttos NVARCHAR(200) = N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa';   -- codigoAplicacion de Porttos (el mismo de la app móvil)
IF EXISTS (SELECT 1 FROM dbo.PTLAplicaciones WHERE codigoAplicacion = @porttos)
BEGIN
  IF NOT EXISTS (SELECT 1 FROM dbo.PTLDominiosAP WHERE dominio = N'porttos.co')
    INSERT INTO dbo.PTLDominiosAP (dominio, tipo, codigoAplicacion, rutaPortal, nombreMarca)
    VALUES (N'porttos.co', N'aplicacion', @porttos, N'/websites/porttos', N'Porttos');
  IF NOT EXISTS (SELECT 1 FROM dbo.PTLDominiosAP WHERE dominio = N'www.porttos.co')
    INSERT INTO dbo.PTLDominiosAP (dominio, tipo, codigoAplicacion, rutaPortal, nombreMarca)
    VALUES (N'www.porttos.co', N'aplicacion', @porttos, N'/websites/porttos', N'Porttos');
END
ELSE
  PRINT 'Aviso: la aplicación Porttos no está en PTLAplicaciones; porttos.co no se registró (agréguelo a mano).';

COMMIT TRANSACTION;

SELECT dominio, tipo, codigoAplicacion, codigoSuite, rutaPortal, rutaInicio, nombreMarca, estado FROM dbo.PTLDominiosAP ORDER BY tipo, dominio;
