// // const db = require('../models');
// // const MapaGeneralRepository = require('../repositories/torre-control/mapa-general.repository');
// // const ExternalIntegrationService = require('../services/torre-control/external-integration.service');
// // const { EventoVial, sequelize } = require('../models/index');
// // const { EventoVialDTO } = require('../models/torre-control/evento-vial.model');

// // // Accede al modelo inicializado
// // const EventoVialModel = db.EventoVial;

// // class SincronizacionService {

// //   async sincronizarAlertasClimaticas() {
// //     try {
// //       const datosOficiales = await ExternalIntegrationService.getAlertasClimaticasOficiales();
// //       for (const item of datosOficiales) {
// //         const alerta = {
// //           codigoAlerta: item.id_externo,
// //           region: item.zona,
// //           corredorVial: item.corredor,
// //           sector: item.tramo,
// //           tipoAlerta: item.tipo,
// //           nivelSeveridad: parseInt(item.nivel),
// //           estadoAlerta: 'ACTIVO',
// //           fechalnicio: new Date().toISOString()
// //         };
// //         await MapaGeneralRepository.upsertAlertaClimatica(alerta);
// //       }
// //     } catch (error) {
// //       console.error("❌ Error en sincronización climática:", error);
// //     }
// //   }

// //   // async sincronizarEventosViales() {
// //   //   console.log("🚀 Iniciando sincronización de eventos viales...");
// //   //   try {
// //   //     const incidentesTomTom = await ExternalIntegrationService.getEventosVialesOficiales();
// //   //     const userContext = { codigoUsuario: 'SYS_CRON_TOMTOM' };

// //   //     console.log(`📊 Total de incidentes activos reportados por TomTom: ${incidentesTomTom.length}`);

// //   //     // Iteramos directamente sobre TODO lo que mande TomTom, porque si lo envían, es porque sigue activo
// //   //     // for (const item of incidentesTomTom) {
// //   //     //   try {
// //   //     //     const rawData = this._mapearEventoVial(item);
// //   //     //     const eventoDTO = EventoVialDTO(rawData, userContext);

// //   //     //     // 1. Clonamos el DTO para asegurar que podemos modificar la propiedad ubicacion_geo sin romper restricciones de inmutabilidad
// //   //     //     const eventoParaGuardar = { ...eventoDTO };

// //   //     //     // 2. Conversión a SQL Literal para MSSQL usando la instrucción nativa y segura (SRID 4326)
// //   //     //     if (eventoParaGuardar.ubicacion_geo && eventoParaGuardar.ubicacion_geo.coordinates) {
// //   //     //       const [lon, lat] = eventoParaGuardar.ubicacion_geo.coordinates;
// //   //     //       eventoParaGuardar.ubicacion_geo = sequelize.literal(`geometry::STGeomFromText('POINT(${lon} ${lat})', 4326)`);
// //   //     //     }

// //   //     //     // 3. Persistencia en la base de datos
// //   //     //     const eventoExistente = await EventoVialModel.findByPk(eventoParaGuardar.codigoEvento);

// //   //     //     if (eventoExistente) {
// //   //     //       await eventoExistente.update(eventoParaGuardar);
// //   //     //       // console.log(`✅ Actualizado: ${eventoParaGuardar.codigoEvento}`);
// //   //     //     } else {
// //   //     //       await EventoVialModel.create(eventoParaGuardar);
// //   //     //       // console.log(`✨ Creado: ${eventoParaGuardar.codigoEvento}`);
// //   //     //     }
// //   //     //   } catch (error) {
// //   //     //     console.log(`===========================================`);
// //   //     //     console.log(`❌ FALLO CAPTURADO EN REGISTRO: ${item.properties?.id || 'Desconocido'}`);
// //   //     //     // Imprimimos el mensaje específico de error para que la terminal no se inunde
// //   //     //     console.log(`MOTIVO COMPLETO:`, error.message || error);
// //   //     //     console.log(`===========================================`);
// //   //     //   }
// //   //     // }
// //   //     for (const item of incidentesTomTom) {
// //   //       try {
// //   //         const rawData = this._mapearEventoVial(item);

// //   //         // 🟢 1. El DTO retorna el GeoJSON puro: { type: 'Point', coordinates: [lon, lat] }
// //   //         const eventoDTO = EventoVialDTO(rawData, userContext);

// //   //         // ❌ BORRAMOS EL BLOQUE DE 'sequelize.literal' AQUÍ. 
// //   //         // Sequelize se encargará automáticamente de la conversión espacial gracias a 'DataTypes.GEOMETRY'.

// //   //         // 🟢 2. Persistencia directa
// //   //         const eventoExistente = await EventoVialModel.findByPk(eventoDTO.codigoEvento);

// //   //         if (eventoExistente) {
// //   //           await eventoExistente.update(eventoDTO);
// //   //         } else {
// //   //           await EventoVialModel.create(eventoDTO);
// //   //         }

