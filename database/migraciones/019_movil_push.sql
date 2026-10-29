/*
  PORTTOS · Migración 019 · App móvil, fase 3: notificaciones push
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_DispositivosMovil  Un teléfono o tableta registrado para recibir notificaciones: token de FCM (Android y,
                                  vía Firebase, iOS), plataforma, usuario y sesión con que se registró, preferencias
                                  (puertos: 'TODOS' o lista separada por comas; severidad mínima: critica | atencion) e idioma.
                                  Solo recibe notificaciones el dispositivo cuya sesión sigue activa en PTLSesiones:
                                  como el usuario tiene una sola sesión sin importar el dispositivo, al entrar en otro
                                  equipo el anterior deja de recibirlas.
    2. dbo.TCL_PushEnvios         Bitácora de envíos (hallazgo, puerto, dispositivo, resultado), para el panel y para
                                  no repetir la misma alerta al mismo dispositivo.
  El API funciona antes de correrla: el registro responde 503 (MIGRACION_PENDIENTE) con el nombre de esta migración y no se envían notificaciones.
  Reversa: DROP TABLE dbo.TCL_PushEnvios; DROP TABLE dbo.TCL_DispositivosMovil;
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

IF OBJECT_ID(N'dbo.TCL_DispositivosMovil', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_DispositivosMovil (
    id                BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_DispositivosMovil PRIMARY KEY,
    token             NVARCHAR(400) NOT NULL,
    plataforma        NVARCHAR(10)  NOT NULL,          -- android | ios
    codigoUsuario     NVARCHAR(100) NOT NULL,
    codigoSesion      NVARCHAR(100) NULL,
    puertos           NVARCHAR(400) NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_puertos DEFAULT (N'TODOS'),
    severidadMinima   NVARCHAR(10)  NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_sev DEFAULT (N'critica'),
    idioma            NVARCHAR(5)   NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_idioma DEFAULT (N'es'),
    activo            BIT           NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_activo DEFAULT (1),
    fallos            INT           NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_fallos DEFAULT (0),
    fechaRegistro     DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_reg DEFAULT (SYSUTCDATETIME()),
    fechaModificacion DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_DispositivosMovil_mod DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_TCL_DispositivosMovil_token UNIQUE (token),
    CONSTRAINT CK_TCL_DispositivosMovil_plataforma CHECK (plataforma IN (N'android', N'ios')),
    CONSTRAINT CK_TCL_DispositivosMovil_sev CHECK (severidadMinima IN (N'critica', N'atencion'))
  );
  CREATE INDEX IX_TCL_DispositivosMovil_Usuario ON dbo.TCL_DispositivosMovil (codigoUsuario, activo) INCLUDE (codigoSesion);
  PRINT N'✔ Creada dbo.TCL_DispositivosMovil';
END
ELSE PRINT N'· dbo.TCL_DispositivosMovil ya existe';

IF OBJECT_ID(N'dbo.TCL_PushEnvios', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_PushEnvios (
    id             BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PushEnvios PRIMARY KEY,
    idDispositivo  BIGINT        NOT NULL,
    idHallazgo     BIGINT        NULL,
    puerto         NVARCHAR(40)  NULL,
    tipo           NVARCHAR(20)  NOT NULL,          -- ia-alerta | prueba
    estado         NVARCHAR(15)  NOT NULL,          -- ENVIADO | ERROR | TOKEN_INVALIDO
    error          NVARCHAR(300) NULL,
    fecha          DATETIME2(0)  NOT NULL CONSTRAINT DF_TCL_PushEnvios_fecha DEFAULT (SYSUTCDATETIME())
  );
  CREATE INDEX IX_TCL_PushEnvios_Hallazgo ON dbo.TCL_PushEnvios (idHallazgo, idDispositivo);
  CREATE INDEX IX_TCL_PushEnvios_Fecha ON dbo.TCL_PushEnvios (fecha);
  PRINT N'✔ Creada dbo.TCL_PushEnvios';
END
ELSE PRINT N'· dbo.TCL_PushEnvios ya existe';

COMMIT TRANSACTION;
PRINT N'Migración 019 lista.';
