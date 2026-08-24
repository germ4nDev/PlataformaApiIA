const axios = require('axios');
const cron = require('node-cron');
const https = require('https');

// 1. IMPORTA TU INSTANCIA DE SEQUELIZE CONECTADA
const { sequelize } = require('../database/connection'); // Ajusta a tu ruta real

// 2. IMPORTAR FUNCIONES Y DTOS DIRECTAMENTE
const { NaveAvisadaModel, NaveAvisadaDTO } = require('../models/torre-control/naves-avisadas.model');
const { NaveArribadaModel, NaveArribadaDTO } = require('../models/torre-control/naves-arribadas.model');
const { NaveFondeadaModel, NaveFondeadaDTO } = require('../models/torre-control/naves-fondeadas.model');
const { NaveZarpadaModel, NaveZarpadaDTO } = require('../models/torre-control/naves-zarpadas.model');

// 🟢 2.1 IMPORTAR EL REPOSITORIO Y EL SERVICIO AIS
const MaritimoRepository = require('../repositories/torre-control/maritimo.repository');
const AISStreamService = require('./../services/torre-control/ais-stream.service');

// 3. INICIALIZAR MODELOS
const TLCNaves_Avisadas = NaveAvisadaModel(sequelize);
const TLCNaves_Arribadas = NaveArribadaModel(sequelize);
const TLCNaves_Fondeadas = NaveFondeadaModel(sequelize);
const TLCNaves_Zarpadas = NaveZarpadaModel(sequelize);

class SitmarEtlService {
  static estaCorriendo = false;