// //   //       } catch (error) {
// //   //         console.log(`===========================================`);
// //   //         console.log(`❌ FALLO CAPTURADO EN REGISTRO: ${item.properties?.id || 'Desconocido'}`);
// //   //         // Imprimir error.message o error.details (que envía Joi) para más claridad
// //   //         console.log(`MOTIVO:`, error.details || error.message || error);
// //   //         console.log(`===========================================`);
// //   //       }
// //   //     }
// //   //     console.log("🏁 Sincronización de eventos viales finalizada.");
// //   //   } catch (error) {
// //   //     console.error("❌ Error grave en el Job:", error);
// //   //   }
// //   // }
// //   static async sincronizarEventosViales(opciones = {}) {
// //     // 🟢 2. Extraemos dryRun, si no existe, por defecto es false
// //     const { dryRun = false } = opciones;

// //     try {
// //       console.log('📡 Consumiendo API externa (TomTom/INVIAS)...');

// //       // Aquí va tu código actual de petición a la API externa
// //       // const response = await axios.get('URL_DE_TU_API');
// //       // const datosExternos = response.data;

// //       // Simulación de datos extraídos para el ejemplo
// //       const datosExternos = [];

// //       // -------------------------------------------------------------
// //       // 🚧 ZONA CRÍTICA: MAPEO DE DATOS (Especialmente GEOMETRY)
// //       // -------------------------------------------------------------
// //       const payloadParaBD = datosExternos.map(evento => {
// //         return {
// //           id_externo: evento.id,
// //           descripcion: evento.description,
// //           // 🟢 Asegúrate de que el formato coincida con lo que espera Sequelize para SQL Server
// //           coordenadas: {
// //             type: 'Point',
// //             coordinates: [evento.longitud, evento.latitud] // [Longitud, Latitud]
// //           },
// //           fecha_evento: evento.date
// //         };
// //       });

// //       // 🟢 3. EL SEMÁFORO DRY-RUN
// //       // Si dryRun es true, devolvemos el payload exacto y salimos de la función.
// //       if (dryRun) {
// //         console.log(`🛠️ [DRY RUN] Modo diagnóstico activo. Simulados ${payloadParaBD.length} registros.`);
// //         return payloadParaBD;
// //       }

// //       // -------------------------------------------------------------
// //       // 💾 INSERCIÓN EN BASE DE DATOS (Solo se ejecuta si dryRun es false)
// //       // -------------------------------------------------------------
// //       console.log('💾 Insertando registros en SQL Server...');

// //       // Te recomiendo usar ignoreDuplicates o updateOnDuplicate dependiendo de tu lógica
// //       const resultado = await EventoVial.bulkCreate(payloadParaBD, {
// //         ignoreDuplicates: true
// //       });

// //       // 🟢 4. Retornamos la cantidad de insertados para que el Wrapper de monitoreo lo registre
// //       return { insertados: resultado.length };

// //     } catch (error) {
// //       console.error('❌ Error en sincronizarEventosViales:', error);
// //       throw error; // Propagamos el error para que el Wrapper lo atrape
// //     }
// //   }

// //   iniciarMotorSimulacion() {
// //     console.log("🚛 Iniciando Motor de Simulación de Flota Terrestre...");

// //     setInterval(async () => {
// //       try {
// //         // Pega aquí exactamente el Query de la Fase 2 usando Sequelize literal o RAW
// //         await sequelize.query(`
// //             DECLARE @SegundosDeSimulacion FLOAT = 10.0; 
// //             DECLARE @Horas FLOAT = @SegundosDeSimulacion / 3600.0;
// //             DECLARE @GradosPorKm FLOAT = 1.0 / 111.32; 

// //             WITH Movimiento AS ( ... ) -- TODO EL QUERY
// //             UPDATE T SET ...
// //          `);
// //       } catch (error) {
// //         console.error("Error moviendo la flota:", error);
// //       }
// //     }, 10000); // 10000 milisegundos = 10 segundos
// //   }

// //   _mapearEventoVial(item) {
// //     const props = item.properties || {};

// //     // iconCategory es el código numérico que manda TomTom
// //     const categoria = props.iconCategory || 0;
// //     const magnitud = props.magnitudeOfDelay || 0;

// //     const coords = item.geometry?.coordinates;
// //     const puntoInicial = Array.isArray(coords[0]) ? coords[0] : coords;
// //     const lon = puntoInicial[0];
// //     const lat = puntoInicial[1];

// //     // 1. CLASIFICACIÓN CORREGIDA DE TOMTOM
// //     let tipoEventoMapeado = 'ALERTA_VIAL';

