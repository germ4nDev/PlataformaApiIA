/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - ¿Se cumplió la alerta temprana? (cierre del ciclo, fase 3)
    Description: Al vencer el horizonte de una alerta del analista, revisa con las fotos de KPI si pasó lo anunciado.
      Criterio determinista: entre la hora de la alerta y el fin de su horizonte, algún KPI citado con umbral del
      sistema llegó al nivel de la alerta (atención o informativa → umbral de atención; crítica → umbral crítico).
        SE_CUMPLIO      algún KPI citado llegó al nivel
        NO_SE_CUMPLIO   hubo fotos y ninguno llegó
        SIN_CRITERIO    la alerta no cita KPI con umbral o no hubo fotos en la ventana (se evalúa solo con el usuario)
      Este resultado y el «útil / no era» del usuario dan la precisión por tipo de alerta.
*/
const { umbralesDe } = require('./catalogo-kpi');

/**
 * @param {{severidad:string, evidencia:string[], fecha:string, vigenteHasta:string}} hallazgo
 * @param {Array<{codigoKpi:string, fecha:string, valor:number|null}>} fotos  fotos del puerto en la ventana
 */
function evaluarCumplimiento(hallazgo, fotos = []) {
  const codigos = (hallazgo.evidencia || []).filter((id) => String(id).startsWith('kpi.')).map((id) => id.slice(4))
    .filter((c) => umbralesDe(c));
  if (!codigos.length) return { resultado: 'SIN_CRITERIO', detalle: 'la alerta no cita indicadores con umbral' };
  const desde = Date.parse(hallazgo.fecha);
  const hasta = Date.parse(hallazgo.vigenteHasta);
  const enVentana = fotos.filter((f) => codigos.includes(f.codigoKpi) && Number.isFinite(Number(f.valor))
    && Date.parse(f.fecha) >= desde && Date.parse(f.fecha) <= hasta);
  if (!enVentana.length) return { resultado: 'SIN_CRITERIO', detalle: 'sin fotos de los indicadores citados en la ventana' };
  for (const codigo of codigos) {
    const u = umbralesDe(codigo);
    const limite = hallazgo.severidad === 'critica' ? u.critico : u.atencion;
    const valores = enVentana.filter((f) => f.codigoKpi === codigo).map((f) => Number(f.valor));
    if (!valores.length) continue;
    const extremo = u.sentido === 'bajo' ? Math.min(...valores) : Math.max(...valores);
    const llego = u.sentido === 'bajo' ? extremo <= limite : extremo >= limite;
    if (llego) return { resultado: 'SE_CUMPLIO', detalle: `${codigo} llegó a ${extremo} (umbral ${limite})` };
  }
  return { resultado: 'NO_SE_CUMPLIO', detalle: `ningún indicador citado llegó al umbral en ${enVentana.length} fotos` };
}

module.exports = { evaluarCumplimiento };
