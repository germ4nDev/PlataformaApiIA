/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Catálogos simples (Utilidades › Catálogos, CC-204; AD-16, sin base ni red)
    Usuario 2026-11-15 (grupo 2 de las tablas sin pantalla): tipos de rol, de widget, de pago, de paquete, de actividad, tipos de
    estado y estados, con el patrón de los módulos de administración (regla 19) y una sola pieza para todos (regla 10).
      CATALOGOS              definición de cada catálogo: tabla, llave, columna de estado, campos, usos y evento de socket
      catalogo(clave)        la definición o null
      normalizar(def, body)  trim, mayúsculas donde va, números, '' → null (o '' si la columna no admite nulos), estado por defecto activo
      revisar(def, p, { nuevo })   [] o la lista de { campo, mensaje }; el código solo se revisa al crear (no cambia al editar)
      columnas(def)          columnas que se escriben (campos + estado)
    Los nombres de tabla y columna salen solo de aquí y se validan al cargar: el repositorio los pone en el SQL sin riesgo.
*/
const IDENT = /^[A-Za-z_][A-Za-z0-9_]*$/;
const CODIGO = /^[A-Z0-9_]+$/;

const CATALOGOS = {
  'tipos-rol': {
    tabla: 'PTL_TiposRole', llave: 'codigoTipoRole', estado: 'estadoTipoRole', orden: 'nombreTipoRole',
    evento: 'tipos-roles-actualizados', nombre: 'tipo de rol', permiso: 'ACT_TIPOSROLE',
    campos: [
      { nombre: 'codigoTipoRole', tipo: 'codigo', max: 200, requerido: true },
      { nombre: 'nombreTipoRole', tipo: 'texto', max: 100, requerido: true, mayusculas: true },
      { nombre: 'descripcionTipoRole', tipo: 'texto', max: 4000 },
    ],
    usos: [{ tabla: 'PTL_RolesAP', columna: 'codigoTipoRole', que: 'rol(es)' }],
  },
  'tipos-widget': {
    tabla: 'PTL_TiposWidget', llave: 'codigoTipo', estado: 'estado', orden: 'nombreTipo',
    evento: 'tipos-widget-actualizados', nombre: 'tipo de widget', permiso: 'ACT_TIPOSWDGT',
    campos: [
      { nombre: 'codigoTipo', tipo: 'codigo', max: 200, requerido: true },
      { nombre: 'nombreTipo', tipo: 'texto', max: 100, requerido: true },
      { nombre: 'descripcion', tipo: 'texto', max: 4000 },
    ],
    usos: [{ tabla: 'PTL_WidgetsMaestro', columna: 'codigoTipo', que: 'widget(s)' }],
  },
  'tipos-pago': {
    tabla: 'PTL_TiposPago', llave: 'codigoTipoPago', estado: 'estadoTipo', orden: 'nombreTipoPago',
    evento: 'tipos-pago-actualizados', nombre: 'tipo de pago', permiso: 'ACT_TIPOSPAGO',
    campos: [
      { nombre: 'codigoTipoPago', tipo: 'codigo', max: 200, requerido: true },
      { nombre: 'nombreTipoPago', tipo: 'texto', max: 100, requerido: true, mayusculas: true },
      { nombre: 'descripcionTipo', tipo: 'texto', max: 4000 },
    ],
    usos: [{ tabla: 'PTL_HistorialFacturacion', columna: 'codigoTipoPago', que: 'registro(s) de facturación' }],
  },
  'tipos-paquete': {
    tabla: 'PTL_TiposPaquete', llave: 'codigoTipoPaquete', estado: 'estadoTipo', orden: 'numMeses',
    evento: 'tipos-paquete-actualizados', nombre: 'tipo de paquete', permiso: 'ACT_TIPOSPAQ',
    campos: [
      { nombre: 'codigoTipoPaquete', tipo: 'codigo', max: 200, requerido: true },
      { nombre: 'nombreTipoPaquete', tipo: 'texto', max: 100, requerido: true, mayusculas: true },
      { nombre: 'numMeses', tipo: 'entero', requerido: true, min: 1, maxValor: 120 },
      { nombre: 'descuentoMeses', tipo: 'decimal', requerido: true, min: 0, maxValor: 100 },
      { nombre: 'descripcionTipo', tipo: 'texto', max: 4000 },
    ],
    usos: [
      { tabla: 'PTL_Paquetes', columna: 'codigoTipoPaquete', que: 'paquete(s)' },
      { tabla: 'PTL_PaquetesSC', columna: 'codigoTipoPaquete', que: 'paquete(s) de suscriptor' },
    ],
  },
  'tipos-actividad': {
    tabla: 'PTL_TiposActividad', llave: 'codigoTipoActividad', estado: 'estadoTipoActividad', orden: 'nombreTipoActividad',
    evento: 'tipos-actividad-actualizados', nombre: 'tipo de actividad', permiso: 'ACT_TIPOSACT',
    campos: [
      { nombre: 'codigoTipoActividad', tipo: 'codigo', max: 100, requerido: true },
      { nombre: 'nombreTipoActividad', tipo: 'texto', max: 200, requerido: true },
      { nombre: 'descripcionTipoActividad', tipo: 'texto', max: 500 },
    ],
    usos: [{ tabla: 'PTL_Actividades', columna: 'codigoTipoActividad', que: 'actividad(es)' }],
  },
  'tipos-estado': {
    tabla: 'PTL_TiposEstados', llave: 'codigoTipoEstado', estado: 'estado', orden: 'tipoEstado',
    evento: 'tipos-estados-actualizados', nombre: 'tipo de estado', permiso: 'ACT_TIPOSEST',
    campos: [
      { nombre: 'codigoTipoEstado', tipo: 'codigo', max: 50, requerido: true },
      { nombre: 'tipoEstado', tipo: 'entero', requerido: true, min: 0, maxValor: 32767, unico: true },
      { nombre: 'nombreTipo', tipo: 'texto', max: 100, requerido: true },
      { nombre: 'descripcionEstado', tipo: 'texto', max: 255, vacio: '' },
    ],
    // los estados se agrupan por el número del tipo (PTL_Estados.tipoEstado = PTL_TiposEstados.tipoEstado), no por el código
    usos: [{ tabla: 'PTL_Estados', columna: 'tipoEstado', propia: 'tipoEstado', que: 'estado(s)' }],
  },
  estados: {
    tabla: 'PTL_Estados', llave: 'estadoId', autonumerica: true, estado: null, orden: 'tipoEstado',
    evento: 'estados-actualizadas', nombre: 'estado', permiso: 'ACT_ESTADOS',
    campos: [
      { nombre: 'tipoEstado', tipo: 'entero', requerido: true, min: 0, maxValor: 32767 },
      { nombre: 'nombreEstado', tipo: 'texto', max: 100, requerido: true, unico: true },
      { nombre: 'siglaEstado', tipo: 'texto', max: 10, requerido: true, mayusculas: true },
    ],
    usos: [],
  },
};

