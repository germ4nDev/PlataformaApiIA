/*
  PLATAFORMA · Migración 029 · Nombres de widgets de Bodegas sin «??» (OT-015, CC-114; pedido del usuario 2026-11-02)
  Qué hace (idempotente; no borra nada):
    Cuatro widgets de Bodegas tenían un emoji al inicio del nombre que se guardó sin el prefijo N y quedó como «?? ». El emoji ya no
    se puede recuperar; ningún otro widget lleva emoji en el nombre. Se quita el «?? » inicial solo a esos cuatro códigos.
  Reversa: UPDATE dbo.PTLWidgetsMaestro SET nombreWidget = N'?? ' + nombreWidget WHERE codigoWidget IN (los cuatro de abajo)
           AND codigoUsuarioModificacion = N'MIGRACION_029';  (el emoji original ya no existía en la base).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @ahora NVARCHAR(100) = CONVERT(NVARCHAR(100), SYSUTCDATETIME(), 127) + N'Z';

BEGIN TRANSACTION;

UPDATE dbo.PTLWidgetsMaestro
SET nombreWidget = LTRIM(SUBSTRING(nombreWidget, 4, 150)),
    codigoUsuarioModificacion = N'MIGRACION_029',
    fechaModificacion = @ahora
WHERE codigoWidget IN (N'PTT_BOD_CHRT_CARGA', N'PTT_BOD_CHRT_FLUJO', N'PTT_BOD_PANEL_SATURACION', N'PTT_BOD_TAB_MOVIMIENTOS')
  AND nombreWidget LIKE N'?? %';

PRINT CONCAT(N'✓ ', @@ROWCOUNT, N' nombres de widgets corregidos');

COMMIT TRANSACTION;

SELECT codigoWidget, nombreWidget
FROM dbo.PTLWidgetsMaestro
WHERE codigoWidget IN (N'PTT_BOD_CHRT_CARGA', N'PTT_BOD_CHRT_FLUJO', N'PTT_BOD_PANEL_SATURACION', N'PTT_BOD_TAB_MOVIMIENTOS');
