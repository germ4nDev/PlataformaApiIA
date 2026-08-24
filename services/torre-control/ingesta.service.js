const ExcelJS = require('exceljs');
const Anthropic = require('@anthropic-ai/sdk');
const csv = require('csv-parser');
const { Readable } = require('stream');
const { io } = require('../../index');
const { v4: uuidv4 } = require('uuid');
const { db, sequelize } = require('../../database/connection');
const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const procesarExcelRNDC = async (fileBuffer, idUsuario) => {
  const usuarioIdSeguro = idUsuario || 'SISTEMA_QPLUS';
  const chunkSize = 500;

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(bufferStream, {
    worksheets: 'emit',
    sharedStrings: 'cache'
  });

  let headers = [];
  let recordsChunk = [];
  let totalInsertados = 0;
  let filasOmitidas = 0;

  // ------------------------------------------------------------------
  // 1. EXTRACTOR ABSOLUTO: Desempaqueta fórmulas o texto enriquecido
  // ------------------------------------------------------------------
  const extractVal = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if ('result' in val) return String(val.result);
      if ('text' in val) return String(val.text);
      if ('richText' in val) return val.richText.map(t => t.text).join('');
      return '';
    }
    return String(val).trim();
  };

  // ------------------------------------------------------------------
  // 2. CASTEADORES TITANIUM: Con limitador de longitud (Defensa SQL)
  // ------------------------------------------------------------------
  const limpiarTexto = (val, maxLen = 250) => {
    if (!val || String(val).trim() === '') return 'NO REGISTRA';
    const textoLimpio = String(val).trim();
    // Salva la transacción cortando el texto si excede el límite del NVARCHAR
    return textoLimpio.length > maxLen ? textoLimpio.substring(0, maxLen) : textoLimpio;
  };

  const parseNum = (val) => {
    if (!val) return 0;
    const num = parseFloat(String(val).replace(/\./g, '').replace(',', '.'));
    return isNaN(num) ? 0 : num;
  };

  const parseIntNum = (val) => {
    if (!val) return 0;
    const num = parseInt(String(val).replace(/\./g, '').replace(',', '.'), 10);
    return isNaN(num) ? 0 : num;
  };

  // Limpieza inicial de la tabla
  await sequelize.query('TRUNCATE TABLE TLCRNDCOperacionTerrestre');

  try {
    for await (const worksheetReader of workbook) {
      for await (const row of worksheetReader) {

        // Mapeo Dinámico de Cabeceras
        if (row.number === 1) {
          headers = row.values.map(h => extractVal(h).toUpperCase());
          continue;
        }

        const rowData = {};
        headers.forEach((colName, index) => {
          rowData[colName] = extractVal(row.values[index]);
        });

        const rawAnio = rowData['AÑO'];

        // ------------------------------------------------------------------
        // ESCUDO DE FINAL DE ARCHIVO: Ignora filas vacías o de Totales
        // ------------------------------------------------------------------
        if (!rawAnio || String(rawAnio).toUpperCase().includes('TOTAL') || String(rawAnio).trim() === '') {
          filasOmitidas++;
          continue;
        }

        // Procesamiento Temporal Inteligente
        let fechaInicioISO = new Date().toISOString();
        let fechaFinISO = new Date().toISOString();

        try {
          let fechaInicio = new Date();
          let fechaFin = new Date();
          const anioStr = String(rawAnio);

          if (anioStr.includes(' a ')) {
            const rango = anioStr.split(' a ');
            fechaInicio = new Date(rango[0] + "-01T00:00:00Z");
            if (rango[1] && rango[1].includes('-')) {
              const [anioFin, mesFin] = rango[1].split('-');
              fechaFin = new Date(anioFin, mesFin, 0, 23, 59, 59);
            }
          } else if (anioStr.includes('-')) {
            fechaInicio = new Date(anioStr + "-01T00:00:00Z");
            const [anioFin, mesFin] = anioStr.split('-');
            fechaFin = new Date(anioFin, mesFin, 0, 23, 59, 59);
          } else {
            fechaInicio = new Date(anioStr + "-01-01T00:00:00Z");
            fechaFin = new Date(anioStr + "-12-31T23:59:59Z");
          }

          if (!isNaN(fechaInicio.getTime())) fechaInicioISO = fechaInicio.toISOString();
          if (!isNaN(fechaFin.getTime())) fechaFinISO = fechaFin.toISOString();

        } catch (e) {
          console.warn(` -> [RNDC] Fila ${row.number}: Formato de fecha ilegible, usando default.`);
        }

        // ------------------------------------------------------------------
        // 3. ENSAMBLAJE SQL (Aplicando los límites de longitud DDL)
        // ------------------------------------------------------------------
        recordsChunk.push({
          codigoRegistroRNDC: uuidv4(),
          anomes: limpiarTexto(rawAnio, 50),
          codConfigVehiculo: limpiarTexto(rowData['COD_CONFIG_VEHICULO'], 20),
          configVehiculo: limpiarTexto(rowData['CONFIG_VEHICULO'], 100),
          codOperacionTransporte: limpiarTexto(rowData['CODOPERACIONTRANSPORTE'], 20),
          operacionTransporte: limpiarTexto(rowData['OPERACIONTRANSPORTE'], 100),
          codTipoContenedor: limpiarTexto(rowData['CODTIPOCONTENEDOR'], 20),
          tipoContenedor: limpiarTexto(rowData['TIPOCONTENEDOR'], 100),
          codMunicipioOrigen: limpiarTexto(rowData['CODMUNICIPIOORIGEN'], 20),
          municipioOrigen: limpiarTexto(rowData['MUNICIPIOORIGEN'], 250),
          departamentoOrigen: limpiarTexto(rowData['DEPARTAMENTOORIGEN'], 150),
          codMunicipioDestino: limpiarTexto(rowData['CODMUNICIPIODESTINO'], 20),
          municipioDestino: limpiarTexto(rowData['MUNICIPIODESTINO'], 250),
          departamentoDestino: limpiarTexto(rowData['DEPARTAMENTODESTINO'], 150),
          codMunicipioIntermedio: limpiarTexto(rowData['CODMUNICIPIOINTERMEDIO'], 20),
          municipioIntermedio: limpiarTexto(rowData['MUNICIPIOINTERMEDIO'], 250),
          departamentoIntermedio: limpiarTexto(rowData['DEPARTAMENTOINTERMEDIO'], 150),
          codMercancia: limpiarTexto(rowData['CODMERCANCIA'], 20),
          // Aquí damos un margen altísimo a Mercancía por los testamentos que a veces escriben
          mercancia: limpiarTexto(rowData['MERCANCIA'], 4000),
          naturalezaCarga: limpiarTexto(rowData['NATURALEZACARGA'], 100),
          viajesTotales: parseIntNum(rowData['VIAJESTOTALES']),
          kilogramos: parseNum(rowData['KILOGRAMOS']),
          galones: parseNum(rowData['GALONES']),
          viajesLiquidos: parseIntNum(rowData['VIAJESLIQUIDOS']),
          viajesValorCero: parseIntNum(rowData['VIAJESVALORCERO']),
          kilometros: parseNum(rowData['KILOMETROS']),
          valoresPagados: parseNum(rowData['VALORESPAGADOS']),
          kilometrosRegreso: parseNum(rowData['KILOMETROSREGRESO']),
          kilogramosRegreso: parseNum(rowData['KILOGRAMOSREGRESO']),
          galonesRegreso: parseNum(rowData['GALONESREGRESO']),
          fechaInicioPeriodo: fechaInicioISO,
          fechaFinPeriodo: fechaFinISO,
          codigoUsuarioCreacion: usuarioIdSeguro,
          fechaCreacion: new Date().toISOString()
        });

        // ------------------------------------------------------------------
        // 4. INSERCIÓN TRANSACCIONAL EN BATCH
        // ------------------------------------------------------------------
        if (recordsChunk.length >= chunkSize) {
          try {
            await sequelize.transaction(async (t) => {
              await sequelize.getQueryInterface().bulkInsert('TLCRNDCOperacionTerrestre', recordsChunk, { transaction: t });
            });
            totalInsertados += recordsChunk.length;
            // console.log(` -> [RNDC] Lote insertado. Acumulado: ${totalInsertados}`);
            recordsChunk = []; // Vaciamos para proteger la RAM
          } catch (dbError) {
            //console.error(`❌ [RNDC] SQL Server rechazó el lote: ${dbError.message}`);
            throw dbError;
          }
        }
      }
    }

    // Insertamos el remanente final
    if (recordsChunk.length > 0) {
      await sequelize.transaction(async (t) => {
        await sequelize.getQueryInterface().bulkInsert('TLCRNDCOperacionTerrestre', recordsChunk, { transaction: t });
      });
      totalInsertados += recordsChunk.length;
    }

    // console.log(`✅ [RNDC] Ingesta Masiva completada. Insertados: ${totalInsertados}. Omitidos (Basura/Totales): ${filasOmitidas}.`);

    if (typeof io !== 'undefined') {
      io.emit('tablero-actualizado', {
        accion: 'RNDC',
        msg: `Tablero Analítica RNDC actualizado (${totalInsertados} registros)`,
        timestamp: new Date()
      });
    }

    return totalInsertados;

  } catch (error) {
    // console.error("❌ [RNDC] Falla crítica en el pipeline de carga:", error);
    throw error;
  }
};

