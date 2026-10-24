/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Security & Transactional Integrity
    Updated for: Centralized Models (index.js) & Metadata-Driven Layouts
*/
const { v4: uuidv4 } = require('uuid');
const { LayoutDTO } = require('../models/layout');
const { LayoutPestanaDTO, LayoutPestanaModel } = require('../models/layout-pestana.model');

// 🚨 RESTAURAMOS LOS NOMBRES EXACTOS DE TU INDEX.JS
const {
  sequelize,
  PTLLayouts,
  LayoutPestana,
  TiposPestana,
  CfgZonDinamicas,
  WidgetsMaestro
} = require('../models');

class LayoutService {
  constructor() { }

  // ==========================================
  // WIDGETS DE USUARIOS (LAYOUTS)
  // ==========================================
  async getLayouts() {
    try {
      const layoutDB = await PTLLayouts.findAll();

      if (!layoutDB || layoutDB.length === 0) return [];

      return layoutDB.map(registro => {
        const widget = registro.toJSON();
        if (widget.config) {
          try { widget.config = JSON.parse(widget.config); }
          catch (e) { console.error("Error parseando config del widget", widget.codigoWidget); }
        }
        return widget;
      });
    } catch (error) {
      console.error("Error en LayoutService.getLayouts:", error);
      throw error;
    }
  }

  async getLayoutByUsuario(codigoUsuario, codigoPestana) {
    try {
      const layoutDB = await PTLLayouts.findAll({
        where: { codigoUsuario, codigoPestana }
      });

      if (!layoutDB || layoutDB.length === 0) return [];

      return layoutDB.map(registro => {
        const widget = registro.toJSON();
        if (widget.config) {
          try { widget.config = JSON.parse(widget.config); }
          catch (e) { console.error("Error parseando config del widget", widget.codigoWidget); }
        }
        return widget;
      });
    } catch (error) {
      console.error("Error en LayoutService.getLayoutByUsuario:", error);
      throw error;
    }
  }

  async saveLayout(rawDataArray) {
    if (!Array.isArray(rawDataArray) || rawDataArray.length === 0) return [];

    const dataDTOs = rawDataArray.map(widgetRaw => LayoutDTO(widgetRaw));
    const { codigoUsuario, codigoPestana } = dataDTOs[0];

    return await sequelize.transaction(async (t) => {
      await PTLLayouts.destroy({
        where: { codigoUsuario, codigoPestana },
        transaction: t
      });

      const layoutDB = await PTLLayouts.bulkCreate(dataDTOs, { transaction: t });

      return layoutDB.map(registro => {
        const widget = registro.toJSON();
        if (widget.config) {
          try { widget.config = JSON.parse(widget.config); }
          catch (e) { }
        }
        return widget;
      });
    });
  }

  // ==========================================
  // PESTAÑAS (TABS)
  // ==========================================
  async getPestanasByUsuario(codigoUsuario) {
    try {
      return await LayoutPestana.findAll({
        where: { codigoUsuario },
        order: [['posicion', 'ASC']]
      });
    } catch (error) {
      console.error("Error en LayoutService.getPestanasByUsuario:", error);
      throw error;
    }
  }

  // async savePestanasUsuario(pestanasArray) {
  //   if (!Array.isArray(pestanasArray) || pestanasArray.length === 0) return [];

  //   const codigoUsuario = pestanasArray[0].codigoUsuario;

  //   const dataDTOs = pestanasArray.map((pestana, index) => {
  //     const pestanaDTO = LayoutPestanaDTO(pestana);
  //     return {
  //       codigoUsuario: pestanaDTO.codigoUsuario,
  //       codigoPestana: pestanaDTO.codigoPestana,
  //       posicion: pestanaDTO.posicion !== undefined ? pestana.posicion : index,
  //       codigoTipo: pestanaDTO.codigoTipo,
  //       estadoPestana: pestanaDTO.estadoPestana,
  //       codigoUsuarioCreacion: pestanaDTO.codigoUsuarioCreacion || codigoUsuario,
  //       fechaCreacion: pestanaDTO.fechaCreacion || new Date()
  //     };
  //   });

  //   try {
  //     return await sequelize.transaction(async (t) => {
  //       await LayoutPestana.destroy({
  //         where: { codigoUsuario },
  //         transaction: t
  //       });

