/*
    Author: German Valencia
    Layer: Repository (Data Access Layer - SQL Server)
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_021 = '021_fuente_simulado_tablas_operacion.sql';
const LOTE_INSERT = 40;   // filas por INSERT (20 columnas × 40 = 800 parámetros, por debajo del tope de 2100)

class VirtualGateRepository {
    /**
     * Detecta cuál tabla de citas existe en la BD (dbo.TCL_CitasVirtualGate o dbo.TCL_CitasGate)
     */
    async resolverTablaCitas() {
        const sql = `
            SELECT 
                CASE 
                    WHEN OBJECT_ID('dbo.TCL_CitasVirtualGate', 'U') IS NOT NULL THEN 'dbo.TCL_CitasVirtualGate'
                    WHEN OBJECT_ID('dbo.TCL_CitasGate', 'U') IS NOT NULL THEN 'dbo.TCL_CitasGate'
                    ELSE NULL
                END AS tablaActiva;
        `;
        const [res] = await sequelize.query(sql, { type: QueryTypes.SELECT });
        return res?.tablaActiva || null;
    }

    /**
     * 1. Obtiene el listado completo de camiones en cola / enturnamiento para el puerto
     */
    /**
     * 1. Obtiene el listado completo de camiones en cola / enturnamiento para el puerto
     */
    async obtenerCitasPorPuerto(puerto) {
        const tabla = await this.resolverTablaCitas();
        if (!tabla) return [];

        const puertoLimpio = String(puerto || 'BUENAVENTURA').trim().toUpperCase();

        try {
            // Intento 1: Asumimos que la columna se llama "id_puerto" y eliminamos c.id del ORDER BY
            const sql = `
                SELECT c.*
                FROM ${tabla} c WITH (NOLOCK)
                WHERE UPPER(LTRIM(RTRIM(c.id_puerto))) = :puerto
                ORDER BY 
                    CASE 
                        WHEN c.estado IN ('EN_PUERTO', 'PRE_GATE', 'VALIDADO', 'LLAMADO') THEN 1
                        WHEN c.estado IN ('EN_COLA', 'ENTURNADO', 'EN_RUTA') THEN 2
                        ELSE 3
                    END ASC;
            `;
            return await sequelize.query(sql, {
                replacements: { puerto: puertoLimpio },
                type: QueryTypes.SELECT
            });

        } catch (error) {
            // Intento 2: Si falla porque "id_puerto" no existe, intentamos con la columna "puerto"
            try {
                const sqlFallback = `
                    SELECT c.*
                    FROM ${tabla} c WITH (NOLOCK)
                    WHERE UPPER(LTRIM(RTRIM(c.puerto))) = :puerto
                    ORDER BY 
                        CASE 
                            WHEN c.estado IN ('EN_PUERTO', 'PRE_GATE', 'VALIDADO', 'LLAMADO') THEN 1
                            WHEN c.estado IN ('EN_COLA', 'ENTURNADO', 'EN_RUTA') THEN 2
                            ELSE 3
                        END ASC;
                `;
                return await sequelize.query(sqlFallback, {
                    replacements: { puerto: puertoLimpio },
                    type: QueryTypes.SELECT
                });

            } catch (errFallback) {
                console.warn(`⚠️ [VirtualGateRepository] No se encontró 'id_puerto' ni 'puerto' en ${tabla}. Consultando sin filtro de puerto.`);

                // Intento 3: Si ninguna columna existe, traemos la data sin filtrar para que la pantalla no quede vacía ni crashee
                const sqlTotal = `
                    SELECT c.* 
                    FROM ${tabla} c WITH (NOLOCK)
                    ORDER BY 
                        CASE 
                            WHEN c.estado IN ('EN_PUERTO', 'PRE_GATE', 'VALIDADO', 'LLAMADO') THEN 1
                            WHEN c.estado IN ('EN_COLA', 'ENTURNADO', 'EN_RUTA') THEN 2
                            ELSE 3
                        END ASC;
                `;
                return await sequelize.query(sqlTotal, { type: QueryTypes.SELECT });
            }
        }
    }

    /**
     * 2. Obtiene la saturación promedio de bodegas del puerto (para el KPI PTT_GATE_KPI_BODEGAS)
     */
    /**
         * 2. Obtiene la saturación promedio de bodegas del puerto (para el KPI PTT_GATE_KPI_BODEGAS)
         */
    /**
         * 2. Obtiene la saturación promedio de bodegas del puerto (para el KPI PTT_GATE_KPI_BODEGAS)
         */
    async obtenerSaturacionBodegasPuerto(puerto) {
        const puertoFiltro = String(puerto || 'BUENAVENTURA').trim().toUpperCase();

        try {
            // 1. Verificamos limpiamente si la tabla existe antes de intentar cualquier cálculo
            const checkSql = `
                SELECT OBJECT_ID('dbo.TCL_MaestroBodegas', 'U') AS tablaExiste
            `;
            const [checkResult] = await sequelize.query(checkSql, { type: QueryTypes.SELECT });

            // Si la tabla no existe en la base de datos, retornamos ceros sin lanzar error
            if (!checkResult || checkResult.tablaExiste === null) {
                return { saturacionPromedio: 0, totalBodegas: 0 };
            }

            // 2. Si existe, calculamos la saturación promedio con una consulta pura y robusta
            const sql = `
                SELECT 
                    -- Corregido 2026-10-17: columnas reales capacidad_maxima_ton / inventario_actual_ton (antes el KPI
                    -- quedaba siempre en 0 %) y ocupación PONDERADA (inventario total / capacidad total), igual que
                    -- la pestaña Bodegas: un promedio simple contaba en 0 % las bodegas sin capacidad registrada.
                    CAST(
                        ROUND(
                            ISNULL(SUM(CAST(inventario_actual_ton AS FLOAT)) * 100.0
                                   / NULLIF(SUM(CAST(capacidad_maxima_ton AS FLOAT)), 0), 0), 1
                        ) AS DECIMAL(5,1)
                    ) AS saturacionPromedio,
                    COUNT(1) AS totalBodegas
                FROM dbo.TCL_MaestroBodegas WITH (NOLOCK)
                WHERE REPLACE(UPPER(LTRIM(RTRIM(id_puerto))), ' ', '_') = REPLACE(:puerto, ' ', '_')
                  AND activo = 1;
            `;

            const [fila] = await sequelize.query(sql, {
                replacements: { puerto: puertoFiltro },
                type: QueryTypes.SELECT
            });

            // Si la consulta arroja nulls (porque no hay registros para el puerto), devolvemos ceros
            return {
                saturacionPromedio: Number(fila?.saturacionPromedio || 0),
                totalBodegas: Number(fila?.totalBodegas || 0)
            };

        } catch (error) {
            console.warn(`⚠️ [VirtualGateRepository] Error al consultar saturación de bodegas. Retornando 0. Detalle:`, error.message);
            // Si llega a fallar algo (tabla sin migrar), el tablero no se cae: KPI en 0 y queda el aviso en consola
            return { saturacionPromedio: 0, totalBodegas: 0 };
        }
    }

    // ── Simulador de citas (OT-009, migración 021) ────────────────────────────────────────────────────────────
    // Las citas simuladas van en la misma tabla con fuente = 'SIMULADOR' y simulado = 1. Sin la 021 no hay columna
    // simulado: se lanza migracionPendiente y el simulador de gate se apaga solo.

    async _q(sql, replacements = {}, type = QueryTypes.SELECT, opciones = {}) {
        try {
            return await sequelize.query(sql, { replacements, type, ...opciones });
        } catch (error) {
            if (esColumnaInexistente(error) || esTablaInexistente(error)) throw migracionPendiente(MIGRACION_021);
            throw error;
        }
    }

    /** Terminales del puerto con su número de muelles (escala del simulador). */
    terminalesConMuelles(idPuerto) {
        return this._q(`
            SELECT t.id_terminal, t.nombre, COUNT(m.id_interno) AS muelles
            FROM dbo.TCL_MaestroTerminales t WITH (NOLOCK)
            LEFT JOIN dbo.TCL_MaestroMuelles m WITH (NOLOCK) ON m.id_terminal = t.id_terminal AND ISNULL(m.estado, 1) = 1
            WHERE t.id_puerto = :idPuerto AND ISNULL(t.estado, 1) = 1
            GROUP BY t.id_terminal, t.nombre`, { idPuerto });
    }

    /** ¿Llegó alguna cita real (simulado = 0) del puerto con fecha desde 'desde'? */
    async hayCitasReales(idPuerto, desde) {
        const [fila] = await this._q(`
            SELECT COUNT(1) AS n FROM dbo.TCL_CitasVirtualGate WITH (NOLOCK)
            WHERE id_puerto = :idPuerto AND simulado = 0 AND fecha_hora_cita >= :desde`, { idPuerto, desde });
        return Number(fila?.n || 0) > 0;
    }

    /** Cambia todas las citas simuladas del puerto por 'filas' (una transacción). Devuelve cuántas escribió. */
    async reemplazarCitasSimuladas(idPuerto, filas) {
        const columnas = ['id_puerto', 'id_cita', 'placa', 'conductor', 'transportador', 'tipo_carga', 'operacion', 'terminal',
            'fecha_hora_cita', 'franja_horaria', 'ubicacion', 'distancia_km', 'estado', 'tiempo_espera_minutos',
            'validacion_ocr', 'validacion_biometria', 'validacion_documental', 'peso_bascula_ton', 'fuente', 'simulado'];
        return sequelize.transaction(async (transaction) => {
            await this._q(`DELETE FROM dbo.TCL_CitasVirtualGate WHERE id_puerto = :idPuerto AND simulado = 1`,
                { idPuerto }, QueryTypes.DELETE, { transaction });
            for (let i = 0; i < filas.length; i += LOTE_INSERT) {
                const lote = filas.slice(i, i + LOTE_INSERT);
                const replacements = {};
                const valores = lote.map((f, j) => `(${columnas.map((c) => {
                    replacements[`${c}_${j}`] = c === 'id_puerto' ? idPuerto
                        : ['validacion_ocr', 'validacion_biometria', 'validacion_documental', 'simulado'].includes(c)
                            ? (f[c] === null || f[c] === undefined ? null : (f[c] ? 1 : 0))
                            : (f[c] === undefined ? null : f[c]);
                    return `:${c}_${j}`;
                }).join(', ')})`);
                await this._q(`INSERT INTO dbo.TCL_CitasVirtualGate (${columnas.join(', ')}) VALUES ${valores.join(',\n')}`,
                    replacements, QueryTypes.INSERT, { transaction });
            }
            return filas.length;
        });
    }

    /** Retira las citas simuladas del puerto (llegó el dato real o se apagó el simulador). */
    retirarCitasSimuladas(idPuerto) {
        return this._q(`DELETE FROM dbo.TCL_CitasVirtualGate WHERE id_puerto = :idPuerto AND simulado = 1`,
            { idPuerto }, QueryTypes.DELETE);
    }
}

module.exports = new VirtualGateRepository();