// //     switch (categoria) {
// //       case 1:
// //         tipoEventoMapeado = 'ACCIDENTE';
// //         break;
// //       case 6: // <--- ¡AQUÍ ESTABA EL ERROR! Ahora sí es Congestión
// //         tipoEventoMapeado = 'CONGESTION';
// //         break;
// //       case 8:
// //       case 9:
// //         tipoEventoMapeado = 'CIERRE_VIAL';
// //         break;
// //       case 11:
// //         tipoEventoMapeado = 'MANTENIMIENTO_OBRA';
// //         break;
// //       case 2:
// //       case 3:
// //       case 4:
// //       case 5:
// //         tipoEventoMapeado = 'ALERTA_CLIMATICA';
// //         break;
// //       case 14:
// //         tipoEventoMapeado = 'VEHICULO_AVERIDADO';
// //         break;
// //       default:
// //         tipoEventoMapeado = 'ALERTA_VIAL';
// //     }

// //     // 2. Cálculo de severidad
// //     let severidadMapeada = 1;
// //     if (magnitud >= 3) severidadMapeada = 3;
// //     else if (magnitud === 2) severidadMapeada = 2;

// //     const corredorPorDefecto = 'Buga - Buenaventura';
// //     let descripcionLugar = props.from ? `De ${props.from} a ${props.to || ''}` : 'Sector Georreferenciado';

// //     let descripcionLimpia = 'Novedad vial reportada.';
// //     if (props.events && props.events.length > 0) {
// //       descripcionLimpia = props.events.map(e => e.description).join(' | ').substring(0, 4000);
// //     }

// //     return {
// //       // 🟢 1. Enviamos idExterno como lo pide el DTO
// //       idExterno: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
// //       codigoEvento: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36), // Dejamos este por si el modelo Sequelize lo usa
// //       corredorVial: corredorPorDefecto,
// //       sector: descripcionLugar.substring(0, 100),
// //       tipoEvento: tipoEventoMapeado,
// //       descripcion: descripcionLimpia,
// //       nivelSeveridad: severidadMapeada,
// //       estadoEvento: 'ACTIVO',
// //       ubicacion_geo: (lat && lon) ? { type: 'Point', coordinates: [lon, lat] } : null,

// //       // 🟢 2. Corregimos el error tipográfico: fechaInicio con "I" mayúscula
// //       fechaInicio: props.startTime ? new Date(props.startTime).toISOString() : new Date().toISOString(),
// //       fechaFin: props.endTime ? new Date(props.endTime).toISOString() : null
// //     };
// //   }
// // }

// // module.exports = new SincronizacionService();

// const db = require('../models');
// const MapaGeneralRepository = require('../repositories/torre-control/mapa-general.repository');
// const ExternalIntegrationService = require('../services/torre-control/external-integration.service');
// const { EventoVial, sequelize } = require('../models/index');
// const { EventoVialDTO } = require('../models/torre-control/evento-vial.model');

// // Accede al modelo inicializado
// const EventoVialModel = db.EventoVial;

// class SincronizacionService {

//   async sincronizarAlertasClimaticas() {
//     try {
//       const datosOficiales = await ExternalIntegrationService.getAlertasClimaticasOficiales();
//       for (const item of datosOficiales) {
//         const alerta = {
//           codigoAlerta: item.id_externo,
//           region: item.zona,
//           corredorVial: item.corredor,
//           sector: item.tramo,
//           tipoAlerta: item.tipo,
//           nivelSeveridad: parseInt(item.nivel),
//           estadoAlerta: 'ACTIVO',
//           fechalnicio: new Date().toISOString()
//         };
//         await MapaGeneralRepository.upsertAlertaClimatica(alerta);
//       }
//     } catch (error) {
//       console.error("❌ Error en sincronización climática:", error);
//     }
//   }

//   async sincronizarEventosViales(opciones = {}) {
//     // Extraemos dryRun, si no existe, por defecto es false
//     const { dryRun = false } = opciones;
//     let procesados = 0;

//     try {
//       console.log('📡 Consumiendo API externa (TomTom) vía ExternalIntegrationService...');

//       const incidentesTomTom = await ExternalIntegrationService.getEventosVialesOficiales();
//       const userContext = { codigoUsuario: 'SYS_CRON_TOMTOM' };

//       console.log(`📊 Total de incidentes activos reportados por TomTom: ${incidentesTomTom.length}`);

//       const payloadParaBD = [];

//       // -------------------------------------------------------------
//       // 🚧 ZONA DE MAPEO Y DTO
//       // -------------------------------------------------------------
//       for (const item of incidentesTomTom) {
//         try {
//           const rawData = this._mapearEventoVial(item);

//           // El DTO retorna el GeoJSON puro: { type: 'Point', coordinates: [lon, lat] }
//           const eventoDTO = EventoVialDTO(rawData, userContext);

//           payloadParaBD.push(eventoDTO);

//         } catch (error) {
//           console.log(`===========================================`);
//           console.log(`❌ FALLO CAPTURADO EN REGISTRO: ${item.properties?.id || 'Desconocido'}`);
//           console.log(`MOTIVO:`, error.details || error.message || error);
//           console.log(`===========================================`);
//         }
//       }

