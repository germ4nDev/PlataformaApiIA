/*
  PLATAFORMA · Migración 037 · Seguimiento de las bases por suscriptor (OT-030, CC-160)
  Qué hace (idempotente; no borra nada): crea dbo.PTLAprovisionamientos, una fila por suscriptor y aplicación con el estado de su base
  (PENDIENTE, EN_CURSO, LISTA, ERROR), el mensaje del último error, la versión del esquema aplicada y los intentos.
  Va ANTES del API nuevo: al asignar un paquete el API registra aquí las bases que debe crear.
  Además (servidor SQL, no esta base): el usuario con el que se conecta el API (o APROV_DB_USER) necesita permiso para crear bases:
    ALTER SERVER ROLE dbcreator ADD MEMBER [<login del API>];   -- o GRANT CREATE ANY DATABASE TO [<login del API>];  (en master)
  Reversa: DROP TABLE dbo.PTLAprovisionamientos (las bases ya creadas quedan; se ven en sys.databases con su prefijo).
*/
SET NOCOUNT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF OBJECT_ID(N'dbo.PTLAprovisionamientos') IS NULL
BEGIN
  CREATE TABLE dbo.PTLAprovisionamientos (
    aprovisionamientoId     INT IDENTITY(1, 1) NOT NULL,
    codigoAprovisionamiento NVARCHAR(36)   NOT NULL CONSTRAINT PK_PTLAprovisionamientos PRIMARY KEY,
    codigoSuscriptor        NVARCHAR(200)  NOT NULL,
    codigoAplicacion        NVARCHAR(200)  NOT NULL,
    codigoPaquete           NVARCHAR(200)  NULL,
    nombreBD                NVARCHAR(128)  NOT NULL,
    version                 INT            NOT NULL CONSTRAINT DF_PTLAprovisionamientos_version DEFAULT 0,
    estado                  NVARCHAR(20)   NOT NULL CONSTRAINT DF_PTLAprovisionamientos_estado DEFAULT N'PENDIENTE'
                            CONSTRAINT CK_PTLAprovisionamientos_estado CHECK (estado IN (N'PENDIENTE', N'EN_CURSO', N'LISTA', N'ERROR')),
    mensaje                 NVARCHAR(2000) NULL,
    intentos                INT            NOT NULL CONSTRAINT DF_PTLAprovisionamientos_intentos DEFAULT 0,
    fechaCreacion           DATETIME2      NOT NULL CONSTRAINT DF_PTLAprovisionamientos_fechaCreacion DEFAULT SYSUTCDATETIME(),
    fechaModificacion       DATETIME2      NOT NULL CONSTRAINT DF_PTLAprovisionamientos_fechaModificacion DEFAULT SYSUTCDATETIME(),
    CONSTRAINT UX_PTLAprovisionamientos_SuscriptorAplicacion UNIQUE (codigoSuscriptor, codigoAplicacion)
  );
  PRINT 'PTLAprovisionamientos creada.';
END
ELSE PRINT 'PTLAprovisionamientos ya existía.';

-- Diagnóstico: ¿puede el usuario actual crear bases?
SELECT CASE WHEN HAS_PERMS_BY_NAME(NULL, NULL, 'CREATE ANY DATABASE') = 1 THEN 'El usuario del API puede crear bases.'
            ELSE 'FALTA: el usuario del API no puede crear bases (ver el comentario de arriba).' END AS permisoCrearBases;
