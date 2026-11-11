/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Metadatos de las pestañas para web y app (OT-008, 2026-10-29)
    Description: Agrega a cada pestaña lo que la web y la app necesitan de la BD. Sin red ni base.
        conEstilo(pestanas, estilos, zonas) → pestañas planas con `icono`, `color` y `zonaDinamica` (null si no hay)
      - icono: nombre neutro (letras, números, guion o guion bajo; máx. 60); cada cliente lo dibuja con su juego de íconos.
      - color: hexadecimal #RGB, #RRGGBB o #RRGGBBAA. Un valor que no cumple se descarta (null) y el cliente usa su respaldo.
      - zonaDinamica: la de PTL_CfgZonasDinamicas (las terminales de Marítimo); la regla de layout la toma de aquí porque
        /api/layout/plantilla no la entrega (ver repositories/pestanas-metadatos.repository.js).
*/

const ICONO_VALIDO = /^[a-z0-9_-]{1,60}$/i;
const COLOR_VALIDO = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

const plano = (p) => (p && typeof p.toJSON === 'function' ? p.toJSON() : { ...p });

function conEstilo(pestanas, estilos = {}, zonas = {}) {
  return (Array.isArray(pestanas) ? pestanas : []).map((p) => {
    const fila = plano(p);
    const codigo = String(fila.codigoPestana || '').trim().toUpperCase();
    const e = estilos[codigo] || {};
    const icono = String(e.icono ?? '').trim();
    const color = String(e.color ?? '').trim();
    return {
      ...fila,
      icono: ICONO_VALIDO.test(icono) ? icono.toLowerCase() : null,
      color: COLOR_VALIDO.test(color) ? color.toUpperCase() : null,
      zonaDinamica: zonas[codigo] || null,
    };
  });
}

module.exports = { conEstilo };
