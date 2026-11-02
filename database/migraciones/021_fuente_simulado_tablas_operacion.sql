/*
  PORTTOS · Migración 021 · Columnas fuente y simulado en las tablas de operación que no las tienen (OT-009)
  Pedido del usuario (2026-10-29): ningún widget sin datos; los simulados van en las mismas tablas que leerá el dato real
  y se reemplazan solos cuando llegue una fuente oficial. Convención de la migración 013:
    fuente   NVARCHAR(40) NOT NULL DEFAULT 'INGESTA_API'   (quién escribió la fila: INGESTA_API, SIMULADOR, DIMAR, AIS…)
    simulado BIT          NOT NULL DEFAULT 0               (1 = dato simulado; los tableros lo rotulan SIMULADO)
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. Agrega las columnas que falten en cada tabla. Lo que ya está en la base queda como real (fuente INGESTA_API, simulado 0).
    2. TCL_CapacidadNodos ya tiene fuente: solo recibe simulado.
    3. Un índice (id_puerto, simulado) en TCL_CitasVirtualGate y TCL_MovimientosBodega, que el simulador consulta en cada ciclo.
  El API funciona antes de correrla: el simulador de esos dominios avisa una vez en consola y no escribe nada.
  Reversa (por tabla): ALTER TABLE dbo.<tabla> DROP CONSTRAINT DF_<tabla>_fuente, DF_<tabla>_simulado; ALTER TABLE dbo.<tabla> DROP COLUMN fuente, simulado;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @tablas TABLE (tabla sysname COLLATE DATABASE_DEFAULT PRIMARY KEY);
INSERT INTO @tablas (tabla) VALUES
  (N'TCL_CitasVirtualGate'), (N'TCL_MovimientosBodega'), (N'TCL_MaestroBodegas'),
  (N'TCL_MovimientosContenedor'), (N'TCL_InventarioContenedores'),
  (N'TCL_LineUpMaritimo'), (N'TCL_NavesAvisadas'), (N'TCL_NavesArribadas'), (N'TCL_NavesFondeadas'), (N'TCL_NavesZarpadas'),
  (N'TCL_AisUltimaPosicion'), (N'TCL_EventosEstadoNave'),
  (N'TCL_OperacionesFlujoGNL'), (N'TCL_HistoricosSupertransporte'), (N'TCL_Noticias'),
  (N'TCL_CapacidadNodos');

DECLARE @tabla sysname, @sql NVARCHAR(MAX);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT tabla FROM @tablas;
OPEN c;
FETCH NEXT FROM c INTO @tabla;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @tabla, N'U') IS NULL
    PRINT 'No existe dbo.' + @tabla + ': se omite.';
  ELSE
  BEGIN
    BEGIN TRANSACTION;
    IF COL_LENGTH(N'dbo.' + @tabla, N'fuente') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD fuente NVARCHAR(40) NOT NULL CONSTRAINT '
               + QUOTENAME(N'DF_' + @tabla + N'_fuente') + N' DEFAULT (N''INGESTA_API'') WITH VALUES;';
      EXEC (@sql);
      PRINT 'dbo.' + @tabla + ': + fuente';
    END
    IF COL_LENGTH(N'dbo.' + @tabla, N'simulado') IS NULL
    BEGIN
      SET @sql = N'ALTER TABLE dbo.' + QUOTENAME(@tabla) + N' ADD simulado BIT NOT NULL CONSTRAINT '
               + QUOTENAME(N'DF_' + @tabla + N'_simulado') + N' DEFAULT (0) WITH VALUES;';
      EXEC (@sql);
      PRINT 'dbo.' + @tabla + ': + simulado';
    END
    COMMIT TRANSACTION;
  END
  FETCH NEXT FROM c INTO @tabla;
END
CLOSE c;
DEALLOCATE c;

-- Índices que usa el simulador en cada ciclo (lote aparte: las columnas nuevas solo se ven después)
IF OBJECT_ID(N'dbo.TCL_CitasVirtualGate', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_CitasVirtualGate_puerto_simulado')
  EXEC (N'CREATE INDEX IX_TCL_CitasVirtualGate_puerto_simulado ON dbo.TCL_CitasVirtualGate (id_puerto, simulado) INCLUDE (fecha_hora_cita, estado);');
IF OBJECT_ID(N'dbo.TCL_MovimientosBodega', N'U') IS NOT NULL
   AND NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_MovimientosBodega_puerto_simulado')
  EXEC (N'CREATE INDEX IX_TCL_MovimientosBodega_puerto_simulado ON dbo.TCL_MovimientosBodega (id_puerto, simulado);');

PRINT 'Migración 021 aplicada: fuente y simulado en las tablas de operación.';