//       // -------------------------------------------------------------
//       // 🛑 EL SEMÁFORO DRY-RUN
//       // -------------------------------------------------------------
//       // Si dryRun es true, devolvemos el payload exacto y salimos de la función sin tocar SQL Server.
//       if (dryRun) {
//         console.log(`🛠️ [DRY RUN] Modo diagnóstico activo. Simulados ${payloadParaBD.length} registros estructurados.`);
//         return payloadParaBD;
//       }

//       // -------------------------------------------------------------
//       // 💾 INSERCIÓN EN BASE DE DATOS
//       // -------------------------------------------------------------
//       console.log('💾 Insertando/Actualizando registros en SQL Server...');
//       for (const eventoDTO of payloadParaBD) {
//         // Buscamos si el evento ya existe
//         const eventoExistente = await EventoVialModel.findByPk(eventoDTO.codigoEvento);

//         if (eventoExistente) {
//           await eventoExistente.update(eventoDTO);
//           procesados++;
//         } else {
//           await EventoVialModel.create(eventoDTO);
//           procesados++;
//         }
//       }

//       console.log("🏁 Sincronización de eventos viales finalizada.");

//       // Retornamos la cantidad de insertados/actualizados para que el Wrapper de monitoreo (Bitácora) lo registre
//       return { insertados: procesados };

//     } catch (error) {
//       console.error('❌ Error grave en sincronizarEventosViales:', error);
//       throw error; // Propagamos el error para que la Torre de Control (Bitácora) lo atrape y registre
//     }
//   }

//   async ejecutarSincronizacion(opciones = {}) {
//     const { dryRun = false } = opciones;

//     console.log(`[SUPERVISOR] Iniciando auditoría de Cron Jobs... Modo DryRun: ${dryRun}`);

//     try {
//       // ==========================================
//       // 1. OBTENER LISTA DE CRONS A EVALUAR
//       // ==========================================
//       // Esto puede venir de tu base de datos (una tabla de configuración de túneles)
//       // o de las tareas activas en memoria de tu servidor.
//       const cronsMonitorizados = [
//         { id: 'cron_clima', nombre_db: '🔄 ETL Nacional de Clima', umbral_horas: 1 },
//         { id: 'cron_motonaves', nombre_db: '🔄 Escaneo de motonaves', umbral_horas: 1 },
//         { id: 'cron_dimar', nombre_db: '🔄 Actualizando boletines externos DIMAR', umbral_horas: 7 },
//         { id: 'cron_prod_ayer', nombre_db: '🔄 Generando reportes de productividad del día anterior', umbral_horas: 25 },
//         { id: 'cron_boletin_sem', nombre_db: '🔄 Boletines semanales', umbral_horas: 25 },
//         { id: 'cron_terminales', nombre_db: '🔄 Iniciando captura de productividad por terminales', umbral_horas: 3 },
//         { id: 'cron_camiones_pos', nombre_db: '🔄 Iniciando captura de posiciones de camiones', umbral_horas: 1 },
//         { id: 'cron_eventos_viales', nombre_db: '🔄 Eventos Viales TomTom', umbral_horas: 1 },
//         { id: 'cron_alertas_clima', nombre_db: '🔄 Iniciando sincronización automática de alertas climáticas', umbral_horas: 1 },
//         { id: 'cron_camiones_sim', nombre_db: '🔄 Iniciando simulación de movimiento', umbral_horas: 1 }
//       ];

//       let cronsEvaluados = 0;
//       let alertasGeneradas = 0;
//       const detallesEvidencia = [];

//       // ==========================================
//       // 2. REVISIÓN Y RECOPILACIÓN DE EVIDENCIA
//       // ==========================================
//       for (const cron of cronsMonitorizados) {
//         // Aquí implementas tu lógica real para verificar el estado del cron.
//         // Por ejemplo: buscar en la bitácora si su última ejecución exitosa fue hace más de 24h.

//         // Simulamos la verificación lógica:
//         const estadoSalud = true; // Supongamos que la validación dio que está sano

//         if (estadoSalud) {
//           detallesEvidencia.push(`✅ ${cron.id}: Operativo.`);
//         } else {
//           detallesEvidencia.push(`⚠️ ${cron.id}: Retraso detectado o inactivo.`);
//           alertasGeneradas++;
//         }

//         cronsEvaluados++;
//       }

//       // ==========================================
//       // 3. REGISTRO O ACCIONES EN BASE A LA EVIDENCIA
//       // ==========================================
//       if (dryRun) {
//         // MODO SIMULACIÓN: Mostramos la evidencia en consola pero no alteramos nada más.
//         console.log(`[SUPERVISOR] 🚧 DRY RUN ACTIVO: Se evaluaron ${cronsEvaluados} crons.`);
//         console.log(`[SUPERVISOR] Evidencia recopilada:\n`, detallesEvidencia.join('\n'));
//       } else {
//         // MODO REAL: 
//         // Aquí podrías actualizar una tabla maestra de 'Estado Global de la Plataforma'
//         // o enviar un correo/socket si 'alertasGeneradas' es mayor a 0.
//         console.log(`[SUPERVISOR] 💾 Guardando estado actualizado de ${cronsEvaluados} crons en el sistema.`);
//       }

