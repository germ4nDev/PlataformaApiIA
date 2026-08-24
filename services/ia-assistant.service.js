/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Autonomous Schema Discovery, Full Analytical Engine & Multi-Agent TCL
*/
const claudeAdapter = require('../adapters/claude.adapter');
const { GUARDRAIL_PROMPT } = require('../config/guardrails.config');
const { sequelize } = require('../database/connection');
const tclConfigService = require('./torre-control/tcl-config.service'); // <-- Nuevo servicio de configuración de agentes

// IMPORTACIÓN DE MODELOS
const { UsuarioModel } = require('../models/usuario');
const { TicketAPModel } = require('../models/ticket-ap');
const { ActividadModel } = require('../models/actividad');
const { AplicacionModel } = require('../models/aplicacion');
const { BibliotecaModel } = require('../models/biblioteca');
const { GaleriaModel } = require('../models/galeria');
const { IdiomaModel } = require('../models/idioma');
const { ItemModel } = require('../models/item');
const { SuscriptorModel } = require('../models/suscriptor');
const { SuiteAPModel } = require('../models/suites-ap');
const { ModuloAPModel } = require('../models/modulo-ap');
const { PaqueteModel } = require('../models/paquete');

// INICIALIZACIÓN DE MODELOS
const PTLUsuarios = UsuarioModel(sequelize);
const PTLTickets = TicketAPModel(sequelize);
const PTLActividades = ActividadModel(sequelize);
const PTLAplicaciones = AplicacionModel(sequelize);
const PTLBibliotecas = BibliotecaModel(sequelize);
const PTLGalerias = GaleriaModel(sequelize);
const PTLIdiomas = IdiomaModel(sequelize);
const PTLItems = ItemModel(sequelize);
const PTLSuscriptores = SuscriptorModel(sequelize);
const PTLSuites = SuiteAPModel(sequelize);
const PTLModulos = ModuloAPModel(sequelize);
const PTLPaquetes = PaqueteModel(sequelize);

// SERVICIOS
const TicketsAPService = require('../services/tickets-ap.service');
const UsuariosService = require('../services/usuarios.service');
const AplicacionesService = require('../services/aplicaciones.service');
const ActividadesService = require('../services/actividades.service');
const BibliotecasService = require('../services/bibliotecas.service');
const GaleriasService = require('../services/galerias.service');
const IdiomasService = require('../services/idiomas.service');
const ItemsService = require('../services/items.service');
const SuitesAPService = require('../services/suites-ap.service');
const SuscriptoresService = require('../services/suscriptores.service');
const ModulosAPService = require('../services/modulos-ap.service');
const PaquetesService = require('../services/paquetes.service');

class IaAssistantService {
  constructor() {
    this.ticketsService = new TicketsAPService();
    this.usuariosService = new UsuariosService();
    this.aplicacionesService = new AplicacionesService();
    this.actividadesService = new ActividadesService();
    this.bibliotecasService = new BibliotecasService();
    this.galeriasService = new GaleriasService();
    this.itemsService = new ItemsService();
    this.idiomasService = new IdiomasService();
    this.suscriptoresService = new SuscriptoresService();
    this.suitesService = new SuitesAPService();
    this.modulosService = new ModulosAPService();
    this.paquetesService = new PaquetesService();
  }

  _getSchema() {
    const modelos = {
      usuarios: PTLUsuarios, tickets: PTLTickets, actividades: PTLActividades,
      aplicaciones: PTLAplicaciones, bibliotecas: PTLBibliotecas, galerias: PTLGalerias,
      idiomas: PTLIdiomas, items: PTLItems, suscriptores: PTLSuscriptores,
      suites: PTLSuites, paquetes: PTLPaquetes, modulos: PTLModulos
    };

    let schemaDescription = {};
    for (const [key, model] of Object.entries(modelos)) {
      if (model && model.rawAttributes) {
        schemaDescription[key] = Object.keys(model.rawAttributes);
      }
    }
    return JSON.stringify(schemaDescription, null, 2);
  }

