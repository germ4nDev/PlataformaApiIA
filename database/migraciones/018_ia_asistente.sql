/*
  PORTTOS · Migración 018 · Capa de análisis con IA, fase 5: asistente y marco de alcance
  Requiere la 015. Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_IAPreguntas  Cada pregunta al asistente: usuario, puerto, decisión de alcance (dentro | frontera | fuera)
                            y de dónde salió (reglas | filtro | asistente | sin_filtro), respuesta, fuentes, herramientas
                            usadas, verificación de cifras, ejecuciones (asistente y filtro), voto «útil» y latencia.
                            Sirve para el tope por usuario, el panel (preguntas rechazadas y de frontera) y para afinar
                            el marco de alcance.
    2. dbo.TCL_IAAlcance    Ajustes al marco de alcance incorporado (utils/ia/alcance.js): una fila con el mismo
                            código reemplaza el tema, una nueva lo agrega y activo = 0 lo apaga. Vacía = el incorporado.
  El API funciona antes de correrla: el asistente responde, pero no guarda las preguntas, no aplica el tope por
  usuario y el marco no se puede editar.
  Reversa: DROP TABLE dbo.TCL_IAPreguntas; DROP TABLE dbo.TCL_IAAlcance;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_IAEjecuciones', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 015_analisis_ia.sql: córrela primero.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.TCL_IAPreguntas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAPreguntas (
    id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_IAPreguntas PRIMARY KEY,
    usuario            NVARCHAR(200) NOT NULL,
    puerto             NVARCHAR(40)  NULL,           -- NULL = sin puerto seleccionado (todos)
    pestana            NVARCHAR(60)  NULL,
    pregunta           NVARCHAR(1000) NOT NULL,
    decision           NVARCHAR(10)  NOT NULL,       -- dentro | frontera | fuera
    origenDecision     NVARCHAR(15)  NOT NULL,       -- reglas | filtro | asistente | sin_filtro
    tema               NVARCHAR(40)  NULL,
    motivo             NVARCHAR(200) NULL,
    estado             NVARCHAR(25)  NOT NULL,       -- RESPONDIDA | RECHAZADA | SIN_DATOS | APAGADO | ERROR | OMITIDA_PRESUPUESTO ...
    respuesta          NVARCHAR(MAX) NULL,
    fuentes            NVARCHAR(MAX) NULL,           -- JSON
    herramientas       NVARCHAR(MAX) NULL,           -- JSON: [{ nombre, entrada, ok, ms }]
    verificacion       NVARCHAR(400) NULL,           -- cifras sin respaldo en los datos consultados
    idEjecucion        BIGINT        NULL,
    idEjecucionFiltro  BIGINT        NULL,
    util               BIT           NULL,
    comentario         NVARCHAR(500) NULL,
    latenciaMs         INT           NULL,
    fecha              DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAPreguntas_fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_TCL_IAPreguntas_decision CHECK (decision IN (N'dentro', N'frontera', N'fuera'))
  );
  CREATE INDEX IX_TCL_IAPreguntas_Usuario ON dbo.TCL_IAPreguntas (usuario, fecha);
  CREATE INDEX IX_TCL_IAPreguntas_Fecha ON dbo.TCL_IAPreguntas (fecha) INCLUDE (decision, tema, estado, puerto, util);
  PRINT N'✔ Creada dbo.TCL_IAPreguntas';
END

IF OBJECT_ID(N'dbo.TCL_IAAlcance', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IAAlcance (
    codigo             NVARCHAR(40)  NOT NULL CONSTRAINT PK_TCL_IAAlcance PRIMARY KEY,
    nombre             NVARCHAR(120) NOT NULL,
    ambito             NVARCHAR(10)  NOT NULL,       -- dentro | frontera | fuera
    descripcion        NVARCHAR(600) NOT NULL,
    palabrasClave      NVARCHAR(MAX) NULL,           -- JSON (lista)
    ejemplos           NVARCHAR(MAX) NULL,           -- JSON (lista)
    activo             BIT           NOT NULL CONSTRAINT DF_TCL_IAAlcance_activo DEFAULT (1),
    orden              INT           NULL,
    modificadoPor      NVARCHAR(200) NULL,
    fechaModificacion  DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_IAAlcance_fecha DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT CK_TCL_IAAlcance_ambito CHECK (ambito IN (N'dentro', N'frontera', N'fuera'))
  );
  PRINT N'✔ Creada dbo.TCL_IAAlcance (vacía: se usa el marco incorporado)';
END

COMMIT TRANSACTION;
PRINT N'✔ Migración 018 aplicada. Reinicia el API.';
