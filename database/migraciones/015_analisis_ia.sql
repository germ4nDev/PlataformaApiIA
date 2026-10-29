/*
  PORTTOS · Migración 015 · Capa de análisis con IA (fotos de KPI, prompts, ejecuciones, hallazgos)
  Diseño: documento «Porttos — Capa de análisis con IA».
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_SnapshotsKpi   Valor de cada KPI por puerto cada 15 min (fase 1: historia para señales y tendencias).
    2. dbo.TCL_IAPrompts      Prompts versionados por tarea (fase 2).
    3. dbo.TCL_IAConfig       Encendido, modo sombra, presupuesto y confianza mínima por puerto y tarea (fase 2).
    4. dbo.TCL_IAEjecuciones  Una fila por llamada al modelo: versión, modelo, tokens, costo, latencia, estado (fase 2).
    5. dbo.TCL_IAHallazgos    Alertas tempranas y tendencias con su evidencia y estado (fase 2).
    6. dbo.TCL_IAFeedback     Útil / «no era» de los usuarios (fase 3).
  Fechas en DATETIME2(0) UTC. Retención de fotos: IA_RETENCION_DIAS (90 por defecto), la aplica el job 'ia-limpieza'.
  El API funciona antes de correrla: las fotos se apagan solas y los endpoints de diagnóstico avisan que falta.
  Reversa:
    DROP TABLE dbo.TCL_IAFeedback; DROP TABLE dbo.TCL_IAHallazgos; DROP TABLE dbo.TCL_IAEjecuciones;
    DROP TABLE dbo.TCL_IAConfig; DROP TABLE dbo.TCL_IAPrompts; DROP TABLE dbo.TCL_SnapshotsKpi;
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

-- 1. Fotos de KPI
IF OBJECT_ID(N'dbo.TCL_SnapshotsKpi', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_SnapshotsKpi (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_SnapshotsKpi PRIMARY KEY,
    puerto      NVARCHAR(40)  NOT NULL,
    modulo      NVARCHAR(30)  NOT NULL,   -- maritimo | gate | contenedores | bodegas | granel | suelta | capacidad | viales
    codigoKpi   NVARCHAR(80)  NOT NULL,   -- catálogo en utils/ia/catalogo-kpi.js
    valor       FLOAT         NULL,       -- NULL = sin dato en esa foto
    unidad      NVARCHAR(20)  NULL,
    simulado    BIT           NOT NULL CONSTRAINT DF_TCL_SnapshotsKpi_simulado DEFAULT (0),
    esRespaldo  BIT           NOT NULL CONSTRAINT DF_TCL_SnapshotsKpi_respaldo DEFAULT (0),
    fecha       DATETIME2(0)  NOT NULL    -- UTC, redondeada al cuarto de hora
  );
  CREATE INDEX IX_TCL_SnapshotsKpi_Serie ON dbo.TCL_SnapshotsKpi (puerto, codigoKpi, fecha) INCLUDE (valor, simulado, esRespaldo);
  CREATE UNIQUE INDEX UX_TCL_SnapshotsKpi_Foto ON dbo.TCL_SnapshotsKpi (puerto, codigoKpi, fecha);
  PRINT 'Creada dbo.TCL_SnapshotsKpi';
END

-- 2. Prompts versionados
IF OBJECT_ID(N'dbo.TCL_IAPrompts', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAPrompts (
    id              INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IAPrompts PRIMARY KEY,
    codigoTarea     NVARCHAR(40)  NOT NULL,   -- analista_turno | tendencias | resumen_turno | asistente | filtro
    version         INT           NOT NULL,
    estado          NVARCHAR(15)  NOT NULL CONSTRAINT DF_TCL_IAPrompts_estado DEFAULT (N'BORRADOR'),  -- BORRADOR | ACTIVO | RETIRADO
    modelo          NVARCHAR(80)  NOT NULL,
    temperatura     DECIMAL(3,2)  NOT NULL CONSTRAINT DF_TCL_IAPrompts_temp DEFAULT (0.20),
    maxTokens       INT           NOT NULL CONSTRAINT DF_TCL_IAPrompts_max DEFAULT (2000),
    sistema         NVARCHAR(MAX) NOT NULL,
    ejemplos        NVARCHAR(MAX) NULL,       -- JSON
    esquemaSalida   NVARCHAR(MAX) NOT NULL,   -- JSON Schema de la herramienta de salida
    nota            NVARCHAR(400) NULL,
    creadoPor       NVARCHAR(200) NOT NULL,
    fechaCreacion   DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAPrompts_fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_TCL_IAPrompts_estado CHECK (estado IN (N'BORRADOR', N'ACTIVO', N'RETIRADO'))
  );
  CREATE UNIQUE INDEX UX_TCL_IAPrompts_Version ON dbo.TCL_IAPrompts (codigoTarea, version);
  PRINT 'Creada dbo.TCL_IAPrompts';
END

-- 3. Configuración por puerto y tarea
IF OBJECT_ID(N'dbo.TCL_IAConfig', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAConfig (
    id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IAConfig PRIMARY KEY,
    puerto            NVARCHAR(40)  NOT NULL,   -- '*' = todos
    codigoTarea       NVARCHAR(40)  NOT NULL,
    activo            BIT           NOT NULL CONSTRAINT DF_TCL_IAConfig_activo DEFAULT (0),
    modoSombra        BIT           NOT NULL CONSTRAINT DF_TCL_IAConfig_sombra DEFAULT (1),
    topeTokensDia     INT           NOT NULL CONSTRAINT DF_TCL_IAConfig_tokens DEFAULT (200000),
    topeLlamadasDia   INT           NOT NULL CONSTRAINT DF_TCL_IAConfig_llamadas DEFAULT (96),
    confianzaMinima   DECIMAL(3,2)  NOT NULL CONSTRAINT DF_TCL_IAConfig_conf DEFAULT (0.60),
    fechaModificacion DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAConfig_fecha DEFAULT (SYSUTCDATETIME()),
    modificadoPor     NVARCHAR(200) NULL
  );
  CREATE UNIQUE INDEX UX_TCL_IAConfig ON dbo.TCL_IAConfig (puerto, codigoTarea);
  INSERT INTO dbo.TCL_IAConfig (puerto, codigoTarea) VALUES (N'*', N'analista_turno');
  PRINT 'Creada dbo.TCL_IAConfig (analista_turno apagado y en modo sombra)';
END

-- 4. Ejecuciones (una por llamada al modelo)
IF OBJECT_ID(N'dbo.TCL_IAEjecuciones', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAEjecuciones (
    id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IAEjecuciones PRIMARY KEY,
    codigoTarea      NVARCHAR(40)  NOT NULL,
    puerto           NVARCHAR(40)  NULL,
    idPrompt         INT           NULL,
    proveedor        NVARCHAR(30)  NOT NULL,   -- anthropic | simulador
    modelo           NVARCHAR(80)  NOT NULL,
    tokensEntrada    INT           NULL,
    tokensSalida     INT           NULL,
    tokensCache      INT           NULL,
    costoUsd         DECIMAL(10,5) NULL,
    latenciaMs       INT           NULL,
    hashFoto         CHAR(64)      NULL,
    estado           NVARCHAR(25)  NOT NULL,   -- OK | INVALIDA | ERROR | OMITIDA_PRESUPUESTO | OMITIDA_CACHE | CORTACIRCUITO
    error            NVARCHAR(1000) NULL,
    fecha            DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAEjecuciones_fecha DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_TCL_IAEjecuciones_Fecha ON dbo.TCL_IAEjecuciones (fecha) INCLUDE (codigoTarea, puerto, estado, tokensEntrada, tokensSalida, costoUsd);
  PRINT 'Creada dbo.TCL_IAEjecuciones';
END

-- 5. Hallazgos (alertas tempranas y tendencias)
IF OBJECT_ID(N'dbo.TCL_IAHallazgos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAHallazgos (
    id              BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IAHallazgos PRIMARY KEY,
    idEjecucion     BIGINT        NULL CONSTRAINT FK_TCL_IAHallazgos_Ejecucion REFERENCES dbo.TCL_IAEjecuciones (id),
    puerto          NVARCHAR(40)  NOT NULL,
    clase           NVARCHAR(15)  NOT NULL,   -- ALERTA | TENDENCIA | RESUMEN
    tipo            NVARCHAR(40)  NOT NULL,
    entidad         NVARCHAR(120) NULL,       -- para agrupar duplicados (muelle, nodo, corredor...)
    severidad       NVARCHAR(10)  NULL,       -- info | atencion | critica
    confianza       DECIMAL(3,2)  NULL,
    horizonteMinH   DECIMAL(5,1)  NULL,
    horizonteMaxH   DECIMAL(5,1)  NULL,
    titulo          NVARCHAR(200) NOT NULL,
    explicacion     NVARCHAR(1000) NULL,
    accionSugerida  NVARCHAR(400) NULL,
    evidencia       NVARCHAR(MAX) NULL,       -- JSON: idEvidencia citados
    estado          NVARCHAR(15)  NOT NULL,   -- PROPUESTO | PUBLICADO | CONFIRMADO | DESCARTADO | FALSO
    vigenteHasta    DATETIME2(0)  NULL,
    resultado       NVARCHAR(400) NULL,       -- qué pasó al vencer el horizonte
    fecha           DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAHallazgos_fecha DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_TCL_IAHallazgos_Vigentes ON dbo.TCL_IAHallazgos (puerto, estado, vigenteHasta) INCLUDE (clase, tipo, severidad, confianza, titulo);
  PRINT 'Creada dbo.TCL_IAHallazgos';
END

-- 6. Retroalimentación
IF OBJECT_ID(N'dbo.TCL_IAFeedback', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAFeedback (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IAFeedback PRIMARY KEY,
    idHallazgo  BIGINT        NOT NULL CONSTRAINT FK_TCL_IAFeedback_Hallazgo REFERENCES dbo.TCL_IAHallazgos (id),
    usuario     NVARCHAR(200) NOT NULL,
    util        BIT           NOT NULL,
    comentario  NVARCHAR(500) NULL,
    fecha       DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAFeedback_fecha DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_TCL_IAFeedback_Hallazgo ON dbo.TCL_IAFeedback (idHallazgo);
  PRINT 'Creada dbo.TCL_IAFeedback';
END

COMMIT TRANSACTION;
PRINT N'✔ Migración 015 aplicada. Reinicia el API para que empiecen las fotos de KPI (IA_SNAPSHOTS_ENABLED=true por defecto).';