  _getTodasLasHerramientas() {
    return [
      {
        name: "consultar_servicio_qplus",
        description: "ÚNICA Y EXCLUSIVAMENTE para traer listas, tablas o generar gráficas. NO USAR para conteos, sumas o promedios.",
        input_schema: {
          type: "object",
          properties: {
            entidadObjetivo: { type: "string" },
            filtros: { type: "object" },
            tipo_grafica: { type: "string", enum: ["barras", "lineas", "pie"] }
          },
          required: ["entidadObjetivo"]
        }
      },
      {
        name: "generar_grafica_agrupada",
        description: "Agrupa datos de una tabla por una columna específica para generar gráficas de proporciones (pie) o comparativas (barras).",
        input_schema: {
          type: "object",
          properties: {
            entidad: { type: "string" },
            columna_agrupacion: { type: "string", description: "Columna para agrupar (ej. estadoUsuario, rol, estadoModulo)" },
            tipo_grafica: { type: "string", enum: ["barras", "pie"] }
          },
          required: ["entidad", "columna_agrupacion", "tipo_grafica"]
        }
      },
      {
        name: "calcular_metrica",
        description: "Calcula estadísticas matemáticas (count, sum, avg, max, min). Requiere el campo numérico a operar si no es count.",
        input_schema: {
          type: "object",
          properties: {
            entidad: { type: "string" },
            operacion: { type: "string", enum: ["count", "avg", "sum", "max", "min"] },
            campo: { type: "string", description: "El nombre exacto de la columna en la base de datos a operar" }
          },
          required: ["entidad", "operacion"]
        }
      },
      {
        name: "ingestar_archivo_excel",
        description: "Carga un archivo Excel, analiza sus datos y crea una nueva tabla en la base de datos para realizar consultas sobre ella.",
        input_schema: {
          type: "object",
          properties: {
            nombre_archivo: { type: "string" },
            nombre_tabla_propuesta: { type: "string" }
          },
          required: ["nombre_archivo", "nombre_tabla_propuesta"]
        }
      },
      // HERRAMIENTAS DE TORRE DE CONTROL (Requieren Agente Específico)
      {
        name: "trazabilidad_logistica",
        requiereAgente: "MARITIMO", // Vínculo con la base de datos TCL
        description: "Consulta el estado de una carga desde el puerto hasta su destino terrestre.",
        input_schema: {
          type: "object",
          properties: {
            numero_contenedor: { type: "string" },
            puerto_destino: { type: "string", enum: ["Cartagena", "Buenaventura", "Barranquilla"] }
          },
          required: ["numero_contenedor"]
        }
      },
      {
        name: "reportar_manifiesto_rndc",
        requiereAgente: "RNDC", // Vínculo con la base de datos TCL
        description: "Envía los datos de un despacho de carga al RNDC. Usa esto solo cuando la carga esté lista y validada.",
        input_schema: {
          type: "object",
          properties: {
            id_manifiesto: { type: "integer" },
            placa: { type: "string" },
            documento_conductor: { type: "string" },
            valor_flete: { type: "number" }
          },
          required: ["id_manifiesto", "placa", "documento_conductor"]
        }
      }
    ];
  }

  _filtrarHerramientasPorAgentes(todasLasTools, agentesActivos) {
    if (!agentesActivos || agentesActivos.length === 0) {
      return todasLasTools.filter(tool => !tool.requiereAgente);
    }

    const codigosActivos = agentesActivos.map(a => a.agente.codigoAgente);
    return todasLasTools.filter(tool => {
      if (!tool.requiereAgente) return true; // Herramientas de QPLUS base
      return codigosActivos.includes(tool.requiereAgente); // Herramientas TCL
    });
  }

