/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Señal AIS del puerto
    Description: Dice si la capa de naves está en vivo o si el AIS dejó de reportar en la caja del puerto, para que el mapa
      (web y app) lo diga en lugar de mostrarse vacío sin explicación (datos honestos). Sin red ni base.
        estadoSenalAis({ naves, ultima, ahora, horasVigencia }) →
          { estado: 'en_vivo' | 'sin_senal' | 'sin_registro', ultima: ISO | null, horasSinSenal: number | null }
      - en_vivo: hay naves vigentes en la caja.
      - sin_senal: no hay naves vigentes, pero hubo una posición en la caja (la de `ultima`).
      - sin_registro: nunca llegó una posición AIS a la caja del puerto.
*/

const HORAS_VIGENCIA = 24;

const aIso = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const t = v instanceof Date ? v.getTime() : Date.parse(v);
  return Number.isFinite(t) ? new Date(t).toISOString() : null;
};

function estadoSenalAis({ naves = 0, ultima = null, ahora = new Date(), horasVigencia = HORAS_VIGENCIA } = {}) {
  const iso = aIso(ultima);
  const horasSinSenal = iso ? Math.max(0, Math.floor((ahora.getTime() - Date.parse(iso)) / 3600000)) : null;
  if (Number(naves) > 0) return { estado: 'en_vivo', ultima: iso, horasSinSenal: null };
  if (!iso) return { estado: 'sin_registro', ultima: null, horasSinSenal: null };
  // Sin naves vigentes: si la última posición aún está dentro de la vigencia, la caja simplemente está vacía (en vivo)
  if (horasSinSenal < horasVigencia) return { estado: 'en_vivo', ultima: iso, horasSinSenal: null };
  return { estado: 'sin_senal', ultima: iso, horasSinSenal };
}

module.exports = { HORAS_VIGENCIA, estadoSenalAis };
