/*
  PORTTOS · Migración 063 · Nivel de los tanques de GNL en el tiempo (CC-301, OT-038; usuario 2026-11-21: «termina lo de GNL»)
  El pronóstico de GNL (inventario contra demanda y llegadas) necesita el nivel de cada tanque guardado, no solo el pulso en vivo.
  Una fila por tanque y por foto (cada 5 min del simulador o cuando la terminal la envíe por la ingesta «niveles-gnl»), con lo que entró
  (descarga de metaneros) y salió (envío a la red y BOG) desde la foto anterior. Lo simulado va con simulado = 1 y fuente SIMULADOR.
  Las llegadas de metaneros van en TCL_OperacionesBuque con segmento GNL (sin cambio de esquema: segmento es texto).
  Qué hace (idempotente; no borra nada):
    1. TCL_NivelTanquesGNL con clave única (id_tanque, fecha) e índice por puerto y fecha.
  Requiere 048 (TCL_MaestroTanques). Va antes del API con el pronóstico de GNL (sin ella ese API responde 503 y el simulador no la llena).
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

IF OBJECT_ID(N'dbo.TCL_NivelTanquesGNL', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_NivelTanquesGNL (
    id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_NivelTanquesGNL PRIMARY KEY,
    id_puerto     NVARCHAR(50)   NOT NULL,
    id_tanque     NVARCHAR(36)   NOT NULL,     -- TCL_MaestroTanques.id_tanque (texto; sin llave foránea, regla 26)
    codigo_tanque NVARCHAR(50)   NOT NULL,
    fecha         NVARCHAR(30)   NOT NULL,     -- ISO UTC de la foto
    nivel_m3      FLOAT          NOT NULL,
    nivel_pct     FLOAT          NOT NULL,     -- sobre capacidad_maxima_m3
    entrada_m3    FLOAT          NULL,         -- descargado al tanque desde la foto anterior
    salida_m3     FLOAT          NULL,         -- enviado a la red + BOG desde la foto anterior
    fuente        NVARCHAR(40)   NOT NULL CONSTRAINT DF_TCL_NivelTanquesGNL_Fuente DEFAULT (N'INGESTA_API'),
    simulado      BIT            NOT NULL CONSTRAINT DF_TCL_NivelTanquesGNL_Simulado DEFAULT (0)
  );
  CREATE UNIQUE INDEX UX_TCL_NivelTanquesGNL_Tanque_Fecha ON dbo.TCL_NivelTanquesGNL (id_tanque, fecha);
  CREATE INDEX IX_TCL_NivelTanquesGNL_Puerto ON dbo.TCL_NivelTanquesGNL (id_puerto, fecha) INCLUDE (id_tanque, nivel_m3, nivel_pct, salida_m3, entrada_m3, simulado);
  PRINT N'✔ TCL_NivelTanquesGNL';
END
ELSE PRINT N'TCL_NivelTanquesGNL ya existe';