  /**
   * Procesa la consulta. Recibe opcionalmente el código del puerto actual
   * para cargar el contexto de los agentes especializados (Torre de Control).
   */
  async processUserQuery(userMessage, codigoPuertoActual = null) {
    try {
      const schema = this._getSchema();
      let systemContext = `Eres el Motor Analítico de la Plataforma 2.0.
            ESQUEMA: ${schema}
            
            TABLA DE DECISIÓN OBLIGATORIA:
            - Cantidad, Total de registros -> 'calcular_metrica' (operacion: 'count')
            - Suma de valores, Total monetario -> 'calcular_metrica' (operacion: 'sum')
            - Promedio, Media -> 'calcular_metrica' (operacion: 'avg')
            - Máximo, Mayor, Más caro -> 'calcular_metrica' (operacion: 'max')
            - Mínimo, Menor, Más barato -> 'calcular_metrica' (operacion: 'min')
            - Listas, Nombres, Detalles, Tablas, Gráficas -> 'consultar_servicio_qplus'.`;

      let herramientasActivas = this._getTodasLasHerramientas();

      // INYECCIÓN DINÁMICA DE AGENTES TCL SI HAY UN PUERTO EN CONTEXTO
      if (codigoPuertoActual) {
        const agentesConfig = await tclConfigService.obtenerAgentesActivosPorPuerto(codigoPuertoActual);

        if (agentesConfig && agentesConfig.length > 0) {
          systemContext += `\n\n=== CONTEXTO TORRE DE CONTROL LOGÍSTICA ===\n`;
          systemContext += `Estás operando en el puerto: ${agentesConfig[0].puerto.nombrePuerto}.\n`;
          systemContext += `Tienes acceso a los siguientes agentes especializados. Aplica sus reglas según la intención del usuario:\n`;

          agentesConfig.forEach(config => {
            systemContext += `\n--- [AGENTE: ${config.agente.codigoAgente} - ${config.agente.nombreAgente}] ---\n`;
            systemContext += `INSTRUCCIONES: ${config.agente.systemPrompt}\n`;
            if (config.apiEndpoint) {
              systemContext += `ENDPOINT ASIGNADO: ${config.apiEndpoint}\n`;
            }
          });

          // Filtramos para que Claude solo vea las herramientas (tools) de los agentes activos
          herramientasActivas = this._filtrarHerramientasPorAgentes(herramientasActivas, agentesConfig);
        }
      } else {
        // Si no hay puerto, limpiamos las herramientas que requieren un agente específico
        herramientasActivas = this._filtrarHerramientasPorAgentes(herramientasActivas, []);
      }

      // 🧹 Limpieza: Claude no soporta atributos custom como 'requiereAgente' en el schema
      const cleanedTools = herramientasActivas.map(({ requiereAgente, ...toolProps }) => toolProps);

      const aiDecision = await claudeAdapter.generateText(userMessage, systemContext, cleanedTools);

      if (aiDecision.type === "tool_use") {
        const resultado = await this._executeTool(aiDecision.toolName, aiDecision.toolInput);

        if (aiDecision.toolInput.tipo_grafica) {
          resultado.tipo_grafica = aiDecision.toolInput.tipo_grafica;
        }

        const finalResponse = await claudeAdapter.generateFinalResponseWithToolResult(userMessage, aiDecision.toolName, resultado);

        return this._formatResponse(finalResponse, {
          name: aiDecision.toolName,
          inputs: aiDecision.toolInput,
          data: resultado
        }, "Function Calling");
      }

      return this._formatResponse(aiDecision.content, null, "Standard Text");
    } catch (error) {
      console.error("Error en IaAssistantService:", error);
      throw { statusCode: 500, msg: "Error al procesar la asistencia de IA." };
    }
  }

  async _executeTool(toolName, inputs) {
    switch (toolName) {
      case 'consultar_servicio_qplus':
        return await this._enrutarConsultaEstandar(inputs);
      case 'calcular_metrica':
        return await this._procesarMetrica(inputs);
      case 'generar_grafica_agrupada':
        return await this._generarGraficaAgrupada(inputs);
      // Espacio para la ejecución real de las tools TCL
      case 'reportar_manifiesto_rndc':
        // return await rndcService.reportar(inputs); 
        return { status: "success", msg: "Simulación: Manifiesto validado internamente." };
      case 'trazabilidad_logistica':
        return { status: "success", msg: "Simulación: Estado logístico obtenido." };
      default:
        return { status: "error", msg: "Herramienta desconocida" };
    }
  }

