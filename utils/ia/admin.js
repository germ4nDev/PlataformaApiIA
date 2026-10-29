/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Métricas del panel de administración de la capa de IA (fase 4)
    Description: Sin base de datos ni red. Resume las filas de uso (TCL_IAEjecuciones por día, tarea, puerto y
      estado) y las de precisión por tipo para el panel: totales por puerto y tarea, serie diaria de costo y
      llamadas, y tasas de acierto.
      Llamadas reales = OK + INVALIDA + ERROR (las que fueron al proveedor). Omitidas = por caché, presupuesto,
      cortacircuito o apagado: no cuestan.
*/
const REALES = new Set(['OK', 'INVALIDA', 'ERROR']);
const num = (v) => Number(v) || 0;
const r4 = (v) => Math.round(v * 10000) / 10000;

/** @returns {{ porPuerto: Object<string, Object<string, object>>, porDia: Array<{dia, llamadas, costoUsd, tokens}>, total: object }} */
function resumirUso(filas = []) {
  const vacio = () => ({ llamadas: 0, omitidas: 0, errores: 0, invalidas: 0, tokensEntrada: 0, tokensSalida: 0, tokensCache: 0, costoUsd: 0, latencias: [] });
  const porPuerto = {};
  const porDia = new Map();
  const total = vacio();
  filas.forEach((f) => {
    const puerto = f.puerto || '—';
    const tarea = f.codigoTarea || '—';
    porPuerto[puerto] = porPuerto[puerto] || {};
    const acc = (porPuerto[puerto][tarea] = porPuerto[puerto][tarea] || vacio());
    const dia = porDia.get(f.dia) || { dia: f.dia, llamadas: 0, costoUsd: 0, tokens: 0 };
    [acc, total].forEach((a) => {
      if (REALES.has(f.estado)) a.llamadas += num(f.llamadas); else a.omitidas += num(f.llamadas);
      if (f.estado === 'ERROR') a.errores += num(f.llamadas);
      if (f.estado === 'INVALIDA') a.invalidas += num(f.llamadas);
      a.tokensEntrada += num(f.tokensEntrada); a.tokensSalida += num(f.tokensSalida); a.tokensCache += num(f.tokensCache);
      a.costoUsd += num(f.costoUsd);
      if (f.latenciaMediaMs !== null && f.latenciaMediaMs !== undefined && REALES.has(f.estado)) a.latencias.push(num(f.latenciaMediaMs));
    });
    if (REALES.has(f.estado)) dia.llamadas += num(f.llamadas);
    dia.costoUsd += num(f.costoUsd); dia.tokens += num(f.tokensEntrada) + num(f.tokensSalida);
    porDia.set(f.dia, dia);
  });
  const cerrar = (a) => {
    const { latencias, ...resto } = a;
    return { ...resto, costoUsd: r4(a.costoUsd), latenciaMediaMs: latencias.length ? Math.round(latencias.reduce((x, y) => x + y, 0) / latencias.length) : null };
  };
  Object.values(porPuerto).forEach((tareas) => Object.keys(tareas).forEach((t) => { tareas[t] = cerrar(tareas[t]); }));
  return {
    porPuerto,
    porDia: [...porDia.values()].map((d) => ({ ...d, costoUsd: r4(d.costoUsd) })).sort((a, b) => String(a.dia).localeCompare(String(b.dia))),
    total: cerrar(total),
  };
}

const tasa = (a, b) => (a + b ? Math.round((a / (a + b)) * 100) : null);

/** Precisión agregada de un puerto (todas las filas por tipo de repo.precision). */
function precisionTotal(filas = []) {
  const s = (k) => filas.reduce((t, f) => t + num(f[k]), 0);
  return {
    alertas: s('alertas'), publicadas: s('publicadas'), seCumplieron: s('seCumplieron'), noSeCumplieron: s('noSeCumplieron'),
    votosUtiles: s('votosUtiles'), votosNoEra: s('votosNoEra'),
    precisionPct: tasa(s('seCumplieron'), s('noSeCumplieron')), utilPct: tasa(s('votosUtiles'), s('votosNoEra')),
  };
}

module.exports = { resumirUso, precisionTotal, tasa };
