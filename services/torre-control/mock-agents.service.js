// /* services/mock-agents.service.js */
// const fs = require('fs');
// const path = require('path');

// class MockAgentsService {

//   // (Tus métodos _delay, obtenerDatosPortuarios y obtenerDatosRndc existentes...)

//   /**
//    * Sobrescribe los archivos semilla con los nuevos datos generados por la IA
//    */
//   async actualizarDatosMock(tipoDocumento, datosJson) {
//     let filename = '';
//     if (tipoDocumento === 'BOLETIN_PORTUARIO') filename = 'boletin-portuario.mock.json';
//     if (tipoDocumento === 'RNDC_EXCEL') filename = 'rndc-viajes.mock.json';

//     if (!filename) throw new Error("Tipo de documento no soportado.");

//     const filePath = path.join(__dirname, `../mocks/${filename}`);

//     // Guardamos el JSON formateado
//     fs.writeFileSync(filePath, JSON.stringify(datosJson, null, 2), 'utf8');

//     return true;
//   }
// }

// module.exports = new MockAgentsService();

/*
    Author: German Valencia
    Service: Mock Agents Service - Data Provider desde Excel/PDF para MVP
*/
const fs = require('fs');
const path = require('path');

class MockAgentsService {

  // Simulación de latencia de red
  _delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Carga los datos marítimos y de infraestructura
   */
  async obtenerDatosPortuarios() {
    try {
      await this._delay(700);
      // Ajusta los '../' dependiendo de dónde esté tu carpeta 'mocks'
      // Si este archivo está en /services/torre-control/, necesitas '../../mocks/...'
      const filePath = path.join(__dirname, '../../mocks/boletin-portuario.mock.json');

      if (!fs.existsSync(filePath)) {
        return { terminales: [], bodegas: [] }; // Evita que explote si el archivo no existe aún
      }

      const rawData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error("🔴 Error leyendo mock portuario:", error.message);
      return { terminales: [], bodegas: [] };
    }
  }

  /**
   * Carga los datos de fletes y rutas originados del Excel del RNDC
   */
  async obtenerDatosRndc() {
    try {
      await this._delay(900);
      const filePath = path.join(__dirname, '../../mocks/rndc-viajes.mock.json');

      if (!fs.existsSync(filePath)) {
        return { rutas: [] };
      }

      const rawData = fs.readFileSync(filePath, 'utf8');
      return JSON.parse(rawData);
    } catch (error) {
      console.error("🔴 Error leyendo mock RNDC:", error.message);
      return { rutas: [] };
    }
  }

  /**
   * Sobrescribe los archivos semilla con los nuevos datos generados por la IA
   */
  async actualizarDatosMock(tipoDocumento, datosJson) {
    let filename = '';
    if (tipoDocumento === 'BOLETIN_PORTUARIO') filename = 'boletin-portuario.mock.json';
    if (tipoDocumento === 'RNDC_EXCEL') filename = 'rndc-viajes.mock.json';

    if (!filename) throw new Error("Tipo de documento no soportado.");

    const filePath = path.join(__dirname, `../../mocks/${filename}`);

    // Asegurar que la carpeta mocks exista
    const dir = path.dirname(filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(filePath, JSON.stringify(datosJson, null, 2), 'utf8');
    return true;
  }
}

module.exports = new MockAgentsService();