  async _procesarMetrica(inputs) {
    const servicios = {
      usuarios: this.usuariosService, tickets: this.ticketsService, aplicaciones: this.aplicacionesService,
      actividades: this.actividadesService, bibliotecas: this.bibliotecasService, galerias: this.galeriasService,
      idiomas: this.idiomasService, items: this.itemsService, suscriptores: this.suscriptoresService,
      suites: this.suitesService, modulos: this.modulosService, paquetes: this.paquetesService
    };

    const servicio = servicios[inputs.entidad];
    if (!servicio || !servicio.model) return { error: `Entidad '${inputs.entidad}' no soportada para métricas` };

    try {
      switch (inputs.operacion) {
        case 'count': return { valor: await servicio.model.count(), descripcion: `Total de registros en ${inputs.entidad}` };
        case 'sum': return { valor: await servicio.model.sum(inputs.campo), descripcion: `Suma total de ${inputs.campo} en ${inputs.entidad}` };
        case 'avg': return { valor: await servicio.model.aggregate(inputs.campo, 'avg'), descripcion: `Promedio de ${inputs.campo} en ${inputs.entidad}` };
        case 'max': return { valor: await servicio.model.max(inputs.campo), descripcion: `Valor máximo de ${inputs.campo} en ${inputs.entidad}` };
        case 'min': return { valor: await servicio.model.min(inputs.campo), descripcion: `Valor mínimo de ${inputs.campo} en ${inputs.entidad}` };
        default: return { error: "Operación no soportada" };
      }
    } catch (e) {
      console.error("Error matemático en métrica:", e);
      return { error: `Error procesando la métrica ${inputs.operacion} sobre ${inputs.campo || 'la tabla'}` };
    }
  }

