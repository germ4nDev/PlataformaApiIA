/*
    Author: German Valencia
    Pattern: PLATAFORMA Núcleo puro - Aprovisionamiento de bases por suscriptor (OT-030, AD-16; sin base ni red)
    Description: Cada suscriptor recibe una base independiente por aplicación de su paquete, excepto la Plataforma (decisión del usuario,
    2026-11-10): nombre = prefijoBD de PTL_Aplicaciones + '_' + codigoSuscriptor sin guiones. El esquema es versionado por aplicación
    (database/suscriptores/<PREFIJO>/NNN_*.sql), no una copia de plantilla.
      PLATAFORMA                               prefijo que nunca se aprovisiona (PTL)
      ESTADOS                                  PENDIENTE, EN_CURSO, LISTA, ERROR
      nombreBD(prefijo, codigoSuscriptor)      'QPL_0e69…' o lanza 400 NOMBRE_INVALIDO (solo A-Z, 0-9 y _; máx. 128)
      aprovisionables(aplicaciones)            aplicaciones con prefijoBD que no son la Plataforma, sin repetidas
      versionDe(archivo)                       3 para '003_tablas.sql'; null si no sigue el formato
      pendientes(archivos, aplicadas)          scripts en orden cuya versión no está en aplicadas
      partirLotes(sql)                         el script en lotes separados por líneas GO (como SSMS)
      porTomar(filas, ahora, minutosAtascado)  la siguiente PENDIENTE, o una EN_CURSO atascada (el API se reinició a mitad)
*/
const PLATAFORMA = 'PTL';
const ESTADOS = ['PENDIENTE', 'EN_CURSO', 'LISTA', 'ERROR'];

const limpio = (v) => String(v ?? '').trim();

function nombreBD(prefijo, codigoSuscriptor) {
  const p = limpio(prefijo).toUpperCase();
  const s = limpio(codigoSuscriptor).replace(/-/g, '').toLowerCase();
  const nombre = `${p}_${s}`;
  if (!/^[A-Z][A-Z0-9]{0,9}$/.test(p) || !/^[a-z0-9_]+$/.test(s) || nombre.length > 128) {
    throw { statusCode: 400, msg: `Nombre de base inválido para el prefijo «${p}» y el suscriptor.`, codigo: 'NOMBRE_INVALIDO' };
  }
  return nombre;
}

function aprovisionables(aplicaciones = []) {
  const vistas = new Set();
  return aplicaciones.filter((a) => {
    const p = limpio(a.prefijoBD).toUpperCase();
    if (!p || p === PLATAFORMA || vistas.has(a.codigoAplicacion)) return false;
    vistas.add(a.codigoAplicacion);
    return true;
  });
}

function versionDe(archivo) {
  const m = /^(\d{3})_[a-z0-9_\-]+\.sql$/i.exec(limpio(archivo));
  return m ? Number(m[1]) : null;
}

function pendientes(archivos = [], aplicadas = []) {
  const hechas = new Set(aplicadas.map(Number));
  return archivos.filter((a) => versionDe(a) !== null && !hechas.has(versionDe(a))).sort((a, b) => versionDe(a) - versionDe(b));
}

function partirLotes(sql) {
  return String(sql || '').split(/^\s*GO\s*;?\s*$/gim).map((x) => x.trim()).filter(Boolean);
}

function porTomar(filas = [], ahora = new Date(), minutosAtascado = 30) {
  const limite = new Date(ahora).getTime() - minutosAtascado * 60000;
  const viejo = (f) => new Date(f.fechaModificacion || f.fechaCreacion || 0).getTime() < limite;
  const orden = (a, b) => new Date(a.fechaCreacion || 0) - new Date(b.fechaCreacion || 0);
  return [...filas].sort(orden).find((f) => f.estado === 'PENDIENTE' || (f.estado === 'EN_CURSO' && viejo(f))) || null;
}

module.exports = { PLATAFORMA, ESTADOS, nombreBD, aprovisionables, versionDe, pendientes, partirLotes, porTomar };
