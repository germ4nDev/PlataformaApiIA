/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Configuración efectiva por puerto y tarea (capa de IA, fase 4)
    Description: Sin base de datos ni red. Mezcla el .env (config/ia.config) con las filas de TCL_IAConfig que
      se editan en el panel de administración. Prioridad: fila del puerto > fila '*' > .env. En una fila, NULL
      significa «hereda» (migración 017). IA_ENABLED=false es el interruptor general: con él apagado ninguna
      tarea llama al modelo, diga lo que diga la tabla.
      Tareas:
        analista_turno   alertas tempranas cada IA_INTERVALO_MIN
        resumen_turno    cierre de turno y resumen diario (si está apagada o sin modelo: resumen automático)
        asistente        preguntas de los usuarios (fase 5); el puerto es el de la pregunta ('*' si no trae)
        filtro           clasificador de alcance de esas preguntas (usa los topes de su propia fila)
*/
const TAREAS = Object.freeze({
  analista_turno: { nombre: 'Analista de turno', descripcion: 'Alertas tempranas y tendencias cada intervalo' },
  resumen_turno: { nombre: 'Resúmenes', descripcion: 'Cierre de turno y resumen diario para el jefe de turno' },
  asistente: { nombre: 'Asistente', descripcion: 'Preguntas de los usuarios sobre la operación, con herramientas de lectura' },
  filtro: { nombre: 'Filtro de alcance', descripcion: 'Decide si una pregunta está dentro del proceso logístico portuario' },
});
const CODIGOS_TAREA = Object.keys(TAREAS);

const nulo = (v) => v === null || v === undefined;
const bit = (v) => (nulo(v) ? null : v === true || v === 1 || v === '1' || String(v).toLowerCase() === 'true');
const lista = (v) => (nulo(v) || String(v).trim() === '' ? null : String(v).split(',').map((s) => s.trim().toLowerCase()).filter(Boolean));
const norm = (p) => String(p || '').trim().toUpperCase();

/**
 * @param {Array<object>} filas   TCL_IAConfig (puerto, codigoTarea, activo, modoSombra, topeTokensDia, topeLlamadasDia, confianzaMinima, tiposPublicar)
 * @param {string} puerto         clave canónica (BUENAVENTURA)
 * @param {string} tarea
 * @param {object} env            leerConfigIA()
 * @returns {{ habilitada:boolean, activa:boolean, modoSombra:boolean, topeLlamadasDia:number, topeTokensDia:number,
 *            confianzaMinima:number, tiposPublicar:string[], origen:Object<string,'env'|'*'|'puerto'> }}
 */
function resolverConfig(filas = [], puerto, tarea, env) {
  const general = filas.find((f) => norm(f.puerto) === '*' && f.codigoTarea === tarea) || null;
  const propia = filas.find((f) => norm(f.puerto) === norm(puerto) && f.codigoTarea === tarea) || null;
  const base = {
    activa: true, modoSombra: !!env.modoSombra, topeLlamadasDia: env.topeLlamadasDia, topeTokensDia: env.topeTokensDia,
    confianzaMinima: env.confianzaMinima, tiposPublicar: env.tiposPublicar || ['todos'],
  };
  const lectores = {
    activa: (f) => bit(f.activo), modoSombra: (f) => bit(f.modoSombra),
    topeLlamadasDia: (f) => (nulo(f.topeLlamadasDia) ? null : Number(f.topeLlamadasDia)),
    topeTokensDia: (f) => (nulo(f.topeTokensDia) ? null : Number(f.topeTokensDia)),
    confianzaMinima: (f) => (nulo(f.confianzaMinima) ? null : Number(f.confianzaMinima)),
    tiposPublicar: (f) => lista(f.tiposPublicar),
  };
  const efectiva = { ...base };
  const origen = Object.fromEntries(Object.keys(base).map((k) => [k, 'env']));
  [[general, '*'], [propia, 'puerto']].forEach(([fila, nivel]) => {
    if (!fila) return;
    Object.entries(lectores).forEach(([campo, leer]) => {
      const v = leer(fila);
      if (v !== null && !(typeof v === 'number' && !Number.isFinite(v))) { efectiva[campo] = v; origen[campo] = nivel; }
    });
  });
  return { ...efectiva, habilitada: !!env.habilitada && efectiva.activa, origen };
}

module.exports = { TAREAS, CODIGOS_TAREA, resolverConfig };
