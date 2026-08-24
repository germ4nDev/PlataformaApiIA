const { InfraestructuraModel, InfraestructuraDTO } = require('./../models/torre-control/infraestructura.model');
const { TerminalModel } = require('./../models/torre-control/terminales.model');
const { db, sequelize } = require('../database/connection');
const { Sequelize } = require('sequelize');
// const { InfraestructuraDTO } = require('./InfraestructuraDTO');
// const { InfraestructuraModel } = require('./InfraestructuraModel');
// const { TerminalModel } = require('./TerminalModel');

// Función que convierte tu BBOX [ [latMin, lonMin], [latMax, lonMax] ] a WKT de SQL
function bboxToWkt(bbox) {
  if (!bbox || bbox.length < 2) return null;
  const [min, max] = bbox;
  const [latMin, lonMin] = min;
  const [latMax, lonMax] = max;

  // Formato WKT Poligono: POLYGON((lon1 lat1, lon2 lat2, ...))
  // Nota: En WKT primero va la Longitud y luego la Latitud (X, Y)
  return `POLYGON((${lonMin} ${latMin}, ${lonMax} ${latMin}, ${lonMax} ${latMax}, ${lonMin} ${latMax}, ${lonMin} ${latMin}))`;
}

async function ejecutarSeeder(jsonCompleto, sequelize) {
  const Infraestructura = InfraestructuraModel(sequelize);

  const mapaTerminales = {
    "SPRC (Sociedad Portuaria Regional de Cartagena) - Manga": "SPRC",
    "CONTECAR - Mamonal": "CONTECAR",
    "Puerto Bahía (Isla de Barú/Mamonal)": "PUERTO_BAHIA",
    "Compas Cartagena": "COMPAS_BOSQUE",
    "SPRB (Sociedad Portuaria Regional de Barranquilla)": "SPRB",
    "Palermo Sociedad Portuaria": "PALERMO",
    "Compas Barranquilla": "S_BARRANQUILLA",
    "SPSM (Sociedad Portuaria de Santa Marta)": "SPSM",
    "SPRBUN (Sociedad Portuaria Regional de Buenaventura)": "SPRBUN",
    "TCBUEN (Terminal de Contenedores de Buenaventura)": "TCBUEN",
    "SPIA (Puerto Aguadulce)": "SPIA",
    "SPR Tumaco": "TUMACO_PORT",
    "Puerto Bolívar (Cerrejón - Guajira)": "PUERTO_BOLIVAR",
    "Terminal Coveñas (Ocensa / Ecopetrol - Sucre)": "ECOPETROL_COVENAS"
  };

  const data = jsonCompleto.red_logistica_y_portuaria_colombia;

  for (const regionKey in data) {
    const nodos = data[regionKey];
    for (const ciudad in nodos) {
      for (const t of nodos[ciudad]) {
        const idTerminal = mapaTerminales[t.terminal];

        if (!idTerminal) {
          continue;
        }

        for (const infra of t.infraestructura) {
          try {
            // 1. Convertimos el BBOX al formato que SQL Server acepta
            const wktPolygon = bboxToWkt(infra.bounding_box);

            // 2. Preparamos el DTO
            // const dto = InfraestructuraDTO({
            //   id_terminal: idTerminal,
            //   tipo: infra.tipo,
            //   nombre: infra.nombre,
            //   latitud: infra.ubicacion_exacta.lat,
            //   longitud: infra.ubicacion_exacta.lon,
            //   geocerca_bounding_box: wktPolygon // Enviamos el WKT
            // });

            // 3. Insertamos
            await Infraestructura.create({
              id_terminal: idTerminal,
              tipo: infra.tipo,
              nombre: infra.nombre,
              latitud: infra.ubicacion_exacta.lat,
              longitud: infra.ubicacion_exacta.lon,
              geocerca_bounding_box: wktPolygon,
              // 🟢 AQUÍ ESTÁ LA MAGIA:
              // Esto le ordena a SQL Server usar su propia función de fecha
              fecha_cargue: sequelize.literal('GETDATE()')
            });
          } catch (e) {
            console.error(`❌ Fallo crítico en ${infra.nombre}:`, e.message);
          }
        }
      }
    }
  }
}

module.exports = { ejecutarSeeder };


// async function ejecutarSeeder(jsonCompleto, sequelize) {
//   const Infraestructura = InfraestructuraModel(sequelize);
//   const Terminal = TerminalModel(sequelize);

//   // Mapeo manual solo para normalizar nombres JSON vs BD
//   // Esto es lo que querías evitar, pero solo se ejecutará una vez
//   const mapaTerminales = {
//     // --- REGIÓN CARIBE ---
//     "SPRC (Sociedad Portuaria Regional de Cartagena) - Manga": "SPRC",
//     "CONTECAR - Mamonal": "CONTECAR",
//     "Puerto Bahía (Isla de Barú/Mamonal)": "PUERTO_BAHIA",
//     "Compas Cartagena": "COMPAS_BOSQUE",

