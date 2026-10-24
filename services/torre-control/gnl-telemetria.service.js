/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, GNL Business Logic & Hybrid Telemetry (Hot/Cold Path)
*/
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { OperacionesFlujoGNLDTO } = require('../../models/torre-control/operaciones-flujo-gnl.model');
const GnlRepository = require('../../repositories/torre-control/gnl.repository');
const { conTransaccion } = require('../../helpers/transaccion.helper');
const { emitir } = require('../../helpers/socket.helper');
const { salaPuerto } = require('../../helpers/salas.helper');

// Buffer en memoria compartido entre el simulador y el Cron Job
global.bufferGNL = global.bufferGNL || [];
global.simuladorGNLActivo = global.simuladorGNLActivo || false;

const { consolidar, serieHistorial } = require('../../utils/gnl-consolidado');

class GnlTelemetriaService {

  // ==========================================
  // HOT PATH: SIMULADOR DE TELEMETRÍA (SOCKETS)
  // ==========================================
  async iniciarSimulador(id_puerto = 'BUENAVENTURA') {
    if (global.simuladorGNLActivo) {
      throw { statusCode: 400, msg: "El simulador SCADA ya se encuentra en ejecución." };
    }

    const datosSCADA = [];
    const csvPath = path.join(__dirname, '../../data/scada_pipeline.csv');

    if (!fs.existsSync(csvPath)) {
      throw { statusCode: 404, msg: "No se encontró el archivo scada_pipeline.csv en la ruta esperada." };
    }

    return new Promise((resolve, reject) => {
      fs.createReadStream(csvPath)
        .pipe(csv())
        .on('data', (row) => datosSCADA.push(row))
        .on('end', () => {
          global.simuladorGNLActivo = true;
          this.transmitirDatosEnVivo(datosSCADA, id_puerto);
          resolve({ msg: "Simulador GNL iniciado. Transmitiendo vía Socket.io..." });
        })
        .on('error', (error) => reject({ statusCode: 500, msg: error.message }));
    });
  }

  transmitirDatosEnVivo(datos, id_puerto) {
    let index = 0;

    // Dispara 1 lectura cada segundo
    global.intervaloGNL = setInterval(() => {
      if (index >= datos.length) index = 0; // Loop infinito para la demo
      const fila = datos[index];

      // Transformación Matemática MVP (De Gas Convencional a GNL Criogénico)
      const fluctuacionTermica = (parseFloat(fila.temperature) - 30) * -0.5;
      const temperaturaGNL = -162 + fluctuacionTermica; // Rango -160 a -163
      const presionPsi = parseFloat(fila.pressure);
      const flujoM3 = parseFloat(fila.flow_rate);
      const esAlarma = fila.alarm_triggered == '1';

      // const lecturaViva = {
      //   id_puerto,
      //   codigo_segmento: `BRAZO_DESCARGA_${fila.segment_id}`,
      //   timestamp: new Date().toISOString(),
      //   presion_psi: presionPsi,
      //   temperatura_celsius: temperaturaGNL,
      //   flujo_m3: flujoM3,
      //   alarma_activa: esAlarma
      // };
      const lecturaViva = {
        id_puerto,
        codigo_segmento: `BRAZO_DESCARGA_${fila.segment_id}`,
        timestamp: new Date().toISOString(),

        // Nombres esperados por Angular (Frontend)
        temp_ducto: temperaturaGNL,
        presion: presionPsi,
        flujo: flujoM3,

        // Nombres originales (Por si otros módulos los usan)
        presion_psi: presionPsi,
        temperatura_celsius: temperaturaGNL,
        flujo_m3: flujoM3,

        alarma_activa: esAlarma,

        // ---------------------------------------------------------------
        // SIMULADO (agregado 2026-10-17). El CSV SCADA de demo solo trae presión, flujo y temperatura;
        // los widgets GNL piden más variables y quedaban en 0. Se derivan de esas tres con reglas fijas
        // y van marcadas con simulado:true para que el front las rotule. Reemplazar por la telemetría real.
        // ---------------------------------------------------------------
        simulado: true,
        caudal_m3h: flujoM3,
        descarga_buque: flujoM3,                                    // el brazo descarga lo que fluye
        inyeccion: Number((flujoM3 * 0.95).toFixed(2)),             // send-out regasificado (95 %)
        bog: Number((flujoM3 * 0.15).toFixed(3)),                   // kg/h, misma tasa que el cold path
        volumen_almacenado: Number((62 + 8 * Math.sin(index / 300)).toFixed(1)), // % llenado de tanques
        poder_calorifico: Number((1045 + 10 * Math.sin(index / 120)).toFixed(1)), // BTU/ft³
        event_type: !esAlarma ? null
          : presionPsi >= 85 ? 'surge'
          : flujoM3 <= 0.1 ? 'blockage'
          : 'leak'
      };

      // 1. Enviar al Tablero Angular (Sin tocar Base de Datos)
      // Como el helper de sockets (setIO) ya fue inicializado en index.js, aquí lo usamos.
      // Solo a los clientes con el dashboard GNL de ese puerto abierto
      emitir('gnl-lectura-viva', lecturaViva, salaPuerto(id_puerto, 'gnl'));

      // 2. Guardar en el Buffer de Memoria para el Cold Path
      global.bufferGNL.push(lecturaViva);

      index++;
    }, 1000);
  }

