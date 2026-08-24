// 1. Importas la instancia de sequelize desde donde la tengas configurada (ej: db.js)
require('dotenv').config();
const { sequelize } = require('../database/connection'); // Ajusta la ruta a tu config real
const { ejecutarSeeder } = require('./infraestructura'); // Tu lógica de carga que armamos

async function run() {
  try {
    await sequelize.authenticate();

    const json = require('./infraestructura_logistica_colombia_master.json');

    // Ejecutas tu lógica
    await ejecutarSeeder(json, sequelize);

    process.exit(0); // Finaliza exitosamente
  } catch (error) {
    console.error('❌ Fallo en la migración:', error);
    process.exit(1); // Finaliza con error
  }
}

run();