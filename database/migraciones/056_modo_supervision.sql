/*
  PORTTOS · Migración 056 · Modo Supervisión (OT-037 paso 3, CC-244; propuesta aprobada por el usuario 2026-11-19)
  Banda sobre el mapa con los indicadores del boletín de la Delegatura de Puertos por puerto, en vivo y con el último valor del boletín.
  Las fórmulas viven en el código (apps/porttos/utils/supervision): UM = TO/TD×100, AB = CUB/CDB×100, AP = CUP/CDP×100, EO = CU/CO×100,
  TV = HV/N. Lo que no tenga fuente sale «Sin dato».
  Qué hace (idempotente; no borra nada):
    1. TCL_IndicadoresSupervision: los 5 indicadores con nombre, unidad, sentido, umbral amarillo y rojo, orden y activo (umbrales
       iniciales editables en Administración › Indicadores de supervisión; TV con el límite de 8 h del Decreto 1017 de 2025).
    2. TCL_BoletinIndicadores: el valor de cada indicador por puerto y mes tal como lo publica el boletín (se carga a mano: el boletín
       es PDF), con la fuente y una nota; activo = 0 retira un valor mal cargado sin borrarlo.
    3. Menú «Indicadores de supervisión» de Porttos (/porttos/supervision-panel, translateKey SUPERVISION), hermano de Capas del mapa.
    4. ACT_SUPERVISION_MODIFICAR (umbrales) y ACT_SUPERVISION_BOLETIN_CREAR / MODIFICAR / ELIMINAR al ROLE_ADMINISTRADOR de Porttos.
    5. Corrige el menú de la 055 (Capas del mapa) y el de esta: si su hermano no estaba en ningún paquete, los pone en los paquetes
       donde están los demás módulos de Administración de Porttos (mismo padre).
  Requiere la 055. Va antes del API con /api/supervision (sin ella ese API responde 503 y la banda no sale).
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
IF OBJECT_ID(N'dbo.TCL_CapasMapa', N'U') IS NULL
BEGIN
  RAISERROR('Falta la 055 (TCL_CapasMapa). Córrala primero.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

-- 1. Indicadores
IF OBJECT_ID(N'dbo.TCL_IndicadoresSupervision', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IndicadoresSupervision (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IndicadoresSupervision PRIMARY KEY,
    codigo                    NVARCHAR(10)   NOT NULL CONSTRAINT UQ_TCL_IndicadoresSupervision_codigo UNIQUE,   -- UM | AB | AP | EO | TV
    nombre                    NVARCHAR(120)  NOT NULL,
    formula                   NVARCHAR(60)   NOT NULL,
    unidad                    NVARCHAR(10)   NOT NULL,
    sentido                   NVARCHAR(12)   NOT NULL,   -- MAYOR_PEOR | MENOR_PEOR
    umbral_amarillo           DECIMAL(14,2)  NULL,
    umbral_rojo               DECIMAL(14,2)  NULL,
    orden                     INT            NOT NULL CONSTRAINT DF_TCL_IndicadoresSupervision_orden DEFAULT (0),
    activo                    BIT            NOT NULL CONSTRAINT DF_TCL_IndicadoresSupervision_activo DEFAULT (1),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL
  );
  PRINT N'✔ TCL_IndicadoresSupervision';
END

MERGE dbo.TCL_IndicadoresSupervision AS d
USING (VALUES
  (N'UM', N'Utilización de muelles', N'TO / TD × 100', N'%', N'MAYOR_PEOR', 75, 90, 10),
  (N'AB', N'Aprovechamiento de bodegas', N'CUB / CDB × 100', N'%', N'MAYOR_PEOR', 80, 95, 20),
  (N'AP', N'Aprovechamiento de patios', N'CUP / CDP × 100', N'%', N'MAYOR_PEOR', 80, 95, 30),
  (N'EO', N'Capacidad utilizada sobre ofrecida', N'CU / CO × 100', N'%', N'MAYOR_PEOR', 80, 95, 40),
  (N'TV', N'Tiempo de permanencia del vehículo', N'HV / N', N'h', N'MAYOR_PEOR', 6, 8, 50)
) AS o (codigo, nombre, formula, unidad, sentido, umbral_amarillo, umbral_rojo, orden)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, nombre, formula, unidad, sentido, umbral_amarillo, umbral_rojo, orden, activo,
  codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.nombre, o.formula, o.unidad, o.sentido, o.umbral_amarillo, o.umbral_rojo, o.orden, 1,
  N'MIGRACION_056', @ahora, N'MIGRACION_056', @ahora);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' indicadores');

-- 2. Valores del boletín
IF OBJECT_ID(N'dbo.TCL_BoletinIndicadores', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_BoletinIndicadores (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_BoletinIndicadores PRIMARY KEY,
    puerto                    NVARCHAR(40)   NOT NULL,   -- clave del maestro de puertos
    indicador                 NVARCHAR(10)   NOT NULL,   -- TCL_IndicadoresSupervision.codigo
    periodo                   NVARCHAR(7)    NOT NULL,   -- AAAA-MM
    valor                     DECIMAL(14,2)  NOT NULL,
    fuente                    NVARCHAR(400)  NULL,       -- boletín y página o enlace
    nota                      NVARCHAR(400)  NULL,
    activo                    BIT            NOT NULL CONSTRAINT DF_TCL_BoletinIndicadores_activo DEFAULT (1),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL
  );
  CREATE INDEX IX_TCL_BoletinIndicadores_Puerto ON dbo.TCL_BoletinIndicadores (puerto, indicador, periodo) INCLUDE (valor, activo);
  PRINT N'✔ TCL_BoletinIndicadores';
END

DECLARE @capas NVARCHAR(200) = N'89b4f3f4-3d2d-40ea-aa1f-c8eb6a08bdb2';   -- Porttos › Administración › Capas del mapa (055)
DECLARE @modulo NVARCHAR(200) = N'5ec6ea77-d30e-4ee5-93aa-1197e22bb311';  -- Porttos › Administración › Indicadores de supervisión (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @capas)
BEGIN
  RAISERROR('Se hicieron las tablas, pero no está el módulo Porttos › Capas del mapa (055). Corra la 055.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 3. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Indicadores de supervisión', m.precioModulo, N'/porttos/supervision-panel',
       N'CC-244 · Modo Supervisión: umbrales de los indicadores del boletín y sus valores por puerto y mes',
       0, N'', N'SUPERVISION', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @capas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

-- 5. Paquetes: los de los hermanos (mismo padre) para Capas del mapa y para este módulo
DECLARE @padre NVARCHAR(200) = (SELECT codigoPadre FROM dbo.PTL_ModulosAP WHERE codigoModulo = @capas);
INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), p.codigoAplicacion, p.codigoSuite, n.codigoModulo, p.codigoPaquete, 1, NULL, @ahora, NULL, @ahora
FROM (SELECT DISTINCT pq.codigoAplicacion, pq.codigoSuite, pq.codigoPaquete
      FROM dbo.PTL_ModulosPQ pq
      INNER JOIN dbo.PTL_ModulosAP m ON m.codigoModulo = pq.codigoModulo
      WHERE m.codigoPadre = @padre AND m.codigoModulo NOT IN (@capas, @modulo) AND ISNULL(pq.estadoModuloPQ, 1) = 1) p
CROSS JOIN (SELECT @capas AS codigoModulo UNION ALL SELECT @modulo) n
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = n.codigoModulo AND x.codigoPaquete = p.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 4. Actividades
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_SUPERVISION_MODIFICAR', N'Modificar umbrales de los indicadores de supervisión'),
                           (N'ACT_SUPERVISION_BOLETIN_CREAR', N'Cargar valores del boletín'),
                           (N'ACT_SUPERVISION_BOLETIN_MODIFICAR', N'Modificar valores del boletín'),
                           (N'ACT_SUPERVISION_BOLETIN_ELIMINAR', N'Retirar valores del boletín');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-244 · Porttos · Indicadores de supervisión', 1, NULL, @ahora, NULL, @ahora
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

PRINT CONCAT('Módulo creado: ', @modulos, ' · filas de paquete (Capas del mapa e Indicadores): ', @paquetes, ' · actividades creadas: ', @creadas,
             ' · asignadas al ADMINISTRADOR de Porttos: ', @asignadas);
IF @paquetes = 0 AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ WHERE codigoModulo = @modulo)
  PRINT N'⚠ Ningún módulo hermano está en un paquete: asigne Capas del mapa e Indicadores de supervisión a los paquetes de Porttos en Paquetes › Módulos.';
