/*
  PORTTOS · Migración 059 · Alertas abiertas en el mapa (OT-037 paso 6 parte 2, CC-252; propuesta aprobada por el usuario 2026-11-19)
  El Centro de alertas (pantalla del CC-252 sobre el API del CC-250) deja cada alerta abierta fija en el mapa con el color de su nivel
  hasta cerrarla. Los datos son los de TCL_AlertasMapa con las columnas de la 058; esta migración solo pone la capa en el catálogo:
    1. Capa 'alertas-abiertas' en TCL_CapasMapa (grupo RIESGOS, orden 30, encendida, solo web: web y tableta; el teléfono nativo no la pinta).
    2. La capa a todos los roles activos de Porttos (como la 055 y la 057).
    3. La capa dentro de la vista Supervisión.
  Idempotente; no borra nada. Requiere la 055 (y la 058 para que haya estados).
  Reversa: UPDATE dbo.TCL_CapasMapa SET activo = 0 WHERE codigo = N'alertas-abiertas'.
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
USING (VALUES (N'alertas-abiertas', N'RIESGOS', 30, 1)) AS o (codigo, grupo, orden, defecto)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, grupo, orden, defecto, canal, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.grupo, o.orden, o.defecto, N'web', 1, N'MIGRACION_059', @ahora, N'MIGRACION_059', @ahora);
DECLARE @capas INT = @@ROWCOUNT;

INSERT INTO dbo.TCL_CapasMapaRoles (codigoCapa, codigoRole, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT N'alertas-abiertas', r.codigoRole, 1, N'MIGRACION_059', @ahora, N'MIGRACION_059', @ahora
FROM dbo.PTL_RolesAP r
WHERE r.codigoAplicacion = @porttos AND ISNULL(r.estadoRole, 1) = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.TCL_CapasMapaRoles x WHERE x.codigoCapa = N'alertas-abiertas' AND x.codigoRole = r.codigoRole COLLATE DATABASE_DEFAULT);
DECLARE @roles INT = @@ROWCOUNT;

UPDATE dbo.TCL_VistasMapa
SET capas = capas + N'|alertas-abiertas', codigoUsuarioModificacion = N'MIGRACION_059', fechaModificacion = @ahora
WHERE codigo = N'SUPERVISION' AND CHARINDEX(N'alertas-abiertas', capas) = 0;
DECLARE @vistas INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT(N'✔ capa alertas-abiertas: ', @capas, N' · roles: ', @roles, N' · vistas: ', @vistas);
