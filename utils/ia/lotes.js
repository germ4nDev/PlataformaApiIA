/*
    Author: German Valencia
    Pattern: PORTTOS Core puro (AD-16) - Ejecución por lotes
    Description: Recorre una lista con a lo sumo `concurrencia` tareas a la vez (los puertos de la capa de IA:
      con todos los puertos no se lanzan decenas de consultas o llamadas al modelo al mismo tiempo).
      Un error en un elemento no detiene a los demás: vuelve como { ok: false, error }.
*/
async function enLotes(items, concurrencia, fn) {
  const resultados = new Array(items.length);
  let siguiente = 0;
  const trabajador = async () => {
    while (siguiente < items.length) {
      const i = siguiente++;
      try {
        resultados[i] = { ok: true, valor: await fn(items[i], i) };
      } catch (error) {
        resultados[i] = { ok: false, error };
      }
    }
  };
  await Promise.all(Array.from({ length: Math.max(1, Math.min(concurrencia, items.length)) }, trabajador));
  return resultados;
}

module.exports = { enLotes };