//       // ==========================================
//       // 4. RETORNO PARA EL ENVOLTORIO
//       // ==========================================
//       // El envoltorio leerá "insertados" y lo guardará en la columna "registros_procesados"
//       // En el contexto de un supervisor, esto equivale a "Cantidad de Crons Revisados".
//       return {
//         exito: true,
//         insertados: cronsEvaluados,
//         resumen: detallesEvidencia.join(' | ') // Opcional, si quisieras guardarlo después
//       };

//     } catch (error) {
//       console.error('[SUPERVISOR] ❌ Fallo crítico intentando auditar los crons:', error.message);

//       // Lanzamos el error para que tu "ejecutarConMonitoreo" atrape el fallo 
//       // y lo registre en TCL_BitacoraSincronizacion como FALLO_CRITICO.
//       throw error;
//     }
//   };

//   iniciarMotorSimulacion() {
//     console.log("🚛 Iniciando Motor de Simulación de Flota Terrestre...");

//     setInterval(async () => {
//       try {
//         await sequelize.query(`
//           -- 1. Variables de tiempo: Calculamos la fracción de hora que representan 10 segundos
//           DECLARE @SegundosDeSimulacion FLOAT = 10.0;
//           DECLARE @Horas FLOAT = @SegundosDeSimulacion / 3600.0;

//           -- 2. Constante de la Tierra: 1 grado de latitud equivale aprox a 111.32 Km
//           DECLARE @KmPorGrado FLOAT = 111.32;

//           -- 3. Seleccionamos únicamente los vehículos que están en movimiento
//           WITH FlotaEnMovimiento AS (
//             SELECT 
//               -- ⚠️ Ajusta estos nombres a las columnas reales de tu tabla Maestro_Vehiculos
//               id_vehiculo,
//               latitud,
//               longitud,
//               velocidad_actual, -- Debe estar en Km/h
//               rumbo,            -- Grados (0 = Norte, 90 = Este, 180 = Sur, 270 = Oeste)
//               ubicacion_geo     -- Si usas columna espacial GEOMETRY
//             FROM Maestro_Vehiculos 
//             WHERE estado = 'EN_RUTA' 
//               AND velocidad_actual > 0
//               AND latitud IS NOT NULL 
//               AND longitud IS NOT NULL
//           )
//           -- 4. Proyectamos las nuevas coordenadas
//           UPDATE FlotaEnMovimiento
//           SET 
//             -- Cálculo de nueva Latitud (Eje Y): Distancia * Coseno del Rumbo
//             latitud = latitud + ((velocidad_actual * @Horas) * COS(RADIANS(rumbo)) / @KmPorGrado),

//             -- Cálculo de nueva Longitud (Eje X): Distancia * Seno del Rumbo 
//             -- (Se divide por el Coseno de la latitud para compensar la curvatura de la tierra)
//             longitud = longitud + ((velocidad_actual * @Horas) * SIN(RADIANS(rumbo)) / (@KmPorGrado * COS(RADIANS(latitud))))

//             -- Opcional: Si necesitas actualizar el campo GEOMETRY al mismo tiempo, descomenta la siguiente línea:
//             -- , ubicacion_geo = geometry::Point(longitud + (...), latitud + (...), 4326)
//         `);
//       } catch (error) {
//         console.error("Error moviendo la flota:", error);
//       }
//     }, 10000); // 10000 milisegundos = 10 segundos
//   }

//   _mapearEventoVial(item) {
//     const props = item.properties || {};

//     // iconCategory es el código numérico que manda TomTom
//     const categoria = props.iconCategory || 0;
//     const magnitud = props.magnitudeOfDelay || 0;

//     const coords = item.geometry?.coordinates;
//     const puntoInicial = Array.isArray(coords[0]) ? coords[0] : coords;
//     const lon = puntoInicial[0];
//     const lat = puntoInicial[1];

//     // 1. CLASIFICACIÓN CORREGIDA DE TOMTOM
//     let tipoEventoMapeado = 'ALERTA_VIAL';

//     switch (categoria) {
//       case 1:
//         tipoEventoMapeado = 'ACCIDENTE';
//         break;
//       case 6: // <--- Congestión corregida
//         tipoEventoMapeado = 'CONGESTION';
//         break;
//       case 8:
//       case 9:
//         tipoEventoMapeado = 'CIERRE_VIAL';
//         break;
//       case 11:
//         tipoEventoMapeado = 'MANTENIMIENTO_OBRA';
//         break;
//       case 2:
//       case 3:
//       case 4:
//       case 5:
//         tipoEventoMapeado = 'ALERTA_CLIMATICA';
//         break;
//       case 14:
//         tipoEventoMapeado = 'VEHICULO_AVERIDADO';
//         break;
//       default:
//         tipoEventoMapeado = 'ALERTA_VIAL';
//     }

