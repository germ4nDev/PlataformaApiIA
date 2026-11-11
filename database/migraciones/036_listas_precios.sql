/*
  PLATAFORMA · Migración 036 · Listas de precios como único lugar del precio de venta (OT-029, CC-159)
  Qué hace (idempotente; no borra filas ni columnas):
    1. PTLListasPreciosDetalle: un precio por paquete o ítem en cada lista (índice único codigoLista + tipoReferencia + codigoReferencia).
    2. PTLPaquetesSC: columnas de la foto del precio con el que se vendió (codigoLista, moneda, periodicidad, mesesCobertura, valorPeriodo,
       precioSetup, porcentajeDescuento, valorFinal), NULL permitidas: la fila que ya existe queda igual.
    3. Menú: «Listas de precios» (translateKey LISTAS_PRECIOS, ruta /paquetes/listas-precios, sin ícono) como hermano de Paquetes › Items y en
       los mismos paquetes; «Precios», «Precios Unitarios» y «Tipos Valor» quedan inactivos (sus rutas no existían en la web).
    4. Las actividades ACT_PRECIO_* pasan a colgar del módulo nuevo (antes de «Precios Unitarios»).
    5. Primera lista (decisión del usuario): «Colombia COP» desde 2026-01-01, con el valorUnitario de cada ítem activo y el costoPaquete de cada
       paquete activo como valor mensual; anual = mensual × 12. Solo si todavía no hay ninguna lista.
  Va ANTES del API nuevo: sin las columnas del punto 2, consultar o crear paquetes de suscriptor falla.
  Reversa: módulo y lista llevan descripción «OT-029 · …»; las columnas nuevas se pueden dejar.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

-- 2. Columnas de la foto del precio (fuera de la transacción: ALTER TABLE)
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'codigoLista') IS NULL         ALTER TABLE dbo.PTLPaquetesSC ADD codigoLista NVARCHAR(200) NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'moneda') IS NULL              ALTER TABLE dbo.PTLPaquetesSC ADD moneda NVARCHAR(3) NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'periodicidad') IS NULL        ALTER TABLE dbo.PTLPaquetesSC ADD periodicidad NVARCHAR(10) NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'mesesCobertura') IS NULL      ALTER TABLE dbo.PTLPaquetesSC ADD mesesCobertura INT NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'valorPeriodo') IS NULL        ALTER TABLE dbo.PTLPaquetesSC ADD valorPeriodo DECIMAL(18, 2) NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'precioSetup') IS NULL         ALTER TABLE dbo.PTLPaquetesSC ADD precioSetup DECIMAL(18, 2) NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'porcentajeDescuento') IS NULL ALTER TABLE dbo.PTLPaquetesSC ADD porcentajeDescuento DECIMAL(5, 2) NULL;
IF COL_LENGTH(N'dbo.PTLPaquetesSC', N'valorFinal') IS NULL          ALTER TABLE dbo.PTLPaquetesSC ADD valorFinal DECIMAL(18, 2) NULL;

-- 1. Un precio por referencia y lista
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'UX_PTLListasPreciosDetalle_Referencia' AND object_id = OBJECT_ID(N'dbo.PTLListasPreciosDetalle'))
BEGIN
  IF EXISTS (SELECT codigoLista, tipoReferencia, codigoReferencia FROM dbo.PTLListasPreciosDetalle
             GROUP BY codigoLista, tipoReferencia, codigoReferencia HAVING COUNT(*) > 1)
  BEGIN
    RAISERROR('Hay precios repetidos en PTLListasPreciosDetalle (misma lista y referencia). Corríjalos y vuelva a correr la 036.', 16, 1);
    RETURN;
  END
  CREATE UNIQUE INDEX UX_PTLListasPreciosDetalle_Referencia ON dbo.PTLListasPreciosDetalle (codigoLista, tipoReferencia, codigoReferencia);
END

DECLARE @items NVARCHAR(200) = (SELECT TOP 1 codigoModulo FROM dbo.PTLModulosAP WHERE translateKey = N'ITEMS' AND rutaModulo = N'/paquetes/items');
DECLARE @modulo NVARCHAR(200) = N'41400408-1335-4e55-8016-a5df73b04b81';  -- Paquetes › Listas de precios (nuevo)
DECLARE @ahora NVARCHAR(30) = LEFT(CONVERT(NVARCHAR(30), SYSUTCDATETIME(), 126), 23) + N'Z';
IF @items IS NULL
BEGIN
  RAISERROR('No existe el módulo Paquetes › Items (/paquetes/items). Solo se agregaron las columnas y el índice.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

-- 3. Menú
INSERT INTO dbo.PTLModulosAP (codigoModulo, codigoAplicacion, codigoSuite, codigoPadre, codigoBiblioteca, nombreModulo, precioModulo, rutaModulo,
                              descripcionModulo, hijos, icon, translateKey, estadoModulo,
                              codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT @modulo, m.codigoAplicacion, m.codigoSuite, m.codigoPadre, m.codigoBiblioteca, N'Listas de precios', m.precioModulo, N'/paquetes/listas-precios',
       N'OT-029 · Único lugar del precio de venta de paquetes e ítems', 0, N'', N'LISTAS_PRECIOS', 1, NULL, @ahora, NULL, @ahora
FROM dbo.PTLModulosAP m
WHERE m.codigoModulo = @items
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLModulosAP x WHERE x.codigoModulo = @modulo);
DECLARE @modulos INT = @@ROWCOUNT;

INSERT INTO dbo.PTLModulosPQ (codigoModuloPQ, codigoAplicacion, codigoSuite, codigoModulo, codigoPaquete, estadoModuloPQ,
                              codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), pq.codigoAplicacion, pq.codigoSuite, @modulo, pq.codigoPaquete, pq.estadoModuloPQ, NULL, @ahora, NULL, @ahora
FROM dbo.PTLModulosPQ pq
WHERE pq.codigoModulo = @items
  AND NOT EXISTS (SELECT 1 FROM dbo.PTLModulosPQ x WHERE x.codigoModulo = @modulo AND x.codigoPaquete = pq.codigoPaquete);
DECLARE @paquetes INT = @@ROWCOUNT;

UPDATE dbo.PTLModulosAP SET estadoModulo = 0, fechaModificacion = @ahora
WHERE translateKey IN (N'PRECIOS', N'PRECIOSUNITARIOS', N'TIPOSVALOR') AND estadoModulo = 1;
DECLARE @inactivos INT = @@ROWCOUNT;

-- 4. Actividades de precios al módulo nuevo
UPDATE dbo.PTLActividades SET codigoModulo = @modulo, fechaModificacion = @ahora
WHERE llavePermiso IN (N'ACT_PRECIO_CREAR', N'ACT_PRECIO_MODIFICAR', N'ACT_PRECIO_ELIMINAR') AND codigoModulo <> @modulo;
DECLARE @actividades INT = @@ROWCOUNT;

-- 5. Primera lista
DECLARE @lista NVARCHAR(200) = N'CO-COP';
DECLARE @precios INT = 0;
IF NOT EXISTS (SELECT 1 FROM dbo.PTLListasPrecios)
BEGIN
  INSERT INTO dbo.PTLListasPrecios (codigoLista, nombreLista, moneda, paisAplica, fechaInicio, fechaFin, estadoLista,
                                    codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (@lista, N'Colombia COP', N'COP', N'Colombia', '2026-01-01', NULL, 1, NULL, @ahora, NULL, @ahora);

  INSERT INTO dbo.PTLListasPreciosDetalle (codigoDetalle, codigoLista, tipoReferencia, codigoReferencia, valorMensual, valorAnual, precioSetup,
                                           estadoDetalle, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), @lista, N'ITEM', i.codigoItem, ISNULL(i.valorUnitario, 0), ISNULL(i.valorUnitario, 0) * 12, 0,
         1, NULL, @ahora, NULL, @ahora
  FROM dbo.PTLItems i WHERE i.estadoItem = 1
  UNION ALL
  SELECT LOWER(CONVERT(NVARCHAR(36), NEWID())), @lista, N'PAQUETE', p.codigoPaquete, ISNULL(p.costoPaquete, 0), ISNULL(p.costoPaquete, 0) * 12, 0,
         1, NULL, @ahora, NULL, @ahora
  FROM dbo.PTLPaquetes p WHERE p.estadoPaquete = 1;
  SET @precios = @@ROWCOUNT;
END

COMMIT TRANSACTION;

PRINT CONCAT('Módulo creado: ', @modulos, ' · en paquetes: ', @paquetes, ' · módulos inactivados: ', @inactivos,
             ' · actividades movidas: ', @actividades, ' · precios en la primera lista: ', @precios);
