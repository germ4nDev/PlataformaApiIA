// /*
//     Author: German Valencia
//     Layer: Business Logic Service
//     Module: Torre de Control - Virtual Gate (TCL_VIRTUAL_GATE_001)
// */
// const virtualGateRepository = require('../../repositories/torre-control/virtual-gate.repository');

// class VirtualGateService {
//   async obtenerDashboardVirtualGate(puertoInput) {
//     const puerto = String(puertoInput || 'BUENAVENTURA').trim().toUpperCase();

//     const [filasCrudas, infoBodegas] = await Promise.all([
//       virtualGateRepository.obtenerCitasPorPuerto(puerto),
//       virtualGateRepository.obtenerSaturacionBodegasPuerto(puerto)
//     ]);

//     // Normalización de cada registro de la cola de camiones
//     const cola = (filasCrudas || []).map((row, index) => {
//       const espera = Number(
//         row.tiempo_espera_minutos ?? row.tiempo_espera ?? row.minutos_espera ?? 0
//       );
//       const estado = String(row.estado || row.estado_cita || 'PROGRAMADO')
//         .trim()
//         .toUpperCase();
//       const tipoCarga = String(row.tipo_carga || row.modalidad || 'CONTENEDOR')
//         .trim()
//         .toUpperCase();
//       const operacion = String(row.operacion || row.tipo_operacion || 'RETIRO')
//         .trim()
//         .toUpperCase();
//       const terminal = String(row.terminal || row.nodo_terminal || 'TCBUEN')
//         .trim()
//         .toUpperCase();
//       const ubicacion = String(row.ubicacion || row.zona_actual || 'ZONA ENTORNAMIENTO')
//         .trim();

//       return {
//         id_cita: row.id_cita || row.codigo_cita || `VG-${puerto.slice(0, 3)}-${1000 + index}`,
//         placa: String(row.placa || row.placa_vehiculo || 'S/P').trim().toUpperCase(),
//         conductor: row.conductor || row.nombre_conductor || 'Conductor Asignado',
//         transportador: row.transportador || row.empresa_transporte || row.empresa || 'Transportadora Portuaria',
//         empresa: row.transportador || row.empresa_transporte || row.empresa || 'Transportadora Portuaria',
//         tipo_carga: tipoCarga,
//         operacion,
//         terminal,
//         franja_horaria: row.franja_horaria || this.extraerFranjaHoraria(row.fecha_hora_cita),
//         fecha_hora_cita: row.fecha_hora_cita || row.fecha_cita || new Date().toISOString(),
//         ubicacion,
//         distancia_km: Number(row.distancia_km ?? this.estimarDistanciaPorUbicacion(ubicacion, estado)),
//         estado,
//         tiempo_espera_minutos: espera,
//         tiempo_espera: `${espera} min`,
//         validacion_ocr: Boolean(row.validacion_ocr ?? true),
//         validacion_biometria: Boolean(row.validacion_biometria ?? (estado !== 'RECHAZADO')),
//         validacion_documental: Boolean(row.validacion_documental ?? (estado !== 'OBSERVADO')),
//         peso_bascula_ton: Number(row.peso_bascula_ton ?? row.toneladas ?? 0)
//       };
//     });

//     // 1. Resumen de los 10 KPIs de Virtual Gate
//     const resumen = this.calcularResumenKpis(cola, infoBodegas);

//     // 2. Gráfico Apilado: Citas Próximas 12 Horas por Terminal y Franja (PTT_GATE_CHRT_CITAS)
//     const citas12h = this.construirCitas12Horas(cola);

//     // 3. Gráfico Dona: Distribución de camiones en radio de 10 km (PTT_GATE_CHRT_DIST)
//     const distribucion10km = this.construirDistribucion10Km(cola);

//     // 4. Widget Estado de Citas por Terminal (PTT_GATE_PANEL_ESTADO)
//     const estadoCitas = this.construirEstadoCitas(cola);

//     // 5. Widget Pre-Gate / Validación (PTT_GATE_PANEL_VAL)
//     const validacion = this.construirPreGateValidacion(cola);

//     // 6. Widget Alertas Operativas de Virtual Gate (PTT_GATE_PANEL_ALERTAS)
//     const alertas = this.construirAlertasGate(cola, puerto);

//     return {
//       puerto,
//       timestamp: new Date().toISOString(),
//       resumen,
//       cola,
//       citas: cola,
//       citas12h,
//       distribucion10km,
//       estadoCitas,
//       validacion,
//       preGate: validacion,
//       alertas
//     };
//   }

//   calcularResumenKpis(cola, infoBodegas) {
//     const esContenedor = (c) => c.tipo_carga.includes('CONT');
//     const esGranel = (c) => c.tipo_carga.includes('GRANEL');
//     const esSuelta = (c) => c.tipo_carga.includes('SUELTA') || c.tipo_carga.includes('GENERAL');
//     const esRoro = (c) => c.tipo_carga.includes('RORO') || c.tipo_carga.includes('VEH');
//     const esNinera = (c) => c.tipo_carga.includes('NINERA') || c.tipo_carga.includes('NIÑERA') || esRoro(c);