// Los identificadores se validan al cargar: nada que venga de una petición llega al nombre de una tabla o columna
for (const [clave, d] of Object.entries(CATALOGOS)) {
  const nombres = [d.tabla, d.llave, d.orden, ...(d.estado ? [d.estado] : []), ...d.campos.map((c) => c.nombre),
    ...d.usos.flatMap((u) => [u.tabla, u.columna, ...(u.propia ? [u.propia] : [])])];
  for (const n of nombres) if (!IDENT.test(n)) throw new Error(`Catálogo ${clave}: identificador inválido ${n}`);
}

const CLAVES = Object.keys(CATALOGOS);
const catalogo = (clave) => (Object.prototype.hasOwnProperty.call(CATALOGOS, clave) ? CATALOGOS[clave] : null);
const columnas = (def) => [...def.campos.map((c) => c.nombre), ...(def.estado ? [def.estado] : [])];

const t = (v) => (v === undefined || v === null ? '' : String(v).trim());
const bool = (v) => v === true || v === 1 || v === '1' || v === 'true';
const numero = (v) => (t(v) === '' ? null : Number(String(v).replace(',', '.')));

function normalizar(def, body = {}) {
  const p = {};
  for (const c of def.campos) {
    const v = body[c.nombre];
    if (c.tipo === 'codigo') p[c.nombre] = t(v).toUpperCase().replace(/\s+/g, '_');
    else if (c.tipo === 'entero' || c.tipo === 'decimal') p[c.nombre] = numero(v);
    else {
      const s = c.mayusculas ? t(v).toUpperCase() : t(v);
      p[c.nombre] = s === '' ? (c.vacio !== undefined ? c.vacio : null) : s;
    }
  }
  if (def.estado) p[def.estado] = body[def.estado] === undefined || body[def.estado] === null || body[def.estado] === '' ? true : bool(body[def.estado]);
  return p;
}

function revisar(def, p, { nuevo = true } = {}) {
  const e = [];
  const mal = (campo, mensaje) => e.push({ campo, mensaje });
  for (const c of def.campos) {
    const v = p[c.nombre];
    if (c.tipo === 'codigo') {
      if (!nuevo) continue;
      if (!v) mal(c.nombre, 'El código es obligatorio.');
      else if (!CODIGO.test(v) || v.length > c.max) mal(c.nombre, `Código en MAYÚSCULAS con letras, números y _ (máx. ${c.max}).`);
    } else if (c.tipo === 'entero' || c.tipo === 'decimal') {
      if (v === null) { if (c.requerido) mal(c.nombre, 'Es obligatorio.'); continue; }
      if (!Number.isFinite(v) || (c.tipo === 'entero' && !Number.isInteger(v))) mal(c.nombre, c.tipo === 'entero' ? 'Debe ser un número entero.' : 'Debe ser un número.');
      else if ((c.min !== undefined && v < c.min) || (c.maxValor !== undefined && v > c.maxValor)) mal(c.nombre, `Debe estar entre ${c.min} y ${c.maxValor}.`);
    } else {
      if (!v) { if (c.requerido) mal(c.nombre, 'Es obligatorio.'); continue; }
      if (v.length > c.max) mal(c.nombre, `Máximo ${c.max} caracteres.`);
    }
  }
  return e;
}

module.exports = { CATALOGOS, CLAVES, catalogo, columnas, normalizar, revisar };
