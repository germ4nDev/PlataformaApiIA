// /*
//     Author: German Valencia
//     Refactored for: QPLUS Architecture, GNL Business Logic & Hybrid Telemetry (Hot/Cold Path)
// */
// const fs = require('fs');
// const path = require('path');
// const csv = require('csv-parser');
// const { sequelize } = require('../../database/connection');
// const { TCLOperacionesFlujoGNL } = require('../../models');
// const { OperacionesFlujoGNLDTO } = require('../../models/torre-control/operaciones-flujo-gnl.model');
// const { getIO } = require('../../helpers/socket.helper');

// // Buffer en memoria compartido entre el simulador y el Cron Job
// global.bufferGNL = global.bufferGNL || [];
// global.simuladorGNLActivo = global.simuladorGNLActivo || false;

// class GnlTelemetriaService {

//   // ==========================================
//   // HOT PATH: SIMULADOR DE TELEMETRÍA (SOCKETS)
//   // ==========================================
//   async iniciarSimulador(id_puerto = 'CARTAGENA_SPEC') {
//     if (global.simuladorGNLActivo) {
//       throw { statusCode: 400, msg: "El simulador SCADA ya se encuentra en ejecución." };
//     }

//     const datosSCADA = [];
//     const csvPath = path.join(__dirname, '../../data/scada_pipeline.csv'); // Asegúrate de colocar el archivo aquí

//     if (!fs.existsSync(csvPath)) {
//       throw { statusCode: 404, msg: "No se encontró el archivo scada_pipeline.csv en la ruta esperada." };
//     }

//     return new Promise((resolve, reject) => {
//       fs.createReadStream(csvPath)
//         .pipe(csv())
//         .on('data', (row) => datosSCADA.push(row))
//         .on('end', () => {
//           global.simuladorGNLActivo = true;
//           this.transmitirDatosEnVivo(datosSCADA, id_puerto);
//           resolve({ msg: "Simulador GNL iniciado. Transmitiendo vía Socket.io..." });
//         })
//         .on('error', (error) => reject({ statusCode: 500, msg: error.message }));
//     });
//   }

//   transmitirDatosEnVivo(datos, id_puerto) {
//     let index = 0;

//     // Dispara 1 lectura cada segundo
//     global.intervaloGNL = setInterval(() => {
//       if (index >= datos.length) index = 0; // Loop infinito para la demo
//       const fila = datos[index];

//       // Transformación Matemática MVP (De Gas Convencional a GNL Criogénico)
//       const fluctuacionTermica = (parseFloat(fila.temperature) - 30) * -0.5;
//       const temperaturaGNL = -162 + fluctuacionTermica; // Rango -160 a -163
//       const presionPsi = parseFloat(fila.pressure);
//       const flujoM3 = parseFloat(fila.flow_rate);
//       const esAlarma = fila.alarm_triggered == '1';

//       const lecturaViva = {
//         id_puerto,
//         codigo_segmento: `BRAZO_DESCARGA_${fila.segment_id}`,
//         timestamp: new Date().toISOString(),
//         presion_psi: presionPsi,
//         temperatura_celsius: temperaturaGNL,
//         flujo_m3: flujoM3,
//         alarma_activa: esAlarma
//       };

//       // 1. Enviar al Tablero Angular (Sin tocar Base de Datos)
//       getIO().emit("gnl-lectura-viva", lecturaViva);

//       // 2. Guardar en el Buffer de Memoria para el Cold Path
//       global.bufferGNL.push(lecturaViva);

//       index++;
//     }, 1000);
//   }

//   detenerSimulador() {
//     if (global.intervaloGNL) {
//       clearInterval(global.intervaloGNL);
//       global.simuladorGNLActivo = false;
//       return { msg: "Simulador GNL detenido exitosamente." };
//     }
//     throw { statusCode: 400, msg: "El simulador no estaba en ejecución." };
//   }

//   // ==========================================
//   // COLD PATH: AGREGACIÓN Y PERSISTENCIA (CRON)
//   // ==========================================
//   async consolidarTelemetria() {
//     if (!global.bufferGNL || global.bufferGNL.length === 0) {
//       console.log("[GNL COLD PATH] No hay datos en el buffer para consolidar.");
//       return;
//     }

//     // Extracción atómica del buffer
//     const datosAProcesar = [...global.bufferGNL];
//     global.bufferGNL = []; // Limpiamos la memoria inmediatamente

//     const totalLecturas = datosAProcesar.length;
//     const id_puerto = datosAProcesar[0].id_puerto;
//     const codigo_segmento = datosAProcesar[0].codigo_segmento;

//     // Matemáticas de Agregación
//     const sumaPresion = datosAProcesar.reduce((acc, curr) => acc + curr.presion_psi, 0);
//     const sumaTemp = datosAProcesar.reduce((acc, curr) => acc + curr.temperatura_celsius, 0);
//     const flujoTotalM3 = datosAProcesar.reduce((acc, curr) => acc + curr.flujo_m3, 0);
//     const totalAlarmas = datosAProcesar.filter(d => d.alarma_activa).length;

//     // Reglas de Negocio GNL
//     const presionPromedio = sumaPresion / totalLecturas;
//     const tempPromedio = sumaTemp / totalLecturas;

//     // 1 m3 de GNL = ~22.4 MMBTU de energía
//     const energiaMMBTU = flujoTotalM3 * 22.4;
//     // BOG (Boil-off Gas) estimado de pérdida en este lapso
//     const bogCalculado = flujoTotalM3 * 0.00015;

