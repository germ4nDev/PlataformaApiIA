/*
  PLATAFORMA · Migración 038 · Nombre de las tablas: PTLNombre → PTL_Nombre y QPLNombre → QPL_Nombre (OT-031, CC-161, regla 24)
  Qué hace (idempotente; no borra datos):
    1. Renombra con sp_rename cada tabla de dbo que empieza por PTL o QPL sin el guion (también las de respaldo _bkAAAAMMDD).
       TCL ya cumple. Si la 038 ya se corrió solo con PTL, volver a correrla renombra las QPL y no toca lo hecho.
    2. Crea un SINÓNIMO con el nombre viejo que apunta a la tabla nueva: el API anterior, reportes, vistas o procedimientos que todavía digan
       PTLModulosAP siguen funcionando. Los sinónimos se retiran en una migración posterior cuando nada los use.
    3. Lista al final las vistas, procedimientos, funciones y triggers que nombran tablas PTL sin guion (siguen funcionando por el sinónimo;
       conviene actualizarlos antes de quitar los sinónimos).
  Va ANTES o JUNTO con el API nuevo (el API nuevo usa PTL_; el viejo sigue funcionando por los sinónimos).
  Reversa: por cada fila, DROP SYNONYM dbo.PTLNombre y EXEC sp_rename 'dbo.PTL_Nombre', 'PTLNombre'.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

-- Prefijos de 3 letras que se normalizan (regla 24: prefijoBD de la aplicación + '_')
DECLARE @prefijos TABLE (p NCHAR(3) COLLATE DATABASE_DEFAULT PRIMARY KEY);
INSERT INTO @prefijos (p) VALUES (N'PTL'), (N'QPL');

DECLARE @cambios TABLE (viejo sysname COLLATE DATABASE_DEFAULT, nuevo sysname COLLATE DATABASE_DEFAULT);
INSERT INTO @cambios (viejo, nuevo)
SELECT t.name, x.p + N'_' + SUBSTRING(t.name, 4, 200)
FROM sys.tables t
INNER JOIN @prefijos x ON t.name LIKE x.p + N'%' AND t.name NOT LIKE x.p + N'[_]%'
WHERE SCHEMA_NAME(t.schema_id) = N'dbo'
  AND NOT EXISTS (SELECT 1 FROM sys.objects o WHERE o.schema_id = t.schema_id AND o.name = x.p + N'_' + SUBSTRING(t.name, 4, 200));

DECLARE @viejo sysname, @nuevo sysname, @sql NVARCHAR(600), @n INT = 0;
BEGIN TRANSACTION;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT viejo, nuevo FROM @cambios ORDER BY viejo;
OPEN c;
FETCH NEXT FROM c INTO @viejo, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'dbo.' + QUOTENAME(@viejo);
  EXEC sp_rename @sql, @nuevo, N'OBJECT';
  SET @sql = N'CREATE SYNONYM dbo.' + QUOTENAME(@viejo) + N' FOR dbo.' + QUOTENAME(@nuevo) + N';';
  EXEC (@sql);
  SET @n += 1;
  FETCH NEXT FROM c INTO @viejo, @nuevo;
END
CLOSE c; DEALLOCATE c;

-- Tablas ya renombradas en una corrida anterior a las que les falta el sinónimo
INSERT INTO @cambios (viejo, nuevo)
SELECT x.p + SUBSTRING(t.name, 5, 200), t.name
FROM sys.tables t
INNER JOIN @prefijos x ON t.name LIKE x.p + N'[_]%'
WHERE SCHEMA_NAME(t.schema_id) = N'dbo'
  AND OBJECT_ID(N'dbo.' + QUOTENAME(x.p + SUBSTRING(t.name, 5, 200))) IS NULL;
DECLARE s CURSOR LOCAL FAST_FORWARD FOR
  SELECT viejo, nuevo FROM @cambios WHERE OBJECT_ID(N'dbo.' + QUOTENAME(viejo)) IS NULL;
OPEN s;
FETCH NEXT FROM s INTO @viejo, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
  SET @sql = N'CREATE SYNONYM dbo.' + QUOTENAME(@viejo) + N' FOR dbo.' + QUOTENAME(@nuevo) + N';';
  EXEC (@sql);
  FETCH NEXT FROM s INTO @viejo, @nuevo;
END
CLOSE s; DEALLOCATE s;
COMMIT TRANSACTION;

DECLARE @sinonimos INT = (SELECT COUNT(*) FROM sys.synonyms s INNER JOIN @prefijos x ON s.name LIKE x.p + N'%' AND s.name NOT LIKE x.p + N'[_]%');
PRINT CONCAT('Tablas renombradas a PTL_ y QPL_: ', @n, ' · sinónimos con el nombre viejo: ', @sinonimos);

-- 3. Objetos de la base que todavía nombran tablas PTL o QPL sin guion (funcionan por el sinónimo; actualizarlos antes de quitar los sinónimos)
SELECT o.type_desc AS tipo, o.name AS objeto
FROM sys.sql_modules m INNER JOIN sys.objects o ON o.object_id = m.object_id
WHERE (m.definition LIKE N'%PTL[A-Z]%' COLLATE Latin1_General_CS_AS OR m.definition LIKE N'%QPL[A-Z]%' COLLATE Latin1_General_CS_AS)
ORDER BY o.type_desc, o.name;