  detenerSimulador() {
    if (global.intervaloGNL) {
      clearInterval(global.intervaloGNL);
      global.simuladorGNLActivo = false;
      return { msg: "Simulador GNL detenido exitosamente." };
    }
    throw { statusCode: 400, msg: "El simulador no estaba en ejecución." };
  }

  // ==========================================
  // COLD PATH: AGREGACIÓN Y PERSISTENCIA (CRON)
  // ==========================================
  async consolidarTelemetria() {
    if (!global.bufferGNL || global.bufferGNL.length === 0) {
      console.log("[GNL COLD PATH] No hay datos en el buffer para consolidar.");
      return;
    }

    // Extracción atómica del buffer
    const datosAProcesar = [...global.bufferGNL];
    global.bufferGNL = []; // Limpiamos la memoria inmediatamente

    // Corregido 2026-10-25: una fila por brazo y volumen = caudal × tiempo (ver utils/gnl-consolidado.js)
    const filas = consolidar(datosAProcesar);
    try {
      await conTransaccion(async (t) => {
        for (const f of filas) {
          const { lecturas, ...rawData } = f;
          await GnlRepository.registrarConsolidado(OperacionesFlujoGNLDTO({ ...rawData, codigoUsuarioCreacion: 'CRON_MANAGER' }), { transaction: t });
        }
      });
      const energia = filas.reduce((a, f) => a + f.energia_total_mmbtu, 0);
      console.log(`[GNL COLD PATH] Éxito: ${datosAProcesar.length} lecturas → ${filas.length} brazos. Energía: ${energia.toFixed(2)} MMBTU.`);
    } catch (error) {
      console.error("[GNL COLD PATH] Error al persistir agregación:", error);
      global.bufferGNL = [...datosAProcesar, ...global.bufferGNL];
    }
  }

  async obtenerHistorialFlujo(id_puerto, limite = 50) {
    return GnlRepository.historial(id_puerto, limite);
  }

  /** Vista ampliada (Fase 3): serie por hora de las últimas `horas` horas, total y por brazo. */
  async serieHistorial(id_puerto, horas = 24, ahora = new Date()) {
    const filas = await GnlRepository.historialDesde(id_puerto, new Date(ahora.getTime() - horas * 3600000).toISOString());
    return { ...serieHistorial(filas, horas, ahora), simulado: true, fuente: 'TCL_OperacionesFlujoGNL (consolidado cada 5 min)' };
  }
}

// ✅ EXPORTAMOS LA INSTANCIA DE LA CLASE
module.exports = new GnlTelemetriaService();