  static async sincronizarTodasLasNaves() {
    if (SitmarEtlService.estaCorriendo) {
      return;
    }

    const getFecha = (diasOffset) => {
      const d = new Date();
      d.setDate(d.getDate() + diasOffset);
      return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} 00:00`;
    };

    const fechaInicio = getFecha(-1);
    const fechaFin = getFecha(2);

    const configuraciones = [
      { nombre: 'Naves Avisadas', endpoint: 'naves_avisadas', modelo: TLCNaves_Avisadas, dto: NaveAvisadaDTO },
      { nombre: 'Naves Arribadas', endpoint: 'naves_arribadas', modelo: TLCNaves_Arribadas, dto: NaveArribadaDTO },
      { nombre: 'Naves Fondeadas', endpoint: 'naves_por_zarpa', modelo: TLCNaves_Fondeadas, dto: NaveFondeadaDTO },
      { nombre: 'Naves Zarpadas', endpoint: 'naves_zarpadas', modelo: TLCNaves_Zarpadas, dto: NaveZarpadaDTO }
    ];

    try {
      SitmarEtlService.estaCorriendo = true;
      // console.log('\n⚡ [SITMAR API MASTER] Iniciando ciclo ETL autónomo...');

      const agent = new https.Agent({ rejectUnauthorized: false });
      let navesAvisadasActualizadas = false; // 🟢 Bandera para saber si actualizamos naves avisadas

      for (const config of configuraciones) {
        try {
          const url = `https://sitmar.dimar.mil.co/sitmarapi/api/reportes/portal/t-i/${config.endpoint}`;

          let payload = { "Capitania": "", "InstalacionPortuaria": "" };

          if (config.endpoint === 'naves_arribadas') {
            payload = { ...payload, "FechaInicioArribo": fechaInicio, "FechaFinArribo": fechaFin };
          } else if (config.endpoint === 'naves_zarpadas') {
            payload = { ...payload, "FechaInicioZarpe": fechaInicio, "FechaFinZarpe": fechaFin };
          } else if (config.endpoint === 'naves_por_zarpa') {
            payload = { ...payload, "FechaInicioETD": fechaInicio, "FechaFinETD": fechaFin };
          } else {
            payload = { ...payload, "FechaInicioETA": fechaInicio, "FechaFinETA": fechaFin };
          }

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/149.0.0.0 Safari/537.36',
              'Referer': 'https://sitmar.dimar.mil.co/core/sp/t-i/situacion-puertos/naves-avisadas',
              'Cookie': 'visid_incap_2919146=IKWnNAhTQoi91o8r3E/426jhMWoAAAAAQUIPAAAAAAB9pY8DZSq2ejB43JUNeEpE; incap_ses_2706_2919146=b2xUcM9XB1yTYlK9xaSNJX/cMmoAAAAAPiikdSoWCkFbf4qyRFxtzQ=='
            },
            body: JSON.stringify(payload),
            agent: agent
          });

          if (!response.ok) throw new Error(`HTTP ${response.status}`);
          const navesData = await response.json();

          if (Array.isArray(navesData) && navesData.length > 0) {
            const navesProcesadas = navesData.map((item, i) => {
              const rawData = {
                capitania: item.CapitaniaNombre,
                id_aviso: (item.NumeroSolZarpe || item.NumeroAviso || `ID-${Date.now()}-${i}`).toString(),
                omi: item.Omi,
                motonave: item.NombreNave,
                bandera: item.Bandera,
                tipo_nave: item.Tipobuque || item.TipoBuqueAndino,
                eslora: item.Eslora,
                calado: item.Calado,
                dwt: item.DWT,
                pais_procedencia: item.PaisProcedencia || item.PaisDestino,
                puerto_procedencia: item.PuertoProcedencia || item.PuertoDestino,
                agencia: item.Agencia,
                instalacion_portuaria: item.Instalacionportuaria
              };

              const formatF = (s) => s ? s.replace(/\//g, '-').replace(' ', 'T') + ':00' : new Date().toISOString();

              if (config.endpoint.includes('avisadas')) rawData.eta = formatF(item.FechaHoraETA);
              else if (config.endpoint.includes('arribadas')) { rawData.eta = formatF(item.FechaHoraETA); rawData.ata = formatF(item.FechaHoraATA); }
              else if (config.endpoint.includes('por_zarpa')) rawData.fecha_fondeo = formatF(item.FechaHoraETD);
              else if (config.endpoint.includes('zarpadas')) { rawData.ata = formatF(item.FechaHoraATA); rawData.atd = formatF(item.FechaHoraZarpe || item.FechaHoraATD); }

              return config.dto(rawData, { codigoUsuario: 'API_DIMAR_SYNC' });
            });

            await config.modelo.sequelize.transaction(async (t) => {
              await config.modelo.destroy({ where: {}, truncate: true, transaction: t });
              await config.modelo.bulkCreate(navesProcesadas, { transaction: t });
            });

            // 🟢 Marcamos que sí hubo datos de Naves Avisadas
            if (config.endpoint === 'naves_avisadas') {
              navesAvisadasActualizadas = true;
            }
          }
        } catch (err) {
          // console.error(`❌ [${config.nombre}] Error de ejecución: ${err.message}`);
        }
      }

      // 🟢 3. EJECUTAR LIMPIEZA DE AIS Y ACTUALIZAR RADAR (Solo si Dimar respondió bien)
      if (navesAvisadasActualizadas) {
        // console.log('🧹 [SITMAR ETL] Purga de motonaves zarpadas/huérfanas...');
        await MaritimoRepository.purgarMotonavesZarpadas();

        // console.log('🔄 [SITMAR ETL] Avisando al motor AIS sobre cambios en la lista...');
        await AISStreamService.recargarListaBlanca();
      } else {
        // console.log('⚠️ [SITMAR ETL] No se ejecutó purga AIS porque Dimar no devolvió naves avisadas válidas.');
      }

      // console.log('\n🏁 [SITMAR API MASTER] Integración finalizada con éxito.');
    } finally {
      SitmarEtlService.estaCorriendo = false;
    }
  }
}

cron.schedule('0 * * * *', async () => {
  await SitmarEtlService.sincronizarTodasLasNaves();
});

SitmarEtlService.sincronizarTodasLasNaves();

module.exports = SitmarEtlService;