/*
    Author: German Valencia
    Layer: Business Logic Service
    Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
*/
const virtualGateRepository = require('../../repositories/torre-control/virtual-gate.repository');

class VirtualGateService {
  async obtenerDashboardVirtualGate(puertoInput) {
    const puerto = String(puertoInput || 'BUENAVENTURA').trim().toUpperCase();

    const [filasCrudas, infoBodegas] = await Promise.all([
      virtualGateRepository.obtenerCitasPorPuerto(puerto),
      virtualGateRepository.obtenerSaturacionBodegasPuerto(puerto)
    ]);

    const cola = (filasCrudas || []).map((row, index) => {
      const espera = Number(
        row.tiempo_espera_minutos ?? row.tiempo_espera ?? row.minutos_espera ?? 0
      );
      const estado = String(row.estado || row.estado_cita || 'PROGRAMADO')
        .trim()
        .toUpperCase();
      const tipoCarga = String(row.tipo_carga || row.modalidad || 'CONTENEDOR')
        .trim()
        .toUpperCase();
      const operacion = String(row.operacion || row.tipo_operacion || 'RETIRO')
        .trim()
        .toUpperCase();
      const terminal = String(row.terminal || row.nodo_terminal || 'TCBUEN')
        .trim()
        .toUpperCase();
      const ubicacion = String(row.ubicacion || row.zona_actual || 'ZONA ENTORNAMIENTO')
        .trim();

      return {
        id_cita: row.id_cita || row.codigo_cita || `VG-${puerto.slice(0, 3)}-${1000 + index}`,
        placa: String(row.placa || row.placa_vehiculo || 'S/P').trim().toUpperCase(),
        conductor: row.conductor || row.nombre_conductor || 'Conductor Asignado',
        transportador: row.transportador || row.empresa_transporte || row.empresa || 'Transportadora Portuaria',
        empresa: row.transportador || row.empresa_transporte || row.empresa || 'Transportadora Portuaria',
        tipo_carga: tipoCarga,
        operacion,
        terminal,
        franja_horaria: row.franja_horaria || this.extraerFranjaHoraria(row.fecha_hora_cita),
        fecha_hora_cita: row.fecha_hora_cita || row.fecha_cita || new Date().toISOString(),
        ubicacion,
        distancia_km: Number(row.distancia_km ?? this.estimarDistanciaPorUbicacion(ubicacion, estado)),
        estado,
        tiempo_espera_minutos: espera,
        tiempo_espera: `${espera} min`,
        validacion_ocr: Boolean(row.validacion_ocr ?? true),
        validacion_biometria: Boolean(row.validacion_biometria ?? (estado !== 'RECHAZADO')),
        validacion_documental: Boolean(row.validacion_documental ?? (estado !== 'OBSERVADO')),
        peso_bascula_ton: Number(row.peso_bascula_ton ?? row.toneladas ?? 0)
      };
    });

    const resumen = this.calcularResumenKpis(cola, infoBodegas);
    const citas12h = this.construirCitas12Horas(cola);
    const distribucion10km = this.construirDistribucion10Km(cola);
    const estadoCitas = this.construirEstadoCitas(cola);
    const validacion = this.construirPreGateValidacion(cola);
    const alertas = this.construirAlertasGate(cola, puerto);

    // 🟢 OBJETO ENCAPSULADO PRINCIPAL PARA FACILITAR EL RASTREO
    return {
      puerto,
      timestamp: new Date().toISOString(),
      virtualGate: {
        resumen,
        citas: cola,
        citas12h,
        distribucion10km,
        estadoCitas,
        validacion,
        alertas
      }
    };
  }

  calcularResumenKpis(cola, infoBodegas) {
    const esContenedor = (c) => c.tipo_carga.includes('CONT');
    const esGranel = (c) => c.tipo_carga.includes('GRANEL');
    const esSuelta = (c) => c.tipo_carga.includes('SUELTA') || c.tipo_carga.includes('GENERAL');
    const esRoro = (c) => c.tipo_carga.includes('RORO') || c.tipo_carga.includes('VEH');

    const contList = cola.filter(esContenedor);
    const granelList = cola.filter(esGranel);
    const sueltaList = cola.filter(esSuelta);
    const roroList = cola.filter(esRoro);

    const tonsGranel = granelList.reduce((acc, c) => acc + (c.peso_bascula_ton || 34), 0);
    const tonsSuelta = sueltaList.reduce((acc, c) => acc + (c.peso_bascula_ton || 22), 0);
    const satPct = Number(infoBodegas?.saturacionPromedio || 0);

    return {
      totalCamiones: cola.length,
      totalContenedores: contList.length,
      subtituloContenedores: 'FCL · LCL · Reefer',
      totalGranel: tonsGranel,
      subtituloGranel: `${granelList.length} camiones en circuito`,
      totalCargaSuelta: tonsSuelta,
      subtituloCargaSuelta: `${sueltaList.length} turnos programados`,
      totalRoro: roroList.length,
      subtituloRoro: 'Importación · Exportación · PDI',
      saturacionBodegas: `${satPct}%`,
      subtituloBodegas: `${infoBodegas?.totalBodegas || 0} bodegas monitoreadas`,
      subContenedores: contList.filter((c) => c.estado !== 'FINALIZADO').length,
      subGranel: granelList.filter((c) => c.estado !== 'FINALIZADO').length,
      subCargaSuelta: sueltaList.filter((c) => c.estado !== 'FINALIZADO').length,
      subNineras: roroList.length
    };
  }

