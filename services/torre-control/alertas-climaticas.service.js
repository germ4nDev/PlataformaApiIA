/*
    Author: German Valencia
    Pattern: PORTTOS Service - Alertas climáticas
    Description: Registro y consulta de alertas climáticas. Acceso a datos en alertas-climaticas.repository.js.
      (El segundo parámetro sequelizeInstance de versiones anteriores ya no se usa; se acepta por compatibilidad.)
*/
const repositorio = require('../../repositories/torre-control/alertas-climaticas.repository');

const AlertaClimaticaService = {
  persistirAlerta: (data) => repositorio.crear(data),
  buscarAlertas: (_sequelizeInstance, filtros) => repositorio.listar(filtros),
  alertasActivas: () => repositorio.listar({ estadoAlerta: 'ACTIVO' }),
};

module.exports = AlertaClimaticaService;