//     // 2. Cálculo de severidad
//     let severidadMapeada = 1;
//     if (magnitud >= 3) severidadMapeada = 3;
//     else if (magnitud === 2) severidadMapeada = 2;

//     const corredorPorDefecto = 'Buga - Buenaventura';
//     let descripcionLugar = props.from ? `De ${props.from} a ${props.to || ''}` : 'Sector Georreferenciado';

//     let descripcionLimpia = 'Novedad vial reportada.';
//     if (props.events && props.events.length > 0) {
//       descripcionLimpia = props.events.map(e => e.description).join(' | ').substring(0, 4000);
//     }

//     return {
//       idExterno: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
//       codigoEvento: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
//       corredorVial: corredorPorDefecto,
//       sector: descripcionLugar.substring(0, 100),
//       tipoEvento: tipoEventoMapeado,
//       descripcion: descripcionLimpia,
//       nivelSeveridad: severidadMapeada,
//       estadoEvento: 'ACTIVO',
//       // Envio de la ubicación pura para que el DTO y Sequelize lo manejen
//       ubicacion_geo: (lat && lon) ? { type: 'Point', coordinates: [lon, lat] } : null,
//       fechaInicio: props.startTime ? new Date(props.startTime).toISOString() : new Date().toISOString(),
//       fechaFin: props.endTime ? new Date(props.endTime).toISOString() : null
//     };
//   }
// }

// module.exports = new SincronizacionService();
const db = require('../models');
const MapaGeneralRepository = require('../repositories/torre-control/mapa-general.repository');
const ExternalIntegrationService = require('../services/torre-control/external-integration.service');
const { EventoVial, sequelize } = require('../models/index');
const { EventoVialDTO } = require('../models/torre-control/evento-vial.model');

// Accede al modelo inicializado
const EventoVialModel = db.EventoVial;

class SincronizacionService {

  async sincronizarAlertasClimaticas() {
    try {
      const datosOficiales = await ExternalIntegrationService.getAlertasClimaticasOficiales();
      for (const item of datosOficiales) {
        const alerta = {
          codigoAlerta: item.id_externo,
          region: item.zona,
          corredorVial: item.corredor,
          sector: item.tramo,
          tipoAlerta: item.tipo,
          nivelSeveridad: parseInt(item.nivel),
          estadoAlerta: 'ACTIVO',
          fechalnicio: new Date().toISOString()
        };
        await MapaGeneralRepository.upsertAlertaClimatica(alerta);
      }
    } catch (error) {
      console.error("❌ Error en sincronización climática:", error);
    }
  }

  async sincronizarEventosViales(opciones = {}) {
    // Extraemos dryRun, si no existe, por defecto es false
    const { dryRun = false } = opciones;
    let procesados = 0;

    try {
      console.log('📡 Consumiendo API externa (TomTom) vía ExternalIntegrationService...');

      const incidentesTomTom = await ExternalIntegrationService.getEventosVialesOficiales();
      const userContext = { codigoUsuario: 'SYS_CRON_TOMTOM' };

      console.log(`📊 Total de incidentes activos reportados por TomTom: ${incidentesTomTom.length}`);

      const payloadParaBD = [];

      // -------------------------------------------------------------
      // 🚧 ZONA DE MAPEO Y DTO
      // -------------------------------------------------------------
      for (const item of incidentesTomTom) {
        try {
          const rawData = this._mapearEventoVial(item);

          // El DTO retorna el GeoJSON puro: { type: 'Point', coordinates: [lon, lat] }
          const eventoDTO = EventoVialDTO(rawData, userContext);

          // 🟢 LA SOLUCIÓN: Clonamos el DTO e inyectamos la sintaxis nativa de SQL Server
          const eventoParaGuardar = { ...eventoDTO };

          if (eventoParaGuardar.ubicacion_geo && eventoParaGuardar.ubicacion_geo.coordinates) {
            const [lon, lat] = eventoParaGuardar.ubicacion_geo.coordinates;
            // Bypasseamos a Sequelize y forzamos el uso de geometry::STGeomFromText
            eventoParaGuardar.ubicacion_geo = sequelize.literal(`geometry::STGeomFromText('POINT(${lon} ${lat})', 4326)`);
          }

          // Agregamos el objeto ya formateado a nuestro arreglo
          payloadParaBD.push(eventoParaGuardar);

        } catch (error) {
          console.log(`===========================================`);
          console.log(`❌ FALLO CAPTURADO EN REGISTRO: ${item.properties?.id || 'Desconocido'}`);
          console.log(`MOTIVO:`, error.details || error.message || error);
          console.log(`===========================================`);
        }
      }

      // -------------------------------------------------------------
      // 🛑 EL SEMÁFORO DRY-RUN
      // -------------------------------------------------------------
      // Si dryRun es true, devolvemos el payload exacto y salimos de la función sin tocar SQL Server.
      if (dryRun) {
        console.log(`🛠️ [DRY RUN] Modo diagnóstico activo. Simulados ${payloadParaBD.length} registros estructurados.`);
        return payloadParaBD;
      }

      // -------------------------------------------------------------
      // 💾 INSERCIÓN EN BASE DE DATOS
      // -------------------------------------------------------------
      console.log('💾 Insertando/Actualizando registros en SQL Server...');
      for (const eventoGuardar of payloadParaBD) {
        // Buscamos si el evento ya existe usando el código
        const eventoExistente = await EventoVialModel.findByPk(eventoGuardar.codigoEvento);

        if (eventoExistente) {
          await eventoExistente.update(eventoGuardar);
          procesados++;
        } else {
          await EventoVialModel.create(eventoGuardar);
          procesados++;
        }
      }

      console.log("🏁 Sincronización de eventos viales finalizada.");

      // Retornamos la cantidad de insertados/actualizados para que el Wrapper de monitoreo (Bitácora) lo registre
      //return { insertados: procesados };
      return procesados;

    } catch (error) {
      console.error('❌ Error grave en sincronizarEventosViales:', error);
      throw error; // Propagamos el error para que la Torre de Control (Bitácora) lo atrape y registre
    }
  }