  //       console.log('✅ pestanas mapeadas listas para guardar:', dataDTOs);

  //       return await LayoutPestana.bulkCreate(dataDTOs, { transaction: t });
  //     });
  //   } catch (error) {
  //     console.error('❌ Error crítico en savePestanasUsuario (Transacción abortada):', error);
  //     throw error;
  //   }
  // }
  async savePestanasUsuario(pestanasArray) {
    if (!Array.isArray(pestanasArray) || pestanasArray.length === 0) return [];

    const codigoUsuario = pestanasArray[0].codigoUsuario;

    try {
      // 🟢 1. EL BLINDAJE: Extraer la verdad absoluta de la plantilla MASTER
      // Buscamos cómo están configuradas las pestañas originalmente por el sistema
      const pestanasMaestras = await LayoutPestana.findAll({
        where: { codigoUsuario: 'MASTER' }
      });

      // Creamos un diccionario para búsqueda ultrarrápida en memoria
      // Ej: { 'TLC_MARITIMO_001': 'CASCADA_DINAMICA', 'TLC_VIRTUAL_GATE_001': 'ESTATICO_ANALITICO' }
      const diccionarioEstrategias = pestanasMaestras.reduce((acc, tab) => {
        acc[tab.codigoPestana] = tab.codigoTipo;
        return acc;
      }, {});

      // 🟢 2. FORMATEO: Mapeamos los datos del usuario e inyectamos la estrategia maestra
      const dataDTOs = pestanasArray.map((pestana, index) => {
        const pestanaDTO = LayoutPestanaDTO(pestana);

        // ¡LA MAGIA AQUÍ! Ignoramos si el frontend mandó la estrategia vacía. 
        // Obligamos a que herede la de MASTER. Si por algún motivo extremo no existe, usamos ESTATICO.
        const estrategiaHeredada = diccionarioEstrategias[pestanaDTO.codigoPestana] || pestanaDTO.codigoTipo || 'ESTATICO_ANALITICO';

        return {
          codigoUsuario: pestanaDTO.codigoUsuario,
          codigoPestana: pestanaDTO.codigoPestana,
          posicion: pestanaDTO.posicion !== undefined ? pestana.posicion : index,
          codigoTipo: estrategiaHeredada, // <--- 🛡️ Blindado contra pérdida de datos
          estadoPestana: pestanaDTO.estadoPestana,
          codigoUsuarioCreacion: pestanaDTO.codigoUsuarioCreacion || codigoUsuario,
          fechaCreacion: pestanaDTO.fechaCreacion || new Date()
        };
      });

      // 🟢 3. TRANSACCIÓN DB: Reemplazo seguro
      return await sequelize.transaction(async (t) => {
        await LayoutPestana.destroy({
          where: { codigoUsuario },
          transaction: t
        });

        // console.log('✅ Pestañas mapeadas con ESTRATEGIA HEREDADA listas para guardar:', dataDTOs);   // [ruido de consola: comentado 2026-10-26]

        return await LayoutPestana.bulkCreate(dataDTOs, { transaction: t });
      });

    } catch (error) {
      console.error('❌ Error crítico en savePestanasUsuario (Transacción abortada):', error);
      throw error;
    }
  }

  async eliminarLayoutPorPestana(codigoUsuario, codigoPestana) {
    try {
      return await PTLLayouts.destroy({
        where: { codigoUsuario, codigoPestana }
      });
    } catch (error) {
      throw new Error(`Error en BD al eliminar el layout: ${error.message}`);
    }
  }

  // ==========================================
  // OBTENER PLANTILLA MAESTRA (METADATA-DRIVEN)
  // ==========================================
  // async getPlantillaMaestra(codigoPestana) {
  //   try {
  //     const codigoLimpio = codigoPestana.trim();
  //     console.log(`\n🔍 --- DEBUG: BUSCANDO PESTAÑA MAESTRA ---`);
  //     console.log(`Parámetro recibido (limpio): '${codigoLimpio}'`);

