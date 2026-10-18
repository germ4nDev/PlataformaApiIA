/*
  PORTTOS · Reversa de la migración 001: elimina los sinónimos y devuelve los nombres anteriores.
    sqlcmd -S <SERVIDOR> -d plataformaBD -E -b -i 001_reversa.sql
*/
SET NOCOUNT ON;
-- Protección: solo corre sobre la base de Porttos
DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END
SET XACT_ABORT ON;
IF OBJECT_ID('tempdb..#mapeo') IS NOT NULL DROP TABLE #mapeo;
CREATE TABLE #mapeo (anterior sysname NOT NULL, nuevo sysname NOT NULL);
-- Mapeo de nombres (idéntico en 001, 001_reversa y 003)
-- Mapeo único de nombres (incluido por 001, 001_reversa y 003). Convención: Prefijo_NombreTabla en PascalCase.
INSERT INTO #mapeo (anterior, nuevo) VALUES
 -- Maestros y catálogos (antes T_*)
 ('T_Maestro_Puertos',            'TCL_MaestroPuertos'),
 ('T_Maestro_Terminales',         'TCL_MaestroTerminales'),
 ('T_Maestro_Muelles',            'TCL_MaestroMuelles'),
 ('T_Maestro_Infraestructura',    'TCL_MaestroInfraestructura'),
 ('T_Tipos_Infraestructura',      'TCL_TiposInfraestructura'),
 ('T_Maestro_Faros',              'TCL_MaestroFaros'),
 ('T_Maestro_NodosLogisticos',    'TCL_MaestroNodosLogisticos'),
 ('T_Maestro_NodosMonitoreo',     'TCL_MaestroNodosMonitoreo'),
 ('T_Maestro_Camiones',           'TCL_MaestroCamiones'),
 ('T_Maestro_EstacionesClima',    'TCL_MaestroEstacionesClima'),
 ('T_Maestro_MatrizOperaciones',  'TCL_MaestroMatrizOperaciones'),
 ('T_Infraestructura_Tanques',    'TCL_MaestroTanques'),
 -- Operación con prefijo de maestro
 ('T_Inventario_Contenedores',    'TCL_InventarioContenedores'),
 ('T_Nominaciones_Gas',           'TCL_NominacionesGas'),
 -- Operación sin guion bajo tras el prefijo
 ('TCLEventosViales',             'TCL_EventosViales'),
 ('TCLAisUltimaPosicion',         'TCL_AisUltimaPosicion'),
 ('TCLAlertasClimaticas',         'TCL_AlertasClimaticas'),
 ('TCLMovimientosTracking',       'TCL_MovimientosTracking'),
 ('TCLAgentes',                   'TCL_Agentes'),
 ('TCLAgenteMonitoreo',           'TCL_AgenteMonitoreo'),
 ('TCLPuertoAgenteConfig',        'TCL_PuertoAgenteConfig'),
 ('TCLParametrosInfraestructura', 'TCL_ParametrosInfraestructura'),
 ('TCLReglasSLAOperacion',        'TCL_ReglasSLAOperacion'),
 -- Guiones bajos internos → PascalCase (siglas en mayúscula)
 ('TCL_Naves_Avisadas',           'TCL_NavesAvisadas'),
 ('TCL_Naves_Arribadas',          'TCL_NavesArribadas'),
 ('TCL_Naves_Fondeadas',          'TCL_NavesFondeadas'),
 ('TCL_Naves_Zarpadas',           'TCL_NavesZarpadas'),
 ('TCL_Clima_Pronostico',         'TCL_ClimaPronostico'),
 ('TCL_Homologacion_MMSI',        'TCL_HomologacionMMSI'),
 ('TCL_Operaciones_FlujoGNL',     'TCL_OperacionesFlujoGNL'),
 ('TCL_Simulador_Rutas',          'TCL_SimuladorRutas'),
 ('TCL_Simulador_Waypoints',      'TCL_SimuladorWaypoints');

BEGIN TRANSACTION;
DECLARE @anterior sysname, @nuevo sysname, @sql nvarchar(max);
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT anterior, nuevo FROM #mapeo;
OPEN c; FETCH NEXT FROM c INTO @anterior, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @nuevo, N'U') IS NOT NULL
  BEGIN
    IF OBJECT_ID(N'dbo.' + @anterior, N'SN') IS NOT NULL
    BEGIN SET @sql = N'DROP SYNONYM dbo.' + QUOTENAME(@anterior) + N';'; EXEC sp_executesql @sql; END
    IF OBJECT_ID(N'dbo.' + @anterior) IS NULL
    BEGIN SET @sql = N'dbo.' + @nuevo; EXEC sp_rename @sql, @anterior, N'OBJECT'; PRINT CONCAT(N'↩ ', @nuevo, N' → ', @anterior); END
  END
  FETCH NEXT FROM c INTO @anterior, @nuevo;
END
CLOSE c; DEALLOCATE c;
COMMIT TRANSACTION;