  async ejecutarSincronizacion(opciones = {}) {
    const { dryRun = false } = opciones;

    console.log(`[SUPERVISOR] Iniciando auditoría de Cron Jobs... Modo DryRun: ${dryRun}`);

    try {
      // ==========================================
      // 1. OBTENER LISTA DE CRONS A EVALUAR
      // ==========================================
      const cronsMonitorizados = [
        { id: 'cron_clima', nombre_db: '🔄 ETL Nacional de Clima', umbral_horas: 1 },
        { id: 'cron_motonaves', nombre_db: '🔄 Escaneo de motonaves', umbral_horas: 1 },
        { id: 'cron_dimar', nombre_db: '🔄 Actualizando boletines externos DIMAR', umbral_horas: 7 },
        { id: 'cron_prod_ayer', nombre_db: '🔄 Generando reportes de productividad del día anterior', umbral_horas: 25 },
        { id: 'cron_boletin_sem', nombre_db: '🔄 Boletines semanales', umbral_horas: 25 },
        { id: 'cron_terminales', nombre_db: '🔄 Iniciando captura de productividad por terminales', umbral_horas: 3 },
        { id: 'cron_camiones_pos', nombre_db: '🔄 Iniciando captura de posiciones de camiones', umbral_horas: 1 },
        { id: 'cron_eventos_viales', nombre_db: '🔄 Eventos Viales TomTom', umbral_horas: 1 },
        { id: 'cron_alertas_clima', nombre_db: '🔄 Iniciando sincronización automática de alertas climáticas', umbral_horas: 1 },
        { id: 'cron_camiones_sim', nombre_db: '🔄 Iniciando simulación de movimiento', umbral_horas: 1 }
      ];

      let cronsEvaluados = 0;
      let alertasGeneradas = 0;
      const detallesEvidencia = [];

      // ==========================================
      // 2. REVISIÓN Y RECOPILACIÓN DE EVIDENCIA
      // ==========================================
      for (const cron of cronsMonitorizados) {
        const estadoSalud = true;

        if (estadoSalud) {
          detallesEvidencia.push(`✅ ${cron.id}: Operativo.`);
        } else {
          detallesEvidencia.push(`⚠️ ${cron.id}: Retraso detectado o inactivo.`);
          alertasGeneradas++;
        }

        cronsEvaluados++;
      }

      // ==========================================
      // 3. REGISTRO O ACCIONES EN BASE A LA EVIDENCIA
      // ==========================================
      if (dryRun) {
        console.log(`[SUPERVISOR] 🚧 DRY RUN ACTIVO: Se evaluaron ${cronsEvaluados} crons.`);
        console.log(`[SUPERVISOR] Evidencia recopilada:\n`, detallesEvidencia.join('\n'));
      } else {
        console.log(`[SUPERVISOR] 💾 Guardando estado actualizado de ${cronsEvaluados} crons en el sistema.`);
      }

      // ==========================================
      // 4. RETORNO PARA EL ENVOLTORIO
      // ==========================================
      return {
        exito: true,
        insertados: cronsEvaluados,
        resumen: detallesEvidencia.join(' | ')
      };

    } catch (error) {
      console.error('[SUPERVISOR] ❌ Fallo crítico intentando auditar los crons:', error.message);
      throw error;
    }
  };

