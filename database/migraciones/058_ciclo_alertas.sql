/*
  PORTTOS · Migración 058 · Centro de alertas y ciclo de vida (OT-037 paso 6, CC-250; propuesta aprobada por el usuario 2026-11-19)
  Cada alerta del mapa pasa por: NUEVA → RECONOCIDA → EN_GESTION → ESCALADA → CERRADA (RESUELTA o DESCARTADA), con quién, cuándo y nota.
  Escala sola si nadie la reconoce a tiempo (por defecto 15 min las rojas y 60 min las amarillas; las informativas no escalan; configurable
  por regla y puerto en TCL_ConfigAlertas.escalar_min) y avisa con push a quien tenga ACT_ALERTAS_SUPERVISAR (decisión 2026-11-19).
  Qué hace (idempotente; no borra nada):
    1. TCL_AlertasMapa: estado (NUEVA), cierre, asignado_a, fechas de reconocida, escalada y cerrada, y quién reconoció y cerró.
    2. TCL_AlertasHistorial: cada paso de cada alerta (estado anterior y nuevo, usuario o SISTEMA, nota, fecha).
    3. TCL_SilenciosAlertas: silenciar por puerto, categoría y entidad (opcional) hasta una hora, con motivo y quién; una alerta silenciada
       se guarda igual pero no escala ni avisa.
    4. TCL_ConfigAlertas.escalar_min (NULL = el defecto por nivel; 0 = no escalar).
    5. ACT_ALERTAS_GESTIONAR, ACT_ALERTAS_SILENCIAR y ACT_ALERTAS_SUPERVISAR (en el módulo de ACT_ALERTAS_REGLAS) al ADMINISTRADOR de Porttos.
  Requiere la 011. Va antes del API con /api/centro-alertas y del job alertas-escalamiento (sin ella el API responde 503 y el job no hace nada).
  Reversa: estadoActividad = 0 de las tres actividades; las columnas y tablas nuevas no estorban.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.TCL_AlertasMapa', N'U') IS NULL OR OBJECT_ID(N'dbo.TCL_ConfigAlertas', N'U') IS NULL
BEGIN
  RAISERROR('Falta la 011 (TCL_AlertasMapa y TCL_ConfigAlertas). Córrala primero.', 16, 1);
  RETURN;
END

DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

-- 1. Ciclo de vida en la bitácora
IF COL_LENGTH(N'dbo.TCL_AlertasMapa', N'estado') IS NULL
  ALTER TABLE dbo.TCL_AlertasMapa ADD estado NVARCHAR(12) NOT NULL CONSTRAINT DF_TCL_AlertasMapa_estado DEFAULT (N'NUEVA');
IF COL_LENGTH(N'dbo.TCL_AlertasMapa', N'cierre') IS NULL
  ALTER TABLE dbo.TCL_AlertasMapa ADD cierre NVARCHAR(12) NULL;                    -- RESUELTA | DESCARTADA
IF COL_LENGTH(N'dbo.TCL_AlertasMapa', N'asignado_a') IS NULL
  ALTER TABLE dbo.TCL_AlertasMapa ADD asignado_a NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.TCL_AlertasMapa', N'fecha_reconocida') IS NULL
  ALTER TABLE dbo.TCL_AlertasMapa ADD fecha_reconocida NVARCHAR(100) NULL, reconocida_por NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.TCL_AlertasMapa', N'fecha_escalada') IS NULL
  ALTER TABLE dbo.TCL_AlertasMapa ADD fecha_escalada NVARCHAR(100) NULL;
IF COL_LENGTH(N'dbo.TCL_AlertasMapa', N'fecha_cerrada') IS NULL
  ALTER TABLE dbo.TCL_AlertasMapa ADD fecha_cerrada NVARCHAR(100) NULL, cerrada_por NVARCHAR(200) NULL;
PRINT N'✔ TCL_AlertasMapa con ciclo de vida';

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_AlertasMapa_Estado' AND object_id = OBJECT_ID(N'dbo.TCL_AlertasMapa'))
  EXEC(N'CREATE INDEX IX_TCL_AlertasMapa_Estado ON dbo.TCL_AlertasMapa (estado, fecha) INCLUDE (id_puerto, nivel, categoria, entidad)');

-- 2. Historial
IF OBJECT_ID(N'dbo.TCL_AlertasHistorial', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_AlertasHistorial (
    id               BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_AlertasHistorial PRIMARY KEY,
    id_alerta        BIGINT         NOT NULL,   -- TCL_AlertasMapa.id
    estado_anterior  NVARCHAR(12)   NULL,
    estado_nuevo     NVARCHAR(12)   NOT NULL,
    cierre           NVARCHAR(12)   NULL,
    codigoUsuario    NVARCHAR(200)  NOT NULL,   -- SISTEMA si escaló solo
    nota             NVARCHAR(500)  NULL,
    fecha            NVARCHAR(100)  NOT NULL
  );
  CREATE INDEX IX_TCL_AlertasHistorial_Alerta ON dbo.TCL_AlertasHistorial (id_alerta, fecha);
  PRINT N'✔ TCL_AlertasHistorial';
END

-- 3. Silencios
IF OBJECT_ID(N'dbo.TCL_SilenciosAlertas', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_SilenciosAlertas (
    id                    INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_SilenciosAlertas PRIMARY KEY,
    id_puerto             NVARCHAR(50)   NOT NULL,
    categoria             NVARCHAR(40)   NOT NULL,
    entidad               NVARCHAR(200)  NULL,      -- NULL = toda la categoría en el puerto
    hasta                 NVARCHAR(100)  NOT NULL,  -- ISO UTC
    motivo                NVARCHAR(300)  NOT NULL,
    codigoUsuario         NVARCHAR(200)  NOT NULL,
    fecha                 NVARCHAR(100)  NOT NULL,
    terminado_por         NVARCHAR(200)  NULL       -- quien lo terminó antes de tiempo (hasta queda en ese momento)
  );
  CREATE INDEX IX_TCL_SilenciosAlertas_Puerto ON dbo.TCL_SilenciosAlertas (id_puerto, hasta);
  PRINT N'✔ TCL_SilenciosAlertas';
END

-- 4. Escalamiento por regla y puerto
IF COL_LENGTH(N'dbo.TCL_ConfigAlertas', N'escalar_min') IS NULL
BEGIN
  ALTER TABLE dbo.TCL_ConfigAlertas ADD escalar_min INT NULL;   -- NULL = defecto por nivel (rojas 15, amarillas 60); 0 = no escalar
  PRINT N'✔ TCL_ConfigAlertas.escalar_min';
END

-- 5. Actividades
DECLARE @modulo NVARCHAR(200) = (SELECT TOP (1) codigoModulo FROM dbo.PTL_Actividades WHERE llavePermiso = N'ACT_ALERTAS_REGLAS');
DECLARE @tipo NVARCHAR(200) = (SELECT TOP (1) codigoTipoActividad FROM dbo.PTL_Actividades WHERE llavePermiso = N'ACT_ALERTAS_REGLAS');
IF @modulo IS NULL
BEGIN
  RAISERROR('Se hicieron las tablas, pero no está la actividad ACT_ALERTAS_REGLAS (033). Revise la base.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_ALERTAS_GESTIONAR', N'Reconocer, tomar, escalar y cerrar alertas del mapa'),
                           (N'ACT_ALERTAS_SILENCIAR', N'Silenciar alertas del mapa'),
                           (N'ACT_ALERTAS_SUPERVISAR', N'Recibir las alertas escaladas');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipo, n.llavePermiso, n.actividad,
       N'CC-250 · Porttos · Centro de alertas', 1, NULL, @ahora, NULL, @ahora
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

PRINT CONCAT('Actividades creadas: ', @creadas, ' · asignadas al ADMINISTRADOR de Porttos: ', @asignadas);
