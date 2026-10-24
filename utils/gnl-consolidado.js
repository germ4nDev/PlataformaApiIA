/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Consolidación e historial de la telemetría GNL (Fase 3, 2026-10-25)
    Description: Sin base de datos ni red.
      - consolidar(lecturas): el cold path (cada 5 min) guarda UNA fila por brazo. Antes mezclaba todos los brazos en
        una fila con el código del primero y sumaba caudales por segundo (m³/h) como si fueran volúmenes, así la energía
        salía unas 3.600 veces mayor. Ahora: volumen = Σ caudal (m³/h) × Δt (h), con Δt = segundos entre lecturas
        (1 s por defecto); energía = volumen × 22,4 MMBTU/m³ (la misma regla del front); BOG = Σ bog (kg/h) × Δt.
      - serieHistorial(filas, horas): serie por hora para la vista ampliada (volumen, energía, presión, temperatura,
        alarmas) y el volumen por brazo.
*/
const C = require('./tablero-comun');

const MMBTU_POR_M3 = 22.4;
const num = (v) => (Number.isFinite(Number(v)) ? Number(v) : 0);

function consolidar(lecturas = []) {
  const porBrazo = new Map();
  for (const l of lecturas) {
    const k = l.codigo_segmento || 'SIN_BRAZO';
    if (!porBrazo.has(k)) porBrazo.set(k, []);
    porBrazo.get(k).push(l);
  }
  return [...porBrazo.entries()].map(([codigo, ls]) => {
    const orden = [...ls].sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp));
    let volumen = 0;
    let bog = 0;
    orden.forEach((l, i) => {
      const sig = orden[i + 1];
      const dtS = sig ? Math.min(60, Math.max(0, (Date.parse(sig.timestamp) - Date.parse(l.timestamp)) / 1000)) || 1 : 1;
      volumen += (num(l.caudal_m3h ?? l.flujo_m3) * dtS) / 3600;
      bog += (num(l.bog) * dtS) / 3600;
    });
    const n = orden.length;
    return {
      id_puerto: orden[0].id_puerto,
      codigo_segmento: codigo,
      fecha_inicio_lectura: orden[0].timestamp,
      fecha_fin_lectura: orden[n - 1].timestamp,
      presion_promedio_psi: C.redondear(orden.reduce((a, l) => a + num(l.presion_psi ?? l.presion), 0) / n, 2),
      temperatura_promedio_celsius: C.redondear(orden.reduce((a, l) => a + num(l.temperatura_celsius ?? l.temp_ducto), 0) / n, 2),
      flujo_total_m3: C.redondear(volumen, 2),
      bog_calculado_m3: C.redondear(bog, 2),
      energia_total_mmbtu: C.redondear(volumen * MMBTU_POR_M3, 4),
      alertas_disparadas: orden.filter((l) => l.alarma_activa).length,
      lecturas: n,
    };
  });
}

/** Serie por hora de las filas consolidadas (vista ampliada). */
function serieHistorial(filas = [], horas = 24, ahora = new Date()) {
  const fin = C.inicioHora(ahora.getTime());
  const horasMs = Array.from({ length: horas }, (_, i) => fin - (horas - 1 - i) * 3600000);
  const indice = new Map(horasMs.map((h, i) => [h, i]));
  const vacio = () => horasMs.map(() => 0);
  const volumen = vacio(); const energia = vacio(); const alarmas = vacio();
  const presion = horasMs.map(() => []); const temp = horasMs.map(() => []);
  const porBrazo = new Map();
  for (const f of filas) {
    const i = indice.get(C.inicioHora(Date.parse(f.fecha_inicio_lectura)));
    if (i === undefined) continue;
    volumen[i] += num(f.flujo_total_m3);
    energia[i] += num(f.energia_total_mmbtu);
    alarmas[i] += num(f.alertas_disparadas);
    presion[i].push(num(f.presion_promedio_psi));
    temp[i].push(num(f.temperatura_promedio_celsius));
    const b = f.codigo_segmento || 'SIN_BRAZO';
    if (!porBrazo.has(b)) porBrazo.set(b, vacio());
    porBrazo.get(b)[i] += num(f.flujo_total_m3);
  }
  const prom = (l) => (l.length ? C.redondear(l.reduce((a, b) => a + b, 0) / l.length, 2) : null);
  return {
    labels: horasMs.map(horas > 48 ? (h) => `${new Date(h - 5 * 3600000).toISOString().slice(8, 10)}/${C.etiquetaHora(h)}` : C.etiquetaHora),
    volumenM3: volumen.map((v) => C.redondear(v, 2)),
    energiaMmbtu: energia.map((v) => C.redondear(v, 3)),
    presionPsi: presion.map(prom),
    temperaturaC: temp.map(prom),
    alarmas,
    porBrazo: [...porBrazo.entries()].map(([brazo, valores]) => ({ brazo, volumenM3: valores.map((v) => C.redondear(v, 2)), total: C.redondear(C.suma(valores), 2) }))
      .sort((a, b) => b.total - a.total),
    filas: filas.length,
    horas,
  };
}

module.exports = { MMBTU_POR_M3, consolidar, serieHistorial };
