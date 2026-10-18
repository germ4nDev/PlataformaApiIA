/*
  PORTTOS · Migración 008 · Puerto en los movimientos de contenedores
  Por qué: dbo.TCL_MovimientosContenedor no tenía puerto, así que la pestaña Contenedores mostraba
           los mismos datos en Buenaventura, Cartagena, Santa Marta...
  Qué hace (idempotente):
    1. Agrega id_puerto NVARCHAR(50) NULL + índice.
    2. Lo llena SOLO donde está vacío, cuando la ruta menciona una terminal conocida
       (id o nombre de dbo.TCL_MaestroTerminales; ej. "TCBUEN→Cali" → BUENAVENTURA).
  Lo que no se pueda inferir queda en NULL y se sigue mostrando en todos los puertos (comportamiento anterior),
  hasta que la ingesta envíe el puerto. El API funciona con o sin esta migración.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

IF DB_NAME() <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD (USE plataformaBD).', 16, 1);
  RETURN;
END

IF COL_LENGTH('dbo.TCL_MovimientosContenedor', 'id_puerto') IS NULL
BEGIN
  ALTER TABLE dbo.TCL_MovimientosContenedor ADD id_puerto NVARCHAR(50) NULL;
  PRINT N'✔ Columna id_puerto agregada';
END
GO  -- lote nuevo: la columna recién creada no se puede usar en el mismo lote

SET NOCOUNT ON;
SET XACT_ABORT ON;
IF DB_NAME() <> N'plataformaBD' OR COL_LENGTH('dbo.TCL_MovimientosContenedor', 'id_puerto') IS NULL
BEGIN
  RAISERROR('Falta la columna id_puerto (revise el lote anterior).', 16, 1);
  RETURN;
END

IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_MovimientosContenedor_Puerto'
               AND object_id = OBJECT_ID(N'dbo.TCL_MovimientosContenedor'))
BEGIN
  CREATE INDEX IX_TCL_MovimientosContenedor_Puerto ON dbo.TCL_MovimientosContenedor (id_puerto, fechaCreacion);
  PRINT N'✔ Índice IX_TCL_MovimientosContenedor_Puerto creado';
END

BEGIN TRAN;
  ;WITH candidatos AS (
    SELECT m.id_movimiento, t.id_puerto,
           ROW_NUMBER() OVER (PARTITION BY m.id_movimiento ORDER BY LEN(t.id_terminal) DESC) AS n
    FROM dbo.TCL_MovimientosContenedor m
    JOIN dbo.TCL_MaestroTerminales t
      ON m.ruta COLLATE Latin1_General_CI_AI LIKE N'%' + t.id_terminal + N'%'
      OR (LEN(t.nombre) >= 4 AND m.ruta COLLATE Latin1_General_CI_AI LIKE N'%' + t.nombre + N'%')
    WHERE m.id_puerto IS NULL AND t.id_puerto IS NOT NULL
  )
  UPDATE m SET id_puerto = UPPER(LTRIM(RTRIM(c.id_puerto)))
  FROM dbo.TCL_MovimientosContenedor m
  JOIN candidatos c ON c.id_movimiento = m.id_movimiento AND c.n = 1;
  PRINT CONCAT(N'✔ Movimientos con puerto inferido: ', @@ROWCOUNT);
COMMIT;

SELECT ISNULL(id_puerto, N'(sin puerto: se ve en todos)') AS puerto, COUNT(*) AS movimientos
FROM dbo.TCL_MovimientosContenedor
GROUP BY id_puerto
ORDER BY COUNT(*) DESC;
GO