  //     // 1. PRIMERO SE HACE LA CONSULTA A LA BASE DE DATOS
  //     const pestanaDB = await LayoutPestana.findOne({
  //       where: {
  //         codigoPestana: codigoLimpio,
  //         codigoUsuario: 'MASTER'
  //       },
  //       // 🔥 EL TRUCO DEFINITIVO: 
  //       // Pasamos las asociaciones como strings. Si TiposPestana está undefined en el require, no importa,
  //       // Sequelize usará el alias 'estrategiaTipo' que ya definiste en tu index.js para hacer el JOIN.
  //       include: ['estrategiaTipo', 'zonaDinamica']
  //     });

  //     // 2. LUEGO SE PONE EL ESCUDO ANTI-CRASH
  //     if (!pestanaDB) {
  //       console.log(`⚠️ No hay metadata en BD para la pestaña ${codigoLimpio}. Retornando plantilla ESTÁTICA por defecto.`);
  //       return {
  //         estrategia: 'ESTATICO_ANALITICO',
  //         configuracion: {
  //           widgetsEstaticos: [],
  //           zonaDinamica: null
  //         }
  //       };
  //     }

  //     // 3. FINALMENTE LA BÚSQUEDA DE WIDGETS DEL CATÁLOGO
  //     const widgetsMaestros = await WidgetsMaestro.findAll({
  //       where: { codigoPestana: codigoLimpio }
  //     });

  //     // 4. ESTRUCTURAR EL PAYLOAD
  //     const estrategia = dataServicio.estrategia || dataServicio.codigoTipoPestana || dataServicio.codigoTipo || 'ESTATICO_ANALITICO';

  //     const layoutEstructurado = {
  //       estrategia: estrategia,
  //       configuracion: {
  //         widgetsEstaticos: [],
  //         zonaDinamica: null
  //       }
  //     };

  //     // Mapear widgets estáticos
  //     layoutEstructurado.configuracion.widgetsEstaticos = widgetsMaestros.map(w => ({
  //       codigoWidget: w.codigoWidget,
  //       x: w.pos_x,
  //       y: (w.anclajeTipo === 'RELATIVO' || w.anclajeTipo === 'RELATIVO_DINAMICO') ? null : w.pos_y,
  //       cols: w.defaultCols || 4,
  //       rows: w.defaultRows || 3,
  //       anclaje: w.anclajeTipo || 'ABSOLUTO',
  //       offsetY: w.offsetY || 0
  //     }));

  //     // Mapear zona dinámica
  //     if (estrategia === 'CASCADA_DINAMICA' && pestanaDB.zonaDinamica) {
  //       layoutEstructurado.configuracion.widgetsEstaticos = widgetsMaestros.map(w => ({
  //         codigoWidget: w.codigoWidget,
  //         x: w.pos_x,
  //         y: (w.anclajeTipo === 'RELATIVO' || w.anclajeTipo === 'RELATIVO_DINAMICO') ? null : w.pos_y,
  //         cols: w.defaultCols || 4,
  //         rows: w.defaultRows || 3,
  //         anclaje: w.anclajeTipo || 'ABSOLUTO',
  //         offsetY: w.offsetY || 0,
  //         // 🟢 AGREGAMOS ESTO: Mapear la columna de la BD. 
  //         // (Cambia 'inicial' por el nombre real de tu columna en SQL si se llama distinto, ej: w.es_inicial)
  //         inicial: w.inicial
  //       }));
  //     }

  //     console.log(`✅ Plantilla ensamblada con éxito para: ${codigoLimpio} | Estrategia: ${estrategia}`);
  //     return layoutEstructurado;

