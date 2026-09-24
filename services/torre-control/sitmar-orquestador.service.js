const axios = require('axios');
const cheerio = require('cheerio');

// Modelos y DTOs importados
const { TLCNaves_Avisadas, TLCNaves_Arribadas, TLCNaves_Fondeadas, TLCNaves_Zarpadas } = require('../models');
const { NaveAvisadaDTO } = require('../../models/torre-control/naves-arribadas.model.js');
const { NaveArribadaDTO } = require('./../../models/torre-control/naveArribada.model');
const { NaveFondeadaDTO } = require('./../../models/torre-control/naveFondeada.model');
const { NaveZarpadaDTO } = require('./../../models/torre-control/naveZarpada.model');

const mapearFechaSmar = (fechaStr, horaStr) => {
  if (!fechaStr) return new Date().toISOString();
  const [dia, mes, anio] = fechaStr.split('/');
  const horaClean = horaStr ? horaStr.trim() : '00:00';
  return `${anio}-${mes}-${dia}T${horaClean}:00`;
};

class SitmarOrquestadorService {

  static async ejecutarEtlCompleto() {
    // console.log('⚡ [SITMAR ORQUESTADOR] Iniciando ciclo masivo de actualización...');

    const configuraciones = [
      {
        endpoint: 'naves-avisadas',
        modelo: TLCNaves_Avisadas,
        dto: NaveAvisadaDTO,
        camposUpdate: ['omi', 'motonave', 'bandera', 'eta', 'tipo_nave', 'eslora', 'calado', 'dwt', 'agencia', 'instalacion_portuaria', 'usuario_cargue', 'fecha_cargue']
      },
      {
        endpoint: 'naves-arribadas',
        modelo: TLCNaves_Arribadas,
        dto: NaveArribadaDTO,
        camposUpdate: ['omi', 'motonave', 'bandera', 'eta', 'ata', 'tipo_nave', 'eslora', 'calado', 'dwt', 'agencia', 'instalacion_portuaria', 'usuario_cargue', 'fecha_cargue']
      },
      {
        endpoint: 'naves-fondeadas',
        modelo: TLCNaves_Fondeadas,
        dto: NaveFondeadaDTO,
        camposUpdate: ['omi', 'motonave', 'bandera', 'fecha_fondeo', 'tipo_nave', 'eslora', 'calado', 'dwt', 'agencia', 'instalacion_portuaria', 'usuario_cargue', 'fecha_cargue']
      },
      {
        endpoint: 'naves-zarpadas',
        modelo: TLCNaves_Zarpadas,
        dto: NaveZarpadaDTO,
        camposUpdate: ['omi', 'motonave', 'bandera', 'ata', 'atd', 'tipo_nave', 'eslora', 'calado', 'dwt', 'agencia', 'instalacion_portuaria', 'usuario_cargue', 'fecha_cargue']
      }
    ];

    for (const config of configuraciones) {
      try {
        // console.log(`📡 Extrayendo datos desde: /${config.endpoint}`);
        const url = `https://sitmar.dimar.mil.co/core/sp/t-i/situacion-puertos/${config.endpoint}`;

        const { data } = await axios.get(url, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });

        const $ = cheerio.load(data);
        const navesSaneadas = [];

        $('table tbody tr').each((i, el) => {
          const col = $(el).find('td');
          if (col.length >= 15) {
            try {
              // Estructura base común de la tabla SITMAR 5.0
              const rawData = {
                capitania: $(col[0]).text().trim(),
                id_aviso: $(col[1]).text().trim(),
                omi: $(col[2]).text().trim(),
                motonave: $(col[3]).text().trim(),
                bandera: $(col[4]).text().trim(),
                tipo_nave: $(col[7]).text().trim(),
                eslora: parseFloat($(col[9]).text()) || null,
                calado: parseFloat($(col[10]).text()) || null,
                dwt: parseFloat($(col[11]).text()) || null,
                agencia: $(col[14]).text().trim(),
                instalacion_portuaria: $(col[15]).text().trim()
              };

              // Fechas dinámicas por tipo de tabla
              if (config.endpoint === 'naves-avisadas') {
                rawData.eta = mapearFechaSmar($(col[5]).text().trim(), $(col[6]).text().trim());
              } else if (config.endpoint === 'naves-arribadas') {
                rawData.eta = mapearFechaSmar($(col[5]).text().trim(), $(col[6]).text().trim());
                rawData.ata = mapearFechaSmar($(col[12]).text().trim(), $(col[13]).text().trim());
              } else if (config.endpoint === 'naves-fondeadas') {
                rawData.fecha_fondeo = mapearFechaSmar($(col[5]).text().trim(), $(col[6]).text().trim());
              } else if (config.endpoint === 'naves-zarpadas') {
                rawData.ata = mapearFechaSmar($(col[5]).text().trim(), $(col[6]).text().trim());
                rawData.atd = mapearFechaSmar($(col[12]).text().trim(), $(col[13]).text().trim());
              }

              // Saneamiento PORTTOS DTO
              const limpio = config.dto(rawData, { codigoUsuario: 'BOT_SITMAR_AUTO' });
              navesSaneadas.push(limpio);

            } catch (lineError) {
              // Ignorar fila corrupta sin detener el scraper
            }
          }
        });

        if (navesSaneadas.length > 0) {
          await config.modelo.bulkCreate(navesSaneadas, {
            updateOnDuplicate: config.camposUpdate
          });
          // console.log(`✅ [${config.endpoint}] Guardadas/Actualizadas: ${navesSaneadas.length} naves.`);
        }

      } catch (err) {
        // console.error(`❌ Error procesando el endpoint ${config.endpoint}:`, err.message);
      }
    }
  }
}

module.exports = SitmarOrquestadorService;