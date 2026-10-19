/*
    Author: German Valencia
    Script: Capas de referencia OpenStreetMap para los editores espaciales (AD-17)
    Uso (desde PlataformaApiIA, en un equipo con internet):
        node scripts/osm-referencia.js --listar            puertos disponibles
        node scripts/osm-referencia.js cartagena tumaco    uno o varios puertos
        node scripts/osm-referencia.js todos               todos los de la lista
    Qué hace: descarga de api.openstreetmap.org el rectángulo de cada puerto (dividiéndolo en teselas),
      lo convierte con utils/osm-referencia.js y deja en el front:
        src/assets/data/referencia/osm_<puerto>_infraestructura.geojson
        mapa-selector/capas-referencia.generado.ts   (registro que lee el editor)
    No toca la base de datos. Datos © colaboradores de OpenStreetMap, licencia ODbL.
*/
const fs = require('fs');
const path = require('path');
const { mapaPorRectangulo } = require('../adapters/openstreetmap.adapter');
const { convertir, unirTeselas, resumen } = require('../utils/osm-referencia');

// Rectángulos [oeste, sur, este, norte] en grados. Ajustar aquí si un terminal queda por fuera.
const PUERTOS = {
  buenaventura:  { nombre: 'Buenaventura',                     bbox: [-77.200, 3.780, -77.020, 3.930] },
  tumaco:        { nombre: 'Tumaco',                           bbox: [-78.800, 1.770, -78.700, 1.840] },
  cartagena:     { nombre: 'Cartagena (bahía, Mamonal, Barú)', bbox: [-75.580, 10.280, -75.470, 10.430] },
  barranquilla:  { nombre: 'Barranquilla (río Magdalena)',     bbox: [-74.860, 10.940, -74.740, 11.110] },
  santa_marta:   { nombre: 'Santa Marta',                      bbox: [-74.235, 11.225, -74.195, 11.260] },
  cienaga:       { nombre: 'Ciénaga y Pozos Colorados',        bbox: [-74.300, 11.000, -74.180, 11.200] },
  puerto_bolivar:{ nombre: 'Puerto Bolívar (La Guajira)',      bbox: [-72.000, 12.180, -71.920, 12.270] },
  morrosquillo:  { nombre: 'Golfo de Morrosquillo (Coveñas, Tolú)', bbox: [-75.720, 9.380, -75.560, 9.560] },
  uraba:         { nombre: 'Urabá (Turbo, Puerto Antioquia)',  bbox: [-76.800, 7.850, -76.680, 8.150] },
  san_andres:    { nombre: 'San Andrés',                       bbox: [-81.730, 12.550, -81.680, 12.600] },
};

const FRONT = path.resolve(__dirname, '../../PlataformaIA/src');
const DIR_DATOS = path.join(FRONT, 'assets/data/referencia');
const REGISTRO = path.join(FRONT, 'app/theme/shared/components/tablero-control/mapa-selector/capas-referencia.generado.ts');
const LADO_TESELA = 0.05;   // grados; la API admite hasta 0,25 grados² pero se corta por 50.000 nodos
const LADO_MINIMO = 0.004;
const PAUSA_MS = 1500;      // entre peticiones, por la política de uso de OSM

const esperar = (ms) => new Promise((r) => setTimeout(r, ms));

function teselas([w, s, e, n]) {
  const lista = [];
  for (let x = w; x < e - 1e-9; x += LADO_TESELA) {
    for (let y = s; y < n - 1e-9; y += LADO_TESELA) {
      lista.push({ minLon: x, minLat: y, maxLon: Math.min(x + LADO_TESELA, e), maxLat: Math.min(y + LADO_TESELA, n) });
    }
  }
  return lista;
}

async function descargar(r, respuestas, nivel = 0) {
  try {
    await esperar(PAUSA_MS);
    respuestas.push(await mapaPorRectangulo(r));
    process.stdout.write('.');
  } catch (error) {
    const lado = Math.min(r.maxLon - r.minLon, r.maxLat - r.minLat);
    if (error.codigo !== 'DEMASIADOS_DATOS' || lado / 2 < LADO_MINIMO) throw error;
    process.stdout.write('÷');
    const mx = (r.minLon + r.maxLon) / 2, my = (r.minLat + r.maxLat) / 2;
    for (const q of [
      { minLon: r.minLon, minLat: r.minLat, maxLon: mx, maxLat: my }, { minLon: mx, minLat: r.minLat, maxLon: r.maxLon, maxLat: my },
      { minLon: r.minLon, minLat: my, maxLon: mx, maxLat: r.maxLat }, { minLon: mx, minLat: my, maxLon: r.maxLon, maxLat: r.maxLat },
    ]) await descargar(q, respuestas, nivel + 1);
  }
}

