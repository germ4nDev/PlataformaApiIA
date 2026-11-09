/*
  PLATAFORMA · Migración 032 · Empresa en el contexto de la sesión (CC-128, decisión del usuario 2026-11-07)
  Qué hace (idempotente; no borra nada):
    1. dbo.PTLSesiones: columna codigoEmpresaSC NVARCHAR(200) NULL. La web la llena con la empresa activa (la misma con la que calcula
       los permisos del menú) por POST /api/sesiones/contexto o el socket 'actualizar-contexto'.
    validarPermiso exige suscriptor y empresa en la sesión y busca los roles del vínculo usuario–suscriptor (PTLUsuariosSC) en esa empresa
    (PTLUsuariosRole.codigoEmpresaSC). Sin empresa en la sesión → 403.
  REQUISITO: correrla ANTES de desplegar el API del CC-128 (el modelo de sesión ya pide la columna: sin ella falla validarSesion en todo el API).
  Reversa: ALTER TABLE dbo.PTLSesiones DROP COLUMN codigoEmpresaSC;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF COL_LENGTH(N'dbo.PTLSesiones', N'codigoEmpresaSC') IS NULL
BEGIN
  EXEC (N'ALTER TABLE dbo.PTLSesiones ADD codigoEmpresaSC NVARCHAR(200) COLLATE DATABASE_DEFAULT NULL;');
  PRINT 'PTLSesiones.codigoEmpresaSC creada.';
END
ELSE
  PRINT 'PTLSesiones.codigoEmpresaSC ya existía.';

-- En EXEC: el lote compila antes de que exista la columna.
EXEC (N'SELECT COUNT(*) AS sesionesActivas, SUM(CASE WHEN codigoEmpresaSC IS NULL THEN 1 ELSE 0 END) AS sinEmpresa
        FROM dbo.PTLSesiones WHERE activa = 1;');
