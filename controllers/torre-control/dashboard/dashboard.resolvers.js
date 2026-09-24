/*
    Author: German Valencia
    Resolvers: Mock Data Hydration for Torre de Control 4.0
    Pattern: PORTTOS Placeholder Engine
*/

const WIDGET_RESOLVERS = {
  // =========================================================
  // FILA 0: KPIs SUPERIORES (CLON EXACTO DEL DISEÑO FIGMA)
  // =========================================================
  'KPI_CAMIONES': async () => ({
    titulo: "CAMIONES EN OPERACIÓN",
    valor: "1.284",
    tendencia: "hoy · pre-gate 87 · interior 412 · puerto 312",
    colorBorde: "borde-cyan"
  }),

  'KPI_CONTENEDORES': async () => ({
    titulo: "CONTENEDORES DÍA",
    valor: "2.847",
    tendencia: "FCL 2.140 · LCL 124 · Reefer 583", // <-- Punto en el 2.140 también
    colorBorde: "borde-teal"
  }),

  'KPI_GRANEL': async () => ({
    titulo: "GRANEL - TONELADAS DÍA",
    valor: "38.4 k",
    tendencia: "Agrícola 24.2k · Mineral 9.8k · Líquido 4.4k",
    colorBorde: "borde-amarillo"
  }),

  'KPI_CARGA_SUELTA': async () => ({
    titulo: "CARGA SUELTA - TM",
    valor: "4.820",
    tendencia: "Break-bulk · Project · Paletizada",
    colorBorde: "borde-naranja"
  }),

  'KPI_RORO': async () => ({
    titulo: "VEHÍCULOS RO-RO",
    valor: "1.142",
    tendencia: "Imp 824 · Exp 318 · PDI 95% ocupado",
    colorBorde: "borde-fucsia"
  }),

  'KPI_BODEGAS': async () => ({
    titulo: "SATURACIÓN BODEGAS",
    valor: "72 %",
    tendencia: "8 bodegas · 2 críticas · ruteo activo",
    colorBorde: "borde-gris"
  }),

  // =========================================================
  // FILA 1: TIER 1 - RESUMEN GERENCIAL Y TABLAS (UNIFICADO)
  // =========================================================
  'RESUMEN_SPRBUN': async () => ({
    title: "SPRBUN",
    subtitle: "SOC. PORTUARIA REGIONAL - 14 MUELLES",
    status: "operative",
    badgeCount: "10/14", // <-- Traído del detalle
    legend: "1-8 contenedores • 9 multiprop. • 10-12 granel • 14 multiprop./líquidos",
    docks: [
      { label: '1', class: 'occupied' }, { label: '2', class: 'occupied' },
      { label: '3', class: 'occupied' }, { label: '4', class: 'free' },
      { label: '5', class: 'occupied' }, { label: '6', class: 'occupied' },
      { label: '7', class: 'free' }, { label: '8', class: 'occupied' },
      { label: '9', class: 'occupied' }, { label: '10', class: 'occupied' },
      { label: '11', class: 'occupied' }, { label: '12', class: 'free' },
      { label: '14', class: 'occupied' }
    ],
    kpis: { occupancy: "71%", vessels: 10, metricValue: "14.2k", metricLabel: "TM HOY" },
    // 🚨 LA MAGIA: Inyectamos la tabla directamente aquí
    tableData: [
      { id: "M-1", especialidad: "Contenedores", draft: "14.0 m", vessel: "MSC GAYANE", operation: "Descargando", status: "occupied" },
      { id: "M-2", especialidad: "Contenedores", draft: "14.0 m", vessel: "CMA CGM AMAZON", operation: "Cargando", status: "occupied" },
      { id: "M-4", especialidad: "Contenedores", draft: "14.0 m", vessel: "—", operation: "Disponible", status: "free" },
      { id: "M-10", especialidad: "Granel Sólido", draft: "10.5 m", vessel: "BULK TITAN", operation: "Descargando", status: "occupied" },
      { id: "M-1", especialidad: "Contenedores", draft: "14.0 m", vessel: "MSC GAYANE", operation: "Descargando", status: "occupied" },
      { id: "M-2", especialidad: "Contenedores", draft: "14.0 m", vessel: "CMA CGM AMAZON", operation: "Cargando", status: "occupied" },
      { id: "M-4", especialidad: "Contenedores", draft: "14.0 m", vessel: "—", operation: "Disponible", status: "free" },
      { id: "M-10", especialidad: "Granel Sólido", draft: "10.5 m", vessel: "BULK TITAN", operation: "Descargando", status: "occupied" },
      { id: "M-1", especialidad: "Contenedores", draft: "14.0 m", vessel: "MSC GAYANE", operation: "Descargando", status: "occupied" },
      { id: "M-2", especialidad: "Contenedores", draft: "14.0 m", vessel: "CMA CGM AMAZON", operation: "Cargando", status: "occupied" },
      { id: "M-4", especialidad: "Contenedores", draft: "14.0 m", vessel: "—", operation: "Disponible", status: "free" },
      { id: "M-10", especialidad: "Granel Sólido", draft: "10.5 m", vessel: "BULK TITAN", operation: "Descargando", status: "occupied" }

    ]
  }),

  'RESUMEN_TCBUEN': async () => ({
    title: "TCBUEN",
    subtitle: "TERM. CONTENEDORES - 700m MUELLE",
    status: "congested",
    badgeCount: "2/2",
    legend: "Especializado en contenedores • 14m calado • 2 puestos Post-Panamax",
    docks: [
      { label: 'TC-1', class: 'occupied' },
      { label: 'TC-2', class: 'occupied' }
    ],
    kpis: { occupancy: "100%", vessels: 7, metricValue: "22.1k", metricLabel: "TEU HOY" },
    tableData: [
      { id: "TC-1", especialidad: "Contenedores", draft: "14.0 m", vessel: "MAERSK EINDHOVEN", operation: "Atracando", status: "occupied" },
      { id: "TC-2", especialidad: "Contenedores", draft: "14.0 m", vessel: "HAPAG LLOYD EXPRESS", operation: "Descargando", status: "occupied" }
    ]
  }),

  'RESUMEN_SPIA': async () => ({
    title: "PUERTO AGUADULCE",
    subtitle: "SPIA - CONTENEDORES",
    status: "operative",
    badgeCount: "1/2",
    legend: "Soc. Puerto Industrial Aguadulce • contenedores • 16m calado",
    docks: [
      { label: 'AD-1', class: 'occupied' },
      { label: 'AD-2', class: 'free dashed' }
    ],
    kpis: { occupancy: "50%", vessels: 4, metricValue: "8.7k", metricLabel: "TEU HOY" },
    tableData: [
      { id: "AD-1", especialidad: "Contenedores", draft: "16.0 m", vessel: "MSC LORETO", operation: "Descargando", status: "occupied" },
      { id: "AD-2", especialidad: "Contenedores", draft: "16.0 m", vessel: "—", operation: "Disponible", status: "free" }
    ]
  }),

  'RESUMEN_COMPAS_CAS': async () => ({
    title: "COMPAS - Cascajal",
    subtitle: "GRANEL SÓLIDO • GRANOS",
    status: "operative",
    badgeCount: "1/2",
    legend: "Isla de Cascajal • graneles sólidos, granos y subproductos • 10.5m",
    docks: [
      { label: 'CC-1', class: 'occupied wide' },
      { label: 'CC-2', class: 'free wide dashed' }
    ],
    kpis: { occupancy: "50%", vessels: 1, metricValue: "3.2k", metricLabel: "TM HOY" },
    tableData: [
      { id: "CC-1", especialidad: "Granel Sólido", draft: "10.5 m", vessel: "DARYA JANYA", operation: "Descarga granos", status: "occupied" },
      { id: "CC-2", especialidad: "Granel Sólido", draft: "10.5 m", vessel: "—", operation: "Disponible", status: "free" }
    ]
  }),

  'RESUMEN_COMPAS_AGU': async () => ({
    title: "COMPAS - Aguadulce",
    subtitle: "GRANEL • CARBÓN • VEHÍC. • GENERAL",
    status: "operative",
    badgeCount: "2/2",
    legend: "Península Aguadulce • granel alimenticio, minerales, carbón, vehículos",
    docks: [
      { label: 'CA-1', class: 'occupied wide' },
      { label: 'CA-2', class: 'occupied wide' }
    ],
    kpis: { occupancy: "100%", vessels: 2, metricValue: "6.4k", metricLabel: "TM HOY" },
    tableData: [
      { id: "CA-1", especialidad: "Granel Sólido", draft: "15.0 m", vessel: "BBC OREGON", operation: "Descarga clinker", status: "occupied" },
      { id: "CA-2", especialidad: "General", draft: "15.0 m", vessel: "GRAN BRETAGNA", operation: "Descarga Ro-Ro", status: "occupied" }
    ]
  }),

  'RESUMEN_GRUPO_PORT': async () => ({
    title: "Grupo Portuario",
    subtitle: "GRANEL • CARBÓN • VEHÍC. • GENERAL",
    status: "operative",
    badgeCount: "2/2",
    legend: "Península Aguadulce • granel alimenticio, minerales, carbón, vehículos",
    docks: [
      { label: 'CA-1', class: 'occupied wide' },
      { label: 'CA-2', class: 'occupied wide' }
    ],
    kpis: { occupancy: "100%", vessels: 2, metricValue: "6.4k", metricLabel: "TM HOY" },
    tableData: [
      { id: "CA-1", especialidad: "Granel Sólido", draft: "15.0 m", vessel: "BBC OREGON", operation: "Descarga clinker", status: "occupied" },
      { id: "CA-2", especialidad: "General", draft: "15.0 m", vessel: "GRAN BRETAGNA", operation: "Descarga Ro-Ro", status: "occupied" }
    ]
  }),

  // ==========================================
  // FILAS 3 Y 4: MASTER TABLE & CHARTS
  // ==========================================
  'TABLE_REPORTE_MOTONAVES': async () => ({
    titulo: 'REPORTE DE MOTONAVES · 72H',
    subtitulo: 'Programación de arribos y atraques',
    motonaves: [
      {
        motonave: 'MSC GAYANE', naviera: 'MSC', terminal: 'TCBUEN', tipo: 'Portacont.',
        eta: '11/05 07:30', ata: '11/05 08:12 - M-N3', carga: '8,240 TEU',
        estadoTexto: 'DESCARGANDO', estadoClase: 'badge-descargando'
      },
      {
        motonave: 'MAERSK SANTIAGO', naviera: 'Maersk', terminal: 'SPRBUN', tipo: 'Portacont.',
        eta: '11/05 10:00', ata: '11/05 10:45 - M-2', carga: '6,520 TEU',
        estadoTexto: 'DESCARGANDO', estadoClase: 'badge-descargando'
      },
      {
        motonave: 'NORDLAKE', naviera: 'Hapag-Lloyd', terminal: 'AGUADULCE', tipo: 'Granelero',
        eta: '11/05 18:30', ata: '11/05 19:15 - A-1', carga: '42k TM maíz',
        estadoTexto: 'DESCARGANDO GRANEL', estadoClase: 'badge-descargando'
      },
      {
        motonave: 'BBC OREGON', naviera: 'BBC', terminal: 'AGUADULCE', tipo: 'Granelero',
        eta: '11/05 22:00', ata: '-- - espera', carga: '28k TM clinker',
        estadoTexto: 'EN FONDEO', estadoClase: 'badge-fondeo'
      },
      {
        motonave: 'CMA CGM AMAZON', naviera: 'CMA CGM', terminal: 'TCBUEN', tipo: 'Portacont.',
        eta: '11/05 14:20', ata: '11/05 14:50 - M-N1', carga: '9,100 TEU',
        estadoTexto: 'ATRACANDO', estadoClase: 'badge-atracando'
      },
      {
        motonave: 'GRAN BRETAGNA', naviera: 'Grimaldi', terminal: 'AGUADULCE', tipo: 'Ro-Ro',
        eta: '11/05 16:00', ata: '11/05 16:50 - A-3', carga: '1,840 vehíc.',
        estadoTexto: 'DESCARGA RO-RO', estadoClase: 'badge-descargando'
      },
      {
        motonave: 'EVERGREEN HARMONY', naviera: 'Evergreen', terminal: 'TCBUEN', tipo: 'Portacont.',
        eta: '11/05 16:00', ata: '-- fondeo', carga: '11,200 TEU',
        estadoTexto: 'EN FONDEO', estadoClase: 'badge-fondeo'
      },
      {
        motonave: 'MV SANTA ROSA', naviera: 'Hamburg Süd', terminal: 'SPRBUN', tipo: 'Reefer',
        eta: '12/05 03:15', ata: '--', carga: '1,840 TEU reefer',
        estadoTexto: 'EN TRÁNSITO', estadoClase: 'badge-transito'
      },
      {
        motonave: 'BBC ARIZONA', naviera: 'BBC', terminal: 'SPRBUN', tipo: 'Multipropósito',
        eta: '12/05 05:30', ata: '--', carga: '3,200 TM acero',
        estadoTexto: 'EN TRÁNSITO', estadoClase: 'badge-transito'
      },
      {
        motonave: 'GRAN BRETAGNA', naviera: 'Grimaldi', terminal: 'AGUADULCE', tipo: 'Ro-Ro',
        eta: '11/05 16:00', ata: '11/05 16:50 - A-3', carga: '1,840 vehíc.',
        estadoTexto: 'DESCARGA RO-RO', estadoClase: 'badge-descargando'
      },
      {
        motonave: 'EVERGREEN HARMONY', naviera: 'Evergreen', terminal: 'TCBUEN', tipo: 'Portacont.',
        eta: '11/05 16:00', ata: '-- fondeo', carga: '11,200 TEU',
        estadoTexto: 'EN FONDEO', estadoClase: 'badge-fondeo'
      },
      {
        motonave: 'MV SANTA ROSA', naviera: 'Hamburg Süd', terminal: 'SPRBUN', tipo: 'Reefer',
        eta: '12/05 03:15', ata: '--', carga: '1,840 TEU reefer',
        estadoTexto: 'EN TRÁNSITO', estadoClase: 'badge-transito'
      },
      {
        motonave: 'BBC ARIZONA', naviera: 'BBC', terminal: 'SPRBUN', tipo: 'Multipropósito',
        eta: '12/05 05:30', ata: '--', carga: '3,200 TM acero',
        estadoTexto: 'EN TRÁNSITO', estadoClase: 'badge-transito'
      }
    ]
  }),

  'CHART_ETA_ATA': async () => ({
    titulo: "⏱️ REPORTE ETA VS ATA",
    subtitulo: "Retraso promedio por terminal (h)",
    // El eje X ahora son los terminales
    labels: ['SPRBUN', 'TCBUEN', 'Aguadulce'],
    datasets: [
      {
        label: 'ETA planeada (h)',
        data: [0, 0, 0], // Valores para la barra azul
        backgroundColor: '#3b82f6', // Azul vibrante
        borderRadius: 4, // Bordes redondeados en las barras
        borderSkipped: false
      },
      {
        label: 'Retraso real (h)',
        // Valores aproximados a lo que se ve en tu Captura 1
        data: [0.7, 2.3, 0.4],
        backgroundColor: '#ff526a', // Rojo/Rosado vibrante
        borderRadius: 4,
        borderSkipped: false
      }
    ]
  }),

  // 1. EL GRÁFICO DE BARRAS APILADAS
  'CHART_TONELADAS': async () => ({
    titulo: "📊 TONELADAS MOVIDAS HOY · POR TIPO",
    labels: ['SPRBUN', 'TCBUEN', 'Aguadulce'],
    datasets: [
      { label: 'Contenedores (TEU eq.)', data: [8000, 14500, 2500], backgroundColor: '#3b82f6' }, // Azul
      { label: 'Granel agrícola (t)', data: [3000, 0, 19000], backgroundColor: '#10b981' }, // Verde
      { label: 'Granel mineral (t)', data: [1500, 0, 8000], backgroundColor: '#a87b51' }, // Café
      { label: 'Granel líquido (t)', data: [1000, 0, 3000], backgroundColor: '#14b8a6' }, // Turquesa
      { label: 'Carga suelta (t)', data: [2500, 500, 1500], backgroundColor: '#f59e0b' }, // Naranja
      { label: 'Vehículos (uds)', data: [0, 0, 1000], backgroundColor: '#ec4899' }  // Rosa
    ]
  }),

  // 2. LA GRILLA DE CONDICIONES
  'CONDICIONES_CANAL': async () => ({
    titulo: "🌊 CONDICIONES DEL CANAL · REPORTE",
    condiciones: [
      { titulo: 'MAREA ACTUAL', valor: '3.8 m', subtitulo: 'Pleamar 14:42', textClass: 'color-blue' },
      { titulo: 'VISIBILIDAD', valor: '12 km', subtitulo: 'Viento 8 nudos', textClass: 'color-green' },
      { titulo: 'CANAL ACCESO', valor: 'Abierto', subtitulo: 'Pilotaje normal', textClass: 'color-green' },
      { titulo: 'DRAGADO', valor: '12.5 m', subtitulo: 'Restricción Panamax', textClass: 'color-orange' }
    ]
  }),

  'RESUMEN_SEMANAL': async () => ({
    titulo: "📝 RESUMEN SEMANAL MARÍTIMO",
    metricas: [
      { label: "MOTONAVES ATENDIDAS", valor: "86", tendencia: "▲ 4 vs sem. anterior" },
      { label: "TEUS TOTALES", valor: "142k", tendencia: "+8.2% YoY" },
      { label: "TM GRANEL", valor: "312k", tendencia: "+12% YoY" },
      { label: "VEHÍCULOS", valor: "6,840", tendencia: "▼ 2% vs mes" }
    ]
  }),

  'CHART_PRODUCTIVIDAD': async () => ({
    labels: ['SPRBUN', 'TCBUEN', 'SPIA', 'COMPAS'],
    datasets: [
      { label: 'Eficiencia %', data: [88, 76, 95, 82] }
    ]
  }),

  'REPORTES_OPERATIVOS': async () => ({
    titulo: "📋 REPORTES OPERATIVOS",
    reportes: [
      { titulo: "Reporte diario operaciones · 11/05", desc: "Productividad 92% · sin incidentes", borde: "border-success" },
      { titulo: "Boletín semanal SPRBUN", desc: "14k TEUs descargados", borde: "border-primary" },
      { titulo: "Restricción dragado canal", desc: "Reporte DIMAR - Panamax con espera", borde: "border-warning" },
      { titulo: "Pronóstico IDEAM 72h", desc: "Lluvias moderadas · sin afectación", borde: "border-info" },
      { titulo: "Reporte diario operaciones · 11/05", desc: "Productividad 92% · sin incidentes", borde: "border-success" },
      { titulo: "Boletín semanal SPRBUN", desc: "14k TEUs descargados", borde: "border-primary" },
      { titulo: "Restricción dragado canal", desc: "Reporte DIMAR - Panamax con espera", borde: "border-warning" },
      { titulo: "Pronóstico IDEAM 72h", desc: "Lluvias moderadas · sin afectación", borde: "border-info" },
      { titulo: "Reporte diario operaciones · 11/05", desc: "Productividad 92% · sin incidentes", borde: "border-success" },
      { titulo: "Boletín semanal SPRBUN", desc: "14k TEUs descargados", borde: "border-primary" },
      { titulo: "Restricción dragado canal", desc: "Reporte DIMAR - Panamax con espera", borde: "border-warning" },
      { titulo: "Pronóstico IDEAM 72h", desc: "Lluvias moderadas · sin afectación", borde: "border-info" }
    ]
  })
};

module.exports = WIDGET_RESOLVERS;