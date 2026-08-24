// src/utils/diccionarios.js

const DICCIONARIO_HOMOLOGACION_ETL = {
  // ==========================================
  // ZONA PACÍFICO
  // ==========================================

  // --- BUENAVENTURA ---
  'sprbun': 'SPRBUN',
  'sprb': 'SPRBUN',
  'spbun': 'SPRBUN', // Typo clásico
  'sociedad portuaria de buenaventura': 'SPRBUN',
  'soc portuaria regional': 'SPRBUN',
  'regional de buenaventura': 'SPRBUN',

  'tcbuen': 'TCBUEN',
  'tbc': 'TCBUEN',
  'tcb': 'TCBUEN',
  'terminal de contenedores de buenaventura': 'TCBUEN',

  'spia': 'SPIA',
  'puerto aguadulce': 'SPIA',
  'aguadulce': 'SPIA',
  'agua dulce': 'SPIA',

  'compas - cascajal': 'COMPASCASCAJAL',
  'compas cascajal': 'COMPASCASCAJAL',
  'cascajal': 'COMPASCASCAJAL',

  'compas - aguadulce': 'COMPASAGD',
  'compas aguadulce': 'COMPASAGD',
  'compas - agu dulce': 'COMPASAGD',
  'compas  agua dulce': 'COMPASAGD',
  'compas - agu': 'COMPASAGD',

  'grupo portuario': 'GRUPOPORT',
  'muelle 13': 'GRUPOPORT',
  'm-13': 'GRUPOPORT',

  // --- TUMACO ---
  'tumaco': 'TUMACO_PORT',
  'sociedad portuaria de tumaco': 'TUMACO_PORT',
  'puerto de tumaco': 'TUMACO_PORT',

  // ==========================================
  // ZONA CARIBE
  // ==========================================

  // --- CARTAGENA ---
  'sprc': 'SPRC',
  'sociedad portuaria de cartagena': 'SPRC',
  'sprc manga': 'SPRC',
  'puerto de cartagena': 'SPRC',
  'manga': 'SPRC',

  'contecar': 'CONTECAR',
  'terminal de contenedores': 'CONTECAR',
  'contecar mamonal': 'CONTECAR',
  'contecar s.a.': 'CONTECAR',

  'compas bosque': 'COMPAS_BOSQUE',
  'puerto el bosque': 'COMPAS_BOSQUE',
  'compas el bosque': 'COMPAS_BOSQUE',
  'compas - el bosque': 'COMPAS_BOSQUE',

  'sociedad portuaria puerto bahia': 'PUERTO_BAHIA',
  'pto bahia': 'PUERTO_BAHIA',
  'puerto bahia': 'PUERTO_BAHIA',
  'puerto bahía': 'PUERTO_BAHIA',

  // --- BARRANQUILLA ---
  'sprb_baq': 'SPRB', // Diferenciador vs Buenaventura
  'sociedad portuaria de barranquilla': 'SPRB',
  'portuaria barranquilla': 'SPRB',
  'sprbun_baq': 'SPRB',

  'palermo': 'PALERMO',
  'palermo soc portuaria': 'PALERMO',
  'palermo sociedad portuaria': 'PALERMO',

  'compas barranquilla': 'COMPAS_BARRANQUILLA',
  'compas - barranquilla': 'COMPAS_BARRANQUILLA',

  // --- SANTA MARTA ---
  'spsm': 'SPSM',
  'puerto santa marta': 'SPSM',
  'sociedad portuaria de santa marta': 'SPSM',
  'puerto de santa marta': 'SPSM',

  // --- URABÁ / TURBO ---
  'turbo': 'PTO_ANTIOQUIA',
  'puerto antioquia': 'PTO_ANTIOQUIA',
  'puerto antioquía': 'PTO_ANTIOQUIA',
  'puerto pisisi': 'PTO_ANTIOQUIA',
  'pto antioquia': 'PTO_ANTIOQUIA',
  'uraba': 'PTO_ANTIOQUIA',
  'urabá': 'PTO_ANTIOQUIA',

  // --- COVEÑAS ---
  'coveñas': 'ECOPETROL_COV',
  'covenas': 'ECOPETROL_COV',
  'terminal de coveñas': 'ECOPETROL_COV',
  'tlu1': 'ECOPETROL_COV',
  'tlu2': 'ECOPETROL_COV',
  'tlu 1': 'ECOPETROL_COV',
  'tlu 2': 'ECOPETROL_COV',
  'oleoducto': 'ECOPETROL_COV',

  // --- LA GUAJIRA ---
  'cerrejon': 'PUERTO_BOLIVAR',
  'cerrejón': 'PUERTO_BOLIVAR',
  'puerto bolivar': 'PUERTO_BOLIVAR',
  'puerto bolívar': 'PUERTO_BOLIVAR',

  'brisa': 'PUERTO_BRISA',
  'puerto brisa': 'PUERTO_BRISA',
  'dibulla': 'PUERTO_BRISA'
};

module.exports = { DICCIONARIO_HOMOLOGACION_ETL };