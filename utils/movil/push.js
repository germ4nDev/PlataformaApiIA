/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Notificaciones push de la app móvil (fase 3)
    Description: Sin base de datos ni red. Decide a quién y qué se envía cuando el Analista IA publica alertas:
      - aceptaPuerto(lista, puerto)       'TODOS' o lista separada por comas (sin distinguir mayúsculas ni tildes)
      - cumpleSeveridad(sev, minima)      minima 'critica' → solo críticas; 'atencion' → atención y críticas
      - planEnvios(dispositivos, puerto, hallazgos, yaEnviados, maxPorTurno)
          → [{ dispositivo, hallazgos[], resumen: boolean }] un mensaje por alerta, o uno solo de resumen si son más de
            maxPorTurno; nunca repite una alerta al mismo dispositivo.
      - mensaje(hallazgos, puerto, idioma, resumen) → { titulo, cuerpo, datos }   (datos: tipo, puerto, id, ruta)
      - normalizarPreferencias(body) para el registro.
*/

const quitarTildes = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toUpperCase();
const RANGO = { info: 0, atencion: 1, critica: 2 };

function aceptaPuerto(lista, puerto) {
  const l = String(lista || 'TODOS').split(',').map(quitarTildes).filter(Boolean);
  return !l.length || l.includes('TODOS') || l.includes(quitarTildes(puerto));
}

function cumpleSeveridad(severidad, minima = 'critica') {
  const s = RANGO[String(severidad || '').toLowerCase()];
  return s !== undefined && s >= (minima === 'atencion' ? RANGO.atencion : RANGO.critica);
}

const TEXTOS = {
  es: {
    critica: 'Alerta crítica', atencion: 'Atención',
    resumen: (n, p) => `${n} alertas tempranas en ${p}`,
    resumenCuerpo: (t) => `${t.join(' · ')}`.slice(0, 380),
    horizonte: (a, b) => (a !== null && a !== undefined ? ` · en ${a}-${b} h` : ''),
    simulado: 'SIMULADO', prueba: 'Notificación de prueba', pruebaCuerpo: 'Si ves esto, Porttos puede avisarte de las alertas tempranas.',
  },
  en: {
    critica: 'Critical alert', atencion: 'Warning',
    resumen: (n, p) => `${n} early warnings in ${p}`,
    resumenCuerpo: (t) => `${t.join(' · ')}`.slice(0, 380),
    horizonte: (a, b) => (a !== null && a !== undefined ? ` · in ${a}-${b} h` : ''),
    simulado: 'SIMULATED', prueba: 'Test notification', pruebaCuerpo: 'If you see this, Porttos can notify you about early warnings.',
  },
};
const textos = (idioma) => TEXTOS[idioma === 'en' ? 'en' : 'es'];

function mensaje(hallazgos, puerto, idioma = 'es', resumen = false) {
  const t = textos(idioma);
  const datos = { tipo: 'ia-alerta', puerto, ruta: '/app/alertas' };
  if (resumen) {
    const criticas = hallazgos.filter((h) => h.severidad === 'critica').length;
    return {
      titulo: `${criticas ? '🔴 ' : '🟠 '}${t.resumen(hallazgos.length, puerto)}`,
      cuerpo: t.resumenCuerpo(hallazgos.slice(0, 4).map((h) => h.titulo)),
      datos: { ...datos, ids: hallazgos.map((h) => h.id).join(',') },
    };
  }
  const h = hallazgos[0];
  return {
    titulo: `${h.severidad === 'critica' ? '🔴' : '🟠'} ${t[h.severidad] || t.atencion} · ${puerto}`,
    cuerpo: `${h.titulo}${t.horizonte(h.horizonteMinH, h.horizonteMaxH)}${h.soloSimulado ? ` · ${t.simulado}` : ''}`.slice(0, 400),
    datos: { ...datos, id: h.id },
  };
}

function mensajePrueba(idioma = 'es') {
  const t = textos(idioma);
  return { titulo: t.prueba, cuerpo: t.pruebaCuerpo, datos: { tipo: 'prueba', ruta: '/app/ajustes' } };
}

function planEnvios(dispositivos, puerto, hallazgos, yaEnviados = [], maxPorTurno = 3) {
  const enviados = new Set((yaEnviados || []).map((e) => `${e.idHallazgo}|${e.idDispositivo}`));
  const alertas = (hallazgos || []).filter((h) => h && h.id !== undefined && h.clase !== 'RESUMEN' && h.clase !== 'TENDENCIA');
  const plan = [];
  for (const d of dispositivos || []) {
    if (!aceptaPuerto(d.puertos, puerto)) continue;
    const suyos = alertas
      .filter((h) => cumpleSeveridad(h.severidad, d.severidadMinima) && !enviados.has(`${h.id}|${d.id}`))
      .sort((a, b) => (RANGO[b.severidad] || 0) - (RANGO[a.severidad] || 0));
    if (!suyos.length) continue;
    if (suyos.length > maxPorTurno) plan.push({ dispositivo: d, hallazgos: suyos, resumen: true });
    else suyos.forEach((h) => plan.push({ dispositivo: d, hallazgos: [h], resumen: false }));
  }
  return plan;
}

function normalizarPreferencias({ puertos, severidadMinima, idioma } = {}) {
  const lista = Array.isArray(puertos) ? puertos : String(puertos || 'TODOS').split(',');
  const limpios = [...new Set(lista.map(quitarTildes).filter(Boolean))];
  return {
    puertos: !limpios.length || limpios.includes('TODOS') ? 'TODOS' : limpios.join(',').slice(0, 400),
    severidadMinima: severidadMinima === 'atencion' ? 'atencion' : 'critica',
    idioma: idioma === 'en' ? 'en' : 'es',
  };
}

module.exports = { aceptaPuerto, cumpleSeveridad, mensaje, mensajePrueba, planEnvios, normalizarPreferencias, quitarTildes };
