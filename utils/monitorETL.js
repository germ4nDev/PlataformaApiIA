const { preferences } = require('joi');
const { BitacoraSincronizacion } = require('../models');
const { db } = require('../models');
const { io } = require('../index');
// async function ejecutarCronMonitoreo(nombreProceso, funcionETL) {
//   const inicio = Date.now();
//   let estado = 'EXITO';
//   let detalle = null;
//   let procesados = 0;

//   try {
//     const resultado = await funcionETL();

//     procesados = resultado?.insertados || resultado?.length || 0;
//     console.log('datos procesados', procesados);

//   } catch (error) {
//     estado = 'FALLO_CRITICO';

//     if (error.original) {
//       detalle = error.original.message;
//     } else if (error.errors && error.errors.length > 0) {
//       detalle = error.errors.map(e => `${e.path}: ${e.message}`).join(' | ');
//     } else {
//       detalle = error.message;
//     }

//     console.error(`🚨 [MONITOR] Fallo en ${nombreProceso}:`, detalle);
//   } finally {
//     const tiempo_ejecucion_ms = Date.now() - inicio;

//     try {
//       console.log('¿Existe el modelo?:', !!BitacoraSincronizacion);
//       console.log('proceso:', nombreProceso);
//       console.log('estado', estado);
//       console.log('registros_procesados:', cantidad);
//       console.log('errores:', mensajeError);
//       console.log('duracion_ms:', tiempo);
//       console.log('fecha_ejecucion:', fechaISO);

//       await BitacoraSincronizacion.create({
//         proceso: nombreProceso,
//         estado: estado,
//         registros_procesados: cantidad,
//         errores: mensajeError,
//         duracion_ms: tiempo,
//         fecha_ejecucion: fechaISO,
//         createdAt: fechaISO,
//         updatedAt: fechaISO
//       });
//     } catch (logError) {
//       console.error('❌ Error crítico intentando guardar la bitácora:', logError.message);
//     }
//   }
// }
async function ejecutarCronMonitoreo(nombreProceso, funcionSincronizacion) {
  // 1. Iniciamos el cronómetro
  const inicio = Date.now();

  // 2. Declaración de variables en el SCOPE SUPERIOR (Anti Capa-8 🛡️)
  // De esta forma, el bloque 'finally' siempre podrá acceder a ellas, falle o no el proceso.
  let cantidad = 0;
  let estado = 'FALLIDO';
  let mensajeError = 'Ninguno';

  try {
    // 3. Ejecutamos tu lógica de sincronización (ETL)
    // Se asume que tu función retorna la cantidad de registros procesados o un array
    const resultado = await funcionSincronizacion();

    // Si la función fue exitosa, actualizamos las variables
    cantidad = resultado?.length !== undefined ? resultado.length : (resultado || 0);
    estado = 'EXITO';

  } catch (error) {
    // 4. Si el proceso principal falla, capturamos el error
    estado = 'FALLIDO';
    mensajeError = error.message || 'Error desconocido';
    console.error(`🚨 [MONITOR] Fallo en ${nombreProceso}:`, error);

  } finally {
    // 5. Bloque de auditoría: Se ejecuta SIEMPRE (con éxito o con error)
    const tiempo_ejecucion_ms = Date.now() - inicio;
    const fechaISO = new Date().toISOString(); // Evitamos el error de validación de fechas de Sequelize

    try {
      // Logs de depuración
      console.log('¿Existe el modelo?:', !!BitacoraSincronizacion);
      console.log('proceso:', nombreProceso);
      console.log('estado:', estado);
      console.log('registros_procesados:', cantidad);
      console.log('errores:', mensajeError);
      console.log('duracion_ms:', tiempo_ejecucion_ms);
      console.log('fecha_ejecucion:', fechaISO);

      // Persistencia en la tabla TCL_BitacoraSincronizacion
      await BitacoraSincronizacion.create({
        proceso: nombreProceso,
        estado: estado,
        registros_procesados: cantidad,
        errores: mensajeError,
        duracion_ms: tiempo_ejecucion_ms,
        fecha_ejecucion: fechaISO,
        createdAt: fechaISO,
        updatedAt: fechaISO
      });

      console.log(`✅ Bitácora guardada para: ${nombreProceso}`);

      // 🚀 EMISIÓN DEL EVENTO POR SOCKET.IO
      // Asumiendo que 'io' es tu servidor de sockets. Disparamos el evento a todos los clientes.
      if (io) {
        io.emit('crons-actualizados', {
          proceso: nombreProceso,
          estado: estado,
          timestamp: fechaISO
        });
        console.log('📡 Evento "crons-actualizados" emitido a los clientes');
      }

    } catch (logError) {
      // Si la base de datos falla al guardar la bitácora, al menos no tumba el servidor
      console.error('❌ Error crítico intentando guardar la bitácora:', logError.message);
    }
  }
}

module.exports = ejecutarCronMonitoreo;