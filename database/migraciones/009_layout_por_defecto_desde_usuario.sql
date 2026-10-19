/*
  PORTTOS · Migración 009 · Layout por defecto = el tablero de un usuario, tal como está hoy
  Por qué: cuando un usuario no tiene layout propio en dbo.PTLLayouts (o pulsa "Restaurar"), el tablero se arma
           con la plantilla de dbo.PTLWidgetsMaestro (inicial, pos_x, pos_y, defaultCols, defaultRows).
           Este script copia a esa plantilla la distribución que un usuario tiene guardada en PTLLayouts.
  Qué hace por cada pestaña donde @codigoUsuario tiene layout:
    - Los widgets de su tablero → inicial = 1 con su posición y tamaño.
    - Los demás widgets de esa pestaña → inicial = 0 (siguen en el catálogo de "Widgets").
    - Marítimo: las tarjetas de terminal (TERM_SLOT_n) no se copian; las arma la zona dinámica según el puerto.
      A los widgets que están debajo de ellas se les descuenta la altura de esa zona (si no, al recargar
      quedaría el doble de espacio).
  Uso: 1) @ejecutar = 0 → vista previa.  2) @ejecutar = 1 → aplica (en una transacción).
  Para cambiar el default más adelante: acomode el tablero con ese usuario y vuelva a correr el script.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @codigoUsuario VARCHAR(200) = 'CAMBIAR_POR_SU_CODIGO_USUARIO';
DECLARE @ejecutar BIT = 0;

IF DB_NAME() <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD (USE plataformaBD).', 16, 1);
  RETURN;
END

IF NOT EXISTS (SELECT 1 FROM dbo.PTLLayouts WHERE codigoUsuario = @codigoUsuario)
BEGIN
  RAISERROR('El usuario %s no tiene layout guardado en PTLLayouts.', 16, 1, @codigoUsuario);
  RETURN;
END

-- Último registro por widget (si hubiera duplicados)
;WITH ultimo AS (
  SELECT l.codigoPestana, UPPER(LTRIM(RTRIM(l.codigoWidget))) AS codigoWidget,
         l.posicion_x, l.posicion_y, l.cols, l.rows,
         ROW_NUMBER() OVER (PARTITION BY l.codigoPestana, UPPER(LTRIM(RTRIM(l.codigoWidget))) ORDER BY l.layoutId DESC) AS n
  FROM dbo.PTLLayouts l
  WHERE l.codigoUsuario = @codigoUsuario
),
zona AS (   -- franja de las tarjetas de terminal (Marítimo)
  SELECT codigoPestana, MIN(posicion_y) AS ini, MAX(posicion_y + rows) AS fin
  FROM ultimo WHERE n = 1 AND codigoWidget LIKE 'TERM[_]SLOT[_]%'
  GROUP BY codigoPestana
)
SELECT u.codigoPestana, u.codigoWidget,
       u.posicion_x AS pos_x,
       CASE WHEN z.fin IS NOT NULL AND u.posicion_y >= z.fin THEN u.posicion_y - (z.fin - z.ini) ELSE u.posicion_y END AS pos_y,
       u.cols, u.rows
INTO #plantilla
FROM ultimo u
LEFT JOIN zona z ON z.codigoPestana = u.codigoPestana
WHERE u.n = 1 AND u.codigoWidget NOT LIKE 'TERM[_]SLOT[_]%';

-- Vista previa: lo que quedará en el tablero inicial y lo que sale de él
SELECT 'ENTRA AL DEFAULT' AS accion, p.codigoPestana, p.codigoWidget, p.pos_x, p.pos_y, p.cols, p.rows,
       m.pos_x AS antes_x, m.pos_y AS antes_y, m.defaultCols AS antes_cols, m.defaultRows AS antes_rows, m.inicial AS antes_inicial
FROM #plantilla p
JOIN dbo.PTLWidgetsMaestro m ON UPPER(m.codigoWidget) = p.codigoWidget AND m.codigoPestana = p.codigoPestana
UNION ALL
SELECT 'SALE DEL DEFAULT', m.codigoPestana, m.codigoWidget, NULL, NULL, NULL, NULL, m.pos_x, m.pos_y, m.defaultCols, m.defaultRows, m.inicial
FROM dbo.PTLWidgetsMaestro m
WHERE m.codigoPestana IN (SELECT DISTINCT codigoPestana FROM #plantilla)
  AND NOT EXISTS (SELECT 1 FROM #plantilla p WHERE p.codigoWidget = UPPER(m.codigoWidget) AND p.codigoPestana = m.codigoPestana)
ORDER BY 2, 1, 6, 5;

SELECT 'EN EL LAYOUT PERO NO EN EL CATÁLOGO (se ignora)' AS aviso, p.codigoPestana, p.codigoWidget
FROM #plantilla p
WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro m WHERE UPPER(m.codigoWidget) = p.codigoWidget AND m.codigoPestana = p.codigoPestana);

IF @ejecutar = 1
BEGIN
  DECLARE @fecha VARCHAR(100) = FORMAT(SYSUTCDATETIME(), 'yyyy-MM-ddTHH:mm:ss.fffZ');
  BEGIN TRAN;
    UPDATE m SET pos_x = p.pos_x, pos_y = p.pos_y, defaultCols = p.cols, defaultRows = p.rows, inicial = 1,
                 codigoUsuarioModificacion = @codigoUsuario, fechaModificacion = @fecha
    FROM dbo.PTLWidgetsMaestro m
    JOIN #plantilla p ON UPPER(m.codigoWidget) = p.codigoWidget AND m.codigoPestana = p.codigoPestana;
    PRINT CONCAT(N'✔ Widgets en el layout por defecto: ', @@ROWCOUNT);

    UPDATE m SET inicial = 0, codigoUsuarioModificacion = @codigoUsuario, fechaModificacion = @fecha
    FROM dbo.PTLWidgetsMaestro m
    WHERE m.codigoPestana IN (SELECT DISTINCT codigoPestana FROM #plantilla)
      AND NOT EXISTS (SELECT 1 FROM #plantilla p WHERE p.codigoWidget = UPPER(m.codigoWidget) AND p.codigoPestana = m.codigoPestana);
    PRINT CONCAT(N'✔ Widgets que quedan solo en el catálogo: ', @@ROWCOUNT);
  COMMIT;
END
ELSE
  PRINT N'Vista previa. Revise las filas y vuelva a ejecutar con @ejecutar = 1.';

DROP TABLE #plantilla;