// ====================================================================
// PROCESAMIENTO CSV MARÍTIMO (Blindado contra BOM, Tildes y Espacios)
// ====================================================================
const procesarCsvMaritimo = async (fileBuffer, idUsuario) => {
  return new Promise((resolve, reject) => {
    const rawData = [];
    const bufferStream = new Readable();
    bufferStream.push(fileBuffer);
    bufferStream.push(null);

    let detectedHeaders = [];

    bufferStream
      .pipe(csv({
        // Si tu consola arroja que las cabeceras están todas pegadas, cambia esta coma ',' por un punto y coma ';'
        separator: ',',
        mapHeaders: ({ header }) => {
          // NORMALIZACIÓN EXTREMA:
          // 1. Quita tildes y la Ñ se vuelve N (AÑO -> ANO)
          // 2. Quita todo lo que no sea letra o número (espacios, BOM invisible, guiones)
          const cleanHeader = header
            .trim()
            .toUpperCase()
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^A-Z0-9]/g, '');

          if (cleanHeader) detectedHeaders.push(cleanHeader);
          return cleanHeader;
        }
      }))
      .on('data', (data) => rawData.push(data))
      .on('error', (error) => {
        // console.error("❌ [MARÍTIMO] Error parseando CSV:", error);
        reject(new Error('El archivo CSV está corrupto o mal formado.'));
      })
      .on('end', async () => {
        // console.log(`📌 [MARÍTIMO] Cabeceras detectadas:`, detectedHeaders.slice(0, 8));

        if (rawData.length === 0) {
          // console.error("⚠️ [MARÍTIMO] CSV vacío o separador incorrecto (Revisa si está separado por comas o punto y coma).");
          return reject(new Error('El CSV está vacío o el separador es incorrecto.'));
        }

        const usuarioIdSeguro = idUsuario || 'SISTEMA_QPLUS';
        const fechaActual = new Date().toISOString();

        const limpiarNumero = (valorStr) => {
          if (!valorStr || String(valorStr).trim() === '' || String(valorStr).trim() === '0') return 0;
          return parseFloat(String(valorStr).replace(/\./g, '').replace(',', '.'));
        };

        try {
          // console.log("🧹 [MARÍTIMO] Truncando tabla...");
          await db.sequelize.query('TRUNCATE TABLE TLCTraficoPortuarioMaritimo');

          // MAPEO SEGURO: Usamos las llaves normalizadas (sin espacios ni tildes)
          const records = rawData.map(row => ({
            zonaPortuaria: row['ZONAPORTUARIA'] || 'NO REGISTRA',
            sociedadPortuaria: row['SOCIEDADPORTUARIA'] || 'NO REGISTRA',
            tipoServicio: row['TIPODESERVICIO'] || row['TIPOSERVICIO'] || null,
            tipoCarga: row['TIPODECARGA'] || row['TIPOCARGA'] || null,
            exportacion: limpiarNumero(row['EXPORTACION']),
            importacion: limpiarNumero(row['IMPORTACION']),
            transbordo: limpiarNumero(row['TRANSBORDO']),
            transitoInternacional: limpiarNumero(row['TRANSITOINTERNACIONAL']),
            fluvial: limpiarNumero(row['FLUVIAL']),
            cabotaje: limpiarNumero(row['CABOTAJE']),
            movilizacionesABordo: limpiarNumero(row['MOVILIZACIONESABORDO']),
            transitoria: limpiarNumero(row['TRANSITORIA']),
            anioVigencia: row['ANOVIGENCIA'] ? limpiarNumero(row['ANOVIGENCIA']) : new Date().getFullYear(),
            mesVigencia: row['MESVIGENCIA'] ? limpiarNumero(row['MESVIGENCIA']) : 1,
            procesadoPorIA: false,
            codigoUsuarioCreacion: usuarioIdSeguro,
            fechaCreacion: fechaActual
          }));

          const chunkSize = 500;
          let totalInsertados = 0;

          // INSERCIÓN BATCH
          for (let i = 0; i < records.length; i += chunkSize) {
            const chunk = records.slice(i, i + chunkSize);
            await db.sequelize.getQueryInterface().bulkInsert('TLCTraficoPortuarioMaritimo', chunk);
            totalInsertados += chunk.length;
          }

          if (typeof io !== 'undefined') {
            io.emit('tablero-actualizado', {
              accion: 'MARITIMO',
              msg: `Tablero Marítimo actualizado (${totalInsertados} regs)`,
              timestamp: new Date()
            });
          }

          resolve(totalInsertados);

        } catch (error) {
          // console.error("❌ [MARÍTIMO] Error SQL BulkInsert:", error.message);
          reject(new Error('Error al insertar los datos en la base de datos SQL Server. Revisa que ninguna columna supere su límite de caracteres.'));
        }
      });
  });
};