//     // Fechas de la ventana
//     const fechaInicio = datosAProcesar[0].timestamp;
//     const fechaFin = datosAProcesar[totalLecturas - 1].timestamp;

//     const rawData = {
//       id_puerto,
//       codigo_segmento,
//       fecha_inicio_lectura: fechaInicio,
//       fecha_fin_lectura: fechaFin,
//       presion_promedio_psi: presionPromedio,
//       temperatura_promedio_celsius: tempPromedio,
//       flujo_total_m3: flujoTotalM3,
//       bog_calculado_m3: bogCalculado,
//       energia_total_mmbtu: energiaMMBTU,
//       alertas_disparadas: totalAlarmas,
//       codigoUsuarioCreacion: 'CRON_MANAGER'
//     };

//     try {
//       const dataDTO = OperacionesFlujoGNLDTO(rawData);

//       await sequelize.transaction(async (t) => {
//         await TCLOperacionesFlujoGNL.create(dataDTO, { transaction: t });
//       });

//       console.log(`[GNL COLD PATH] Éxito: Consolidados ${totalLecturas} registros a BD. Energía: ${energiaMMBTU.toFixed(2)} MMBTU.`);
//     } catch (error) {
//       console.error("[GNL COLD PATH] Error al persistir agregación:", error);
//       // Si falla, regresamos los datos al buffer para no perderlos
//       global.bufferGNL = [...datosAProcesar, ...global.bufferGNL];
//     }
//   }

//   // ==========================================
//   // CONSULTA PARA EL TABLERO (GRÁFICA HISTÓRICA)
//   // ==========================================
//   async obtenerHistorialFlujo(id_puerto, limite = 50) {
//     return await TCLOperacionesFlujoGNL.findAll({
//       where: { id_puerto },
//       order: [['fecha_inicio_lectura', 'DESC']],
//       limit: limite,
//       raw: true // Optimización estricta para Angular
//     });
//   }
// }

// module.exports = new GnlTelemetriaService();

/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, GNL Business Logic & Hybrid Telemetry (Hot/Cold Path)
*/
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');
const { sequelize } = require('../../database/connection');
const { TCLOperacionesFlujoGNL } = require('../../models');
const { OperacionesFlujoGNLDTO } = require('../../models/torre-control/operaciones-flujo-gnl.model');
const { getIO } = require('../../helpers/socket.helper');

// Buffer en memoria compartido entre el simulador y el Cron Job
global.bufferGNL = global.bufferGNL || [];
global.simuladorGNLActivo = global.simuladorGNLActivo || false;

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

        alarma_activa: esAlarma
      };

      // 1. Enviar al Tablero Angular (Sin tocar Base de Datos)
      // Como el helper de sockets (setIO) ya fue inicializado en index.js, aquí lo usamos.
      getIO().emit("gnl-lectura-viva", lecturaViva);

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

    const totalLecturas = datosAProcesar.length;
    const id_puerto = datosAProcesar[0].id_puerto;
    const codigo_segmento = datosAProcesar[0].codigo_segmento;

    // Matemáticas de Agregación
    const sumaPresion = datosAProcesar.reduce((acc, curr) => acc + curr.presion_psi, 0);
    const sumaTemp = datosAProcesar.reduce((acc, curr) => acc + curr.temperatura_celsius, 0);
    const flujoTotalM3 = datosAProcesar.reduce((acc, curr) => acc + curr.flujo_m3, 0);
    const totalAlarmas = datosAProcesar.filter(d => d.alarma_activa).length;

    // Reglas de Negocio GNL
    const presionPromedio = sumaPresion / totalLecturas;
    const tempPromedio = sumaTemp / totalLecturas;

    // 1 m3 de GNL = ~22.4 MMBTU de energía
    const energiaMMBTU = flujoTotalM3 * 22.4;
    const bogCalculado = flujoTotalM3 * 0.00015;

    const fechaInicio = datosAProcesar[0].timestamp;
    const fechaFin = datosAProcesar[totalLecturas - 1].timestamp;

    const rawData = {
      id_puerto,
      codigo_segmento,
      fecha_inicio_lectura: fechaInicio,
      fecha_fin_lectura: fechaFin,
      presion_promedio_psi: presionPromedio,
      temperatura_promedio_celsius: tempPromedio,
      flujo_total_m3: flujoTotalM3,
      bog_calculado_m3: bogCalculado,
      energia_total_mmbtu: energiaMMBTU,
      alertas_disparadas: totalAlarmas,
      codigoUsuarioCreacion: 'CRON_MANAGER'
    };

    try {
      const dataDTO = OperacionesFlujoGNLDTO(rawData);
      await sequelize.transaction(async (t) => {
        await TCLOperacionesFlujoGNL.create(dataDTO, { transaction: t });
      });
      console.log(`[GNL COLD PATH] Éxito: Consolidados ${totalLecturas} registros a BD. Energía: ${energiaMMBTU.toFixed(2)} MMBTU.`);
    } catch (error) {
      console.error("[GNL COLD PATH] Error al persistir agregación:", error);
      global.bufferGNL = [...datosAProcesar, ...global.bufferGNL];
    }
  }

  async obtenerHistorialFlujo(id_puerto, limite = 50) {
    return await TCLOperacionesFlujoGNL.findAll({
      where: { id_puerto },
      order: [['fecha_inicio_lectura', 'DESC']],
      limit: limite,
      raw: true
    });
  }
}

// ✅ EXPORTAMOS LA INSTANCIA DE LA CLASE
module.exports = new GnlTelemetriaService();