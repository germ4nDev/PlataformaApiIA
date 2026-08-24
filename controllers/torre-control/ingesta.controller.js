const ingestaService = require('../../services/torre-control/ingesta.service');

const cargarRNDC = async (req, res) => {
  try {
    // express-fileupload guarda los archivos en req.files
    if (!req.files || !req.files.archivoExcel) {
      return res.status(400).json({ ok: false, msg: 'No se recibió el archivo Excel.' });
    }

    // Extraemos el archivo
    const archivo = req.files.archivoExcel;
    const codigoUsuario = req.codigoUsuario;

    // archivo.data es el Buffer en memoria que necesita la librería de Excel
    const resultado = await ingestaService.procesarExcelRNDC(archivo.data, codigoUsuario);

    res.status(200).json({ ok: true, msg: 'Carga masiva RNDC exitosa', registros: resultado });

  } catch (error) {
    console.error('Error en el controlador cargarRNDC:', error.message);
    res.status(500).json({ ok: false, msg: error.message });
  }
};

const cargarMaritimo = async (req, res) => {
  try {
    if (!req.files || !req.files.archivoCsv) {
      return res.status(400).json({ ok: false, msg: 'No se recibió el archivo CSV.' });
    }

    const archivo = req.files.archivoCsv;
    const codigoUsuario = req.codigoUsuario;

    // Le pasamos el buffer (archivo.data)
    const resultado = await ingestaService.procesarCsvMaritimo(archivo.data, codigoUsuario);

    res.status(200).json({ ok: true, msg: 'Carga masiva Marítima exitosa', registros: resultado });
  } catch (error) {
    console.error('Error en cargarMaritimo:', error.message);
    res.status(500).json({ ok: false, msg: error.message });
  }
};

const cargarMatrizOperaciones = async (req, res) => {
  try {
    // Usando express-fileupload al igual que en RNDC
    if (!req.files || !req.files.archivoExcel) {
      return res.status(400).json({ ok: false, msg: 'No se recibió el archivo Excel de la matriz.' });
    }

    const archivo = req.files.archivoExcel;
    const codigoUsuario = req.codigoUsuario;

    // Enviamos el buffer a nuestro servicio
    const resultado = await ingestaService.procesarExcelMatriz(archivo.data, codigoUsuario);

    res.status(200).json({ ok: true, msg: 'Carga masiva de Matriz exitosa', registros: resultado });

  } catch (error) {
    console.error('Error en el controlador cargarMatrizOperaciones:', error.message);
    res.status(500).json({ ok: false, msg: error.message });
  }
};

const sincronizarSupertransporte = async (req, res) => {
  try {
    // Ejecutamos el worker que consulta la API de SODA
    const resultado = await IngestaService.sincronizarHistoricosSupertransporte();

    return res.status(200).json({
      ok: true,
      msg: 'Sincronización histórica completada con éxito',
      data: resultado
    });
  } catch (error) {
    console.error('[CTRL] Error sincronizando Supertransporte:', error);
    return res.status(500).json({
      ok: false,
      msg: 'Falla al intentar conectar con la fuente oficial de datos.gov.co'
    });
  }
};

module.exports = { cargarRNDC, cargarMaritimo, cargarMatrizOperaciones, sincronizarSupertransporte };