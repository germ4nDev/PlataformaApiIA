/*
  PLATAFORMA · Migración 039 · Utilidades › Países (CC-163)
  Qué hace (idempotente; no borra nada):
    1. Crea dbo.PTL_Paises (regla 24): código ISO 3166-1 alfa-2 (llave), alfa-3, numérico, nombre, moneda ISO 4217, símbolo, decimales,
       indicativo telefónico, zona horaria IANA, idioma, descripción (NVARCHAR(4000), estándar de las maestras) y estado. Siembra Colombia (CO · COP).
    2. Listas de precios: paisAplica pasa del nombre al código del país ('Colombia' → 'CO').
    3. Menú «Países» (translateKey PAISES, ruta /utilidades/paises, sin ícono) hermano de Utilidades › Idiomas y en sus paquetes.
    4. Actividades ACT_PAIS_CREAR / MODIFICAR / ELIMINAR al ROLE_ADMINISTRADOR de Plataforma.
  Requiere la 038 (tablas PTL_). Va antes del API con /api/paises.
  Nota: la migración que quita los sinónimos de la 038 llevará el número siguiente libre.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
IF OBJECT_ID(N'dbo.PTL_ModulosAP', N'U') IS NULL
BEGIN
  RAISERROR('Falta la migración 038 (tablas PTL_). Córrala primero.', 16, 1);
  RETURN;
END

-- 1. Tabla
IF OBJECT_ID(N'dbo.PTL_Paises', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.PTL_Paises (
    paisId                    INT IDENTITY(1, 1) NOT NULL,
    codigoPais                NCHAR(2)       NOT NULL CONSTRAINT PK_PTL_Paises PRIMARY KEY,
    codigoIso3                NCHAR(3)       NOT NULL CONSTRAINT UX_PTL_Paises_Iso3 UNIQUE,
    codigoNumerico            NCHAR(3)       NULL,
    nombrePais                NVARCHAR(100)  NOT NULL,
    moneda                    NCHAR(3)       NOT NULL,
    simboloMoneda             NVARCHAR(5)    NULL,
    decimalesMoneda           TINYINT        NOT NULL CONSTRAINT DF_PTL_Paises_decimales DEFAULT 2,
    indicativo                NVARCHAR(6)    NULL,
    zonaHoraria               NVARCHAR(64)   NULL,
    idioma                    NVARCHAR(10)   NULL,
    descripcion               NVARCHAR(4000) NULL,
    estadoPais                BIT            NOT NULL CONSTRAINT DF_PTL_Paises_estado DEFAULT 1,
    codigoUsuarioCreacion     NVARCHAR(200)  NULL,
    fechaCreacion             DATETIME2      NOT NULL CONSTRAINT DF_PTL_Paises_fechaCreacion DEFAULT SYSUTCDATETIME(),
    codigoUsuarioModificacion NVARCHAR(200)  NULL,
    fechaModificacion         DATETIME2      NOT NULL CONSTRAINT DF_PTL_Paises_fechaModificacion DEFAULT SYSUTCDATETIME()
  );
  PRINT 'PTL_Paises creada.';
END
-- descripcion (estándar de las tablas maestras): por si la tabla se creó sin ella
IF COL_LENGTH(N'dbo.PTL_Paises', N'descripcion') IS NULL ALTER TABLE dbo.PTL_Paises ADD descripcion NVARCHAR(4000) NULL;

IF NOT EXISTS (SELECT 1 FROM dbo.PTL_Paises WHERE codigoPais = N'CO')
  INSERT INTO dbo.PTL_Paises (codigoPais, codigoIso3, codigoNumerico, nombrePais, moneda, simboloMoneda, decimalesMoneda, indicativo, zonaHoraria, idioma, estadoPais)
  VALUES (N'CO', N'COL', N'170', N'Colombia', N'COP', N'$', 2, N'+57', N'America/Bogota', N'es-CO', 1);

DECLARE @idiomas NVARCHAR(200) = N'4699b32f-5476-4b15-b86e-e2e0472722fd';   -- Utilidades › Idiomas
DECLARE @modulo NVARCHAR(200) = N'e330c96f-466e-4338-9162-df62e0787030';  -- Utilidades › Países (nuevo)
DECLARE @tipoCrud NVARCHAR(200) = N'e1a8fa99-15db-479b-a0a4-9c2be72272n8';
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';

BEGIN TRANSACTION;

-- 2. Listas de precios con el código del país
UPDATE l SET l.paisAplica = p.codigoPais
FROM dbo.PTL_ListasPrecios l INNER JOIN dbo.PTL_Paises p ON p.nombrePais = l.paisAplica;
DECLARE @listas INT = @@ROWCOUNT;

-- 3. Menú
INSERT INTO dbo.PTL_ModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                               descripcionModulo, hijos, icon, translateKey, estadoModulo,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Países', m.precioModulo, N'/utilidades/paises',
       N'CC-163 · Países con su código ISO, moneda y datos regionales', 0, N'', N'PAISES', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosAP m
WHERE m.codigoModulo = @idiomas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTL_ModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                               codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTL_ModulosPQ pq
WHERE pq.codigoModulo = @idiomas
  AND NOT EXISTS (SELECT 1 FROM dbo.PTL_ModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

-- 4. Actividades
DECLARE @nuevas TABLE (llavePermiso NVARCHAR(100) COLLATE DATABASE_DEFAULT NOT NULL PRIMARY KEY, actividad NVARCHAR(500) COLLATE DATABASE_DEFAULT NOT NULL);
INSERT INTO @nuevas VALUES (N'ACT_PAIS_CREAR', N'Crear países'), (N'ACT_PAIS_MODIFICAR', N'Modificar países'), (N'ACT_PAIS_ELIMINAR', N'Eliminar países');

INSERT INTO dbo.PTL_Actividades (codigoActividad, codigoAplicacion, codigoSuite, codigoModulo, codigoTipoActividad, llavePermiso, actividad,
                                 descripcion, estadoActividad, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), m.codigoAplicacion, m.codigoSuite, @modulo, @tipoCrud, n.llavePermiso, n.actividad,
       N'CC-163 · Plataforma · Utilidades › Países', 1, NULL, @ahora, NULL, @ahora
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

PRINT CONCAT('Listas con código de país: ', @listas, ' · módulo creado: ', @modulos, ' · en paquetes: ', @paquetes,
             ' · actividades creadas: ', @creadas, ' · asignadas al ADMINISTRADOR: ', @asignadas);