  //   } catch (error) {
  //     console.error('❌ Error en LayoutService.getPlantillaMaestra:', error);
  //     throw error;
  //   }
  // }
  // ==========================================
  // OBTENER PLANTILLA MAESTRA (METADATA-DRIVEN)
  // ==========================================
  async getPlantillaMaestra(codigoPestana) {
    try {
      const codigoLimpio = codigoPestana.trim();
      console.log(`\n🔍 --- DEBUG: BUSCANDO PESTAÑA MAESTRA ---`);
      console.log(`Parámetro recibido: '${codigoLimpio}'`);

      // 🟢 1. CONSULTA A LA TABLA MAESTRA GLOBAL (Sin usar 'MASTER' ni usuarios)
      // Asegúrate de usar el modelo de Sequelize que apunta a "dbo.PTLPestanas"
      const pestanaGlobal = await LayoutPestana.findOne({
        where: {
          codigoPestana: codigoLimpio
        },
        // Si tienes la relación con la zona dinámica, la incluyes aquí:
        include: ['zonaDinamica']
      });

      // 🟢 2. VALIDAR Y EXTRAER LA ESTRATEGIA (Con el nombre de tu columna)
      if (!pestanaGlobal) {
        console.log(`⚠️ Pestaña no encontrada en la BD global. Retornando ESTÁTICA por defecto.`);
        return {
          estrategia: 'ESTATICO_ANALITICO',
          configuracion: { widgetsEstaticos: [], zonaDinamica: null }
        };
      }

      // Leemos tu columna 'codigoTipoPestana'
      const estrategia = pestanaGlobal.codigoTipoPestana || 'ESTATICO_ANALITICO';

      // 🟢 3. OBTENER LOS WIDGETS MAESTROS (Ya lo tenías bien)
      const widgetsMaestros = await WidgetsMaestro.findAll({
        where: { codigoPestana: codigoLimpio }
      });

      // 🟢 4. ESTRUCTURAR EL DTO
      const layoutEstructurado = {
        estrategia: estrategia,
        configuracion: {
          widgetsEstaticos: [],
          zonaDinamica: null
        }
      };

      // Mapear widgets estáticos (Igual que antes)
      layoutEstructurado.configuracion.widgetsEstaticos = widgetsMaestros.map(w => ({
        codigoWidget: w.codigoWidget,
        x: w.pos_x,
        // Corregido 2026-10-18: antes los RELATIVO salían con y = null y el front los apilaba todos en la misma fila.
        // El front usa y para conservar la distancia vertical respecto a la zona dinámica (terminales).
        y: w.pos_y,
        cols: w.defaultCols || 4,
        rows: w.defaultRows || 3,
        anclaje: w.anclajeTipo || 'ABSOLUTO',
        offsetY: w.offsetY || 0,
        inicial: w.inicial // <- Nuestro filtro para el Lobby
      }));

      // Mapear zona dinámica
      if (estrategia === 'CASCADA_DINAMICA' && pestanaGlobal.zonaDinamica) {
        layoutEstructurado.configuracion.zonaDinamica = {
          activa: true,
          codigoMolde: pestanaGlobal.zonaDinamica.codigoMolde,
          inicioX: Number(pestanaGlobal.zonaDinamica.inicioX),
          inicioY: Number(pestanaGlobal.zonaDinamica.inicioY),
          colsPorItem: Number(pestanaGlobal.zonaDinamica.colsPorItem),
          rowsPorItem: Number(pestanaGlobal.zonaDinamica.rowsPorItem),
          maxItemsPorFila: pestanaGlobal.zonaDinamica.maxItemsPorFila ? Number(pestanaGlobal.zonaDinamica.maxItemsPorFila) : 3
        };
      }

      console.log(`✅ Plantilla ensamblada con éxito para: ${codigoLimpio} | Estrategia: ${estrategia}`);
      return layoutEstructurado;

    } catch (error) {
      console.error('❌ Error en LayoutService.getPlantillaMaestra:', error);
      throw error;
    }
  }

  // ==========================================
  // GUARDAR CONFIGURACIÓN DE PLANTILLA
  // ==========================================
  async saveConfiguracionMaestra(codigoPestana, payloadConfig) {
    return await sequelize.transaction(async (t) => {
      await LayoutPestana.update(
        { codigoTipo: payloadConfig.codigoTipo },
        { where: { codigoPestana, codigoUsuario: 'MASTER' }, transaction: t }
      );

      await CfgZonDinamicas.destroy({
        where: { codigoPestana },
        transaction: t
      });

      if (payloadConfig.zonaDinamica) {
        await CfgZonDinamicas.create({
          codigoPestana,
          codigoMolde: payloadConfig.zonaDinamica.codigoMolde,
          inicioX: payloadConfig.zonaDinamica.inicioX,
          inicioY: payloadConfig.zonaDinamica.inicioY,
          colsPorItem: payloadConfig.zonaDinamica.colsPorItem,
          rowsPorItem: payloadConfig.zonaDinamica.rowsPorItem
        }, { transaction: t });
      }

      return true;
    });
  }
}

module.exports = LayoutService;