/*
  PORTTOS · Migración 011 · Alertas del mapa (fase 2)
  Qué hace (idempotente, se puede correr varias veces):
    1. dbo.TCL_AlertasMapa: bitácora de las alertas emitidas por el motor (sobrevive a reinicios del API
       y sirve para reportes). Fechas en NVARCHAR(100) ISO 8601 UTC, como el resto de Porttos.
    2. dbo.TCL_ConfigAlertas: reglas activas, umbrales y enfriamiento. id_puerto = '*' es la configuración
       global; una fila con un puerto la sobreescribe para ese puerto (ocupación, fondeo, faros, atraque).
       umbral_1..3 según la regla (ver el panel Reglas de alertas o utils/reglas-alertas.js).
    3. Carga los valores por defecto (los mismos del catálogo del API) sin pisar lo que ya exista.
  El API funciona antes de correrla: usa los valores por defecto y la bitácora en memoria.
  Retención: el proceso 'alertas-limpieza' borra las alertas de más de 30 días.
  Reversa: DROP TABLE dbo.TCL_AlertasMapa; DROP TABLE dbo.TCL_ConfigAlertas;
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

IF OBJECT_ID(N'dbo.TCL_AlertasMapa', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_AlertasMapa (
    id          BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_AlertasMapa PRIMARY KEY,
    id_alerta   NVARCHAR(200) NOT NULL,
    id_puerto   NVARCHAR(50)  NOT NULL,
    nivel       NVARCHAR(10)  NOT NULL,   -- info | warning | error
    categoria   NVARCHAR(40)  NOT NULL,   -- peaje | geocerca | proximidad_evento | ocupacion | faro | atraque | zarpe | fondeo
    titulo      NVARCHAR(200) NOT NULL,
    mensaje     NVARCHAR(500) NULL,
    longitud    FLOAT         NULL,
    latitud     FLOAT         NULL,
    entidad     NVARCHAR(200) NULL,
    simulado    BIT           NOT NULL CONSTRAINT DF_TCL_AlertasMapa_simulado DEFAULT (0),
    fecha       NVARCHAR(100) NOT NULL    -- ISO 8601 UTC
  );
  PRINT 'Creada dbo.TCL_AlertasMapa';
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_AlertasMapa_Puerto_Fecha' AND object_id = OBJECT_ID(N'dbo.TCL_AlertasMapa'))
  CREATE INDEX IX_TCL_AlertasMapa_Puerto_Fecha ON dbo.TCL_AlertasMapa (id_puerto, fecha DESC)
    INCLUDE (id_alerta, nivel, categoria, titulo, mensaje, longitud, latitud, entidad, simulado);

IF OBJECT_ID(N'dbo.TCL_ConfigAlertas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_ConfigAlertas (
    codigo_regla          NVARCHAR(40)  NOT NULL,
    id_puerto             NVARCHAR(50)  NOT NULL CONSTRAINT DF_TCL_ConfigAlertas_puerto DEFAULT (N'*'),
    activa                BIT           NOT NULL CONSTRAINT DF_TCL_ConfigAlertas_activa DEFAULT (1),
    umbral_1              DECIMAL(12,2) NULL,
    umbral_2              DECIMAL(12,2) NULL,
    umbral_3              DECIMAL(12,2) NULL,
    enfriamiento_min      INT           NOT NULL,
    descripcion           NVARCHAR(300) NULL,
    fecha_modificacion    NVARCHAR(100) NULL,
    usuario_modificacion  NVARCHAR(100) NULL,
    CONSTRAINT PK_TCL_ConfigAlertas PRIMARY KEY (codigo_regla, id_puerto),
    CONSTRAINT CK_TCL_ConfigAlertas_enfriamiento CHECK (enfriamiento_min BETWEEN 1 AND 1440)
  );
  PRINT 'Creada dbo.TCL_ConfigAlertas';
END

MERGE dbo.TCL_ConfigAlertas AS destino
USING (VALUES
  (N'peaje',             300,  20000, NULL, 10,  N'Camión pasa por un peaje: radio (m) y salto máximo entre posiciones (m)'),
  (N'geocerca',          NULL, NULL,  NULL, 15,  N'Camión entra a una geocerca (rojo si la zona es crítica)'),
  (N'proximidad_evento', 2000, NULL,  NULL, 20,  N'Camión cerca de un evento vial activo: distancia (m)'),
  (N'ocupacion',         80,   95,    75,   30,  N'Ocupación de muelles por terminal: amarillo (%), rojo (%), rearme (%)'),
  (N'faro',              NULL, NULL,  NULL, 30,  N'Nave entra a la zona de un faro con alerta activada'),
  (N'atraque',           NULL, NULL,  NULL, 60,  N'Nave atraca'),
  (N'zarpe',             NULL, NULL,  NULL, 60,  N'Nave desatraca'),
  (N'fondeo',            12,   24,    NULL, 360, N'Nave fondeada mucho tiempo: amarillo (h), rojo (h)')
) AS origen (codigo_regla, umbral_1, umbral_2, umbral_3, enfriamiento_min, descripcion)
ON destino.codigo_regla = origen.codigo_regla AND destino.id_puerto = N'*'
WHEN NOT MATCHED THEN
  INSERT (codigo_regla, id_puerto, activa, umbral_1, umbral_2, umbral_3, enfriamiento_min, descripcion, fecha_modificacion, usuario_modificacion)
  VALUES (origen.codigo_regla, N'*', 1, origen.umbral_1, origen.umbral_2, origen.umbral_3, origen.enfriamiento_min, origen.descripcion,
          CONVERT(NVARCHAR(100), SYSUTCDATETIME(), 127) + 'Z', N'MIGRACION_011');

COMMIT TRANSACTION;

SELECT codigo_regla, id_puerto, activa, umbral_1, umbral_2, umbral_3, enfriamiento_min FROM dbo.TCL_ConfigAlertas ORDER BY codigo_regla, id_puerto;
