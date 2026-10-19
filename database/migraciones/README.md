# Migraciones de base de datos · Porttos

Convención de nombres: **`Prefijo_NombreTabla`** en PascalCase, sin guiones bajos internos, siglas en mayúscula.

| Prefijo | Dominio |
|---|---|
| `PTL_` | Plataforma |
| `TCL_` | Porttos (Tablero de Control Logístico). Maestros: `TCL_Maestro*`, catálogos: `TCL_Tipos*` |
| `QPL_` | QPlus |

## Orden de ejecución

Los scripts son autocontenidos: se pueden abrir y ejecutar directamente en SSMS. `_mapeo.sql` queda solo como referencia.

0. **Respaldo**: `BACKUP DATABASE plataformaBD TO DISK = N'...\plataformaBD_pre001.bak' WITH COPY_ONLY, COMPRESSION;`
1. `001_unificar_prefijos.sql` → renombra tablas y deja sinónimos con los nombres anteriores (la app vieja sigue funcionando).
2. Desplegar el API con los nombres nuevos (sin `DB_SYNC=true`).
3. `002_eliminar_duplicados_vacios.sql` → borra duplicados vacíos (aborta si alguno tiene filas).
4. `004_actualizar_vistas_triggers.sql` → primero con `@ejecutar = 0` (vista previa), luego con `@ejecutar = 1`.
5. `003_retirar_sinonimos.sql` → solo cuando nada use ya los nombres anteriores.
6. `005_ais_estado_navegacion.sql` → (independiente, se puede correr ya) columnas de zona/estado en `TCL_AisUltimaPosicion` y bitácora `TCL_EventosEstadoNave` para los KPIs de fondeo. Reiniciar el API después.
7. `006_capitania_dimar_puertos.sql` → (independiente) capitanía DIMAR de cada puerto para cruzar los avisos de arribo (La Guajira → PUERTO BOLIVAR, Turbo → URABÁ Y DEL DARIÉN).
8. `007_widgets_maritimo_vivo.sql` → registra los 5 widgets "Marítimo en vivo" (endpoints `/api/maritimo/:puerto/{resumen,tiempos,ocupacion,llegadas}`) en el catálogo de la pestaña Marítimo, con los roles del widget de referencia.
9. `008_puerto_movimientos_contenedor.sql` → (independiente) agrega `id_puerto` a `TCL_MovimientosContenedor` y lo infiere desde la ruta (terminal conocida). La pestaña Contenedores filtra por puerto; lo que quede sin puerto se sigue viendo en todos. El API funciona antes y después de correrla.
10. `009_layout_por_defecto_desde_usuario.sql` → copia el tablero de un usuario como layout por defecto (`@ejecutar = 0` vista previa).
11. `010_compatibilidad_110.sql` → **urgente**: sube `plataformaBD` del nivel 100 al 110 para que funcionen `TRY_CONVERT`/`TRY_CAST` (64 consultas del API). Mantiene el estimador de cardinalidad clásico. Reversa: `ALTER DATABASE plataformaBD SET COMPATIBILITY_LEVEL = 100`.

Reversa de la 001: `001_reversa.sql`.

```
sqlcmd -S <SERVIDOR> -d plataformaBD -E -b -i 001_unificar_prefijos.sql
```
