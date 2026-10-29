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
12. `011_alertas_mapa.sql` → (independiente) bitácora de alertas del mapa (`TCL_AlertasMapa`) y reglas configurables (`TCL_ConfigAlertas`, con valores por defecto). El API funciona antes de correrla (valores por defecto y bitácora en memoria); después de correrla, reiniciar el API.
13. `012_recorrido_mapa.sql` → (independiente) muestras de posición de naves y camiones (`TCL_RecorridoMapa`) para el modo reproducir del mapa (últimas 24 h). Retención de 3 días. Sin ella el API funciona y el modo reproducir avisa que falta; después de correrla, reiniciar el API.
14. `013_granel_suelta_capacidad_noticias.sql` → (independiente) pestañas Granel, Carga suelta, Capacidad y Noticias: 10 tablas (operación de buques y su avance, equipos, carga suelta, vehículos, capacidad y ocupación de nodos, noticias, TRM, fuentes), catálogo inicial de nodos de Buenaventura (capacidades de referencia, a validar con cada operador) y 38 widgets en el layout base de las 4 pestañas. Sin ella el API funciona y esos tableros responden 503; después de correrla, reiniciar el API.

15. `014_eventos_viales_ciclo_vida.sql` → (independiente) ciclo de vida de los eventos viales: columnas `fuente`, `zonaFuente`, `fechaUltimoReporte`, `ausencias` y `motivoCierre` en `TCL_EventosViales`, respaldo `TCL_EventosViales_respaldo014`, corrección de `VEHICULO_AVERIDADO` y depuración de los ACTIVO de TomTom sin reporte hace más de 1 h (pasan a DESPEJADO, no se borran). Sin ella el API funciona con la regla anterior (reportados hoy) y no despeja nada; después de correrla, reiniciar el API. Reversa en el encabezado del script.

16. `015_analisis_ia.sql` → (independiente) capa de análisis con IA: fotos de KPI cada 15 min (`TCL_SnapshotsKpi`), prompts versionados, configuración por puerto y tarea, ejecuciones, hallazgos y retroalimentación. Sin ella el API funciona y las fotos se apagan solas; después de correrla, reiniciar el API. Interruptores en el `.env`: `IA_ENABLED` (analista con el modelo, apagado por defecto) e `IA_SNAPSHOTS_ENABLED` (fotos y señales, encendido por defecto). Reversa en el encabezado.

17. `016_widget_analista_ia.sql` → (independiente, después de la 015) widget «Analista IA» `PTT_IA_ANALISTA_<PESTAÑA>` en cada pestaña del tablero que tenga widgets, con los roles de un widget de la misma pestaña. Queda disponible en el selector (`inicial = 0`); con `@mostrarEnLayoutInicial = 1` entra al layout base. Si se crea una pestaña nueva, volver a correrla. Reversa en el encabezado.

18. `017_ia_resumenes_admin.sql` → (después de la 015) capa de IA fase 4: columna `contenido` en `TCL_IAHallazgos` para los resúmenes de turno y diarios, y `TCL_IAConfig` con «NULL = hereda del .env» más `tiposPublicar`, para el panel de administración por puerto y tarea. Sin ella el API funciona: los resúmenes se calculan pero no se guardan y el panel queda en solo lectura. Reiniciar el API después. Reversa en el encabezado.

19. `018_ia_asistente.sql` → (después de la 015) capa de IA fase 5: `TCL_IAPreguntas` (cada pregunta al asistente con su decisión de alcance, respuesta, fuentes, herramientas, verificación y voto) y `TCL_IAAlcance` (ajustes al marco de alcance incorporado; vacía = el incorporado). Sin ella el asistente responde, pero no guarda, no aplica el tope por usuario y el marco no se edita. Reiniciar el API después. Reversa en el encabezado.

Reversa de la 001: `001_reversa.sql`.

```
sqlcmd -S <SERVIDOR> -d plataformaBD -E -b -i 001_unificar_prefijos.sql
```