//     "SPRB (Sociedad Portuaria Regional de Barranquilla)": "SPRB",
//     "Palermo Sociedad Portuaria": "PALERMO",
//     "Compas Barranquilla": "S_BARRANQUILLA",

//     "SPSM (Sociedad Portuaria de Santa Marta)": "SPSM",
//     "Puerto Drummond (Ciénaga)": "PENDIENTE_BD", // No está en tu tabla
//     "Puerto Nuevo / Prodeco (Ciénaga)": "PENDIENTE_BD", // No está en tu tabla

//     "Puerto Bolívar (Cerrejón - Guajira)": "PUERTO_BOLIVAR",
//     "Terminal Coveñas (Ocensa / Ecopetrol - Sucre)": "ECOPETROL_COVENAS",

//     // --- REGIÓN PACÍFICO ---
//     "SPRBUN (Sociedad Portuaria Regional de Buenaventura)": "SPRBUN",
//     "TCBUEN (Terminal de Contenedores de Buenaventura)": "TCBUEN",
//     "SPIA (Puerto Aguadulce)": "SPIA",
//     "SPR Tumaco": "TUMACO_PORT",

//     // --- ZONAS LOGÍSTICAS INTERIOR ---
//     "Puerto Seco de Buga": "PENDIENTE_BD",
//     "Zona Franca del Pacífico": "PENDIENTE_BD",
//     "Zona Franca de Bogotá (Fontibón)": "PENDIENTE_BD",
//     "Zona Franca Rionegro": "PENDIENTE_BD"
//   };

//   const data = jsonCompleto.red_logistica_y_portuaria_colombia;

//   console.log("🚀 Iniciando carga de infraestructura...");

//   for (const region in data) {
//     for (const ciudad in data[region]) {
//       for (const t of data[region][ciudad]) {

//         const idTerminal = mapaTerminales[t.terminal];

//         // 🟢 FILTRO DE SEGURIDAD: Si no está en BD, no intentes insertar
//         if (!idTerminal || idTerminal === 'PENDIENTE_BD') {
//           console.warn(`⚠️ Saltando ${t.terminal}: No es un ID válido en BD.`);
//           continue;
//         }

//         // for (const infra of t.infraestructura) {
//         //   try {
//         //     const dto = InfraestructuraDTO({
//         //       id_terminal: idTerminal,
//         //       tipo: infra.tipo,
//         //       nombre: infra.nombre,
//         //       latitud: infra.ubicacion_exacta.lat,
//         //       longitud: infra.ubicacion_exacta.lon,
//         //       bbox_json: JSON.stringify(infra.bounding_box)
//         //     });

//         //     // 🟢 DEBUG: Imprime el objeto antes de enviarlo
//         //     console.log("Intentando insertar:", JSON.stringify(dto, null, 2));

//         //     try {
//         //       await Infraestructura.create(dto);
//         //       console.log(`✅ Creado: ${infra.nombre}`);
//         //     } catch (e) {
//         //       console.error(`❌ ERROR en ${infra.nombre}`);

//         //       // 🟢 VOLCADO TOTAL DEL ERROR PARA DEBUG
//         //       console.error("--- INICIO ERROR DETALLADO ---");
//         //       console.error("Mensaje principal:", e.message);

//         //       // Mostramos todas las propiedades del error
//         //       if (e.errors) {
//         //         console.error("Errores de validación:", JSON.stringify(e.errors, null, 2));
//         //       }

//         //       // Si viene de SQL, suele estar en e.parent o e.original
//         //       if (e.parent) {
//         //         console.error("Objeto parent:", JSON.stringify(e.parent, null, 2));
//         //       }

//         //       console.error("--- FIN ERROR DETALLADO ---");
//         //     }
//         //     console.log(`✅ Creado: ${infra.nombre} en ${idTerminal}`);
//         //   } catch (e) {
//         //     // 🟢 CAMBIO: Imprimimos el error completo y los datos que fallaron
//         //     console.error(`❌ Fallo crítico en ${infra.nombre}:`);

//         //   }
//         // }
//         for (const infra of t.infraestructura) {
//           try {
//             // Asegúrate de usar geocerca_bounding_box aquí también
//             await Infraestructura.create({
//               id_terminal: idTerminal,
//               tipo: infra.tipo,
//               nombre: infra.nombre,
//               latitud: infra.ubicacion_exacta.lat,
//               longitud: infra.ubicacion_exacta.lon,
//               geocerca_bounding_box: JSON.stringify(infra.bounding_box) // Renombrado
//             });
//             console.log(`✅ Creado: ${infra.nombre} en ${idTerminal}`);
//           } catch (e) {
//             console.error(`❌ Fallo en ${infra.nombre}: ${e.message}`);
//           }
//         }
//       }
//     }
//   }
//   console.log("🏁 Carga finalizada.");
// }

// module.exports = { ejecutarSeeder };