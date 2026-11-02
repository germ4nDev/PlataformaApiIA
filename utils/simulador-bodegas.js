/*
    Author: German Valencia
    Pattern: PORTTOS Núcleo puro (AD-16) - Simulador de bodegas y silos (OT-009, 2026-10-29)
    Description: Sin base de datos ni red; lo usan simulador-operacion.service.js y las pruebas.
      - Catálogo: si un puerto no tiene bodegas en TCL_MaestroBodegas, propone las suyas (decisión del usuario 2026-10-29:
        catálogos simulados rotulados SIMULADO). Cuántas y de qué tamaño sale de los muelles del puerto, nada fijo a un puerto.
        Código 'SIM-B<n>', así se distinguen de las reales a simple vista.
      - Ocupación de una bodega simulada: nivel propio de la bodega (semilla) con un ciclo semanal y otro diario; depende solo
        de la hora, así no hace falta guardar estado y dos ciclos seguidos dan valores continuos.
      - Movimientos de los últimos 7 días (la ventana del tablero) por bodega y por día: ingresos de buque y despachos en
        camión, reproducibles (semilla puerto + bodega + día). Los del futuro no se generan.
      Todo va con fuente SIMULADOR y simulado = 1 (lo pone el servicio).
*/
const { rngDe, hash32 } = require('./simulador-gate');

const HORA = 3600000;
const DIA = 24 * HORA;
const DIAS_MOVIMIENTOS = 7;
const PERFILES = Object.freeze([
  // tipo_almacenamiento, tipo_carga_principal, capacidad [t], productos, clientes, temperatura °C, humedad %
  ['SILO', 'Granel Sólido', [20000, 40000], ['Maíz amarillo', 'Trigo panadero', 'Soya', 'Cebada'], ['Solla S.A.', 'Harinera del Valle', 'Italcol', 'Contegral'], 22, 13],
  ['CUBIERTA', 'Fertilizantes', [10000, 20000], ['Urea granulada 46%', 'Fertilizante NPK', 'Cloruro de potasio'], ['Monómeros S.A.', 'Yara Colombia', 'Abocol'], 27, 58],
  ['COBERTIZO', 'Carga General', [8000, 18000], ['Bobinas de acero', 'Tubería', 'Madera aserrada', 'Cátodos de cobre'], ['Acerías Paz del Río', 'Tenaris', 'Pizano', 'Centelsa'], 28, 66],
  ['CUBIERTA', 'Azúcar y Café', [10000, 25000], ['Azúcar crudo', 'Café verde', 'Azúcar refinada'], ['Ingenio Providencia', 'Federación de Cafeteros', 'Riopaila Castilla'], 25, 60],
  ['REFRIGERADA', 'Carga Refrigerada', [5000, 12000], ['Banano', 'Pulpa de fruta', 'Pescado congelado'], ['Uniban', 'Banacol', 'Frutas de la Sabana'], -18, 85],
]);

const entre = (rng, a, b) => a + (b - a) * rng();
const entero = (rng, a, b) => Math.floor(entre(rng, a, b + 1));
const elegir = (rng, lista) => lista[Math.floor(rng() * lista.length) % lista.length];
const r1 = (n) => Math.round(n * 10) / 10;
const inicioDiaColombia = (ms) => { const c = ms - 5 * HORA; return c - (((c % DIA) + DIA) % DIA) + 5 * HORA; };

/** Estado operativo por ocupación (la misma regla de bodegas.model.js). */
const estadoPorOcupacion = (pct) => (pct >= 90 ? 'CRÍTICO' : pct >= 75 ? 'ALTO' : 'NORMAL');

/**
 * Catálogo simulado del puerto (sin inventario: lo pone ocupacion()).
 * @param {string} clave  puerto (semilla)
 * @param {{ muelles?: number }[]} terminales  del maestro; dan la escala
 */
function catalogoSimulado(clave, terminales = []) {
  const muelles = terminales.reduce((t, x) => t + Math.max(1, Number(x.muelles) || 0), 0) || 1;
  const n = Math.max(2, Math.min(5, Math.round(1.5 + muelles * 0.25)));
  const rng = rngDe(`${clave}|catalogo-bodegas`);
  const inicio = Math.floor(rng() * PERFILES.length);
  return Array.from({ length: n }, (_, i) => {
    const [tipoAlm, tipoCarga, [cmin, cmax], , , temp, hum] = PERFILES[(inicio + i) % PERFILES.length];
    return {
      codigo_bodega: `SIM-B${i + 1}`,
      nombre_bodega: `${tipoAlm === 'SILO' ? 'Silos' : tipoAlm === 'REFRIGERADA' ? 'Cámara' : 'Bodega'} ${i + 1} · ${tipoCarga}`,
      tipo_almacenamiento: tipoAlm,
      tipo_carga_principal: tipoCarga,
      capacidad_maxima_ton: Math.round(entre(rng, cmin, cmax) / 500) * 500,
      temperatura_c: r1(temp + entre(rng, -1.5, 1.5)),
      humedad_relativa_pct: Math.round(hum + entre(rng, -4, 4)),
    };
  });
}