  async _generarGraficaAgrupada(inputs) {
    const { entidad, columna_agrupacion, tipo_grafica } = inputs;
    const servicios = {
      usuarios: this.usuariosService, tickets: this.ticketsService, aplicaciones: this.aplicacionesService,
      actividades: this.actividadesService, bibliotecas: this.bibliotecasService, galerias: this.galeriasService,
      idiomas: this.idiomasService, items: this.itemsService, suscriptores: this.suscriptoresService,
      suites: this.suitesService, modulos: this.modulosService, paquetes: this.paquetesService
    };

    const servicio = servicios[entidad];
    if (!servicio || !servicio.model) return { error: `Entidad '${entidad}' no soportada` };

    try {
      const resultados = await servicio.model.findAll({
        attributes: [
          columna_agrupacion,
          [sequelize.fn('COUNT', sequelize.col(columna_agrupacion)), 'total']
        ],
        group: [columna_agrupacion],
        raw: true
      });

      const labels = [];
      const data = [];
      const coloresPredefinidos = ['#4f46e5', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'];

      resultados.forEach(item => {
        let etiqueta = item[columna_agrupacion];
        if (etiqueta === 1 || etiqueta === true) etiqueta = 'Activo / Sí';
        if (etiqueta === 0 || etiqueta === false) etiqueta = 'Inactivo / No';
        if (etiqueta === null) etiqueta = 'Sin definir';

        labels.push(String(etiqueta));
        data.push(parseInt(item.total, 10));
      });

      return {
        chartConfig: {
          labels: labels,
          datasets: [{
            data: data,
            backgroundColor: coloresPredefinidos.slice(0, data.length),
            label: `Distribución de ${entidad}`
          }]
        },
        tipo_grafica: tipo_grafica,
        db_source: `QPLUS DB - Agrupado por: ${columna_agrupacion}`
      };
    } catch (e) {
      console.error("Error en motor de agrupación:", e);
      return { error: `Imposible agrupar la tabla ${entidad} por la columna ${columna_agrupacion}` };
    }
  }

  /**
     * Método especializado para interpretar documentos (PDF/Excel) y extraer métricas logísticas en JSON.
     */
  async interpretarDocumentoLogistico(textoCrudo, tipoDocumento) {
    try {
      const claudeAdapter = require('../adapters/claude.adapter');

      let systemContext = `
        Eres un experto en logística portuaria y director de una Torre de Control para Buenaventura.
        Tu modelo operativo se basa en Visibilidad 360°, control de ingreso a puertos (Pre-Arribo y Citas), 
        monitoreo del ecosistema de bodegas aledañas (Cross-Docking Sincronizado) y flujo de contenedores (Vacíos vs. Cargados).
        
        Misión: Analiza el siguiente texto extraído de un documento oficial (${tipoDocumento}) y extrae los datos operativos.
        
        REGLA CRÍTICA Y ABSOLUTA: Debes responder ÚNICA Y EXCLUSIVAMENTE con un objeto JSON válido. NO incluyas explicaciones, saludos, ni bloques de markdown (como \`\`\`json) en tu respuesta final. Comienza directamente con { y termina con }.
      `;

      if (tipoDocumento === 'BOLETIN_PORTUARIO') {
        systemContext += `
        El JSON debe cumplir esta estructura:
        {
          "terminales": [
            { "id": "String (ej. SPRBUN, TCBUEN, AGUADULCE)", "ocupacion": Number, "motonaves": Number, "toneladasHoy": Number }
          ],
          "bodegas": [
            { "name": "String", "op": Number, "cap": "String (ej. 45.000 t)", "tipo": "granel|contenedor|suelta", "level": "red|yellow|green" }
          ]
        }`;
      } else if (tipoDocumento === 'RNDC_EXCEL') {
        systemContext += `
        El JSON debe cumplir esta estructura:
        {
          "rutas": [
            { "origen": "String", "destino": "String", "viajes": Number, "toneladas": Number, "valorPagado": Number }
          ]
        }`;
      }

      // Truncamos el texto para no exceder límites absurdos de tokens, dejando un buen margen
      const safeText = textoCrudo.substring(0, 40000);
      const userMessage = `Extrae los datos en JSON puro de este texto:\n\n${safeText}`;

      // Llamada pura a la IA sin 'tools', solo extracción de texto
      const respuestaIA = await claudeAdapter.generateText(userMessage, systemContext, []);

      // Intentar extraer el JSON si la IA insistió en usar Markdown
      let cleanContent = respuestaIA.content.trim();
      if (cleanContent.startsWith('```json')) {
        cleanContent = cleanContent.replace(/```json/g, '').replace(/```/g, '').trim();
      }

      const datosEstructurados = JSON.parse(cleanContent);

      return { ok: true, data: datosEstructurados };

    } catch (error) {
      console.error("🔴 Error parseando la respuesta de la IA a JSON:", error);
      return { ok: false, msg: "La IA no devolvió un JSON válido." };
    }
  }

  async _enrutarConsultaEstandar(inputs) {
    if (!inputs.filtros || Object.keys(inputs.filtros).length === 0) {
      return { error: "Para estadísticas o conteos, usa la herramienta de métricas. Esta herramienta es solo para listas o gráficas con filtros." };
    }

    const f = inputs.filtros || {};
    const e = inputs.entidadObjetivo;

    const enrutador = {
      usuarios: () => this.usuariosService.getUsuarios(f, true),
      tickets: () => this.ticketsService.getTickets(f, true),
      actividades: () => this.actividadesService.getActividades(f, true),
      aplicaciones: () => this.aplicacionesService.getAplicaciones(f, true),
      bibliotecas: () => this.bibliotecasService.getBibliotecas(f, true),
      galerias: () => this.galeriasService.getGalerias(f, true),
      idiomas: () => this.idiomasService.getIdiomas(f, true),
      items: () => this.itemsService.getItems(f, true),
      paquetes: () => this.paquetesService.getPaquetes(f, true),
      suites: () => this.suitesService.getSuites(f, true),
      suscriptores: () => this.suscriptoresService.getSuscriptores(f, true),
      modulos: () => this.modulosService.getModulos(f, true)
    };

    if (enrutador[e]) return await enrutador[e]();
    return { data: [] };
  }

  _formatResponse(msg, toolData, mode) {
    return { ok: true, respuesta: { msg, meta: { executionMode: mode, toolExecuted: toolData, timestamp: new Date().toISOString() } } };
  }
}

module.exports = new IaAssistantService();