/*
  PORTTOS · Migración 057 · Reloj de las 8 horas (OT-037 paso 4, CC-247; propuesta aprobada por el usuario 2026-11-19)
  El reloj no tiene tablas propias: usa las estadías de camión de la 053 (TCL_EventosGeocerca) en las geocercas donde está activa una
  métrica de permanencia (zonas de cargue, descargue o enturnamiento) y los umbrales del indicador TV de la 056 (6 / 8 h por defecto,
  Decreto 1017 de 2025). Esta migración solo lo pone en el catálogo de capas del mapa:
    1. Capa 'reloj-8h' en TCL_CapasMapa (grupo TERRESTRE, orden 50, encendida, web y teléfono).
    2. La capa a todos los roles activos de Porttos (como la 055).
    3. La capa dentro de las vistas Supervisión y Corredor.
  Idempotente; no borra nada. Requiere la 055 (y la 053 y la 056 para que el reloj tenga datos y umbrales).
  Reversa: UPDATE dbo.TCL_CapasMapa SET activo = 0 WHERE codigo = N'reloj-8h'.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_CapasMapa', N'U') IS NULL
BEGIN
  RAISERROR('Falta la 055 (TCL_CapasMapa). Córrala primero.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';
DECLARE @porttos NVARCHAR(200) = N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa';

BEGIN TRANSACTION;

MERGE dbo.TCL_CapasMapa AS d
USING (VALUES (N'reloj-8h', N'TERRESTRE', 50, 1)) AS o (codigo, grupo, orden, defecto)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, grupo, orden, defecto, canal, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.grupo, o.orden, o.defecto, N'ambos', 1, N'MIGRACION_057', @ahora, N'MIGRACION_057', @ahora);
DECLARE @capas INT = @@ROWCOUNT;

INSERT INTO dbo.TCL_CapasMapaRoles (codigoCapa, codigoRole, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT N'reloj-8h', r.codigoRole, 1, N'MIGRACION_057', @ahora, N'MIGRACION_057', @ahora
FROM dbo.PTL_RolesAP r
WHERE r.codigoAplicacion = @porttos AND ISNULL(r.estadoRole, 1) = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.TCL_CapasMapaRoles x WHERE x.codigoCapa = N'reloj-8h' AND x.codigoRole = r.codigoRole COLLATE DATABASE_DEFAULT);
DECLARE @roles INT = @@ROWCOUNT;

UPDATE dbo.TCL_VistasMapa
SET capas = capas + N'|reloj-8h', codigoUsuarioModificacion = N'MIGRACION_057', fechaModificacion = @ahora
WHERE codigo IN (N'SUPERVISION', N'CORREDOR') AND CHARINDEX(N'reloj-8h', capas) = 0;
DECLARE @vistas INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT(N'✔ capa reloj-8h: ', @capas, N' · roles: ', @roles, N' · vistas: ', @vistas);
