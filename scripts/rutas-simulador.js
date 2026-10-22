/*
    Author: German Valencia
    Script: Ajusta las rutas del simulador de flota a la red vial real (INVIAS/IGAC)
    Uso (desde PlataformaApiIA, con el .env de la base y conexión a internet):
        node --max-old-space-size=4096 scripts/rutas-simulador.js            vista previa: no escribe en la base
        node --max-old-space-size=4096 scripts/rutas-simulador.js --escribir reemplaza los waypoints
        ... --ruta 2                                                         solo esa ruta (se puede repetir)
        ... --fuente red                                                     sin internet: red vial INVIAS/IGAC del front
        ... --red <archivo.geojson>                                          otra red vial (por defecto la completa del front)
    Qué hace: lee TCL_SimuladorWaypoints y busca el camino por la vía con OSRM (OpenStreetMap, la misma cartografía
      del fondo del mapa; adapters/osrm.adapter.js, OSRM_URL en el .env) o, con --fuente red, por la red vial
      INVIAS/IGAC (utils/ruteo-vial.js; esa red es solo la nacional y no trae las vías concesionadas). Deja en scripts/salidas/rutas-simulador-vista.geojson la ruta original (gris) y la ajustada (verde)
      para revisarlas en geojson.io o QGIS. Con --escribir reemplaza los waypoints (la primera vez guarda
      TCL_SimuladorWaypoints_respaldo), actualiza max_pasos y el paso de cada camión. Reiniciar el API después.
    Reversa: DELETE FROM TCL_SimuladorWaypoints; INSERT INTO TCL_SimuladorWaypoints SELECT * FROM TCL_SimuladorWaypoints_respaldo;
             y volver max_pasos a 200 en TCL_SimuladorRutas.
*/
require('dotenv').config();
const fs = require('fs');
const path = require('path');
const SimuladorFlotaService = require('../services/torre-control/simulador-flota.service');

const args = process.argv.slice(2);
const valor = (bandera) => args.flatMap((a, i) => (a === bandera ? [args[i + 1]] : []));
const escribir = args.includes('--escribir');
const fuente = valor('--fuente')[0] === 'red' ? 'red' : 'osrm';
const ids = valor('--ruta').map(Number).filter(Number.isFinite);
const RED = valor('--red')[0] || path.resolve(__dirname, '../../PlataformaIA/src/assets/data/Red_Vial_20260626.geojson');
const SALIDA = path.join(__dirname, 'salidas', 'rutas-simulador-vista.geojson');

(async () => {
  // La red vial se lee siempre: es el respaldo si OSRM no responde
  console.log(`Leyendo la red vial: ${RED}`);
  const red = fs.existsSync(RED) ? JSON.parse(fs.readFileSync(RED, 'utf8')) : { features: [] };
  console.log(`  ${red.features.length} tramos · fuente principal: ${fuente === 'osrm' ? 'OSRM (OpenStreetMap)' : 'red vial'}`);
  const informe = await SimuladorFlotaService.ajustarRutasALaVia(red.features, { escribir, fuente, ids: ids.length ? ids : null });

  const features = informe.flatMap((r) => [
    { type: 'Feature', properties: { ruta: r.id, version: 'original', stroke: '#94a3b8', 'stroke-width': 2 }, geometry: { type: 'LineString', coordinates: r.original } },
    { type: 'Feature', properties: { ruta: r.id, version: 'ajustada', stroke: '#16a34a', 'stroke-width': 3 }, geometry: { type: 'LineString', coordinates: r.ajustada } },
  ]);
  fs.mkdirSync(path.dirname(SALIDA), { recursive: true });
  fs.writeFileSync(SALIDA, JSON.stringify({ type: 'FeatureCollection', features }));

  console.table(informe.map((r) => ({
    ruta: r.id, fuente: r.fuente, 'puntos antes': r.puntosAntes, 'puntos después': r.puntosDespues, 'km antes': r.kmAntes, 'km después': r.kmDespues,
    'tramos ajustados': r.ajustados, 'tramos sin ajustar': r.sinAjuste.length, escrito: r.escrito ? 'sí' : 'no',
  })));
  informe.forEach((r) => r.aviso && console.log(`  ruta ${r.id}: ${r.aviso}`));
  informe.forEach((r) => r.sinAjuste.forEach((s) => console.log(`  ruta ${r.id}: waypoints ${s.desde}-${s.hasta} sin ajustar (${s.motivo})`)));
  console.log(`Vista previa: ${SALIDA}`);
  console.log(escribir ? 'Waypoints reemplazados. Reinicia el API.' : 'No se escribió nada. Revisa la vista previa y corre con --escribir.');
  process.exit(0);
})().catch((e) => { console.error('❌', e.message || e); process.exit(1); });
