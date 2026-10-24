/*
    Author: German Valencia
    Layer: Business Logic Service
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
    Description: Orquesta repositorio → núcleo puro (utils/virtual-gate.js). El núcleo aplica la ventana de tiempo
      real, marca los campos sin dato en lugar de inventarlos y publica el origen del dato (2026-10-23).
*/
const virtualGateRepository = require('../../repositories/torre-control/virtual-gate.repository');
const { armarVirtualGate } = require('../../utils/virtual-gate');

class VirtualGateService {
  async obtenerDashboardVirtualGate(puertoInput, ahora = new Date()) {
    const puerto = String(puertoInput || 'BUENAVENTURA').trim().toUpperCase();

    const [tabla, filasCrudas, infoBodegas] = await Promise.all([
      virtualGateRepository.resolverTablaCitas().catch(() => null),
      virtualGateRepository.obtenerCitasPorPuerto(puerto),
      virtualGateRepository.obtenerSaturacionBodegasPuerto(puerto),
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
