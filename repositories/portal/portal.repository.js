/*
    Author: German Valencia
    Pattern: PORTTOS Repository - Portal público porttos.co (migración 025)
    Description:
      - config()                          filas de TCL_PortalConfig
      - secciones(pagina, idioma)         secciones de la página (todas: el núcleo filtra las activas)
      - elementos(idsSeccion)             tarjetas, pasos y cifras de esas secciones
      - planes() · caracteristicas() · comparativo() · comparativoValores()
      - preguntas(pagina, idioma)
      - cifras()                          { tableros, puertos } desde PTL_Pestanas (TLC_*) y TCL_MaestroPuertos (activos)
      - guardarMensaje(m) → id · marcarNotificado(id)
      Puertos en vivo (OT-011; tablas de la Torre de Control, no de la 025: si faltan, vacío y el núcleo dice «sin dato»):
      - puertosActivos()                  id, nombre y punto de los puertos activos del maestro
      - traficoMensual(idPuerto, desde)   toneladas por mes de Supertransporte (fuente SUPERTRANSPORTE y simulado = 0)
      - ultimaLecturaVias(zonas)          último reporte de TomTom en las zonas del puerto y en cualquiera: ¿la fuente está viva?
    Sin la 025 lanza migracionPendiente('025_portal_porttos.sql').
*/
const { QueryTypes } = require('sequelize');
const { db } = require('../../database/connection');
const { esColumnaInexistente, esTablaInexistente, migracionPendiente } = require('../../helpers/errores.helper');

const MIGRACION_025 = '025_portal_porttos.sql';

async function ejecutar(texto, replacements = {}, type = QueryTypes.SELECT) {
  try {
    return await db.sequelize.query(texto, { replacements, type });
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error) || /Invalid object name/i.test(error?.message || '')) throw migracionPendiente(MIGRACION_025);
    throw error;
  }
}

const config = () => ejecutar('SELECT clave, valor FROM dbo.TCL_PortalConfig');

const secciones = (pagina, idioma) => ejecutar(`
  SELECT id, pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, imagen, enlaceTexto, enlaceUrl, activo
  FROM dbo.TCL_PortalSecciones WHERE pagina = :pagina AND idioma = :idioma`, { pagina, idioma });

async function elementos(idsSeccion) {
  if (!idsSeccion || !idsSeccion.length) return [];
  return ejecutar(`
    SELECT id, idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl, activo
    FROM dbo.TCL_PortalElementos WHERE idSeccion IN (:idsSeccion)`, { idsSeccion });
}

const planes = () => ejecutar(`
  SELECT codigo, nombre, descripcion, precioMensual, precioAnual, moneda, etiquetaPrecio, destacado, orden, activo, fuente, simulado
  FROM dbo.TCL_PortalPlanes`);
const caracteristicas = () => ejecutar('SELECT id, codigoPlan, orden, texto, activo FROM dbo.TCL_PortalPlanCaracteristicas');
const comparativo = () => ejecutar('SELECT id, orden, concepto, activo FROM dbo.TCL_PortalComparativo');
const comparativoValores = () => ejecutar('SELECT idFila, codigoPlan, valor FROM dbo.TCL_PortalComparativoValores');

const preguntas = (pagina, idioma) => ejecutar(`
  SELECT id, orden, pregunta, respuesta, activo FROM dbo.TCL_PortalPreguntas
  WHERE pagina = :pagina AND idioma = :idioma AND activo = 1 ORDER BY orden, id`, { pagina, idioma });

/** Cifras reales del portal: pestañas de la Torre de Control activas y puertos activos del maestro. */
async function cifras() {
  const [fila] = await db.sequelize.query(`
    SELECT
      (SELECT COUNT(*) FROM dbo.PTL_Pestanas WHERE codigoPestana LIKE 'TLC[_]%' AND estado = 1) AS tableros,
      (SELECT COUNT(*) FROM dbo.TCL_MaestroPuertos WHERE COALESCE(estado, 1) = 1) AS puertos`, { type: QueryTypes.SELECT });
  return { tableros: fila?.tableros ?? null, puertos: fila?.puertos ?? null };
}

async function guardarMensaje(m) {
  const [fila] = await ejecutar(`
    INSERT INTO dbo.TCL_PortalMensajes (motivo, codigoPlan, nombre, empresa, correo, telefono, puerto, mensaje, aceptaDatos, origen)
    OUTPUT INSERTED.id
    VALUES (:motivo, :codigoPlan, :nombre, :empresa, :correo, :telefono, :puerto, :mensaje, :aceptaDatos, :origen)`, {
    motivo: m.motivo, codigoPlan: m.codigoPlan || null, nombre: m.nombre, empresa: m.empresa || null, correo: m.correo,
    telefono: m.telefono || null, puerto: m.puerto || null, mensaje: m.mensaje, aceptaDatos: m.aceptaDatos ? 1 : 0, origen: m.origen || null,
  });
  return fila?.id ?? null;
}

const marcarNotificado = (id) => ejecutar('UPDATE dbo.TCL_PortalMensajes SET notificado = 1 WHERE id = :id', { id }, QueryTypes.UPDATE);

const puertosActivos = () => db.sequelize.query(`
  SELECT id_puerto, nombre, ubicacion_geo.STStartPoint().STY AS lat, ubicacion_geo.STStartPoint().STX AS lon
  FROM dbo.TCL_MaestroPuertos WHERE COALESCE(estado, 1) = 1`, { type: QueryTypes.SELECT });

/** Nunca filas simuladas: el portal es público (también lo filtra el núcleo). */
const traficoMensual = (idPuerto, desdeAnio) => db.sequelize.query(`
  SELECT anio, mes, SUM(CAST(total_toneladas AS FLOAT)) AS toneladas, 'SUPERTRANSPORTE' AS fuente, 0 AS simulado,
         MAX(fecha_ingesta) AS lectura
  FROM dbo.TCL_HistoricosSupertransporte WITH (NOLOCK)
  WHERE id_puerto = :idPuerto AND fuente = 'SUPERTRANSPORTE' AND COALESCE(simulado, 0) = 0 AND anio >= :desdeAnio
  GROUP BY anio, mes`, { replacements: { idPuerto, desdeAnio }, type: QueryTypes.SELECT })
  .catch((error) => {
    if (esTablaInexistente(error) || esColumnaInexistente(error)) return [];
    throw error;
  });

/** Último reporte de TomTom en las zonas del puerto y en cualquier zona. Sin la 014 no se sabe cuándo leyó: { null, null }. */
async function ultimaLecturaVias(zonas = []) {
  try {
    const [fila] = await db.sequelize.query(`
      SELECT MAX(fechaUltimoReporte) AS global,
             MAX(CASE WHEN zonaFuente IN (:zonas) THEN fechaUltimoReporte END) AS zona
      FROM dbo.TCL_EventosViales WITH (NOLOCK) WHERE fuente = 'TOMTOM'`,
    { replacements: { zonas: zonas.length ? zonas : [''] }, type: QueryTypes.SELECT });
    return { zona: fila?.zona ?? null, global: fila?.global ?? null };
  } catch (error) {
    if (esTablaInexistente(error) || esColumnaInexistente(error)) return { zona: null, global: null };
    throw error;
  }
}

module.exports = {
  MIGRACION_025, config, secciones, elementos, planes, caracteristicas, comparativo, comparativoValores, preguntas, cifras,
  guardarMensaje, marcarNotificado, puertosActivos, traficoMensual, ultimaLecturaVias,
};