// ====================================================================
// PROCESAMIENTO MATRIZ (Multiusuario / Multi-Hoja)
// ====================================================================
const procesarExcelMatriz = async (fileBuffer, idUsuario) => {
  const usuarioIdSeguro = idUsuario || 'SISTEMA_QPLUS';
  const fechaActual = new Date().toISOString();

  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const options = { worksheets: 'emit', sharedStrings: 'cache' };
  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(bufferStream, options);

  let recordsChunk = [];
  let totalInsertados = 0;
  const chunkSize = 500;

  const extractVal = (val) => {
    if (val === null || val === undefined) return '';
    if (typeof val === 'object') {
      if ('result' in val) return String(val.result);
      if ('text' in val) return String(val.text);
      if ('richText' in val) return val.richText.map(t => t.text).join('');
      return '';
    }
    return String(val).trim();
  };

  const limpiarTexto = (val, maxLen) => {
    if (!val || String(val).trim() === '') return null;
    const textoLimpio = String(val).trim();
    return textoLimpio.length > maxLen ? textoLimpio.substring(0, maxLen) : textoLimpio;
  };

  try {
    // console.log("🧹 [MATRIZ] Truncando tabla...");
    await db.sequelize.query('TRUNCATE TABLE TLCMatriz_Operaciones');

    // Recorremos TODAS las hojas del libro
    for await (const worksheetReader of workbook) {
      let headers = []; // Reiniciamos cabeceras para cada nueva hoja

      for await (const row of worksheetReader) {
        if (row.number === 1) {
          headers = row.values.map(h => extractVal(h).toUpperCase().replace(/\s+/g, ''));
          // console.log(`📌 [MATRIZ] Cabeceras encontradas en hoja:`, headers);
          continue;
        }

        const rowData = {};
        headers.forEach((colName, index) => {
          if (colName) rowData[colName] = extractVal(row.values[index]);
        });

        // 🚨 FILTRO ESTRICTO: Si no tiene TERMINAL y OPERACION, ignoramos la fila (y la hoja)
        if (!rowData['TERMINAL'] || !rowData['OPERACION']) {
          continue;
        }

        recordsChunk.push({
          // Si no viene la columna puerto, asignamos Buenaventura por defecto
          puerto: limpiarTexto(rowData['PUERTO'], 100) || 'BUENAVENTURA',
          terminal: limpiarTexto(rowData['TERMINAL'], 100),
          operacion: limpiarTexto(rowData['OPERACION'], 100),
          suboperacion: limpiarTexto(rowData['SUBOPERACION'], 100),
          tipo_carga: limpiarTexto(rowData['TIPODECARGA'] || rowData['TIPOCARGA'], 100),
          rata_minima: limpiarTexto(rowData['RATAMINIMA'], 50),
          unidad: limpiarTexto(rowData['UNIDAD'], 50),
          eficiencia_kpi: limpiarTexto(rowData['EFICIENCIA/KPI'] || rowData['EFICIENCIA'], 255),
          equipos: limpiarTexto(rowData['EQUIPOS'], 255),
          infraestructura: limpiarTexto(rowData['INFRAESTRUCTURA'], 255),
          normativa: limpiarTexto(rowData['NORMATIVA/RCTO'] || rowData['NORMATIVA'], 255),
          observaciones: limpiarTexto(rowData['OBSERVACIONES'], 500),
          usuario_cargue: limpiarTexto(usuarioIdSeguro, 50),
          fecha_cargue: fechaActual
        });

        if (recordsChunk.length >= chunkSize) {
          await db.sequelize.getQueryInterface().bulkInsert('TLCMatriz_Operaciones', recordsChunk);
          totalInsertados += recordsChunk.length;
          // console.log(` 🚀 [MATRIZ] Lote insertado. Acumulado: ${totalInsertados}`);
          recordsChunk = [];
        }
      }
      // NOTA: Eliminamos el 'break;' para que no se detenga en la Hoja 1
    }

    if (recordsChunk.length > 0) {
      await db.sequelize.getQueryInterface().bulkInsert('TLCMatriz_Operaciones', recordsChunk);
      totalInsertados += recordsChunk.length;
      console.log(` 🚀 [MATRIZ] Lote final insertado. Acumulado: ${totalInsertados}`);
    }

    if (typeof io !== 'undefined') {
      io.emit('tablero-actualizado', {
        accion: 'MATRIZ_BODEGAS',
        msg: `Tablero Gate & Bodegas actualizado (${totalInsertados} regs)`,
        timestamp: new Date()
      });
    }

    return totalInsertados;

  } catch (error) {
    // console.error("❌ [MATRIZ] Error crítico:", error);
    throw error;
  }
};

