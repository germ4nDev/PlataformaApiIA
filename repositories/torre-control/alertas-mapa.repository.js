/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Alertas del mapa (TCL_AlertasMapa, TCL_ConfigAlertas · migración 011)
    Description: Lecturas y escrituras de la bitácora de alertas y de la configuración de reglas.
      Si la migración 011 no se ha corrido, las consultas lanzan un error con codigo 'SIN_MIGRACION_011'
      y el servicio sigue funcionando con valores por defecto y bitácora en memoria.
*/
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../models');
const { esTablaInexistente } = require('../../helpers/errores.helper');

const sinTabla = (error) => esTablaInexistente(error) || /Invalid object name/i.test(error?.message || '');

async function ejecutar(sql, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await sequelize.query(sql, { replacements, type });
  } catch (error) {
    if (sinTabla(error)) {
      const e = new Error('Falta la migración 011_alertas_mapa.sql');
      e.codigo = 'SIN_MIGRACION_011';
      throw e;
    }
    throw error;
  }
}

/** Inserta un lote de alertas ya enrutadas (cada una con su puerto). */
async function guardar(alertas) {
  if (!alertas.length) return 0;
  const valores = [];
  const reemplazos = {};
  alertas.forEach((a, i) => {
    valores.push(`(:id${i}, :pu${i}, :ni${i}, :ca${i}, :ti${i}, :me${i}, :lo${i}, :la${i}, :en${i}, :si${i}, :fe${i})`);
    Object.assign(reemplazos, {
      [`id${i}`]: String(a.id).slice(0, 200), [`pu${i}`]: a.puerto, [`ni${i}`]: a.nivel, [`ca${i}`]: a.categoria,
      [`ti${i}`]: String(a.titulo || '').slice(0, 200), [`me${i}`]: String(a.mensaje || '').slice(0, 500),
      [`lo${i}`]: a.coordenadas ? a.coordenadas[0] : null, [`la${i}`]: a.coordenadas ? a.coordenadas[1] : null,
      [`en${i}`]: String(a.entidad || '').slice(0, 200), [`si${i}`]: a.simulado ? 1 : 0, [`fe${i}`]: a.fecha,
    });
  });
  await ejecutar(`
    INSERT INTO dbo.TCL_AlertasMapa (id_alerta, id_puerto, nivel, categoria, titulo, mensaje, longitud, latitud, entidad, simulado, fecha)
    VALUES ${valores.join(', ')}`, reemplazos, QueryTypes.INSERT);
  return alertas.length;
}

/** Últimas alertas del puerto, más reciente primero, con el mismo formato que emite el socket. */
async function ultimas(puerto, limite = 20) {
  const filas = await ejecutar(`
    SELECT TOP (:limite) ${COLUMNAS}
    FROM dbo.TCL_AlertasMapa WITH (NOLOCK)
    WHERE id_puerto = :puerto
    ORDER BY fecha DESC, id DESC`, { puerto, limite });
  return filas.map(aAlerta);
}

const COLUMNAS = `id_alerta, id_puerto, nivel, categoria, titulo, mensaje, longitud, latitud, entidad,
           CAST(simulado AS INT) AS simulado, fecha`;

const aAlerta = (f) => ({
  id: f.id_alerta, puerto: f.id_puerto, nivel: f.nivel, categoria: f.categoria, titulo: f.titulo, mensaje: f.mensaje,
  coordenadas: f.longitud != null && f.latitud != null ? [Number(f.longitud), Number(f.latitud)] : null,
  entidad: f.entidad, simulado: f.simulado === 1, fecha: f.fecha,
});

/** Alertas del puerto en la ventana [desde, hasta] (ISO), en orden cronológico. Para el modo reproducir del mapa. */
async function entre(puerto, desde, hasta, limite = 500) {
  const filas = await ejecutar(`
    SELECT TOP (:limite) ${COLUMNAS}
    FROM dbo.TCL_AlertasMapa WITH (NOLOCK)
    WHERE id_puerto = :puerto AND fecha >= :desde AND fecha <= :hasta
    ORDER BY fecha, id`, { puerto, desde, hasta, limite });
  return filas.map(aAlerta);
}

/** Borra alertas anteriores a la fecha ISO dada. */
async function purgar(antesDeIso) {
  await ejecutar('DELETE FROM dbo.TCL_AlertasMapa WHERE fecha < :antes', { antes: antesDeIso }, QueryTypes.DELETE);
}

async function reglas() {
  const filas = await ejecutar(`
    SELECT codigo_regla, id_puerto, CAST(activa AS INT) AS activa,
           CAST(umbral_1 AS FLOAT) AS umbral_1, CAST(umbral_2 AS FLOAT) AS umbral_2, CAST(umbral_3 AS FLOAT) AS umbral_3,
           enfriamiento_min, descripcion, fecha_modificacion, usuario_modificacion
    FROM dbo.TCL_ConfigAlertas WITH (NOLOCK)
    ORDER BY codigo_regla, id_puerto`);
  return filas.map((f) => ({ ...f, activa: f.activa === 1 }));
}

/** Crea o actualiza la configuración de una regla para un puerto ('*' = global). */
async function guardarRegla(f) {
  await ejecutar(`
    MERGE dbo.TCL_ConfigAlertas AS d
    USING (SELECT :codigo AS codigo_regla, :puerto AS id_puerto) AS o
      ON d.codigo_regla = o.codigo_regla AND d.id_puerto = o.id_puerto
    WHEN MATCHED THEN UPDATE SET activa = :activa, umbral_1 = :u1, umbral_2 = :u2, umbral_3 = :u3,
      enfriamiento_min = :enf, fecha_modificacion = :fecha, usuario_modificacion = :usuario
    WHEN NOT MATCHED THEN INSERT (codigo_regla, id_puerto, activa, umbral_1, umbral_2, umbral_3, enfriamiento_min, descripcion, fecha_modificacion, usuario_modificacion)
      VALUES (:codigo, :puerto, :activa, :u1, :u2, :u3, :enf, :descripcion, :fecha, :usuario);`, {
    codigo: f.codigo_regla, puerto: f.id_puerto, activa: f.activa ? 1 : 0,
    u1: f.umbral_1 ?? null, u2: f.umbral_2 ?? null, u3: f.umbral_3 ?? null, enf: f.enfriamiento_min,
    descripcion: f.descripcion || null, fecha: f.fecha_modificacion, usuario: f.usuario_modificacion || null,
  }, QueryTypes.UPSERT);
}

/** Quita la configuración propia de un puerto (vuelve a la global). La global no se borra. */
async function eliminarRegla(codigo, puerto) {
  await ejecutar(`DELETE FROM dbo.TCL_ConfigAlertas WHERE codigo_regla = :codigo AND id_puerto = :puerto AND id_puerto <> N'*'`,
    { codigo, puerto }, QueryTypes.DELETE);
}

module.exports = { guardar, ultimas, entre, purgar, reglas, guardarRegla, eliminarRegla };
