/*
  PORTTOS · Migración 020 · Ícono y color de cada pestaña en la base (OT-008, decisión del usuario 2026-10-29)
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.PTLPestanas + icono NVARCHAR(60) NULL y color NVARCHAR(9) NULL. Son opcionales (NULL) porque PTLPestanas es de la
       plataforma compartida: las otras aplicaciones no cambian y una pestaña sin valor sigue con el respaldo del código.
         icono: nombre neutro del ícono (barco, camion, bodega, contenedor, granel, suelta, gnl, capacidad, noticias, mapa,
                tablero). Cada cliente lo dibuja con su juego: la web con Font Awesome, la app con sus SVG.
         color: hexadecimal (#RRGGBB).
    2. Los valores de las pestañas de la Torre de Control (TLC_*) que hasta hoy estaban escritos en el código
       (PorttosMovil/src/app/nucleo/pestanas.ts → ESTILO_PESTANAS y PlataformaIA/.../iconos-pestana.ts). Solo donde esté NULL:
       no pisa un valor que alguien ya haya puesto.
  El API funciona antes de correrla: /api/pestanas sale sin icono ni color y web y app usan el respaldo del código.
  Reversa: ALTER TABLE dbo.PTLPestanas DROP COLUMN icono, color;
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

BEGIN TRANSACTION;

IF COL_LENGTH(N'dbo.PTLPestanas', N'icono') IS NULL
  ALTER TABLE dbo.PTLPestanas ADD icono NVARCHAR(60) NULL;
IF COL_LENGTH(N'dbo.PTLPestanas', N'color') IS NULL
  ALTER TABLE dbo.PTLPestanas ADD color NVARCHAR(9) NULL;

COMMIT TRANSACTION;

-- Las columnas nuevas solo se ven en un lote aparte (por eso el UPDATE va con EXEC)
BEGIN TRANSACTION;

EXEC (N'
  UPDATE p SET
    icono = ISNULL(p.icono, v.icono),
    color = ISNULL(p.color, v.color)
  FROM dbo.PTLPestanas p
  JOIN (VALUES
    (N''TLC_MARITIMO_001'',     N''barco'',      N''#00BCD4''),
    (N''TLC_VIRTUAL_GATE_001'', N''camion'',     N''#FFB64D''),
    (N''TLC_BODEGAS_001'',      N''bodega'',     N''#4099FF''),
    (N''TLC_CONTENEDORES_001'', N''contenedor'', N''#2ED8B6''),
    (N''TLC_GRANEL_001'',       N''granel'',     N''#2ED8B6''),
    (N''TLC_SUELTA_001'',       N''suelta'',     N''#FFB64D''),
    (N''TLC_GNL_001'',          N''gnl'',        N''#FF5370''),
    (N''TLC_CAPACIDAD_001'',    N''capacidad'',  N''#00BCD4''),
    (N''TLC_NOTICIAS'',         N''noticias'',   N''#4099FF''),
    (N''TLC_NOTICIAS_001'',     N''noticias'',   N''#4099FF''),
    (N''TLC_MAPA_001'',         N''mapa'',       N''#FF5370'')
  ) v (codigoPestana, icono, color) ON v.codigoPestana = p.codigoPestana
  WHERE p.icono IS NULL OR p.color IS NULL;
');

COMMIT TRANSACTION;

PRINT 'Migración 020 aplicada: PTLPestanas.icono y PTLPestanas.color.';
