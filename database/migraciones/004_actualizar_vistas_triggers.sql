/*
  PORTTOS · Migración 004 · Actualiza vistas, triggers, funciones y SP que aún usan nombres de tabla anteriores.

  MODO SEGURO POR DEFECTO: con @ejecutar = 0 solo MUESTRA cómo quedaría cada objeto (no cambia nada).
  Revisa los resultados y luego cambia a @ejecutar = 1 para aplicar (todo en una transacción).

  - Reemplaza los nombres anteriores por los nuevos (los más largos primero).
  - Convierte CREATE en CREATE OR ALTER (SQL Server 2016 SP1+).
  - Si el NOMBRE del objeto contenía un nombre anterior (p.ej. trg_AutoGeo_T_Maestro_NodosLogisticos),
    crea el objeto con el nombre nuevo y elimina el anterior (evita triggers duplicados).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @ejecutar bit = 0;   -- ← cambiar a 1 para aplicar

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s.', 16, 1, @base);
  RETURN;
END

IF OBJECT_ID('tempdb..#mapeo') IS NOT NULL DROP TABLE #mapeo;
CREATE TABLE #mapeo (anterior sysname NOT NULL, nuevo sysname NOT NULL);
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

IF OBJECT_ID('tempdb..#objetos') IS NOT NULL DROP TABLE #objetos;
SELECT o.object_id,
       OBJECT_SCHEMA_NAME(o.object_id) AS esquema,
       o.name AS nombre_actual,
       o.type_desc AS tipo,
       CAST(m.definition AS nvarchar(max)) AS definicion_actual,
       CAST(m.definition AS nvarchar(max)) AS definicion_nueva,
       CAST(o.name AS nvarchar(256)) AS nombre_nuevo
INTO #objetos
FROM sys.sql_modules m
JOIN sys.objects o ON o.object_id = m.object_id
WHERE o.is_ms_shipped = 0
  AND EXISTS (SELECT 1 FROM #mapeo x WHERE CHARINDEX(x.anterior, m.definition) > 0);

-- Reemplazos: nombres más largos primero para no pisar prefijos
DECLARE @anterior sysname, @nuevo sysname;
DECLARE c CURSOR LOCAL FAST_FORWARD FOR SELECT anterior, nuevo FROM #mapeo ORDER BY LEN(anterior) DESC;
OPEN c; FETCH NEXT FROM c INTO @anterior, @nuevo;
WHILE @@FETCH_STATUS = 0
BEGIN
  UPDATE #objetos SET definicion_nueva = REPLACE(definicion_nueva, @anterior, @nuevo),
                      nombre_nuevo     = REPLACE(nombre_nuevo, @anterior, @nuevo);
  FETCH NEXT FROM c INTO @anterior, @nuevo;
END
CLOSE c; DEALLOCATE c;

-- CREATE → CREATE OR ALTER (primera aparición de CREATE en la definición)
UPDATE #objetos
SET definicion_nueva = STUFF(definicion_nueva, PATINDEX(N'%CREATE%', definicion_nueva), 6, N'CREATE OR ALTER')
WHERE PATINDEX(N'%CREATE OR ALTER%', definicion_nueva) = 0;

-- Vista previa
SELECT esquema, tipo, nombre_actual, nombre_nuevo,
       CASE WHEN nombre_actual <> nombre_nuevo THEN N'RENOMBRA (crea nuevo y borra anterior)' ELSE N'ALTER' END AS accion,
       definicion_nueva
FROM #objetos ORDER BY tipo, nombre_actual;

IF @ejecutar = 0
BEGIN
  PRINT N'Vista previa únicamente. Revisa la columna definicion_nueva y ejecuta con @ejecutar = 1 para aplicar.';
  RETURN;
END

BEGIN TRANSACTION;
DECLARE @id int, @esq sysname, @nom sysname, @nomNuevo nvarchar(256), @tipo nvarchar(60), @def nvarchar(max), @drop nvarchar(max);
DECLARE o CURSOR LOCAL FAST_FORWARD FOR
  SELECT object_id, esquema, nombre_actual, nombre_nuevo, tipo, definicion_nueva FROM #objetos
  ORDER BY CASE tipo WHEN 'VIEW' THEN 1 ELSE 2 END;
OPEN o; FETCH NEXT FROM o INTO @id, @esq, @nom, @nomNuevo, @tipo, @def;
WHILE @@FETCH_STATUS = 0
BEGIN
  EXEC sp_executesql @def;
  IF @nom <> @nomNuevo
  BEGIN
    SET @drop = N'DROP ' + CASE
                  WHEN @tipo LIKE '%TRIGGER%' THEN N'TRIGGER '
                  WHEN @tipo = 'VIEW' THEN N'VIEW '
                  WHEN @tipo LIKE '%PROCEDURE%' THEN N'PROCEDURE '
                  ELSE N'FUNCTION ' END
              + QUOTENAME(@esq) + N'.' + QUOTENAME(@nom);
    EXEC sp_executesql @drop;
    PRINT CONCAT(N'↻ ', @nom, N' → ', @nomNuevo);
  END
  ELSE PRINT CONCAT(N'✔ actualizado ', @nom);
  FETCH NEXT FROM o INTO @id, @esq, @nom, @nomNuevo, @tipo, @def;
END
CLOSE o; DEALLOCATE o;
COMMIT TRANSACTION;
PRINT N'Listo. Vuelve a ejecutar con @ejecutar = 0: la vista previa debe quedar vacía.';
