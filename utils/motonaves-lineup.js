/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Motonaves del line-up en ventana de 72 h (Fase 3, 2026-10-25)
    Description: Sin base de datos ni red. El widget "Reporte de motonaves 72 h" traía todo el line-up activo.
      - fecha(): acepta ISO, Date y 'dd/mm/aaaa [hh:mm]' (el line-up trae ambos formatos).
      - enVentana(): sin atraque → ETA hasta ahora + 72 h (las atrasadas también); atracadas → sin zarpe o con zarpe en
        las últimas 24 h. Las filas sin ninguna fecha legible se conservan (no se puede decidir) y se cuentan.
*/
const H = 3600000;

function fecha(v) {
  if (!v) return null;
  if (v instanceof Date) return Number.isFinite(v.getTime()) ? v.getTime() : null;
  const t = String(v).trim();
  const m = t.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:[ T](\d{1,2}):(\d{2}))?/);
  if (m) {
    // Hora de Colombia (UTC-5)
    const ms = Date.UTC(Number(m[3]), Number(m[2]) - 1, Number(m[1]), Number(m[4] || 0) + 5, Number(m[5] || 0));
    return Number.isFinite(ms) ? ms : null;
  }
  const ms = Date.parse(t);
  return Number.isFinite(ms) ? ms : null;
}

/**
 * @param {object[]} filas  filas del line-up con fechaETA, fechaATA, fechaZarpe
 * @returns {{ filas: object[], fuera: number, sinFecha: number }}
 */
function enVentana(filas = [], ahora = new Date(), horas = 72) {
  const ahoraMs = ahora.getTime();
  let fuera = 0;
  let sinFecha = 0;
  const dentro = filas.filter((f) => {
    const eta = fecha(f.fechaETA);
    const ata = fecha(f.fechaATA);
    const zarpe = fecha(f.fechaZarpe);
    if (eta === null && ata === null) { sinFecha++; return true; }
    const ok = ata === null ? eta <= ahoraMs + horas * H : zarpe === null || zarpe >= ahoraMs - 24 * H;
    if (!ok) fuera++;
    return ok;
  });
  return { filas: dentro, fuera, sinFecha };
}

module.exports = { fecha, enVentana };