/** Ocupación (%) de una bodega simulada a la hora dada: nivel propio + ciclo semanal + ciclo diario. */
function ocupacion(clave, codigo, ahoraMs) {
  const fase = (hash32(`${clave}|${codigo}`) % 1000) / 1000;
  const nivel = 50 + fase * 38;                                              // 50 % a 88 %
  const semana = 7 * Math.sin(2 * Math.PI * (ahoraMs / (7 * DIA) + fase));
  const dia = 2.5 * Math.sin(2 * Math.PI * (ahoraMs / DIA + fase * 3));
  return r1(Math.max(15, Math.min(98, nivel + semana + dia)));
}

/** Inventario y estado de una bodega simulada (fila del catálogo) a la hora dada. */
function inventario(clave, bodega, ahoraMs) {
  const pct = ocupacion(clave, bodega.codigo_bodega, ahoraMs);
  return { inventario_actual_ton: Math.round(Number(bodega.capacidad_maxima_ton) * pct / 100), estado_operativo: estadoPorOcupacion(pct) };
}

const perfilDe = (b) => PERFILES.find((p) => p[1] === b.tipo_carga_principal)
  || PERFILES[hash32(b.tipo_carga_principal || b.codigo_bodega) % PERFILES.length];

/**
 * Movimientos de los últimos 7 días de las bodegas dadas (reales o simuladas), hasta 'ahoraMs'.
 * @param {{ id_bodega:number, codigo_bodega:string, nombre_bodega:string, capacidad_maxima_ton:number, tipo_carga_principal?:string }[]} bodegas
 * @returns {object[]} filas de TCL_MovimientosBodega (sin id_puerto, fuente ni simulado: los pone el servicio)
 */
function movimientosSimulados(clave, bodegas, ahoraMs, dias = DIAS_MOVIMIENTOS) {
  const filas = [];
  const hoy = inicioDiaColombia(ahoraMs);
  for (const b of bodegas) {
    const [, , , productos, clientes] = perfilDe(b);
    const escala = Math.max(0.3, (Number(b.capacidad_maxima_ton) || 10000) / 20000);
    for (let d = dias - 1; d >= 0; d--) {
      const dia = hoy - d * DIA;
      const rng = rngDe(`${clave}|${b.codigo_bodega}|${new Date(dia).toISOString().slice(0, 10)}`);
      const lista = [];
      for (let i = entero(rng, 0, 2); i > 0; i--) lista.push(['INGRESO BUQUE', Math.round(entre(rng, 1500, 5500) * escala / 10) * 10]);
      for (let i = entero(rng, 2, 5); i > 0; i--) lista.push(['DESPACHO CAMIÓN', Math.round(entre(rng, 150, 1100) * escala / 10) * 10]);
      if (rng() < 0.15) lista.push(['TRASLADO INTERNO', Math.round(entre(rng, 100, 600) / 10) * 10]);
      lista.forEach(([tipo, ton], i) => {
        const fecha = dia + Math.floor(entre(rng, 6, 22) * HORA);
        const producto = elegir(rng, productos);
        const cliente = elegir(rng, clientes);
        const lote = `BL-SIM-${String(hash32(`${clave}|${b.codigo_bodega}|${dia}|${i}`)).slice(-6)}`;
        if (fecha > ahoraMs) return;
        const horasAtras = (ahoraMs - fecha) / HORA;
        const estado = tipo === 'INGRESO BUQUE' ? (horasAtras < 6 ? 'En descargue' : 'Almacenado')
          : tipo === 'DESPACHO CAMIÓN' ? (horasAtras < 3 ? 'En despacho' : 'Despachado') : 'Trasladado';
        filas.push({
          id_bodega: b.id_bodega, nombre_bodega: b.nombre_bodega, lote_bl: lote, producto, tipo_operacion: tipo,
          toneladas: ton, cliente, dias_almacenaje: Math.max(1, Math.floor((ahoraMs - fecha) / DIA)), estado,
          fechaCreacion: new Date(fecha).toISOString(),
        });
      });
    }
  }
  return filas.sort((a, b) => b.fechaCreacion.localeCompare(a.fechaCreacion));
}

module.exports = { PERFILES, DIAS_MOVIMIENTOS, estadoPorOcupacion, catalogoSimulado, ocupacion, inventario, movimientosSimulados };