// ============================================================================
// 3. TÚNEL BOLETINES NLP (Nueva integración en el mismo servicio)
// ============================================================================
const procesarBoletinesViales = async (textoCrudoBoletin, idUsuario = 'SISTEMA_QPLUS') => {
  try {
    const promptSystem = `Eres un extractor de datos logísticos experto. 
    Lee el boletín de vías y extrae los eventos. 
    Responde estrictamente con un JSON: {"eventos": [{"corredorVial", "sector", "tipoEvento", "descripcion", "nivelSeveridad", "estado", "fechaInicio"}]}.
    * nivelSeveridad debe ser un entero de 1 a 5 (1=leve, 5=crítico).
    * fechaInicio debe estar en formato ISO (YYYY-MM-DDTHH:mm:ssZ).`;

    const response = await anthropic.messages.create({
      model: "claude-3-haiku-20240307",
      max_tokens: 1000,
      temperature: 0.1,
      system: promptSystem,
      messages: [{ role: "user", content: textoCrudoBoletin }]
    });

    const jsonLimpio = response.content[0].text.replace(/```json/g, '').replace(/```/g, '').trim();
    const datosEstructurados = JSON.parse(jsonLimpio);

    const records = datosEstructurados.eventos.map(ev => ({
      codigoEvento: uuidv4(),
      corredorVial: ev.corredorVial || 'NO ESPECIFICADO',
      sector: ev.sector || 'NO ESPECIFICADO',
      tipoEvento: ev.tipoEvento,
      descripcion: ev.descripcion,
      nivelSeveridad: parseInt(ev.nivelSeveridad) || 1,
      estadoEvento: ev.estado || 'ACTIVO',
      fechainicio: ev.fechaInicio ? new Date(ev.fechaInicio) : new Date(),
      codigoUsuarioCreacion: idUsuario,
      fechaCreacion: new Date()
    }));

    if (records.length > 0) {
      await sequelize.getQueryInterface().bulkInsert('TCLEventosViales', records);
      // console.log(`✅ [BOLETINES] ${records.length} eventos registrados.`);
    }

    return records;

  } catch (error) {
    // console.error('❌ [BOLETINES] Fallo en el túnel NLP:', error);
    throw error;
  }
};

