/*
    Author: German Valencia
    Service: Virtual Gate - Lógica de Negocio de Citas y Operaciones Terrestres
*/
const { v4: uuidv4 } = require('uuid');
// const CitasGateRepository = require('../../repositories/torre-control/citas-gate.repository'); // Para el futuro

class CitasGateService {
  constructor() { }

  async obtenerDatosVirtualGate() {
    // 1. Generar/Obtener las citas (Mock Data temporal)
    const citas = this._generarCitasMock();

    // 2. Procesar la lógica de negocio (Agrupaciones y KPIs)
    const resumen = {
      totalCamiones: citas.length,
      validados: citas.filter(c => c.estado === 'VALIDADO').length,
      enCola: citas.filter(c => c.ubicacion.includes('Pre-gate')).length,
      retenidos: citas.filter(c => c.estado === 'RETENIDO' || c.estado === 'DOC. FALTANTE').length,
      tiempoMedioTCBUEN: 28, // Hardcodeado por ahora para igualar el diseño
      tiempoMedioSPRBUN: 12,
      tiempoMedioAGUADULCE: 9
    };

    // 3. Retornar la data procesada al controlador
    return {
      resumen,
      citas
    };
  }

  _generarCitasMock() {
    return [
      { id_cita: uuidv4(), placa: 'SDR-184', transportador: 'TRANSPORTES DEL VALLE', tipo_carga: 'Contenedor', operacion: 'Retiro cargado', terminal: 'SPRBUN', fecha_hora_cita: '09:30', ubicacion: 'Pre-gate A', estado: 'VALIDADO', tiempo_espera_minutos: 12 },
      { id_cita: uuidv4(), placa: 'UVT-902', transportador: 'COLDECON SAS', tipo_carga: 'Contenedor', operacion: 'Entrega vacío', terminal: 'TCBUEN', fecha_hora_cita: '09:45', ubicacion: 'Pre-gate B', estado: 'VALIDADO', tiempo_espera_minutos: 28 },
      { id_cita: uuidv4(), placa: 'DJK-117', transportador: 'GRANELERA PACÍFICO', tipo_carga: 'Granel agric.', operacion: 'Cargue maíz', terminal: 'SPRBUN', fecha_hora_cita: '10:00', ubicacion: 'Bodega COLDEX 02', estado: 'EN OPERACIÓN', tiempo_espera_minutos: 0 },
      { id_cita: uuidv4(), placa: 'RTG-554', transportador: 'ANDES CARGO', tipo_carga: 'Contenedor', operacion: 'Cargue export.', terminal: 'SPRBUN', fecha_hora_cita: '10:15', ubicacion: 'Pre-gate A', estado: 'VALIDADO', tiempo_espera_minutos: 15 },
      { id_cita: uuidv4(), placa: 'FQS-201', transportador: 'TRANSCONT BUEN.', tipo_carga: 'Contenedor', operacion: 'Entrega vacío', terminal: 'AGUADULCE', fecha_hora_cita: '10:30', ubicacion: 'Pre-gate C', estado: 'VALIDADO', tiempo_espera_minutos: 9 },
      { id_cita: uuidv4(), placa: 'CXR-340', transportador: 'TRANS PACÍFICO', tipo_carga: 'Contenedor', operacion: 'Retiro cargado', terminal: 'TCBUEN', fecha_hora_cita: '10:45', ubicacion: 'Pre-gate B', estado: 'DOC. FALTANTE', tiempo_espera_minutos: 120 },
      { id_cita: uuidv4(), placa: 'EXL-880', transportador: 'GRANELERA PACÍFICO', tipo_carga: 'Granel agric.', operacion: 'Cargue soya', terminal: 'SPRBUN', fecha_hora_cita: '11:00', ubicacion: 'Vía alterna km5', estado: 'EN RUTA', tiempo_espera_minutos: 0 },
      { id_cita: uuidv4(), placa: 'HDZ-455', transportador: 'NIÑERAS COL', tipo_carga: 'Vehiculo Ro-Ro', operacion: 'Trasiego PDI', terminal: 'AGUADULCE', fecha_hora_cita: '11:15', ubicacion: 'Pre-gate C', estado: 'VALIDADO', tiempo_espera_minutos: 5 },
      { id_cita: uuidv4(), placa: 'JMN-708', transportador: 'GRANEL ANDINO', tipo_carga: 'Granel mineral', operacion: 'Cargue clinker', terminal: 'AGUADULCE', fecha_hora_cita: '11:30', ubicacion: 'Muelle A-1', estado: 'EN OPERACIÓN', tiempo_espera_minutos: 0 },
      { id_cita: uuidv4(), placa: 'LMR-013', transportador: 'LOGÍSTICA DEL MAR', tipo_carga: 'Contenedor', operacion: 'Retiro cargado', terminal: 'TCBUEN', fecha_hora_cita: '11:45', ubicacion: 'Pre-gate B', estado: 'RETENIDO', tiempo_espera_minutos: 45 }
    ];
  }
}

module.exports = new CitasGateService();