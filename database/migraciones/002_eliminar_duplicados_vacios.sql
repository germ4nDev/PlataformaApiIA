/*
  PORTTOS · Migración 002 · Elimina tablas duplicadas que están VACÍAS y que el código ya no necesita.
  Seguridad: si alguna tiene filas, aborta sin borrar nada.
    T_Maestro_Bodegas → la tabla viva es TCL_MaestroBodegas
    TCL_CitasGate     → la tabla viva es TCL_CitasVirtualGate
  Pendientes (aún las usa código vivo, se eliminan cuando se limpie ese código):
    TLCCatalogo_Widgets, TLCUserDashboardLayout (dashboard.controller), TCL_HistoricoProductividad (maritimo.repository)
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

-- Protección: solo corre sobre la base de Porttos
DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @t TABLE (tabla sysname);
INSERT INTO @t VALUES ('T_Maestro_Bodegas'), ('TCL_CitasGate');

DECLARE @tabla sysname, @filas bigint, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tabla FROM @t;
BEGIN TRANSACTION;
OPEN c; FETCH NEXT FROM c INTO @tabla;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @tabla, N'U') IS NOT NULL
  BEGIN
    SET @sql = N'SELECT @n = COUNT_BIG(*) FROM dbo.' + QUOTENAME(@tabla);
    EXEC sp_executesql @sql, N'@n bigint OUTPUT', @n = @filas OUTPUT;
    IF @filas > 0
    BEGIN
      DECLARE @msg nvarchar(400) = CONCAT('La tabla ', @tabla, ' tiene ', @filas, ' filas; no se elimina nada. Revisa antes de continuar.');
      THROW 50001, @msg, 1;  -- aborta y revierte toda la transacción
    END
    SET @sql = N'DROP TABLE dbo.' + QUOTENAME(@tabla); EXEC sp_executesql @sql;
    PRINT CONCAT(N'🗑 eliminada ', @tabla);
  END
  FETCH NEXT FROM c INTO @tabla;
END
CLOSE c; DEALLOCATE c;
COMMIT TRANSACTION;
