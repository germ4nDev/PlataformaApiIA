/*
  PORTTOS · Migración 055 · Capas del mapa por usuario y por rol (OT-037 paso 2, CC-243; propuesta aprobada por el usuario 2026-11-19)
  El catálogo de capas vive en el código (web: widgets/panel-mapa/mapa-logistico/mapa-capas.ts; app: nucleo/mapa.ts CAPA_CATALOGO):
  aquí va lo que se administra de cada capa. _pruebas/capas-mapa.test.js falla si un código de la web o de la app no está en esta lista.
  Qué hace (idempotente; no borra nada):
    1. TCL_CapasMapa: una fila por capa (código del catálogo, grupo, orden, visible por defecto, canal web | telefono | ambos, activo, auditoría).
    2. TCL_CapasMapaRoles: qué roles ven cada capa (patrón de PTL_WidgetsRoles, regla 18: sin relación activa = no la ve). Siembra
       todas las capas a todos los roles activos de Porttos, para que nadie pierda capas al correrla.
    3. TCL_VistasMapa: vistas guardadas (código, nombre, descripción, capas separadas por |, orden, activo) + Supervisión, Marítimo,
       Corredor y Nacional.
    4. TCL_CapasMapaUsuario: preferencia de cada usuario por canal (web = web y tableta; telefono = la web embebida en el teléfono y la
       vista nativa de respaldo): estado JSON { codigo: visible } y vista elegida. Solo la escribe /api/capas-mapa/mias.
    5. Menú «Capas del mapa» de Porttos (/porttos/capas-mapa-panel, translateKey CAPAS_MAPA), hermano de Métricas de control.
    6. ACT_CAPASMAPA_MODIFICAR y ACT_CAPASMAPA_VISTA_CREAR / MODIFICAR / ELIMINAR al ROLE_ADMINISTRADOR de Porttos.
  Requiere la 038 (tablas PTL_) y la 051 (módulo Métricas de control). Va antes del API con /api/capas-mapa (sin ella ese API responde 503
  y el mapa usa el catálogo del código con sus valores por defecto).
  Reversa: estadoModulo = 0 del módulo y estadoActividad = 0 de las cuatro actividades; las tablas nuevas no estorban.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL OR OBJECT_ID(N'dbo.PTL_RolesAP', N'U') IS NULL
BEGIN
  RAISERROR('Faltan las tablas PTL_ (038). Revise la base.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';
DECLARE @porttos NVARCHAR(200) = N'3eb98a9f-cc5d-417d-95ea-a2b8abc3b5fa';   -- codigoAplicacion de Porttos (app.manifest.json)

-- 1. Capas
IF OBJECT_ID(N'dbo.TCL_CapasMapa', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_CapasMapa (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_CapasMapa PRIMARY KEY,
    codigo                    NVARCHAR(40)   NOT NULL CONSTRAINT UQ_TCL_CapasMapa_codigo UNIQUE,   -- id del catálogo del código
    grupo                     NVARCHAR(20)   NOT NULL,   -- MARITIMO | INFRAESTRUCTURA | TERRESTRE | RIESGOS
    orden                     INT            NOT NULL CONSTRAINT DF_TCL_CapasMapa_orden DEFAULT (0),
    defecto                   BIT            NOT NULL CONSTRAINT DF_TCL_CapasMapa_defecto DEFAULT (1),
    canal                     NVARCHAR(10)   NOT NULL CONSTRAINT DF_TCL_CapasMapa_canal DEFAULT (N'ambos'),   -- web | telefono | ambos
    activo                    BIT            NOT NULL CONSTRAINT DF_TCL_CapasMapa_activo DEFAULT (1),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL
  );
  PRINT N'✔ TCL_CapasMapa';
END

MERGE dbo.TCL_CapasMapa AS d
USING (VALUES
  (N'muelles-estado', N'MARITIMO', 10, 1), (N'naves', N'MARITIMO', 20, 1), (N'naves-nombres', N'MARITIMO', 30, 1),
  (N'faros', N'MARITIMO', 40, 1), (N'geocercas-kpi', N'MARITIMO', 50, 1),
  (N'puertos', N'INFRAESTRUCTURA', 10, 1), (N'terminales', N'INFRAESTRUCTURA', 20, 1), (N'muelles-almacenamiento', N'INFRAESTRUCTURA', 30, 1),
  (N'puntos-control', N'INFRAESTRUCTURA', 40, 1),
  (N'terrestre', N'TERRESTRE', 10, 1), (N'peajes', N'TERRESTRE', 20, 1), (N'peajes-zonas', N'TERRESTRE', 30, 1), (N'vias', N'TERRESTRE', 40, 0),
  (N'accidentes', N'RIESGOS', 10, 1), (N'clima', N'RIESGOS', 20, 1)
) AS o (codigo, grupo, orden, defecto)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, grupo, orden, defecto, canal, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.grupo, o.orden, o.defecto, N'ambos', 1, N'MIGRACION_055', @ahora, N'MIGRACION_055', @ahora);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' capas');

-- 2. Capas por rol
IF OBJECT_ID(N'dbo.TCL_CapasMapaRoles', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_CapasMapaRoles (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_CapasMapaRoles PRIMARY KEY,
    codigoCapa                NVARCHAR(40)   NOT NULL,   -- TCL_CapasMapa.codigo (datos por código, regla 26)
    codigoRole                NVARCHAR(200)  NOT NULL,   -- rol de la plataforma (sin llave foránea a PTL_, regla 26)
    activo                    BIT            NOT NULL CONSTRAINT DF_TCL_CapasMapaRoles_activo DEFAULT (1),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL,
    CONSTRAINT UQ_TCL_CapasMapaRoles UNIQUE (codigoCapa, codigoRole)
  );
  PRINT N'✔ TCL_CapasMapaRoles';
END

INSERT INTO dbo.TCL_CapasMapaRoles (codigoCapa, codigoRole, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT c.codigo, r.codigoRole, 1, N'MIGRACION_055', @ahora, N'MIGRACION_055', @ahora
FROM dbo.TCL_CapasMapa c
CROSS JOIN (SELECT codigoRole FROM dbo.PTL_RolesAP WHERE codigoAplicacion = @porttos AND ISNULL(estadoRole, 1) = 1) r
WHERE NOT EXISTS (SELECT 1 FROM dbo.TCL_CapasMapaRoles x WHERE x.codigoCapa = c.codigo COLLATE DATABASE_DEFAULT AND x.codigoRole = r.codigoRole COLLATE DATABASE_DEFAULT);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' capas por rol');

-- 3. Vistas guardadas
IF OBJECT_ID(N'dbo.TCL_VistasMapa', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_VistasMapa (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_VistasMapa PRIMARY KEY,
    codigo                    NVARCHAR(40)   NOT NULL CONSTRAINT UQ_TCL_VistasMapa_codigo UNIQUE,
    nombre                    NVARCHAR(80)   NOT NULL,
    descripcion               NVARCHAR(400)  NULL,
    capas                     NVARCHAR(1000) NOT NULL,   -- códigos de TCL_CapasMapa separados por |
    orden                     INT            NOT NULL CONSTRAINT DF_TCL_VistasMapa_orden DEFAULT (0),
    activo                    BIT            NOT NULL CONSTRAINT DF_TCL_VistasMapa_activo DEFAULT (1),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL
  );
  PRINT N'✔ TCL_VistasMapa';
END

MERGE dbo.TCL_VistasMapa AS d
USING (VALUES
  (N'SUPERVISION', N'Supervisión', N'Puntos de control, muelles, naves, flota y eventos viales: lo que pide atención ahora', 
   N'puntos-control|muelles-estado|naves|faros|puertos|terminales|terrestre|accidentes', 10),
  (N'MARITIMO', N'Marítimo', N'Muelles, naves con nombre, faros, geocercas y clima', 
   N'muelles-estado|naves|naves-nombres|faros|geocercas-kpi|puertos|terminales|clima', 20),
  (N'CORREDOR', N'Corredor', N'Flota en ruta, peajes con su zona, red vial y eventos viales', 
   N'terrestre|peajes|peajes-zonas|vias|accidentes|puertos', 30),
  (N'NACIONAL', N'Nacional', N'Puertos, clima y eventos viales', N'puertos|clima|accidentes|naves', 40)
) AS o (codigo, nombre, descripcion, capas, orden)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, nombre, descripcion, capas, orden, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.nombre, o.descripcion, o.capas, o.orden, 1, N'MIGRACION_055', @ahora, N'MIGRACION_055', @ahora);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' vistas iniciales');

-- 4. Preferencia por usuario y canal
IF OBJECT_ID(N'dbo.TCL_CapasMapaUsuario', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_CapasMapaUsuario (
    id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_CapasMapaUsuario PRIMARY KEY,
    codigoUsuario      NVARCHAR(200)  NOT NULL,
    canal              NVARCHAR(10)   NOT NULL,   -- web | telefono
    estado             NVARCHAR(2000) NOT NULL,   -- JSON { codigo: true | false }
    vista              NVARCHAR(40)   NULL,       -- TCL_VistasMapa.codigo elegida (NULL = a mano)
    fechaCreacion      NVARCHAR(100)  NULL,
    fechaModificacion  NVARCHAR(100)  NULL,
    CONSTRAINT UQ_TCL_CapasMapaUsuario UNIQUE (codigoUsuario, canal)
  );
  PRINT N'✔ TCL_CapasMapaUsuario';
END

DECLARE @metricas NVARCHAR(200) = N'c7b84803-7f88-4fa3-b81b-20bcfab0c361';  -- Porttos › Administración › Métricas de control (051)
DECLARE @modulo NVARCHAR(200) = N'89b4f3f4-3d2d-40ea-aa1f-c8eb6a08bdb2';    -- Porttos › Administración › Capas del mapa (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @metricas)
BEGIN
  RAISERROR('Se hicieron las tablas, pero no está el módulo Porttos › Métricas de control (051, hermano del menú nuevo). Corra la 051.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 5. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Capas del mapa', m.precioModulo, N'/porttos/capas-mapa-panel',
       N'CC-243 · Capas del mapa logístico: visibles por defecto, canal, roles que las ven y vistas guardadas',
       0, N'', N'CAPAS_MAPA', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @metricas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
WHERE pq.codigoModulo = @metricas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 6. Actividades
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_CAPASMAPA_MODIFICAR', N'Modificar capas del mapa y sus roles'),
                           (N'ACT_CAPASMAPA_VISTA_CREAR', N'Crear vistas del mapa'),
                           (N'ACT_CAPASMAPA_VISTA_MODIFICAR', N'Modificar vistas del mapa'),
                           (N'ACT_CAPASMAPA_VISTA_ELIMINAR', N'Inactivar vistas del mapa');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-243 · Porttos · Capas del mapa', 1, NULL, @ahora, NULL, @ahora
FROM @nuevas n
CROSS JOIN (SELECT codigoAplicacion, codigoSuite FROM dbo.PTL_ModulosAP WHERE codigoModulo = @modulo) m
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTL_Actividades a WHERE a.llavePermiso = n.llavePermiso);
DECLARE @creadas INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ActividadesRoles (codigoActividadRole, codigoActividad, codigoRole, permiso,
                                      codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), a.codigoActividad, r.codigoRole, 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_Actividades a
INNER JOIN dbo.PTL_RolesAP r ON r.codigoAplicacion = a.codigoAplicacion AND r.nombreRole = N'ROLE_ADMINISTRADOR'
WHERE a.llavePermiso IN (SELECT llavePermiso FROM @nuevas) AND a.estadoActividad = 1
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ActividadesRoles ar WHERE ar.codigoActividad = a.codigoActividad AND ar.codigoRole = r.codigoRole);
DECLARE @asignadas INT = @@ROWCOUNT;

COMMIT TRANSACTION;

PRINT CONCAT('Módulo creado: ', @modulos, ' · en paquetes: ', @paquetes, ' · actividades creadas: ', @creadas,
             ' · asignadas al ADMINISTRADOR de Porttos: ', @asignadas);
