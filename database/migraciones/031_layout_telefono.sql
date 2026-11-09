/*
  PORTTOS · Migración 031 · Layout del teléfono por usuario y pestaña (OT-017 fase 2, aprobado por el usuario el 2026-11-05)
  Qué hace (idempotente; solo agrega, no toca ninguna tabla existente):
    dbo.TCL_LayoutTelefono: un layout por usuario y pestaña para la web embebida en el teléfono (rejilla de 4 columnas).
      layout = JSON [{ codigo, x, y, cols, rows }]; lo escribe solo /api/layout-telefono. /api/layout (compartido) no se toca.
      Sin fila = el API arma el layout por defecto con los widgets de teléfono que permite el rol (utils/layout/layout-telefono.js).
  El API funciona antes de correrla: /api/layout-telefono responde 503 (MIGRACION_PENDIENTE).
  Reversa: DROP TABLE dbo.TCL_LayoutTelefono.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF OBJECT_ID(N'dbo.TCL_LayoutTelefono', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_LayoutTelefono (
    id                INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_LayoutTelefono PRIMARY KEY,
    codigoUsuario     NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
    codigoPestana     NVARCHAR(200) COLLATE DATABASE_DEFAULT NOT NULL,
    layout            NVARCHAR(MAX) COLLATE DATABASE_DEFAULT NOT NULL,
    version           INT NOT NULL CONSTRAINT DF_TCL_LayoutTelefono_version DEFAULT (1),
    fechaCreacion     DATETIME2(0) NOT NULL CONSTRAINT DF_TCL_LayoutTelefono_creacion DEFAULT (SYSUTCDATETIME()),
    fechaModificacion DATETIME2(0) NOT NULL CONSTRAINT DF_TCL_LayoutTelefono_modificacion DEFAULT (SYSUTCDATETIME()),
    CONSTRAINT UQ_TCL_LayoutTelefono_usuario_pestana UNIQUE (codigoUsuario, codigoPestana)
  );
  PRINT N'✔ Tabla TCL_LayoutTelefono creada';
END
ELSE
  PRINT N'· La tabla TCL_LayoutTelefono ya existía: no se cambia.';

PRINT 'Migración 031 aplicada: layout del teléfono por usuario y pestaña (TCL_LayoutTelefono).';