async function procesar(id) {
  const p = PUERTOS[id];
  const respuestas = [];
  process.stdout.write(`\n${p.nombre}: `);
  for (const t of teselas(p.bbox)) await descargar(t, respuestas);
  const fecha = new Date().toISOString().slice(0, 10);
  const fc = convertir(unirTeselas(respuestas), {
    puerto: id, fuente: `OpenStreetMap (ODbL) via api.openstreetmap.org, descargado ${fecha}`,
  });
  fs.mkdirSync(DIR_DATOS, { recursive: true });
  const archivo = path.join(DIR_DATOS, `osm_${id}_infraestructura.geojson`);
  const lineas = fc.features.map((f) => JSON.stringify(f));
  const { features, ...cabecera } = fc;
  fs.writeFileSync(archivo, `${JSON.stringify(cabecera).slice(0, -1)},"features":[\n${lineas.join(',\n')}\n]}\n`, 'utf8');
  const r = resumen(fc);
  console.log(`\n  ${fc.features.length} elementos → ${path.relative(FRONT, archivo)}`);
  console.log(`  áreas ${r.area_portuaria} · muelles ${r.muelle} · rompeolas ${r.rompeolas} · tanques ${r.tanque} · edificaciones ${r.edificacion_en_terminal}`);
  if (!r.area_portuaria) console.log('  ⚠ Sin áreas portuarias: revise el rectángulo o el trazado en OpenStreetMap.');
}

/** Regenera el registro del front con todos los archivos presentes en assets/data/referencia. */
function escribirRegistro() {
  const capas = fs.readdirSync(DIR_DATOS).filter((f) => /^osm_.+_infraestructura\.geojson$/.test(f)).sort().map((f) => {
    const id = f.replace(/^osm_|_infraestructura\.geojson$/g, '');
    const fc = JSON.parse(fs.readFileSync(path.join(DIR_DATOS, f), 'utf8'));
    let w = 180, s = 90, e = -180, n = -90;
    const recorrer = (c) => (typeof c[0] === 'number' ? (w = Math.min(w, c[0]), s = Math.min(s, c[1]), e = Math.max(e, c[0]), n = Math.max(n, c[1])) : c.forEach(recorrer));
    fc.features.forEach((ft) => recorrer(ft.geometry.coordinates));
    const generado = (fc.fuente || '').match(/\d{4}-\d{2}-\d{2}/)?.[0] || null;
    const r6 = (x) => Math.round(x * 1e4) / 1e4;
    return { id, nombre: PUERTOS[id]?.nombre || id, url: `assets/data/referencia/${f}`, bbox: [r6(w), r6(s), r6(e), r6(n)], elementos: fc.features.length, generado };
  }).filter((c) => c.elementos > 0);
  const ts = `// Generado por PlataformaApiIA/scripts/osm-referencia.js — no editar a mano.\n` +
    `// Datos © colaboradores de OpenStreetMap, licencia ODbL.\n\n` +
    `export interface CapaReferencia {\n    id: string;\n    nombre: string;\n    url: string;\n    /** [oeste, sur, este, norte] */\n    bbox: [number, number, number, number];\n    elementos: number;\n    generado: string | null;\n}\n\n` +
    `export const CAPAS_REFERENCIA: CapaReferencia[] = ${JSON.stringify(capas, null, 4)};\n`;
  fs.writeFileSync(REGISTRO, ts, 'utf8');
  console.log(`\nRegistro actualizado: ${capas.length} capa(s) → ${path.relative(FRONT, REGISTRO)}`);
}

async function main() {
  const args = process.argv.slice(2);
  if (!args.length || args.includes('--listar')) {
    console.log('Puertos disponibles:');
    Object.entries(PUERTOS).forEach(([id, p]) => console.log(`  ${id.padEnd(15)} ${p.nombre}`));
    console.log('\nUso: node scripts/osm-referencia.js <puerto...> | todos | --registro');
    return;
  }
  if (!args.includes('--registro')) {
    const ids = args.includes('todos') ? Object.keys(PUERTOS) : args;
    const desconocidos = ids.filter((id) => !PUERTOS[id]);
    if (desconocidos.length) { console.error(`Puerto(s) desconocido(s): ${desconocidos.join(', ')}. Use --listar.`); process.exitCode = 1; return; }
    for (const id of ids) {
      try { await procesar(id); } catch (error) { console.error(`\n  ✖ ${id}: ${error.message}`); process.exitCode = 1; }
    }
  }
  escribirRegistro();
}

if (require.main === module) main();
module.exports = { PUERTOS, teselas };
