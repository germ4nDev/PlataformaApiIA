/*
    Author: German Valencia
    Pattern: PLATAFORMA Helper - Cargador de aplicaciones (regla 26 y 27; OT-032 fase 3a, CC-187)
    Description: el núcleo monta cada aplicación desde su manifiesto (apps/<app>/app.manifest.json, campo «entrada») sin nombrarla en
      el código: no hay require fijo hacia una app. La entrada de la app exporta, todos opcionales:
        - montarRutas(app)        sus rutas de Express (se llama donde antes estaban sus app.use, antes del manejador de errores)
        - alCargar({ io })        lo que corría al cargar el módulo (p. ej. simuladores)
        - alArrancar({ io })      lo que corre cuando el servidor ya escucha (cron, motores en segundo plano)
        - alApagar()              cierre ordenado (persistir buffers)
      Una app que falla al cargar o al arrancar se registra con ❌ y no tumba la plataforma ni a las demás apps.
*/
const fs = require('fs');
const path = require('path');

const RAIZ_APPS = path.join(__dirname, '..', 'apps');

/** Manifiestos con «entrada», en orden alfabético de carpeta (orden estable de montaje). */
function manifiestos(raiz = RAIZ_APPS) {
  if (!fs.existsSync(raiz)) return [];
  return fs.readdirSync(raiz, { withFileTypes: true })
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort()
    .map((nombre) => {
      const archivo = path.join(raiz, nombre, 'app.manifest.json');
      if (!fs.existsSync(archivo)) return null;
      try {
        const m = JSON.parse(fs.readFileSync(archivo, 'utf8'));
        return m && typeof m.entrada === 'string' && m.entrada.trim() ? { nombre, manifiesto: m, ruta: path.join(raiz, nombre, m.entrada) } : null;
      } catch (e) {
        console.error(`❌ [Apps] ${nombre}: app.manifest.json inválido (${e.message})`);
        return null;
      }
    })
    .filter(Boolean);
}

let cargadas = null;

function cargar() {
  if (cargadas) return cargadas;
  cargadas = [];
  for (const a of manifiestos()) {
    try {
      cargadas.push({ ...a, modulo: require(a.ruta) });
    } catch (e) {
      console.error(`❌ [Apps] ${a.nombre}: no se pudo cargar ${a.manifiesto.entrada} (${e.message})`);
    }
  }
  return cargadas;
}

function cada(gancho, ...args) {
  return cargar().map((a) => {
    const fn = a.modulo && a.modulo[gancho];
    if (typeof fn !== 'function') return null;
    try {
      return Promise.resolve(fn(...args)).catch((e) => console.error(`❌ [Apps] ${a.nombre}.${gancho}: ${e.message}`));
    } catch (e) {
      console.error(`❌ [Apps] ${a.nombre}.${gancho}: ${e.message}`);
      return null;
    }
  });
}

module.exports = {
  manifiestos,
  cargar,
  montarRutas: (app) => {
    for (const a of cargar()) {
      if (typeof a.modulo.montarRutas !== 'function') continue;
      try {
        a.modulo.montarRutas(app);
        console.log(`🧩 [Apps] ${a.manifiesto.nombre || a.nombre}: rutas montadas`);
      } catch (e) {
        console.error(`❌ [Apps] ${a.nombre}.montarRutas: ${e.message}`);
      }
    }
  },
  alCargar: (ctx) => cada('alCargar', ctx),
  alArrancar: (ctx) => cada('alArrancar', ctx),
  alApagar: () => Promise.all(cada('alApagar').filter(Boolean)),
};