  construirCitas12Horas(cola) {
    if (!cola.length) return { labels: [], datasets: [] };
    const franjasMap = new Map();
    const terminalesSet = new Set();

    cola.forEach((c) => {
      const franja = c.franja_horaria || '08:00 - 10:00';
      const terminal = c.terminal || 'TERMINAL PRINCIPAL';
      terminalesSet.add(terminal);
      if (!franjasMap.has(franja)) franjasMap.set(franja, {});
      franjasMap.get(franja)[terminal] = (franjasMap.get(franja)[terminal] || 0) + 1;
    });

    const labels = Array.from(franjasMap.keys()).sort();
    const terminales = Array.from(terminalesSet);
    const datasets = terminales.map((term) => ({
      label: term,
      data: labels.map((franja) => franjasMap.get(franja)?.[term] || 0)
    }));

    return { labels, datasets };
  }

  construirDistribucion10Km(cola) {
    if (!cola.length) return { labels: [], valores: [], items: [], total: 0 };
    const grupos = {
      'En Pre-Gate (< 1 km)': 0,
      'Zona Enturnamiento (1 - 3 km)': 0,
      'Corredor Logístico (3 - 5 km)': 0,
      'Anillo Periférico (5 - 10 km)': 0
    };

    cola.forEach((c) => {
      const km = Number(c.distancia_km || 0);
      if (km <= 1) grupos['En Pre-Gate (< 1 km)']++;
      else if (km <= 3) grupos['Zona Enturnamiento (1 - 3 km)']++;
      else if (km <= 5) grupos['Corredor Logístico (3 - 5 km)']++;
      else grupos['Anillo Periférico (5 - 10 km)']++;
    });

    const labels = Object.keys(grupos);
    const valores = Object.values(grupos);
    const total = valores.reduce((a, b) => a + b, 0);

    return {
      labels,
      valores,
      total,
      items: labels.map((label, i) => ({
        label,
        valor: valores[i],
        porcentaje: total > 0 ? Number(((valores[i] / total) * 100).toFixed(1)) : 0
      }))
    };
  }

  construirEstadoCitas(cola) {
    const total = cola.length;
    const atendidas = cola.filter((c) => ['ATENDIDO', 'EN_OPERACION', 'EN_PUERTO', 'VALIDADO', 'FINALIZADO'].includes(c.estado)).length;
    const enCola = cola.filter((c) => ['EN_COLA', 'ENTURNADO', 'PRE_GATE', 'PROGRAMADO', 'EN_RUTA'].includes(c.estado)).length;
    const retrasadas = cola.filter((c) => c.estado.includes('RETRAS') || c.tiempo_espera_minutos > 45).length;

    return {
      totalCitas: total,
      atendidas,
      enCola,
      retrasadas,
      cumplimientoPct: total > 0 ? Math.round(((total - retrasadas) / total) * 100) : 0,
      esperaPromedioMin: total > 0 ? Math.round(cola.reduce((acc, c) => acc + c.tiempo_espera_minutos, 0) / total) : 0
    };
  }

  construirPreGateValidacion(cola) {
    const total = cola.length;
    const listosIngreso = cola.filter((c) => c.validacion_ocr && c.validacion_biometria && c.validacion_documental).length;

    return {
      totalEvaluados: total,
      listosIngreso,
      observados: Math.max(0, total - listosIngreso),
      tasaAprobacionPct: total > 0 ? Math.round((listosIngreso / total) * 100) : 0,
      ultimosRegistros: cola.slice(0, 8)
    };
  }

  construirAlertasGate(cola) {
    const alertas = [];
    cola.forEach((c) => {
      if (c.tiempo_espera_minutos >= 60) {
        alertas.push({
          id: `ALT-${c.id_cita}`,
          severidad: 'CRITICA',
          tipo: 'TIEMPO DE ESPERA EXCEDIDO',
          placa: c.placa,
          terminal: c.terminal,
          mensaje: `Unidad ${c.placa} supera ${c.tiempo_espera_minutos} min en ${c.ubicacion}.`,
          timestamp: c.fecha_hora_cita
        });
      }
    });
    return alertas.slice(0, 20);
  }

  extraerFranjaHoraria(fechaCita) {
    if (!fechaCita) return '08:00 - 10:00';
    const d = new Date(fechaCita);
    if (isNaN(d.getTime())) return '08:00 - 10:00';
    const h = d.getHours();
    return `${String(h - (h % 2)).padStart(2, '0')}:00 - ${String((h - (h % 2) + 2) % 24).padStart(2, '0')}:00`;
  }

  estimarDistanciaPorUbicacion(ubicacion, estado) {
    const u = String(ubicacion || '').toUpperCase();
    if (u.includes('PRE')) return 0.5;
    if (u.includes('ENTURN')) return 2.2;
    return 4.5;
  }
}

module.exports = new VirtualGateService();