/*
  PORTTOS · Migración 054 · Métrica «Nave que se acerca» (CC-241, fase 2 de puntos de control)
  Qué hace (idempotente; no borra nada):
    1. TCL_MetricasControl: la métrica NAVE_SE_ACERCA sobre el calculador NAVE_CERCANA: minutos estimados de la nave más cercana que viene
       hacia la geocerca (a menos de 20 km del borde, a 2 nudos o más y con rumbo a menos de 45° del centro). Menos es peor; amarillo a
       30 min, sin rojo (aviso informativo). Si ninguna nave viene, la lectura queda NORMAL sin valor. Se edita en Administración ›
       Métricas de control (por ejemplo, otra con la distancia en km).
  Requiere la 051. Sin tablas nuevas: el calculador lee TCL_AisUltimaPosicion.
  Reversa: UPDATE dbo.TCL_MetricasControl SET activo = 0 WHERE codigoUsuarioCreacion = N'MIGRACION_054';
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

MERGE dbo.TCL_MetricasControl AS d
USING (VALUES
  (N'NAVE_SE_ACERCA', N'Nave que se acerca', N'Minutos estimados de la nave más cercana que viene hacia la geocerca (20 km, 2 nudos o más)', N'NAVE_CERCANA', N'{"medida":"MINUTOS","radio_km":20,"velocidad_min_nudos":2}', N'min', N'MENOR_PEOR', 30, NULL, 15)
) AS o (codigo, nombre, descripcion, calculador, parametros, unidad, sentido, umbral_amarillo, umbral_rojo, ventana_min)
ON d.codigo = o.codigo
WHEN NOT MATCHED THEN INSERT (codigo, nombre, descripcion, calculador, parametros, unidad, sentido, umbral_amarillo, umbral_rojo, ventana_min,
  tipos_sugeridos, activo, codigoUsuarioCreacion, fechaCreacion, codigoUsuarioModificacion, fechaModificacion)
  VALUES (o.codigo, o.nombre, o.descripcion, o.calculador, o.parametros, o.unidad, o.sentido, o.umbral_amarillo, o.umbral_rojo, o.ventana_min,
  NULL, 1, N'MIGRACION_054', @ahora, N'MIGRACION_054', @ahora);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' métrica «Nave que se acerca»');

SELECT codigo, nombre, calculador, parametros, umbral_amarillo, umbral_rojo, activo FROM dbo.TCL_MetricasControl WHERE calculador = N'NAVE_CERCANA';
