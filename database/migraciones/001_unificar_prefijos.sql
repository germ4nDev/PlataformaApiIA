/*
  PORTTOS · Migración 001 · Unificación de nombres de tabla (Prefijo_NombreTabla, PascalCase)

  - Renombra cada tabla con sp_rename (datos, índices, FKs y triggers se conservan).
  - Crea un SINÓNIMO con el nombre anterior → el código viejo sigue funcionando (SELECT/INSERT/UPDATE/DELETE).
    Ojo: TRUNCATE no funciona sobre sinónimos.
  - Idempotente: si una tabla ya fue renombrada, la omite.
  - Todo o nada: corre en una transacción.

  Ejecutar en SSMS (sin modo SQLCMD) o con sqlcmd:
    sqlcmd -S <SERVIDOR> -d plataformaBD -E -b -i 001_unificar_prefijos.sql
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

DECLARE @anterior sysname, @nuevo sysname, @sql nvarchar(max), @renombradas int = 0, @omitidas int = 0;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT anterior, nuevo FROM #mapeo;
OPEN c; FETCH NEXT FROM c INTO @anterior, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
  IF OBJECT_ID(N'dbo.' + @anterior, N'U') IS NOT NULL AND OBJECT_ID(N'dbo.' + @nuevo) IS NULL
  BEGIN
    SET @sql = N'dbo.' + @anterior;
    EXEC sp_rename @sql, @nuevo, N'OBJECT';
    SET @sql = N'CREATE SYNONYM dbo.' + QUOTENAME(@anterior) + N' FOR dbo.' + QUOTENAME(@nuevo) + N';';
    EXEC sp_executesql @sql;
    PRINT CONCAT(N'✔ ', @anterior, N' → ', @nuevo, N' (+ sinónimo)');
    SET @renombradas += 1;
  END
  ELSE
  BEGIN
    PRINT CONCAT(N'· omitida ', @anterior, N' (no existe como tabla o ', @nuevo, N' ya existe)');
    SET @omitidas += 1;
  END
  FETCH NEXT FROM c INTO @anterior, @nuevo;
END
CLOSE c; DEALLOCATE c;

COMMIT TRANSACTION;
PRINT CONCAT(N'Renombradas: ', @renombradas, N' · Omitidas: ', @omitidas);

-- Objetos programables (vistas, triggers, SP) que aún mencionan nombres anteriores.
-- Funcionan gracias a los sinónimos, pero deben actualizarse antes de la migración 003.
PRINT N'--- Objetos que referencian nombres anteriores (actualizar antes de 003):';
SELECT DISTINCT OBJECT_SCHEMA_NAME(m.object_id) + '.' + OBJECT_NAME(m.object_id) AS objeto,
       o.type_desc AS tipo, x.anterior
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
JOIN #mapeo x ON CHARINDEX(x.anterior, m.definition) > 0
ORDER BY objeto;
