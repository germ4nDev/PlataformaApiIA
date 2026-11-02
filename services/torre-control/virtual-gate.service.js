/*
    Author: German Valencia
    Layer: Business Logic Service
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
    Description: Orquesta repositorio → núcleo puro (utils/virtual-gate.js). El núcleo aplica la ventana de tiempo
      real, marca los campos sin dato en lugar de inventarlos y publica el origen del dato (2026-10-23).
*/
const virtualGateRepository = require('../../repositories/torre-control/virtual-gate.repository');
const { contextoPuerto } = require('../../helpers/puerto-contexto.helper');
const { armarVirtualGate } = require('../../utils/virtual-gate');

class VirtualGateService {
  async obtenerDashboardVirtualGate(puertoInput, ahora = new Date()) {
    const puerto = String(puertoInput || 'BUENAVENTURA').trim().toUpperCase();
    // El selector manda 'LA_GUAJIRA' o 'PUERTO_ANTIOQUIA' y las citas se guardan con el id del maestro (GUAJIRA, TURBO):
    // se resuelve con el contexto de puerto (OT-009). Si el puerto no está en el maestro se busca tal cual llegó.
    const idPuerto = await contextoPuerto(puerto).then((p) => p.idPuerto.toUpperCase()).catch(() => puerto);

    const [tabla, filasCrudas, infoBodegas] = await Promise.all([
      virtualGateRepository.resolverTablaCitas().catch(() => null),
      virtualGateRepository.obtenerCitasPorPuerto(idPuerto),
      virtualGateRepository.obtenerSaturacionBodegasPuerto(idPuerto),
    ]);

    const virtualGate = armarVirtualGate({
      filas: filasCrudas || [],
      infoBodegas,
      puerto,
      fuente: tabla ? tabla.replace(/^dbo\./, '') : 'Sin tabla de citas',
    }, ahora);

    return { puerto, timestamp: ahora.toISOString(), virtualGate };
  }
}

module.exports = new VirtualGateService();
