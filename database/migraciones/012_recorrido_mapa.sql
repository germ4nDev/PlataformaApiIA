/*
  PORTTOS · Migración 012 · Recorrido del mapa (modo reproducir)
  Qué hace (idempotente, se puede correr varias veces):
    1. dbo.TCL_RecorridoMapa: muestras de posición de naves (AIS) y camiones (flota terrestre).
       El proceso 'recorrido-muestreo' guarda una muestra por minuto solo de lo que cambió
       (se movió más de 30 m, cambió de estado o lleva 10 min sin muestra), así una nave
       fondeada no llena la tabla.
    2. Índice por fecha con las columnas que lee el modo reproducir (rango de horas + caja del puerto).
  Fechas en NVARCHAR(100) ISO 8601 UTC, como el resto de Porttos (ordenan bien como texto).
  Retención: el proceso 'recorrido-limpieza' borra las muestras de más de 3 días
  (RECORRIDO_RETENCION_DIAS en el .env para cambiarlo).
  El API funciona antes de correrla: el muestreo se apaga solo y el modo reproducir avisa que falta.
  Reversa: DROP TABLE dbo.TCL_RecorridoMapa;
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

IF OBJECT_ID(N'dbo.TCL_RecorridoMapa', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_RecorridoMapa (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_RecorridoMapa PRIMARY KEY,
    tipo        NVARCHAR(10)  NOT NULL,   -- NAVE | CAMION
    id_objeto   NVARCHAR(30)  NOT NULL,   -- MMSI o placa
    nombre      NVARCHAR(100) NULL,
    latitud     FLOAT         NOT NULL,
    longitud    FLOAT         NOT NULL,
    rumbo       SMALLINT      NULL,
    velocidad   DECIMAL(6,1)  NULL,
    estado      NVARCHAR(30)  NULL,       -- estado AIS inferido (naves) o EN_RUTA / DETENIDO (camiones)
    fecha       NVARCHAR(100) NOT NULL    -- ISO 8601 UTC
  );
  PRINT 'Creada dbo.TCL_RecorridoMapa';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_RecorridoMapa_Fecha' AND object_id = OBJECT_ID(N'dbo.TCL_RecorridoMapa'))
  CREATE INDEX IX_TCL_RecorridoMapa_Fecha ON dbo.TCL_RecorridoMapa (fecha)
    INCLUDE (tipo, id_objeto, nombre, latitud, longitud, rumbo, velocidad, estado);

COMMIT TRANSACTION;
PRINT N'✔ Migración 012 aplicada. Reinicia el API para que el muestreo empiece a guardar.';