//     const contList = cola.filter(esContenedor);
//     const granelList = cola.filter(esGranel);
//     const sueltaList = cola.filter(esSuelta);
//     const roroList = cola.filter(esRoro);
//     const nineraList = cola.filter(esNinera);

//     const tonsGranel = granelList.reduce((acc, c) => acc + (c.peso_bascula_ton || 34), 0);
//     const tonsSuelta = sueltaList.reduce((acc, c) => acc + (c.peso_bascula_ton || 22), 0);
//     const satPct = Number(infoBodegas?.saturacionPromedio || 0);

//     return {
//       totalCamiones: cola.length,
//       totalContenedores: contList.length,
//       subtituloContenedores: 'FCL · LCL · Reefer',
//       totalGranel: tonsGranel,
//       subtituloGranel: `${granelList.length} camiones en circuito`,
//       totalCargaSuelta: tonsSuelta,
//       subtituloCargaSuelta: `${sueltaList.length} turnos programados`,
//       totalRoro: roroList.length,
//       subtituloRoro: 'Importación · Exportación · PDI',
//       saturacionBodegas: `${satPct}%`,
//       subtituloBodegas: `${infoBodegas?.totalBodegas || 0} bodegas monitoreadas`,
//       subContenedores: contList.filter((c) => c.estado !== 'FINALIZADO').length,
//       subGranel: granelList.filter((c) => c.estado !== 'FINALIZADO').length,
//       subCargaSuelta: sueltaList.filter((c) => c.estado !== 'FINALIZADO').length,
//       subNineras: nineraList.length
//     };
//   }

//   construirCitas12Horas(cola) {
//     if (!cola.length) {
//       return { labels: [], datasets: [] };
//     }

//     const franjasMap = new Map();
//     const terminalesSet = new Set();

//     cola.forEach((c) => {
//       const franja = c.franja_horaria || '08:00 - 10:00';
//       const terminal = c.terminal || 'TERMINAL PRINCIPAL';
//       terminalesSet.add(terminal);

//       if (!franjasMap.has(franja)) {
//         franjasMap.set(franja, {});
//       }
//       const grupo = franjasMap.get(franja);
//       grupo[terminal] = (grupo[terminal] || 0) + 1;
//     });

//     const labels = Array.from(franjasMap.keys()).sort();
//     const terminales = Array.from(terminalesSet);

//     const datasets = terminales.map((term) => ({
//       label: term,
//       data: labels.map((franja) => franjasMap.get(franja)?.[term] || 0)
//     }));

//     return { labels, datasets };
//   }

//   construirDistribucion10Km(cola) {
//     if (!cola.length) {
//       return { labels: [], valores: [], items: [], total: 0 };
//     }

//     const grupos = {
//       'En Pre-Gate (< 1 km)': 0,
//       'Zona Enturnamiento (1 - 3 km)': 0,
//       'Corredor Logístico (3 - 5 km)': 0,
//       'Anillo Periférico (5 - 10 km)': 0
//     };

//     cola.forEach((c) => {
//       const km = Number(c.distancia_km || 0);
//       if (km <= 1) grupos['En Pre-Gate (< 1 km)']++;
//       else if (km <= 3) grupos['Zona Enturnamiento (1 - 3 km)']++;
//       else if (km <= 5) grupos['Corredor Logístico (3 - 5 km)']++;
//       else grupos['Anillo Periférico (5 - 10 km)']++;
//     });

//     const labels = Object.keys(grupos);
//     const valores = Object.values(grupos);
//     const total = valores.reduce((a, b) => a + b, 0);

//     return {
//       labels,
//       valores,
//       total,
//       items: labels.map((label, i) => ({
//         label,
//         valor: valores[i],
//         porcentaje: total > 0 ? Number(((valores[i] / total) * 100).toFixed(1)) : 0
//       }))
//     };
//   }

//   construirEstadoCitas(cola) {
//     const total = cola.length;
//     const atendidas = cola.filter((c) =>
//       ['ATENDIDO', 'EN_OPERACION', 'EN_PUERTO', 'VALIDADO', 'FINALIZADO'].includes(c.estado)
//     ).length;
//     const enCola = cola.filter((c) =>
//       ['EN_COLA', 'ENTURNADO', 'PRE_GATE', 'PROGRAMADO', 'EN_RUTA'].includes(c.estado)
//     ).length;
//     const retrasadas = cola.filter(
//       (c) => c.estado.includes('RETRAS') || c.estado.includes('VENCID') || c.tiempo_espera_minutos > 45
//     ).length;

//     const cumplimientoPct = total > 0 ? Math.round(((total - retrasadas) / total) * 100) : 0;
//     const esperaPromedio =
//       total > 0
//         ? Math.round(cola.reduce((acc, c) => acc + c.tiempo_espera_minutos, 0) / total)
//         : 0;

