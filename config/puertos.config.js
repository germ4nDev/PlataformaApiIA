


export const MAPA_PORTUARIO = {
  BUENAVENTURA: {
    nombre: 'Buenaventura',
    region: 'Pacífico',
    coordenadas: { lat: 3.882, lon: -77.076 },
    infraestructura: {
      SPRBUN: {
        nombre: 'SPRBUN',
        alias: ['SPRB', 'SOCIEDAD PORTUARIA DE BUENAVENTURA', 'SOC PORTUARIA REGIONAL'],
        sub: 'SOC. PORTUARIA REGIONAL · 13 MUELLES',
        desc: 'Terminal multipropósito principal del Pacífico colombiano.',
        unidad: 'TM HOY',
        capacidadReefer: 600,
        muelles: [
          { id: 'M-1', dbId: '1', esp: 'Contenedores', calado: '14.0 m', estadoMantenimiento: false, poligono: [[3.8810, -77.0750]] },
          { id: 'M-2', dbId: '2', esp: 'Contenedores', calado: '14.0 m', estadoMantenimiento: false, poligono: [[3.8812, -77.0752]] },
          { id: 'M-3', dbId: '3', esp: 'Contenedores', calado: '14.0 m', estadoMantenimiento: false, poligono: [[3.8814, -77.0754]] },
          { id: 'M-4', dbId: '4', esp: 'Contenedores', calado: '14.0 m', estadoMantenimiento: false, poligono: [[3.8816, -77.0756]] },
          { id: 'M-5', dbId: '5', esp: 'Contenedores', calado: '13.5 m', estadoMantenimiento: false, poligono: [[3.8818, -77.0758]] },
          { id: 'M-6', dbId: '6', esp: 'Contenedores', calado: '13.5 m', estadoMantenimiento: false, poligono: [[3.8820, -77.0760]] },
          { id: 'M-7', dbId: '7', esp: 'Contenedores', calado: '13.5 m', estadoMantenimiento: false, poligono: [[3.8822, -77.0762]] },
          { id: 'M-8', dbId: '8', esp: 'Contenedores', calado: '13.5 m', estadoMantenimiento: false, poligono: [[3.8824, -77.0764]] },
          { id: 'M-9', dbId: '9', esp: 'Multipropósito', calado: '12.5 m', estadoMantenimiento: false, poligono: [[3.8826, -77.0766]] },
          { id: 'M-10', dbId: '10', esp: 'Granel sólido', calado: '13.0 m', estadoMantenimiento: false, poligono: [[3.8828, -77.0768]] },
          { id: 'M-11', dbId: '11', esp: 'Granel sólido', calado: '13.0 m', estadoMantenimiento: false, poligono: [[3.8830, -77.0770]] },
          { id: 'M-12', dbId: '12', esp: 'Granel sólido', calado: '13.0 m', estadoMantenimiento: false, poligono: [[3.8832, -77.0772]] },
          { id: 'M-14', dbId: '14', esp: 'Líquidos', calado: '12.5 m', estadoMantenimiento: false, poligono: [[3.8834, -77.0774]] }
        ]
      },
      TCBUEN: {
        nombre: 'TCBUEN',
        alias: ['TBC', 'TCB', 'TERMINAL DE CONTENEDORES DE BUENAVENTURA'],
        sub: 'TERM. CONTENEDORES · 700m MUELLE',
        desc: 'Terminal especializada de contenedores del grupo APM Terminals.',
        unidad: 'TEU HOY',
        capacidadReefer: 540,
        muelles: [
          { id: 'TC-1', dbId: 'TC1', esp: 'Contenedores', calado: '14.0 m', estadoMantenimiento: false, poligono: [[3.8650, -77.0350]] },
          { id: 'TC-2', dbId: 'TC2', esp: 'Contenedores', calado: '14.0 m', estadoMantenimiento: false, poligono: [[3.8652, -77.0352]] }
        ]
      },
      SPIA: {
        nombre: 'PUERTO AGUADULCE',
        alias: ['COMPAS - AGU DULCE', 'COMPAS - AGUADULCE', 'SPIA', 'AGUADULCE', 'COMPAS  AGUA DULCE'],
        sub: 'SPIA · CONTENEDORES Y GRANEL',
        desc: 'Sociedad Puerto Industrial Aguadulce. Infraestructura de última generación.',
        unidad: 'TEU HOY',
        capacidadReefer: 830,
        muelles: [
          { id: 'AD-1', dbId: '1', esp: 'Contenedores', calado: '16.0 m', estadoMantenimiento: false, poligono: [[3.8150, -77.0500]] },
          { id: 'AD-2', dbId: '2', esp: 'Contenedores', calado: '16.0 m', estadoMantenimiento: false, poligono: [[3.8152, -77.0502]] }
        ]
      },
      COMPASCASCAJAL: {
        nombre: 'COMPAS · Cascajal',
        alias: ['COMPAS - CASCAJAL', 'COMPAS CASCAJAL'],
        sub: 'GRANEL SÓLIDO · CEREALES',
        desc: 'Terminal especializada en graneles alimenticios y carbón.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'CC-1', dbId: '15', esp: 'Granel sólido', calado: '10.5 m', estadoMantenimiento: false, poligono: [[3.8780, -77.0750]] },
          { id: 'CC-2', dbId: '16', esp: 'Granel sólido', calado: '10.5 m', estadoMantenimiento: false, poligono: [[3.8782, -77.0752]] }
        ]
      },
      COMPASAGD: {
        nombre: 'COMPAS · Aguadulce',
        alias: ['COMPAS - AGUADULCE', 'COMPAS AGUADULCE', 'COMPAS - AGU'], // 🚨 Alias clave
        sub: 'GRANEL · CARBÓN · GENERAL',
        desc: 'Terminal marítima para graneles, carbón y vehículos.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          // En tu BD, los muelles son 1 y 2 para Aguadulce
          { id: 'CA-1', dbId: '1', esp: 'Granel / Carbón', calado: '15.0 m', estadoMantenimiento: false, poligono: [[3.8180, -77.0520]] },
          { id: 'CA-2', dbId: '2', esp: 'Vehículos / General', calado: '15.0 m', estadoMantenimiento: false, poligono: [[3.8182, -77.0522]] }
        ]
      },
      GRUPOPORT: {
        nombre: 'Grupo Portuario',
        alias: ['GRUPO PORTUARIO', 'MUELLE 13'],
        sub: 'MUELLE 13 · MULTIPROPÓSITO',
        desc: 'Concesión independiente especializada en graneles sólidos y minerales.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'M-13', dbId: '13', esp: 'Multipropósito', calado: '12.0 m', estadoMantenimiento: false, poligono: [[3.8840, -77.0780]] }
        ]
      }
    }
  },
  CARTAGENA: {
    nombre: 'Cartagena',
    region: 'Caribe',
    coordenadas: { lat: 10.391, lon: -75.483 },
    infraestructura: {
      SPRC: {
        nombre: 'SPRC',
        alias: ['SOCIEDAD PORTUARIA DE CARTAGENA', 'SPRC MANGA', 'PUERTO DE CARTAGENA'],
        sub: 'HUB DE TRANSBORDO · MANGA',
        desc: 'Especializado en contenedores, carga general y cruceros.',
        unidad: 'TEU HOY',
        capacidadReefer: 1200,
        muelles: [
          { id: 'C-1', dbId: '1', esp: 'Contenedores', calado: '15.0 m', estadoMantenimiento: false, poligono: [[10.4070, -75.5340]] },
          { id: 'C-2', dbId: '2', esp: 'Contenedores', calado: '15.0 m', estadoMantenimiento: false, poligono: [[10.4072, -75.5342]] },
          { id: 'C-3', dbId: '3', esp: 'Contenedores', calado: '15.0 m', estadoMantenimiento: false, poligono: [[10.4074, -75.5344]] },
          { id: 'C-4', dbId: '4', esp: 'Contenedores', calado: '15.0 m', estadoMantenimiento: false, poligono: [[10.4076, -75.5346]] },
          { id: 'C-5', dbId: '5', esp: 'Cruceros / General', calado: '12.0 m', estadoMantenimiento: false, poligono: [[10.4080, -75.5350]] },
          { id: 'C-6', dbId: '6', esp: 'Cruceros', calado: '12.0 m', estadoMantenimiento: false, poligono: [[10.4082, -75.5352]] }
        ]
      },
      CONTECAR: {
        nombre: 'CONTECAR',
        alias: ['TERMINAL DE CONTENEDORES', 'CONTECAR MAMONAL', 'CONTECAR S.A.'],
        sub: 'TERMINAL POST-PANAMAX · MAMONAL',
        desc: 'Gran centro de conexiones logísticas para contenedores y carga rodante (Ro-Ro).',
        unidad: 'TEU HOY',
        capacidadReefer: 1500,
        muelles: [
          { id: 'CT-1', dbId: 'CT1', esp: 'Contenedores', calado: '16.5 m', estadoMantenimiento: false, poligono: [[10.3750, -75.5030]] },
          { id: 'CT-2', dbId: 'CT2', esp: 'Contenedores', calado: '16.5 m', estadoMantenimiento: false, poligono: [[10.3752, -75.5032]] },
          { id: 'CT-3', dbId: 'CT3', esp: 'Ro-Ro / General', calado: '14.0 m', estadoMantenimiento: false, poligono: [[10.3754, -75.5034]] }
        ]
      },
      COMPAS_BOSQUE: {
        nombre: 'COMPAS · El Bosque',
        alias: ['COMPAS BOSQUE', 'PUERTO EL BOSQUE', 'COMPAS EL BOSQUE'],
        sub: 'MULTIPROPÓSITO · ISLA DEL BOSQUE',
        desc: 'Movilización de graneles alimenticios, industriales, coque y líquidos.',
        unidad: 'TM HOY',
        capacidadReefer: 50,
        muelles: [
          { id: 'CB-1', dbId: '1', esp: 'Granel sólido', calado: '11.0 m', estadoMantenimiento: false, poligono: [[10.3880, -75.5180]] },
          { id: 'CB-2', dbId: '2', esp: 'Multipropósito', calado: '11.0 m', estadoMantenimiento: false, poligono: [[10.3882, -75.5182]] },
          { id: 'CB-3', dbId: '3', esp: 'Líquidos', calado: '10.5 m', estadoMantenimiento: false, poligono: [[10.3884, -75.5184]] }
        ]
      },
      PUERTO_BAHIA: {
        nombre: 'Puerto Bahía',
        alias: ['SOCIEDAD PORTUARIA PUERTO BAHIA', 'PTO BAHIA', 'PUERTO BAHIA'],
        sub: 'LÍQUIDOS · RO-RO · MAMONAL',
        desc: 'Terminal marítima especializada en hidrocarburos y carga rodante del Caribe.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'PB-L1', dbId: 'L1', esp: 'Líquidos', calado: '15.5 m', estadoMantenimiento: false, poligono: [[10.3150, -75.5350]] },
          { id: 'PB-R1', dbId: 'R1', esp: 'Ro-Ro / General', calado: '12.0 m', estadoMantenimiento: false, poligono: [[10.3154, -75.5354]] }
        ]
      }
    }
  },
  BARRANQUILLA: {
    nombre: 'Barranquilla',
    region: 'Caribe',
    coordenadas: { lat: 10.963, lon: -74.782 },
    infraestructura: {
      SPRB: {
        nombre: 'SPRB',
        alias: ['SOCIEDAD PORTUARIA DE BARRANQUILLA', 'PORTUARIA BARRANQUILLA', 'SPRBUN_BAQ'],
        sub: 'SOC. PORTUARIA REGIONAL',
        desc: 'Terminal fluvial y marítima multipropósito sobre el Río Magdalena.',
        unidad: 'TM HOY',
        capacidadReefer: 300,
        muelles: [
          { id: 'B-1', dbId: '1', esp: 'Contenedores', calado: '10.0 m', estadoMantenimiento: false, poligono: [[10.9630, -74.7820]] },
          { id: 'B-2', dbId: '2', esp: 'Contenedores', calado: '10.0 m', estadoMantenimiento: false, poligono: [[10.9632, -74.7822]] },
          { id: 'B-3', dbId: '3', esp: 'Multipropósito', calado: '10.0 m', estadoMantenimiento: false, poligono: [[10.9634, -74.7824]] },
          { id: 'B-4', dbId: '4', esp: 'Granel sólido', calado: '10.0 m', estadoMantenimiento: false, poligono: [[10.9636, -74.7826]] },
          { id: 'B-5', dbId: '5', esp: 'Granel sólido', calado: '10.0 m', estadoMantenimiento: false, poligono: [[10.9638, -74.7828]] },
          { id: 'B-6', dbId: '6', esp: 'Líquidos / Coque', calado: '10.0 m', estadoMantenimiento: false, poligono: [[10.9640, -74.7830]] }
        ]
      },
      PALERMO: {
        nombre: 'PALERMO',
        alias: ['PALERMO SOC PORTUARIA', 'PALERMO SOCIEDAD PORTUARIA', 'PALERMO'],
        sub: 'TERMINAL MULTIPROPÓSITO Y OFFSHORE',
        desc: 'Ubicado estratégicamente en la margen oriental del río Magdalena.',
        unidad: 'TM HOY',
        capacidadReefer: 80,
        muelles: [
          { id: 'P-1', dbId: '1', esp: 'Multipropósito', calado: '11.0 m', estadoMantenimiento: false, poligono: [[10.9700, -74.7750]] },
          { id: 'P-2', dbId: '2', esp: 'Líquidos / Granel', calado: '11.0 m', estadoMantenimiento: false, poligono: [[10.9702, -74.7752]] }
        ]
      },
      COMPAS_BARRANQUILLA: {
        nombre: 'COMPAS · Barranquilla',
        alias: ['COMPAS BARRANQUILLA', 'COMPAS - BARRANQUILLA'],
        sub: 'ACERO Y GRANEL SÓLIDO',
        desc: 'Terminal especializada en el manejo de acero, carbón y derivados.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'CBA-1', dbId: '1', esp: 'Acero / Multipropósito', calado: '9.5 m', estadoMantenimiento: false, poligono: [[10.9550, -74.7850]] },
          { id: 'CBA-2', dbId: '2', esp: 'Granel agrícola', calado: '9.5 m', estadoMantenimiento: false, poligono: [[10.9552, -74.7852]] }
        ]
      }
    }
  },
  SANTA_MARTA: {
    nombre: 'Santa Marta',
    region: 'Caribe',
    coordenadas: { lat: 11.242, lon: -74.212 },
    infraestructura: {
      SPSM: {
        nombre: 'PUERTO SANTA MARTA',
        alias: ['SPSM', 'SOCIEDAD PORTUARIA DE SANTA MARTA', 'PUERTO DE SANTA MARTA'],
        sub: 'PUERTO DE AGUAS PROFUNDAS NATURALES',
        desc: 'Terminal eficiente con calado natural profundo, ideal para graneles y contenedores reefer.',
        unidad: 'TM HOY',
        capacidadReefer: 900,
        muelles: [
          { id: 'SM-1', dbId: '1', esp: 'General / Ro-Ro', calado: '12.1 m', estadoMantenimiento: false, poligono: [[11.2450, -74.2150]] },
          { id: 'SM-2', dbId: '2', esp: 'Multipropósito', calado: '12.1 m', estadoMantenimiento: false, poligono: [[11.2452, -74.2152]] },
          { id: 'SM-3', dbId: '3', esp: 'Granel agrícola', calado: '13.0 m', estadoMantenimiento: false, poligono: [[11.2454, -74.2154]] },
          { id: 'SM-4', dbId: '4', esp: 'Granel agrícola', calado: '13.0 m', estadoMantenimiento: false, poligono: [[11.2456, -74.2156]] },
          { id: 'SM-5', dbId: '5', esp: 'Carbón', calado: '18.2 m', estadoMantenimiento: false, poligono: [[11.2458, -74.2158]] },
          { id: 'SM-6', dbId: '6', esp: 'Carbón', calado: '18.2 m', estadoMantenimiento: false, poligono: [[11.2460, -74.2160]] },
          { id: 'SM-7', dbId: '7', esp: 'Contenedores (Reefer)', calado: '14.0 m', estadoMantenimiento: false, poligono: [[11.2462, -74.2162]] }
        ]
      }
    }
  },
  TUMACO: {
    nombre: 'Tumaco',
    region: 'Pacífico',
    coordenadas: { lat: 1.806, lon: -78.764 },
    infraestructura: {
      TUMACO_PORT: {
        nombre: 'PUERTO DE TUMACO',
        alias: ['TUMACO', 'SOCIEDAD PORTUARIA DE TUMACO'],
        sub: 'PUERTO FRONTERA SUR DEL PACÍFICO',
        desc: 'Especializado en la exportación de aceite de palma, hidrocarburos y pesca.',
        unidad: 'TM HOY',
        capacidadReefer: 20,
        muelles: [
          { id: 'T-1', dbId: '1', esp: 'Granel Líquido', calado: '11.0 m', estadoMantenimiento: false, poligono: [[1.8000, -78.7500]] },
          { id: 'T-2', dbId: '2', esp: 'General / Pesca', calado: '9.0 m', estadoMantenimiento: false, poligono: [[1.8010, -78.7510]] }
        ]
      }
    }
  },
  TURBO: {
    nombre: 'Puerto Antioquia',
    region: 'Caribe (Urabá)',
    coordenadas: { lat: 8.125, lon: -76.733 },
    infraestructura: {
      PTO_ANTIOQUIA: {
        nombre: 'PUERTO ANTIOQUIA',
        alias: ['TURBO', 'PUERTO PISISI', 'PTO ANTIOQUIA', 'URABA'],
        sub: 'NUEVA PLATAFORMA LOGÍSTICA DE URABÁ',
        desc: 'Mega-terminal moderna dedicada a la agroexportación y contenedores.',
        unidad: 'TEU HOY',
        capacidadReefer: 1100,
        muelles: [
          { id: 'PA-1', dbId: '1', esp: 'Contenedores', calado: '15.0 m', estadoMantenimiento: false, poligono: [[8.1000, -76.7500]] },
          { id: 'PA-2', dbId: '2', esp: 'Granel / General', calado: '14.5 m', estadoMantenimiento: false, poligono: [[8.1012, -76.7512]] }
        ]
      }
    }
  },
  COVENAS: {
    nombre: 'Coveñas',
    region: 'Caribe',
    coordenadas: { lat: 9.421, lon: -75.681 },
    infraestructura: {
      ECOPETROL_COV: {
        nombre: 'TERMINAL DE COVEÑAS',
        alias: ['COVEÑAS', 'TLU1', 'TLU2', 'TLU 1', 'TLU 2', 'OLEODUCTO'],
        sub: 'PUERTO EXPORTADOR DE CRUDO',
        desc: 'Estación terminal marítima de carga de hidrocarburos procedentes del interior.',
        unidad: 'BLS HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'TLU-1', dbId: 'TLU1', esp: 'Petróleo / Crudos', calado: '22.0 m', estadoMantenimiento: false, poligono: [[9.4500, -75.7100]] },
          { id: 'TLU-2', dbId: 'TLU2', esp: 'Petróleo / Crudos', calado: '24.0 m', estadoMantenimiento: false, poligono: [[9.4600, -75.7200]] }
        ]
      }
    }
  },
  GUAJIRA: {
    nombre: 'La Guajira',
    region: 'Caribe',
    coordenadas: { lat: 12.215, lon: -71.971 },
    infraestructura: {
      PUERTO_BOLIVAR: {
        nombre: 'PUERTO BOLÍVAR',
        alias: ['CERREJON', 'PUERTO BOLIVAR', 'CERREJÓN'],
        sub: 'TERMINAL MINERO DE CARBÓN',
        desc: 'Puerto marítimo privado para la exportación del carbón de El Cerrejón.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'PB-1', dbId: '1', esp: 'Carbón / Granel', calado: '19.0 m', estadoMantenimiento: false, poligono: [[12.2100, -71.9650]] }
        ]
      },
      PUERTO_BRISA: {
        nombre: 'PUERTO BRISA',
        alias: ['BRISA', 'DIBULLA'],
        sub: 'PUERTO MULTIPROPÓSITO · DIBULLA',
        desc: 'Terminal multipropósito privada con alto potencial minero e industrial.',
        unidad: 'TM HOY',
        capacidadReefer: 0,
        muelles: [
          { id: 'PBR-1', dbId: '1', esp: 'Graneles / General', calado: '15.5 m', estadoMantenimiento: false, poligono: [[11.2600, -73.3700]] }
        ]
      }
    }
  }
};
