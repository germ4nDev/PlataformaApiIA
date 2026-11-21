/*
  PORTTOS · Migración 061 · Registro de decisiones de la capa de prevención (CC-274; Fase B, propuesta aprobada por el usuario 2026-11-20)
  Cada acción propuesta para que un terminal no se sature (mover un atraque, pasarlo a otro muelle, adelantar un zarpe) que alguien aprueba
  o descarta queda aquí, con el efecto que Porttos calculó en ese momento y la hora del cruce pronosticado. Porttos no cambia el line-up:
  la decisión la ejecuta la terminal o la agencia. `resultado` lo llena la Fase C al llegar el horizonte (SE_CUMPLIO | SE_EVITO | FALSA_ALARMA).
  Qué hace (idempotente; no borra nada):
    1. TCL_DecisionesPrevencion con índice por puerto y fecha.
  Requiere solo la base plataformaBD. Va antes del API con /api/prevencion (sin ella ese API responde 503).
  Reversa: la tabla no estorba; para retirarla, renombrarla.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF OBJECT_ID(N'dbo.TCL_DecisionesPrevencion', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_DecisionesPrevencion (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_DecisionesPrevencion PRIMARY KEY,
    id_puerto           NVARCHAR(50)   NOT NULL,
    tipo                NVARCHAR(30)   NOT NULL,     -- MUELLES (corredor vial y otros, después)
    entidad             NVARCHAR(200)  NOT NULL,     -- id del terminal (MUELLES)
    acciones            NVARCHAR(MAX)  NOT NULL,     -- JSON: [{ tipo, terminal, muelle, motonave?, horas?, aTerminal?, aMuelle? }]
    efecto              NVARCHAR(MAX)  NULL,         -- JSON: antes y después por terminal (cruce crítico y ocupación máxima)
    decision            NVARCHAR(12)   NOT NULL,     -- APROBADA | DESCARTADA
    nota                NVARCHAR(500)  NULL,
    cruce_hora          NVARCHAR(100)  NULL,         -- ISO UTC: cuándo cruzaba el crítico sin la acción
    resultado           NVARCHAR(20)   NULL,         -- Fase C: SE_CUMPLIO | SE_EVITO | FALSA_ALARMA
    simulado            BIT            NOT NULL CONSTRAINT DF_TCL_DecisionesPrevencion_Simulado DEFAULT (0),
    codigoUsuario       NVARCHAR(200)  NOT NULL,
    fecha               NVARCHAR(100)  NOT NULL      -- ISO UTC
  );
  CREATE INDEX IX_TCL_DecisionesPrevencion_Puerto ON dbo.TCL_DecisionesPrevencion (id_puerto, fecha);
  PRINT N'✔ TCL_DecisionesPrevencion';
END
ELSE PRINT N'TCL_DecisionesPrevencion ya existe';
