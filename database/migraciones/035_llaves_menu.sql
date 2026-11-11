/*
  PLATAFORMA · Migración 035 · translateKey del menú según la regla 23 (OT-028, 2026-11-10)
  El menú arma la llave con un prefijo + el translateKey de la tabla (navigation.service): MENU.MODULES.<translateKey> y MENU.SUITES.<translateKey>.
  Por eso translateKey es solo la hoja (p. ej. TRADUCCIONES). La 034 lo había guardado completo (PLATAFORMA.MODULOS.TRADUCCIONES) y algún registro
  hecho a mano puede traer el prefijo viejo: se le quita. Idempotente; no borra nada; solo toca filas cuyo translateKey trae el prefijo.
  Reversa: no hace falta (con prefijo la llave no existía en el JSON y el menú mostraba la llave cruda).
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

UPDATE dbo.PTLModulosAP
SET translateKey = SUBSTRING(translateKey, LEN(N'PLATAFORMA.MODULOS.') + 1, 200)
WHERE translateKey LIKE N'PLATAFORMA.MODULOS.%';
DECLARE @modulos INT = @@ROWCOUNT;

UPDATE dbo.PTLModulosAP
SET translateKey = SUBSTRING(translateKey, LEN(N'MENU.MODULES.') + 1, 200)
WHERE translateKey LIKE N'MENU.MODULES.%';
SET @modulos += @@ROWCOUNT;

UPDATE dbo.PTLSuitesAP
SET translateKey = SUBSTRING(translateKey, LEN(N'PLATAFORMA.SUITES.') + 1, 200)
WHERE translateKey LIKE N'PLATAFORMA.SUITES.%';
DECLARE @suites INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('translateKey corregidos · módulos: ', @modulos, ' · suites: ', @suites);
