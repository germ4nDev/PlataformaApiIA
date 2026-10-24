/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Origen del dato (contrato común de todos los tableros)
    Description: Cada tablero (o nodo) publica de dónde salen sus cifras para que la vista ampliada lo diga:
      origen: { fuente, simulado, esRespaldo, periodo, generadoEn, nota }
      - simulado: la fila o el tablero salió del simulador (fuera de producción).
      - esRespaldo: la cifra es un valor de referencia, fijo o estimado porque la fuente no respondió o no existe.
      - nota: aclaraciones (p. ej. "12 citas con campos completados por defecto").
*/

/**
 * @param {{fuente:string, simulado?:boolean, esRespaldo?:boolean, periodo?:string|null, nota?:string|string[]|null}} p
 * @param {Date} [ahora]
 */
function origen({ fuente, simulado = false, esRespaldo = false, periodo = null, nota = null }, ahora = new Date()) {
  const notas = (Array.isArray(nota) ? nota : [nota]).filter(Boolean);
  return {
    fuente: fuente || null,
    simulado: !!simulado,
    esRespaldo: !!esRespaldo,
    periodo: periodo || null,
    generadoEn: ahora.toISOString(),
    nota: notas.length ? notas.join(' · ') : null,
  };
}

/** Une varios orígenes (p. ej. un tablero que mezcla fuentes): simulado/respaldo si alguno lo es. */
function combinar(origenes, ahora = new Date()) {
  const lista = (origenes || []).filter(Boolean);
  return origen({
    fuente: [...new Set(lista.map((o) => o.fuente).filter(Boolean))].join(' + '),
    simulado: lista.some((o) => o.simulado),
    esRespaldo: lista.some((o) => o.esRespaldo),
    periodo: [...new Set(lista.map((o) => o.periodo).filter(Boolean))].join(' · ') || null,
    nota: lista.map((o) => o.nota).filter(Boolean),
  }, ahora);
}

module.exports = { origen, combinar };
