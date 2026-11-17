/*
  PORTTOS · Migración 051 · Puntos de control, fase 1 (CC-231, propuesta aprobada por el usuario 2026-11-16)
  Una infraestructura con geocerca + métricas activas = punto de control. Los calculadores (formas de medir) viven en el código
  (apps/porttos/utils/puntos-control); las métricas se crean en Administración › Métricas de control.
  Qué hace (idempotente; no borra nada):
    1. TCL_MetricasControl: métricas (código único, nombre, calculador, parámetros JSON, unidad, sentido, umbrales por defecto, ventana,
       tipos sugeridos separados por |, activo, auditoría) + 10 métricas iniciales que el usuario puede editar o inactivar.
    2. TCL_InfraestructuraMetricas: qué métricas están activas en cada infraestructura, con umbrales propios opcionales y si avisan.
    3. TCL_LecturasPuntoControl: cada cálculo del motor (valor, estado, hora del dato, simulado, fuente); el motor depura a 30 días.
    4. Menú «Métricas de control» de Porttos (/porttos/metricas-control-panel, translateKey METRICAS_CONTROL), hermano de Faros.
    5. ACT_METRICAS_CREAR / MODIFICAR / ELIMINAR al ROLE_ADMINISTRADOR de Porttos. Asignar métricas a una infraestructura usa
       ACT_INFRA_MODIFICAR (ya existe).
  Requiere la 038 (tablas PTL_). Va antes del API con /api/metricas-control (sin ella ese API responde 503).
  Reversa: estadoModulo = 0 del módulo y estadoActividad = 0 de las tres actividades; las tablas nuevas no estorban.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL OR OBJECT_ID(N'dbo.TCL_MaestroInfraestructura', N'U') IS NULL
BEGIN
  RAISERROR('Faltan las tablas PTL_ (038) o TCL_MaestroInfraestructura. Revise la base.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

-- 1. Métricas
IF OBJECT_ID(N'dbo.TCL_MetricasControl', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_MetricasControl (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_MetricasControl PRIMARY KEY,
    codigo                    NVARCHAR(40)   NOT NULL CONSTRAINT UQ_TCL_MetricasControl_codigo UNIQUE,
    nombre                    NVARCHAR(120)  NOT NULL,
    descripcion               NVARCHAR(400)  NULL,
    calculador                NVARCHAR(40)   NOT NULL,
    parametros                NVARCHAR(1000) NULL,      -- JSON validado por el núcleo según el calculador
    unidad                    NVARCHAR(20)   NOT NULL,
    sentido                   NVARCHAR(12)   NOT NULL,  -- MAYOR_PEOR | MENOR_PEOR
    umbral_amarillo           DECIMAL(14,2)  NULL,
    umbral_rojo               DECIMAL(14,2)  NULL,
    ventana_min               INT            NOT NULL CONSTRAINT DF_TCL_MetricasControl_ventana DEFAULT (15),
    tipos_sugeridos           NVARCHAR(1000) NULL,      -- codigo_tipo de TCL_TiposInfraestructura separados por |; NULL = todos
    activo                    BIT            NOT NULL CONSTRAINT DF_TCL_MetricasControl_activo DEFAULT (1),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL
  );
  PRINT N'✔ TCL_MetricasControl';
END

MERGE dbo.TCL_MetricasControl AS d
USING (VALUES
  (N'SATURACION', N'Saturación', N'Ocupación sobre capacidad del nodo ligado o de la bodega', N'SATURACION', N'{}', N'%', N'MAYOR_PEOR', 80, 95, 15),
  (N'FLUJO_ENTRADA', N'Flujo de entrada', N'Camiones que entran por hora', N'FLUJO_CAMIONES', N'{"sentido":"ENTRADA"}', N'camiones/h', N'MAYOR_PEOR', NULL, NULL, 15),
  (N'FLUJO_SALIDA', N'Flujo de salida', N'Camiones que salen por hora', N'FLUJO_CAMIONES', N'{"sentido":"SALIDA"}', N'camiones/h', N'MENOR_PEOR', NULL, NULL, 15),
  (N'ESPERA', N'Espera para entrar', N'Minutos de espera de los camiones', N'ESPERA', N'{}', N'min', N'MAYOR_PEOR', 60, 120, 15),
  (N'CAMIONES_DENTRO', N'Camiones dentro', N'Camiones dentro de la geocerca ahora', N'CONTEO_CAMIONES', N'{}', N'camiones', N'MAYOR_PEOR', 20, 50, 5),
  (N'EXCESO_VELOCIDAD', N'Exceso de velocidad', N'Camiones dentro de la geocerca a más de 20 km/h', N'CONTEO_CAMIONES', N'{"velocidad_min_kmh":20}', N'camiones', N'MAYOR_PEOR', 1, 3, 5),
  (N'NAVES_DENTRO', N'Naves dentro', N'Naves (AIS) dentro de la geocerca ahora', N'CONTEO_NAVES', N'{}', N'naves', N'MAYOR_PEOR', NULL, NULL, 15),
  (N'NAVES_FONDEADAS', N'Naves detenidas', N'Naves dentro de la geocerca a menos de 1 nudo', N'CONTEO_NAVES', N'{"velocidad_max_nudos":1}', N'naves', N'MAYOR_PEOR', NULL, NULL, 15),
  (N'EVENTO_VIAL_CERCA', N'Evento vial cerca', N'Eventos viales vigentes a menos de 2 km', N'EVENTOS_VIALES_CERCA', N'{"distancia_m":2000,"severidad_min":1}', N'eventos', N'MAYOR_PEOR', 1, 2, 15),
  (N'ANTIGUEDAD_OCUPACION', N'Antigüedad del dato de ocupación', N'Minutos desde la última foto de ocupación', N'ANTIGUEDAD_DATO', N'{"fuente":"OCUPACION"}', N'min', N'MAYOR_PEOR', 30, 60, 15)
) AS o (codigo, nombre, descripcion, calculador, parametros, unidad, sentido, umbral_amarillo, umbral_rojo, ventana_min)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, nombre, descripcion, calculador, parametros, unidad, sentido, umbral_amarillo, umbral_rojo, ventana_min,
  tipos_sugeridos, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.nombre, o.descripcion, o.calculador, o.parametros, o.unidad, o.sentido, o.umbral_amarillo, o.umbral_rojo, o.ventana_min,
  NULL, 1, N'MIGRACION_051', @ahora, N'MIGRACION_051', @ahora);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' métricas iniciales');

-- 2. Asignación por infraestructura
IF OBJECT_ID(N'dbo.TCL_InfraestructuraMetricas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_InfraestructuraMetricas (
    id                        INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_InfraestructuraMetricas PRIMARY KEY,
    id_infraestructura        INT            NOT NULL,
    id_metrica                INT            NOT NULL CONSTRAINT FK_TCL_InfraestructuraMetricas_metrica REFERENCES dbo.TCL_MetricasControl (id),
    activa                    BIT            NOT NULL CONSTRAINT DF_TCL_InfraestructuraMetricas_activa DEFAULT (1),
    umbral_amarillo           DECIMAL(14,2)  NULL,      -- NULL = el de la métrica
    umbral_rojo               DECIMAL(14,2)  NULL,
    alerta                    BIT            NOT NULL CONSTRAINT DF_TCL_InfraestructuraMetricas_alerta DEFAULT (0),
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             NVARCHAR(100)  NULL,
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         NVARCHAR(100)  NULL,
    CONSTRAINT UQ_TCL_InfraestructuraMetricas UNIQUE (id_infraestructura, id_metrica)
  );
  PRINT N'✔ TCL_InfraestructuraMetricas';
END

-- 3. Lecturas
IF OBJECT_ID(N'dbo.TCL_LecturasPuntoControl', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_LecturasPuntoControl (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_LecturasPuntoControl PRIMARY KEY,
    id_infraestructura  INT            NOT NULL,
    id_metrica          INT            NOT NULL,
    fecha               NVARCHAR(100)  NOT NULL,   -- cuándo calculó el motor (ISO UTC)
    valor               DECIMAL(14,2)  NULL,       -- NULL = sin dato
    estado              NVARCHAR(12)   NOT NULL,   -- NORMAL | ATENCION | CRITICO | SIN_DATO
    fecha_dato          NVARCHAR(100)  NULL,       -- hora del dato de la fuente
    simulado            BIT            NOT NULL CONSTRAINT DF_TCL_LecturasPuntoControl_simulado DEFAULT (0),
    fuente              NVARCHAR(60)   NOT NULL
  );
  CREATE INDEX IX_TCL_LecturasPuntoControl_Infra_Fecha ON dbo.TCL_LecturasPuntoControl (id_infraestructura, fecha)
    INCLUDE (id_metrica, valor, estado, fecha_dato, simulado);
  PRINT N'✔ TCL_LecturasPuntoControl';
END

DECLARE @faros NVARCHAR(200) = N'733e3cfb-db6e-4eba-baa3-456d18c62u5oi';   -- Porttos › Administración › Faros
DECLARE @modulo NVARCHAR(200) = N'c7b84803-7f88-4fa3-b81b-20bcfab0c361';  -- Porttos › Administración › Métricas de control (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP WHERE codigoModulo = @faros)
BEGIN
  RAISERROR('Se hicieron las tablas, pero no está el módulo Porttos › Faros (hermano del menú nuevo). Revise la base.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 2. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Métricas de control', m.precioModulo, N'/porttos/metricas-control-panel',
       N'CC-231 · Métricas de los puntos de control (calculador, parámetros, umbrales, tipos sugeridos)',
       0, N'', N'METRICAS_CONTROL', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @faros
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
WHERE pq.codigoModulo = @faros
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 3. Actividades
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_METRICAS_CREAR', N'Crear métricas de control'), (N'ACT_METRICAS_MODIFICAR', N'Modificar métricas de control'),
                           (N'ACT_METRICAS_ELIMINAR', N'Inactivar métricas de control');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-231 · Porttos · Métricas de control', 1, NULL, @ahora, NULL, @ahora
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
