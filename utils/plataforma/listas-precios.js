/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Listas de precios (OT-029, AD-16; sin base ni red)
    Description: La lista de precios es el único lugar del precio de venta de paquetes e items (decisión del usuario, 2026-11-10).
      ambito(lista)                         'COP|CO' (moneda y país; país vacío = todos)
      seCruzan(a, b)                        true si las vigencias [fechaInicio, fechaFin] se tocan (fechaFin vacía = sin fin)
      revisarLista(lista, otras)            null si se puede guardar; 'FECHAS' si fin < inicio; 'VIGENCIA_CRUZADA' si otra lista activa del
                                            mismo ámbito se cruza (la misma lista, por código, no cuenta)
      revisarDetalle(detalle, existentes)   null | 'DUPLICADO' (la misma referencia dos veces en la lista)
      listaVigente(listas, { pais, moneda, fecha })  la lista activa que cubre la fecha; primero la del país, luego la general; entre
                                            varias, la de inicio más reciente
      precio(detalles, tipo, codigo)        el detalle activo de esa referencia o null
      sumaItems(itemsPaquete, detalles)     { mensual, anual, setup, sinPrecio: [codigoItem] } de referencia para el paquete (cantidad × precio)
      fotoPrecio({ lista, detalle, numMeses, porcentajeDescuento })
                                            lo que se guarda en PTL_PaquetesSC al vender (el precio no cambia si después cambia la lista).
                                            numMeses y el descuento vienen del tipo de paquete: 12 meses con valor anual en la lista =
                                            ANUAL con ese valor y sin descuento (ya es el precio anual); si no, MENSUAL: mensual × meses − descuento
*/
const PERIODICIDADES = ['MENSUAL', 'ANUAL'];
const TIPOS = ['PAQUETE', 'ITEM'];

const txt = (v) => String(v ?? '').trim().toUpperCase();
const dia = (v) => (v ? String(v instanceof Date ? v.toISOString() : v).slice(0, 10) : null);
const activa = (x) => x && x.estadoLista !== false && x.estadoLista !== 0;
const redondear = (n) => Math.round((Number(n) || 0) * 100) / 100;

const ambito = (l) => `${txt(l.moneda)}|${txt(l.paisAplica)}`;

function seCruzan(a, b) {
  const ai = dia(a.fechaInicio), af = dia(a.fechaFin) || '9999-12-31';
  const bi = dia(b.fechaInicio), bf = dia(b.fechaFin) || '9999-12-31';
  return ai <= bf && bi <= af;
}

function revisarLista(lista, otras = []) {
  if (lista.fechaFin && dia(lista.fechaFin) < dia(lista.fechaInicio)) return 'FECHAS';
  if (!activa(lista)) return null;
  const choca = otras.some((o) => activa(o) && txt(o.codigoLista) !== txt(lista.codigoLista) && ambito(o) === ambito(lista) && seCruzan(o, lista));
  return choca ? 'VIGENCIA_CRUZADA' : null;
}

function revisarDetalle(d, existentes = []) {
  const repetido = existentes.some((e) => txt(e.codigoDetalle) !== txt(d.codigoDetalle)
    && txt(e.tipoReferencia) === txt(d.tipoReferencia) && String(e.codigoReferencia).trim() === String(d.codigoReferencia).trim());
  return repetido ? 'DUPLICADO' : null;
}

function listaVigente(listas = [], { pais = '', moneda = '', fecha = new Date() } = {}) {
  const f = dia(fecha);
  const cubre = listas.filter((l) => activa(l) && dia(l.fechaInicio) <= f && (!l.fechaFin || dia(l.fechaFin) >= f)
    && (!moneda || txt(l.moneda) === txt(moneda)));
  const orden = (a, b) => (dia(b.fechaInicio) > dia(a.fechaInicio) ? 1 : -1);
  const delPais = pais ? cubre.filter((l) => txt(l.paisAplica) === txt(pais)).sort(orden) : [];
  const generales = cubre.filter((l) => !txt(l.paisAplica)).sort(orden);
  // sin país (el suscriptor no lo tiene): la general y, si no hay, la de inicio más reciente
  return delPais[0] || generales[0] || (!pais ? [...cubre].sort(orden)[0] || null : null);
}

function precio(detalles = [], tipo, codigo) {
  return detalles.find((d) => d.estadoDetalle !== false && d.estadoDetalle !== 0
    && txt(d.tipoReferencia) === txt(tipo) && String(d.codigoReferencia).trim() === String(codigo).trim()) || null;
}

function sumaItems(itemsPaquete = [], detalles = []) {
  const r = { mensual: 0, anual: 0, setup: 0, sinPrecio: [] };
  for (const it of itemsPaquete) {
    if (it.estadoItem === false || it.estadoItem === 0) continue;
    const p = precio(detalles, 'ITEM', it.codigoItem);
    const n = Number(it.cantidad) || 1;
    if (!p) { r.sinPrecio.push(it.codigoItem); continue; }
    r.mensual += n * Number(p.valorMensual || 0);
    r.anual += n * Number(p.valorAnual || 0);
    r.setup += n * Number(p.precioSetup || 0);
  }
  return { ...r, mensual: redondear(r.mensual), anual: redondear(r.anual), setup: redondear(r.setup) };
}

function fotoPrecio({ lista, detalle, numMeses = 1, porcentajeDescuento = 0 }) {
  if (!lista || !detalle) throw { statusCode: 409, msg: 'El paquete no tiene precio en la lista de precios elegida.', codigo: 'SIN_PRECIO' };
  const meses = Number(numMeses);
  if (!Number.isInteger(meses) || meses < 1) throw { statusCode: 400, msg: 'Los meses de cobertura deben ser un entero desde 1.', codigo: 'MESES' };
  let desc = Number(porcentajeDescuento) || 0;
  if (desc < 0 || desc > 100) throw { statusCode: 400, msg: 'El descuento va de 0 a 100.', codigo: 'DESCUENTO' };
  const anual = meses === 12 && Number(detalle.valorAnual) > 0;
  const valorPeriodo = redondear(anual ? detalle.valorAnual : Number(detalle.valorMensual || 0) * meses);
  if (anual) desc = 0;
  return {
    codigoLista: lista.codigoLista,
    moneda: txt(lista.moneda),
    periodicidad: anual ? 'ANUAL' : 'MENSUAL',
    mesesCobertura: meses,
    valorPeriodo,
    precioSetup: redondear(detalle.precioSetup),
    porcentajeDescuento: redondear(desc),
    valorFinal: redondear(valorPeriodo * (1 - desc / 100)),
  };
}

module.exports = { PERIODICIDADES, TIPOS, ambito, seCruzan, revisarLista, revisarDetalle, listaVigente, precio, sumaItems, fotoPrecio };