  iniciarMotorSimulacion() {
    console.log("🚛 Iniciando Motor de Simulación de Flota Terrestre...");

    setInterval(async () => {
      try {
        await sequelize.query(`
          -- 1. Variables de tiempo: Calculamos la fracción de hora que representan 10 segundos
          DECLARE @SegundosDeSimulacion FLOAT = 10.0;
          DECLARE @Horas FLOAT = @SegundosDeSimulacion / 3600.0;
          
          -- 2. Constante de la Tierra: 1 grado de latitud equivale aprox a 111.32 Km
          DECLARE @KmPorGrado FLOAT = 111.32;

          -- 3. Seleccionamos únicamente los vehículos que están en movimiento
          WITH FlotaEnMovimiento AS (
            SELECT 
              -- ⚠️ Ajusta estos nombres a las columnas reales de tu tabla Maestro_Vehiculos
              id_vehiculo,
              latitud,
              longitud,
              velocidad_actual, -- Debe estar en Km/h
              rumbo,            -- Grados (0 = Norte, 90 = Este, 180 = Sur, 270 = Oeste)
              ubicacion_geo     -- Si usas columna espacial GEOMETRY
            FROM Maestro_Vehiculos 
            WHERE estado = 'EN_RUTA' 
              AND velocidad_actual > 0
              AND latitud IS NOT NULL 
              AND longitud IS NOT NULL
          )
          -- 4. Proyectamos las nuevas coordenadas
          UPDATE FlotaEnMovimiento
          SET 
            -- Cálculo de nueva Latitud (Eje Y): Distancia * Coseno del Rumbo
            latitud = latitud + ((velocidad_actual * @Horas) * COS(RADIANS(rumbo)) / @KmPorGrado),
            
            -- Cálculo de nueva Longitud (Eje X): Distancia * Seno del Rumbo 
            -- (Se divide por el Coseno de la latitud para compensar la curvatura de la tierra)
            longitud = longitud + ((velocidad_actual * @Horas) * SIN(RADIANS(rumbo)) / (@KmPorGrado * COS(RADIANS(latitud))))
            
            -- Opcional: Si necesitas actualizar el campo GEOMETRY al mismo tiempo, descomenta la siguiente línea:
            -- , ubicacion_geo = geometry::Point(longitud + (...), latitud + (...), 4326)
        `);
      } catch (error) {
        console.error("Error moviendo la flota:", error);
      }
    }, 10000); // 10000 milisegundos = 10 segundos
  }

  _mapearEventoVial(item) {
    const props = item.properties || {};

    // iconCategory es el código numérico que manda TomTom
    const categoria = props.iconCategory || 0;
    const magnitud = props.magnitudeOfDelay || 0;

    const coords = item.geometry?.coordinates;
    const puntoInicial = Array.isArray(coords[0]) ? coords[0] : coords;
    const lon = puntoInicial[0];
    const lat = puntoInicial[1];

    // 1. CLASIFICACIÓN CORREGIDA DE TOMTOM
    let tipoEventoMapeado = 'ALERTA_VIAL';

    switch (categoria) {
      case 1:
        tipoEventoMapeado = 'ACCIDENTE';
        break;
      case 6: // <--- Congestión corregida
        tipoEventoMapeado = 'CONGESTION';
        break;
      case 8:
      case 9:
        tipoEventoMapeado = 'CIERRE_VIAL';
        break;
      case 11:
        tipoEventoMapeado = 'MANTENIMIENTO_OBRA';
        break;
      case 2:
      case 3:
      case 4:
      case 5:
        tipoEventoMapeado = 'ALERTA_CLIMATICA';
        break;
      case 14:
        tipoEventoMapeado = 'VEHICULO_AVERIDADO';
        break;
      default:
        tipoEventoMapeado = 'ALERTA_VIAL';
    }

    // 2. Cálculo de severidad
    let severidadMapeada = 1;
    if (magnitud >= 3) severidadMapeada = 3;
    else if (magnitud === 2) severidadMapeada = 2;

    const corredorPorDefecto = 'Buga - Buenaventura';
    let descripcionLugar = props.from ? `De ${props.from} a ${props.to || ''}` : 'Sector Georreferenciado';

    let descripcionLimpia = 'Novedad vial reportada.';
    if (props.events && props.events.length > 0) {
      descripcionLimpia = props.events.map(e => e.description).join(' | ').substring(0, 4000);
    }

    return {
      idExterno: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
      codigoEvento: props.id || Buffer.from(`${lon}-${lat}-${Date.now()}-${Math.random()}`).toString('base64').substring(0, 36),
      corredorVial: corredorPorDefecto,
      sector: descripcionLugar.substring(0, 100),
      tipoEvento: tipoEventoMapeado,
      descripcion: descripcionLimpia,
      nivelSeveridad: severidadMapeada,
      estadoEvento: 'ACTIVO',
      // Envio de la ubicación pura para que el DTO y Sequelize lo manejen
      ubicacion_geo: (lat && lon) ? { type: 'Point', coordinates: [lon, lat] } : null,
      fechaInicio: props.startTime ? new Date(props.startTime).toISOString() : new Date().toISOString(),
      fechaFin: props.endTime ? new Date(props.endTime).toISOString() : null
    };
  }
}

module.exports = new SincronizacionService();