//     // Desglose por terminal
//     const porTerminalMap = new Map();
//     cola.forEach((c) => {
//       const t = c.terminal || 'GENERAL';
//       if (!porTerminalMap.has(t)) {
//         porTerminalMap.set(t, { terminal: t, total: 0, atendidas: 0, enCola: 0, retrasadas: 0 });
//       }
//       const item = porTerminalMap.get(t);
//       item.total++;
//       if (c.tiempo_espera_minutos > 45 || c.estado.includes('RETRAS')) item.retrasadas++;
//       else if (['ATENDIDO', 'EN_OPERACION', 'EN_PUERTO', 'VALIDADO'].includes(c.estado)) item.atendidas++;
//       else item.enCola++;
//     });

//     return {
//       totalCitas: total,
//       atendidas,
//       enCola,
//       retrasadas,
//       cumplimientoPct,
//       esperaPromedioMin: esperaPromedio,
//       terminales: Array.from(porTerminalMap.values())
//     };
//   }

//   construirPreGateValidacion(cola) {
//     const total = cola.length;
//     const ocrOk = cola.filter((c) => c.validacion_ocr).length;
//     const biometriaOk = cola.filter((c) => c.validacion_biometria).length;
//     const docOk = cola.filter((c) => c.validacion_documental).length;
//     const listosIngreso = cola.filter(
//       (c) => c.validacion_ocr && c.validacion_biometria && c.validacion_documental
//     ).length;

//     return {
//       totalEvaluados: total,
//       listosIngreso,
//       observados: Math.max(0, total - listosIngreso),
//       tasaAprobacionPct: total > 0 ? Math.round((listosIngreso / total) * 100) : 0,
//       etapas: [
//         {
//           codigo: 'OCR',
//           nombre: 'Lectura OCR Placa / Contenedor',
//           aprobados: ocrOk,
//           total,
//           porcentaje: total > 0 ? Math.round((ocrOk / total) * 100) : 0
//         },
//         {
//           codigo: 'BIOMETRIA',
//           nombre: 'Validación Biométrica Conductor',
//           aprobados: biometriaOk,
//           total,
//           porcentaje: total > 0 ? Math.round((biometriaOk / total) * 100) : 0
//         },
//         {
//           codigo: 'DOCUMENTAL',
//           nombre: 'Manifiesto RNDC / Cita Activa',
//           aprobados: docOk,
//           total,
//           porcentaje: total > 0 ? Math.round((docOk / total) * 100) : 0
//         }
//       ],
//       ultimosRegistros: cola.slice(0, 8)
//     };
//   }

//   construirAlertasGate(cola, puerto) {
//     const alertas = [];

//     cola.forEach((c) => {
//       if (c.tiempo_espera_minutos >= 60) {
//         alertas.push({
//           id: `ALT-ESP-${c.id_cita}`,
//           severidad: 'CRITICA',
//           tipo: 'TIEMPO DE ESPERA EXCEDIDO',
//           placa: c.placa,
//           terminal: c.terminal,
//           mensaje: `Unidad ${c.placa} supera ${c.tiempo_espera_minutos} min en ${c.ubicacion}.`,
//           timestamp: c.fecha_hora_cita
//         });
//       } else if (!c.validacion_documental || !c.validacion_biometria) {
//         alertas.push({
//           id: `ALT-DOC-${c.id_cita}`,
//           severidad: 'ALERTA',
//           tipo: 'NOVEDAD PRE-GATE',
//           placa: c.placa,
//           terminal: c.terminal,
//           mensaje: `Validación pendiente en Pre-Gate para vehículo ${c.placa} (${c.transportador}).`,
//           timestamp: c.fecha_hora_cita
//         });
//       } else if (c.tiempo_espera_minutos >= 35) {
//         alertas.push({
//           id: `ALT-MOD-${c.id_cita}`,
//           severidad: 'INFO',
//           tipo: 'DEMORA MODERADA EN FILA',
//           placa: c.placa,
//           terminal: c.terminal,
//           mensaje: `Turno ${c.id_cita} registra ${c.tiempo_espera_minutos} min de espera en ${c.terminal}.`,
//           timestamp: c.fecha_hora_cita
//         });
//       }
//     });

//     return alertas.slice(0, 20);
//   }

//   extraerFranjaHoraria(fechaCita) {
//     if (!fechaCita) return '08:00 - 10:00';
//     const d = new Date(fechaCita);
//     if (isNaN(d.getTime())) return '08:00 - 10:00';
//     const h = d.getHours();
//     const inicio = String(h - (h % 2)).padStart(2, '0') + ':00';
//     const fin = String((h - (h % 2) + 2) % 24).padStart(2, '0') + ':00';
//     return `${inicio} - ${fin}`;
//   }

//   estimarDistanciaPorUbicacion(ubicacion, estado) {
//     const u = String(ubicacion || '').toUpperCase();
//     const e = String(estado || '').toUpperCase();
//     if (u.includes('PRE') || e.includes('PRE_GATE') || e.includes('PUERTO')) return 0.5;
//     if (u.includes('ENTURN') || e.includes('COLA')) return 2.2;
//     if (u.includes('CORREDOR') || u.includes('5')) return 4.5;
//     return 7.8;
//   }
// }

// module.exports = new VirtualGateService();
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