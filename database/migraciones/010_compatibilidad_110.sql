/* 010 — Sube plataformaBD a nivel de compatibilidad 110.

   Por qué: con nivel 100, SQL Server no reconoce TRY_CONVERT ni TRY_CAST (Msg 195),
   y la API los usa en 64 consultas (maritimo, maritimo-vivo, mapa-general).
   Todas esas consultas fallan hoy.

   Por qué 110 y no 160: 110 activa TRY_CONVERT/TRY_CAST/TRY_PARSE y mantiene el
   estimador de cardinalidad clásico (el nuevo empieza en 120). Los planes de
   ejecución de las demás aplicaciones no cambian de comportamiento.

   Requiere permiso ALTER sobre la base. No corre dentro de una transacción.
   Reversa: ALTER DATABASE plataformaBD SET COMPATIBILITY_LEVEL = 100;  */
USE master;
GO

SELECT name, compatibility_level AS antes FROM sys.databases WHERE name = N'plataformaBD';

IF (SELECT compatibility_level FROM sys.databases WHERE name = N'plataformaBD') < 110
BEGIN
  ALTER DATABASE plataformaBD SET COMPATIBILITY_LEVEL = 110;
  PRINT N'✔ plataformaBD ahora en nivel 110';
END
ELSE
  PRINT N'· plataformaBD ya estaba en 110 o más; no se cambia nada';
GO

USE plataformaBD;
GO
SELECT name, compatibility_level AS despues FROM sys.databases WHERE name = N'plataformaBD';
-- Prueba (con EXEC para que el lote compile después del cambio)
EXEC (N'SELECT TRY_CONVERT(DATETIMEOFFSET, N''2026-10-18T12:00:00.000Z'', 127) AS prueba_try_convert');
GO
