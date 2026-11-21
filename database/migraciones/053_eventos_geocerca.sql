/*
  PORTTOS · Migración 053 · Entradas y salidas en las geocercas: permanencia de camiones y naves (CC-240, fase 2 de puntos de control)
  Qué hace (idempotente; no borra nada):
    1. TCL_EventosGeocerca: una fila por estadía de un camión (placa) o una nave (MMSI) dentro de la geocerca de una infraestructura.
       El motor de puntos de control (cada 5 min) abre la estadía cuando lo ve dentro (entrada = última vista), la mantiene viva
       (última vista) mientras siga dentro y la cierra cuando ya no está (salida = su última vista). Solo para las infraestructuras con
       una métrica de permanencia activa y solo con la fuente fresca (flota ≤ 15 min, AIS ≤ 30 min): un hueco de datos no cierra nada.
       El motor depura las estadías cerradas de más de 30 días.
    2. Dos métricas iniciales en TCL_MetricasControl (editables en Administración › Métricas de control):
       PERMANENCIA_CAMIONES (horas del camión que más lleva dentro; 2 / 4 h) y PERMANENCIA_NAVES (horas de la nave detenida que más
       lleva dentro, a menos de 1 nudo; 12 / 24 h).
  La permanencia cuenta desde la primera vez que el motor vio el objeto dentro: las primeras horas tras correrla quedan cortas.
  Requiere la 051. Va antes del API del CC-240 (sin ella las métricas de permanencia dan «Sin dato»).
  Reversa: UPDATE dbo.TCL_MetricasControl SET activo = 0 WHERE codigoUsuarioCreacion = N'MIGRACION_053'; la tabla nueva no estorba.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_MetricasControl', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 051 (puntos de control).', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(100) = FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd\THH:mm:ss.fff\Z');

-- 1. Estadías
IF OBJECT_ID(N'dbo.TCL_EventosGeocerca', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_EventosGeocerca (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_EventosGeocerca PRIMARY KEY,
    id_infraestructura  INT            NOT NULL,
    objeto              NVARCHAR(10)   NOT NULL CONSTRAINT CK_TCL_EventosGeocerca_objeto CHECK (objeto IN (N'CAMION', N'NAVE')),
    identificador       NVARCHAR(40)   NOT NULL,   -- placa del camión o MMSI de la nave
    entrada             NVARCHAR(100)  NOT NULL,   -- primera vez que el motor lo vio dentro (ISO UTC)
    ultima_vista        NVARCHAR(100)  NOT NULL,   -- última vez que lo vio dentro (ISO UTC)
    salida              NVARCHAR(100)  NULL,       -- NULL = sigue dentro; al cerrar = su última vista
    simulado            BIT            NOT NULL CONSTRAINT DF_TCL_EventosGeocerca_simulado DEFAULT (0)
  );
  CREATE INDEX IX_TCL_EventosGeocerca_Abiertas ON dbo.TCL_EventosGeocerca (objeto, id_infraestructura)
    INCLUDE (identificador, entrada, ultima_vista) WHERE salida IS NULL;
  CREATE INDEX IX_TCL_EventosGeocerca_Infra_Entrada ON dbo.TCL_EventosGeocerca (id_infraestructura, entrada)
    INCLUDE (objeto, identificador, salida, simulado);
  PRINT N'✔ TCL_EventosGeocerca';
END

-- 2. Métricas iniciales de permanencia
MERGE dbo.TCL_MetricasControl AS d
USING (VALUES
  (N'PERMANENCIA_CAMIONES', N'Permanencia de camiones', N'Horas del camión que más lleva dentro de la geocerca', N'PERMANENCIA_CAMIONES', N'{"medida":"MAXIMO"}', N'h', N'MAYOR_PEOR', 2, 4, 15),
  (N'PERMANENCIA_NAVES', N'Permanencia de naves detenidas', N'Horas de la nave a menos de 1 nudo que más lleva dentro de la geocerca', N'PERMANENCIA_NAVES', N'{"medida":"MAXIMO","velocidad_max_nudos":1}', N'h', N'MAYOR_PEOR', 12, 24, 15)
) AS o (codigo, nombre, descripcion, calculador, parametros, unidad, sentido, umbral_amarillo, umbral_rojo, ventana_min)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, nombre, descripcion, calculador, parametros, unidad, sentido, umbral_amarillo, umbral_rojo, ventana_min,
  tipos_sugeridos, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.nombre, o.descripcion, o.calculador, o.parametros, o.unidad, o.sentido, o.umbral_amarillo, o.umbral_rojo, o.ventana_min,
  NULL, 1, N'MIGRACION_053', @ahora, N'MIGRACION_053', @ahora);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' métricas de permanencia');

SELECT codigo, nombre, calculador, parametros, umbral_amarillo, umbral_rojo, activo FROM dbo.TCL_MetricasControl
WHERE calculador IN (N'PERMANENCIA_CAMIONES', N'PERMANENCIA_NAVES');
