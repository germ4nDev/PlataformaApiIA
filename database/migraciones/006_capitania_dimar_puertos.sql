/*
  PORTTOS · Migración 006 · Capitanía DIMAR de cada puerto
  Por qué: los avisos de arribo (TCL_NavesAvisadas.capitania) usan el nombre de la capitanía de DIMAR,
  que no siempre coincide con el puerto: La Guajira → PUERTO BOLIVAR, Puerto Antioquia (Turbo) → URABÁ Y DEL DARIÉN.
  Qué hace (idempotente):
    1. Agrega dbo.TCL_MaestroPuertos.capitania_dimar NVARCHAR(100).
    2. La llena SOLO donde está vacía (no pisa ajustes manuales).
  El API (maritimo-vivo.repository.js) la usa para cruzar "naves por llegar"; si está vacía, cae a comparar por nombre.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

IF COL_LENGTH('dbo.TCL_MaestroPuertos', 'capitania_dimar') IS NULL
BEGIN
  ALTER TABLE dbo.TCL_MaestroPuertos ADD capitania_dimar NVARCHAR(100) NULL;
  PRINT N'✔ Columna capitania_dimar agregada';
END
GO  -- lote nuevo: SQL Server no deja usar una columna en el mismo lote donde se crea

SET NOCOUNT ON;
SET XACT_ABORT ON;
-- La protección se repite: RETURN solo sale del lote anterior
IF DB_NAME() <> N'plataformaBD' OR COL_LENGTH('dbo.TCL_MaestroPuertos', 'capitania_dimar') IS NULL
BEGIN
  RAISERROR('Base incorrecta o la columna capitania_dimar no se creó. No se actualiza nada.', 16, 1);
  RETURN;
END

BEGIN TRANSACTION;

UPDATE p
SET capitania_dimar = m.capitania
FROM dbo.TCL_MaestroPuertos p
INNER JOIN (VALUES
  (N'BARRANQUILLA', N'BARRANQUILLA'),
  (N'BUENAVENTURA', N'BUENAVENTURA'),
  (N'CARTAGENA',    N'CARTAGENA'),
  (N'SANTA_MARTA',  N'SANTA MARTA'),
  (N'GUAJIRA',      N'PUERTO BOLIVAR'),
  (N'TURBO',        N'URABÁ Y DEL DARIÉN'),
  (N'COVENAS',      N'COVEÑAS'),   -- aún sin avisos cargados: confirmar el nombre cuando lleguen
  (N'TUMACO',       N'TUMACO')     -- ídem
) AS m (id_puerto, capitania) ON m.id_puerto = p.id_puerto
WHERE p.capitania_dimar IS NULL;

PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' puertos actualizados');
COMMIT TRANSACTION;

-- Verificación: cuántos avisos cruza cada puerto (0 en COVENAS/TUMACO es normal si no hay avisos)
SELECT p.id_puerto, p.nombre, p.capitania_dimar,
       (SELECT COUNT(*) FROM dbo.TCL_NavesAvisadas a
        WHERE a.capitania COLLATE Latin1_General_CI_AI = p.capitania_dimar COLLATE Latin1_General_CI_AI) AS avisos
FROM dbo.TCL_MaestroPuertos p
ORDER BY p.nombre;