// ====================================================================
// PROCESAMIENTO HISTÓRICOS SUPERTRANSPORTE (Benchmarking)
// ====================================================================
const procesarHistoricoSuper = async (fileBuffer, idUsuario) => {
  const usuarioIdSeguro = idUsuario || 'SISTEMA_QPLUS';

  // Usamos el mismo patrón de stream para Excel que en la Matriz
  const bufferStream = new Readable();
  bufferStream.push(fileBuffer);
  bufferStream.push(null);

  const workbook = new ExcelJS.stream.xlsx.WorkbookReader(bufferStream, { worksheets: 'emit', sharedStrings: 'cache' });
  let records = [];

  try {
    for await (const worksheetReader of workbook) {
      for await (const row of worksheetReader) {
        // Ignoramos cabeceras (asumimos fila 1)
        if (row.number === 1) continue;

        // Mapeo directo según la estructura de la tabla TLC_HistoricosSupertransporte
        // row.values[1] es Puerto, [2] Terminal, [3] Año, [4] Mes, [5] TipoCarga, [6] Volumen
        records.push({
          anio: parseInt(row.values[3]),
          mes: parseInt(row.values[4]),
          zona_portuaria: String(row.values[1]),
          sociedad_portuaria: String(row.values[2]),
          tipo_carga: String(row.values[5]),
          total_toneladas: parseFloat(row.values[6] || 0),
          usuario_cargue: usuarioIdSeguro
        });

        if (records.length >= 500) {
          await db.sequelize.getQueryInterface().bulkInsert('TLCHistoricosSupertransporte', records);
          records = [];
        }
      }
    }
    if (records.length > 0) {
      await db.sequelize.getQueryInterface().bulkInsert('TLCHistoricosSupertransporte', records);
    }

    // console.log("✅ [HISTÓRICOS] Reporte Supertransporte procesado exitosamente.");
    return true;
  } catch (error) {
    // console.error("❌ [HISTÓRICOS] Error:", error);
    throw error;
  }
};

// NO OLVIDES EXPORTARLO EN EL MODULE.EXPORTS AL FINAL DEL ARCHIVO
module.exports = { procesarExcelRNDC, procesarCsvMaritimo, procesarExcelMatriz, procesarHistoricoSuper };