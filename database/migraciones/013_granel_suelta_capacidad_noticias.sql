/*
  PORTTOS · Migración 013 · Pestañas Granel, Carga suelta, Capacidad y Noticias
  Qué hace (idempotente, se puede correr varias veces):
    1. Operación de buques por segmento (granel y Ro-Ro) y su avance por hora:
         TCL_OperacionesBuque, TCL_AvanceOperacionBuque
    2. Equipos portuarios (aspiradores, grúas, cintas, SPMT...), compartidos por granel y carga suelta:
         TCL_EquiposPortuarios
    3. Carga suelta (break-bulk y project cargo) e inventario de vehículos por patio y marca:
         TCL_CargaSuelta, TCL_InventarioVehiculos
    4. Capacidad: catálogo de nodos operativos que NO son bodegas (las bodegas siguen en TCL_MaestroBodegas)
       y fotos de ocupación con tráfico de entrada y salida: TCL_CapacidadNodos, TCL_OcupacionNodos
    5. Noticias e indicadores: TCL_Noticias, TCL_IndicadoresMercado, TCL_FuentesInformacion
    6. Catálogo inicial: nodos de Buenaventura (de la maqueta del tablero; capacidades de referencia, a validar
       con cada operador) y fuentes oficiales, gremiales y de medios.
    7. Widgets de las 4 pestañas en PTLWidgetsMaestro (inicial = 1: forman el layout base) con los roles de un
       widget de referencia.
  Toda fila de operación lleva 'fuente' (INGESTA_API, ARCHIVO, SIMULADOR, CATALOGO_REFERENCIA...) y 'simulado'.
  'codigo_externo' es el identificador en el sistema de la terminal: la ingesta hace upsert por (id_puerto, codigo_externo).
  Fechas en NVARCHAR(100) ISO 8601 UTC, como el resto de Porttos.
  El API funciona antes de correrla: los tableros responden 503 (MIGRACION_PENDIENTE) y los procesos se apagan solos.
  Reversa: DROP de las 10 tablas y
           DELETE FROM PTLWidgetsRoles / PTLWidgetsMaestro WHERE codigoUsuarioCreacion = 'MIGRACION_013'.
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

DECLARE @ahora NVARCHAR(100) = FORMAT(SYSUTCDATETIME(), 'yyyy-MM-dd\THH:mm:ss.fff\Z');

BEGIN TRANSACTION;

-- 1. Operación de buques --------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.TCL_OperacionesBuque', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_OperacionesBuque (
    id_operacion        BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_OperacionesBuque PRIMARY KEY,
    id_puerto           NVARCHAR(50)  NOT NULL,
    id_terminal         NVARCHAR(50)  NULL,
    terminal            NVARCHAR(120) NULL,      -- nombre visible (la ingesta puede no conocer el id)
    codigo_muelle       NVARCHAR(50)  NULL,
    motonave            NVARCHAR(100) NOT NULL,
    mmsi                NVARCHAR(20)  NULL,
    naviera             NVARCHAR(120) NULL,
    segmento            NVARCHAR(20)  NOT NULL,  -- GRANEL | RORO
    tipo                NVARCHAR(20)  NOT NULL,  -- AGRICOLA | MINERAL | LIQUIDO | VEHICULOS
    producto            NVARCHAR(80)  NULL,
    sentido             NVARCHAR(20)  NOT NULL CONSTRAINT DF_TCL_OperacionesBuque_sentido DEFAULT (N'IMPORTACION'),
    unidad              NVARCHAR(10)  NOT NULL,  -- TM | UNIDADES
    cantidad_total      DECIMAL(14,2) NOT NULL,
    cantidad_operada    DECIMAL(14,2) NOT NULL CONSTRAINT DF_TCL_OperacionesBuque_operada DEFAULT (0),
    eta                 NVARCHAR(100) NULL,
    fecha_inicio        NVARCHAR(100) NULL,
    fecha_fin_estimada  NVARCHAR(100) NULL,
    fecha_fin           NVARCHAR(100) NULL,
    estado              NVARCHAR(20)  NOT NULL,  -- PROGRAMADA | FONDEADA | OPERANDO | SUSPENDIDA | TERMINADA
    codigo_externo      NVARCHAR(80)  NOT NULL,
    fuente              NVARCHAR(30)  NOT NULL,
    simulado            BIT           NOT NULL CONSTRAINT DF_TCL_OperacionesBuque_simulado DEFAULT (0),
    fechaCreacion       NVARCHAR(100) NOT NULL,
    fechaModificacion   NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_TCL_OperacionesBuque_externo UNIQUE (id_puerto, codigo_externo),
    CONSTRAINT CK_TCL_OperacionesBuque_segmento CHECK (segmento IN (N'GRANEL', N'RORO'))
  );
  CREATE INDEX IX_TCL_OperacionesBuque_Puerto_Estado ON dbo.TCL_OperacionesBuque (id_puerto, segmento, estado);
  PRINT N'✔ TCL_OperacionesBuque';
END

IF OBJECT_ID(N'dbo.TCL_AvanceOperacionBuque', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_AvanceOperacionBuque (
    id            BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_AvanceOperacionBuque PRIMARY KEY,
    id_operacion  BIGINT        NOT NULL,
    id_puerto     NVARCHAR(50)  NOT NULL,
    segmento      NVARCHAR(20)  NOT NULL,
    hora          NVARCHAR(100) NOT NULL,          -- inicio de la hora, ISO (2026-10-19T14:00:00.000Z)
    cantidad      DECIMAL(14,2) NOT NULL,          -- TM o unidades operadas en esa hora
    fuente        NVARCHAR(30)  NOT NULL,
    simulado      BIT           NOT NULL CONSTRAINT DF_TCL_AvanceOperacionBuque_simulado DEFAULT (0),
    CONSTRAINT UQ_TCL_AvanceOperacionBuque UNIQUE (id_operacion, hora)
  );
  CREATE INDEX IX_TCL_AvanceOperacionBuque_Puerto_Hora ON dbo.TCL_AvanceOperacionBuque (id_puerto, segmento, hora) INCLUDE (cantidad, id_operacion);
  PRINT N'✔ TCL_AvanceOperacionBuque';
END

-- 2. Equipos portuarios ---------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.TCL_EquiposPortuarios', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_EquiposPortuarios (
    id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_EquiposPortuarios PRIMARY KEY,
    id_puerto           NVARCHAR(50)  NOT NULL,
    codigo_equipo       NVARCHAR(30)  NOT NULL,
    tipo                NVARCHAR(30)  NOT NULL,  -- ASPIRADOR | GRUA_MOVIL | CINTA | VOLQUETA | SPMT | CAMA_BAJA | MONTACARGAS
    descripcion         NVARCHAR(120) NULL,
    terminal            NVARCHAR(120) NULL,
    segmento            NVARCHAR(20)  NOT NULL,  -- GRANEL | CARGA_SUELTA | RORO | MULTI
    capacidad_tmh       DECIMAL(10,2) NULL,      -- rendimiento nominal
    capacidad_ton       DECIMAL(10,2) NULL,      -- capacidad de izaje
    estado              NVARCHAR(20)  NOT NULL,  -- OPERANDO | LIBRE | EN_RUTA | MANTENIMIENTO
    id_operacion        BIGINT        NULL,      -- operación de buque asignada
    folio_carga_suelta  NVARCHAR(30)  NULL,
    motonave            NVARCHAR(100) NULL,
    producto            NVARCHAR(80)  NULL,
    rendimiento_tmh     DECIMAL(10,2) NULL,      -- rendimiento actual
    fuente              NVARCHAR(30)  NOT NULL,
    simulado            BIT           NOT NULL CONSTRAINT DF_TCL_EquiposPortuarios_simulado DEFAULT (0),
    fechaModificacion   NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_TCL_EquiposPortuarios UNIQUE (id_puerto, codigo_equipo)
  );
  PRINT N'✔ TCL_EquiposPortuarios';
END

-- 3. Carga suelta y vehículos ---------------------------------------------------------------------
IF OBJECT_ID(N'dbo.TCL_CargaSuelta', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_CargaSuelta (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_CargaSuelta PRIMARY KEY,
    id_puerto           NVARCHAR(50)  NOT NULL,
    folio               NVARCHAR(30)  NOT NULL,
    clase               NVARCHAR(20)  NOT NULL,  -- BREAK_BULK | PROJECT_CARGO
    producto            NVARCHAR(120) NOT NULL,
    cliente             NVARCHAR(120) NULL,
    motonave            NVARCHAR(100) NULL,
    naviera             NVARCHAR(120) NULL,
    terminal            NVARCHAR(120) NULL,
    sentido             NVARCHAR(20)  NOT NULL CONSTRAINT DF_TCL_CargaSuelta_sentido DEFAULT (N'IMPORTACION'),
    bultos              INT           NULL,
    bultos_recibidos    INT           NULL,
    tm                  DECIMAL(12,2) NULL,
    peso_unitario_tm    DECIMAL(10,2) NULL,
    dimensiones         NVARCHAR(60)  NULL,
    equipo_requerido    NVARCHAR(60)  NULL,
    ubicacion           NVARCHAR(120) NULL,
    requiere_permiso    BIT           NOT NULL CONSTRAINT DF_TCL_CargaSuelta_permiso DEFAULT (0),
    permiso_aprobado    BIT           NULL,
    estado              NVARCHAR(20)  NOT NULL,  -- PROGRAMADO | EN_DESCARGA | EN_CARGUE | EN_PATIO | ESPERA_PERMISO | DESPACHADO
    fecha_programada    NVARCHAR(100) NULL,
    codigo_externo      NVARCHAR(80)  NOT NULL,
    fuente              NVARCHAR(30)  NOT NULL,
    simulado            BIT           NOT NULL CONSTRAINT DF_TCL_CargaSuelta_simulado DEFAULT (0),
    fechaCreacion       NVARCHAR(100) NOT NULL,
    fechaModificacion   NVARCHAR(100) NOT NULL,
    CONSTRAINT UQ_TCL_CargaSuelta_externo UNIQUE (id_puerto, codigo_externo)
  );
  CREATE INDEX IX_TCL_CargaSuelta_Puerto_Estado ON dbo.TCL_CargaSuelta (id_puerto, clase, estado);
  PRINT N'✔ TCL_CargaSuelta';
END

IF OBJECT_ID(N'dbo.TCL_InventarioVehiculos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_InventarioVehiculos (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_InventarioVehiculos PRIMARY KEY,
    id_puerto           NVARCHAR(50)  NOT NULL,
    id_nodo             NVARCHAR(50)  NOT NULL,  -- patio (TCL_CapacidadNodos.id_nodo, categoría PATIO_PDI)
    marca               NVARCHAR(60)  NOT NULL,
    flujo               NVARCHAR(20)  NOT NULL,  -- IMPORTACION | EXPORTACION
    unidades            INT           NOT NULL,
    dias_promedio       DECIMAL(6,1)  NULL,      -- estadía media en patio
    fecha_corte         NVARCHAR(100) NOT NULL,
    fuente              NVARCHAR(30)  NOT NULL,
    simulado            BIT           NOT NULL CONSTRAINT DF_TCL_InventarioVehiculos_simulado DEFAULT (0),
    CONSTRAINT UQ_TCL_InventarioVehiculos UNIQUE (id_puerto, id_nodo, marca, flujo)
  );
  PRINT N'✔ TCL_InventarioVehiculos';
END

-- 4. Capacidad ------------------------------------------------------------------------------------
IF OBJECT_ID(N'dbo.TCL_CapacidadNodos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_CapacidadNodos (
    id_puerto             NVARCHAR(50)  NOT NULL,
    id_nodo               NVARCHAR(50)  NOT NULL,
    nombre                NVARCHAR(150) NOT NULL,
    categoria             NVARCHAR(30)  NOT NULL,  -- TERMINAL | PATIO_CONTENEDOR | DEPOT_VACIOS | PATIO_PDI | PATIO_BREAKBULK
    operador              NVARCHAR(150) NULL,
    unidad_capacidad      NVARCHAR(10)  NOT NULL,  -- TEU | TON | UNIDADES | M2
    capacidad             DECIMAL(14,2) NOT NULL,
    descripcion_capacidad NVARCHAR(150) NULL,
    operaciones           NVARCHAR(400) NULL,      -- separadas por '|'
    id_terminal           NVARCHAR(50)  NULL,
    id_infraestructura    INT           NULL,
    activo                BIT           NOT NULL CONSTRAINT DF_TCL_CapacidadNodos_activo DEFAULT (1),
    fuente                NVARCHAR(30)  NOT NULL,
    fechaModificacion     NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_TCL_CapacidadNodos PRIMARY KEY (id_puerto, id_nodo)
  );
  PRINT N'✔ TCL_CapacidadNodos';
END

IF OBJECT_ID(N'dbo.TCL_OcupacionNodos', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_OcupacionNodos (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_OcupacionNodos PRIMARY KEY,
    id_puerto           NVARCHAR(50)  NOT NULL,
    id_nodo             NVARCHAR(50)  NOT NULL,  -- de TCL_CapacidadNodos o 'BOD-<id_bodega>' para bodegas
    fecha               NVARCHAR(100) NOT NULL,
    ocupacion           DECIMAL(14,2) NULL,      -- en la unidad de capacidad del nodo
    ocupacion_pct       DECIMAL(5,1)  NOT NULL,
    ingresos_h          INT           NULL,      -- camiones por hora
    salidas_h           INT           NULL,
    espera_min          INT           NULL,
    fuente              NVARCHAR(30)  NOT NULL,
    simulado            BIT           NOT NULL CONSTRAINT DF_TCL_OcupacionNodos_simulado DEFAULT (0)
  );
  CREATE INDEX IX_TCL_OcupacionNodos_Puerto_Fecha ON dbo.TCL_OcupacionNodos (id_puerto, fecha)
    INCLUDE (id_nodo, ocupacion, ocupacion_pct, ingresos_h, salidas_h, espera_min, simulado);
  PRINT N'✔ TCL_OcupacionNodos';
END

-- 5. Noticias, indicadores y fuentes --------------------------------------------------------------
IF OBJECT_ID(N'dbo.TCL_Noticias', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_Noticias (
    id                  BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_Noticias PRIMARY KEY,
    id_hash             NVARCHAR(64)   NOT NULL,  -- sha1 del título normalizado: evita repetidos entre proveedores
    titulo              NVARCHAR(400)  NOT NULL,
    resumen             NVARCHAR(1000) NULL,
    url                 NVARCHAR(1000) NOT NULL,
    medio               NVARCHAR(150)  NULL,
    proveedor           NVARCHAR(20)   NOT NULL,  -- GOOGLE_NEWS | GNEWS
    categoria           NVARCHAR(30)   NOT NULL,  -- PUERTOS | TRANSPORTE | CARRETERAS | COMERCIO_EXTERIOR | GREMIOS
    id_puerto           NVARCHAR(50)   NULL,      -- si menciona un puerto
    relevancia          INT            NOT NULL CONSTRAINT DF_TCL_Noticias_relevancia DEFAULT (0),
    fecha_publicacion   NVARCHAR(100)  NOT NULL,
    fecha_ingesta       NVARCHAR(100)  NOT NULL,
    CONSTRAINT UQ_TCL_Noticias_hash UNIQUE (id_hash)
  );
  CREATE INDEX IX_TCL_Noticias_Fecha ON dbo.TCL_Noticias (fecha_publicacion DESC) INCLUDE (categoria, id_puerto, relevancia);
  PRINT N'✔ TCL_Noticias';
END

IF OBJECT_ID(N'dbo.TCL_IndicadoresMercado', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_IndicadoresMercado (
    codigo              NVARCHAR(20)  NOT NULL,  -- TRM
    fecha               NVARCHAR(100) NOT NULL,  -- vigencia
    valor               DECIMAL(18,4) NOT NULL,
    unidad              NVARCHAR(20)  NOT NULL,
    fuente              NVARCHAR(60)  NOT NULL,
    fecha_ingesta       NVARCHAR(100) NOT NULL,
    CONSTRAINT PK_TCL_IndicadoresMercado PRIMARY KEY (codigo, fecha)
  );
  PRINT N'✔ TCL_IndicadoresMercado';
END

IF OBJECT_ID(N'dbo.TCL_FuentesInformacion', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.TCL_FuentesInformacion (
    id                  INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_FuentesInformacion PRIMARY KEY,
    grupo               NVARCHAR(40)  NOT NULL,  -- OFICIAL | TRANSPORTE | COMERCIO_INDUSTRIA | GOBIERNO_MEDIOS
    nombre              NVARCHAR(120) NOT NULL,
    descripcion         NVARCHAR(200) NULL,
    url                 NVARCHAR(400) NOT NULL,
    orden               INT           NOT NULL CONSTRAINT DF_TCL_FuentesInformacion_orden DEFAULT (0),
    activo              BIT           NOT NULL CONSTRAINT DF_TCL_FuentesInformacion_activo DEFAULT (1),
    CONSTRAINT UQ_TCL_FuentesInformacion_url UNIQUE (url)
  );
  PRINT N'✔ TCL_FuentesInformacion';
END

-- 6. Catálogo inicial -----------------------------------------------------------------------------
MERGE dbo.TCL_FuentesInformacion AS d
USING (VALUES
  (N'OFICIAL', N'Supertransporte · Tráfico portuario', N'Boletines oficiales de carga', N'https://www.supertransporte.gov.co/index.php/superintendencia-delegada-de-puertos/estadisticas-trafico-portuario-en-colombia/', 1),
  (N'OFICIAL', N'INVÍAS · Estado de la red vial', N'Emergencias y cierres', N'https://www.invias.gov.co/', 2),
  (N'OFICIAL', N'DIMAR · Autoridad marítima', N'Avisos a navegantes y condiciones', N'https://www.dimar.mil.co/', 3),
  (N'OFICIAL', N'Banco de la República · TRM', N'Tasa oficial diaria', N'https://www.banrep.gov.co/es/estadisticas/trm', 4),
  (N'OFICIAL', N'IDEAM · Pronóstico y alertas', N'Clima, mareas y alertas tempranas', N'https://ideam.gov.co/', 5),
  (N'TRANSPORTE', N'Colfecar', N'Transporte de carga', N'https://www.colfecar.org.co/', 1),
  (N'TRANSPORTE', N'ACC · Camioneros', N'Carga', N'https://www.acc.org.co/', 2),
  (N'TRANSPORTE', N'Fedetranscarga', N'Carga', N'https://fedetranscarga.org/', 3),
  (N'TRANSPORTE', N'Defencarga', N'Carga', N'https://www.defencarga.org/', 4),
  (N'TRANSPORTE', N'Asecarga', N'Carga', N'https://asecarga.org/', 5),
  (N'TRANSPORTE', N'ATC', N'Transportadores', N'https://www.atc.org.co/', 6),
  (N'COMERCIO_INDUSTRIA', N'ANDI', N'Industria', N'https://www.andi.com.co/', 1),
  (N'COMERCIO_INDUSTRIA', N'Analdex', N'Comercio exterior', N'https://www.analdex.org/', 2),
  (N'COMERCIO_INDUSTRIA', N'Fenalco', N'Comercio', N'https://www.fenalco.com.co/', 3),
  (N'COMERCIO_INDUSTRIA', N'CCI', N'Infraestructura', N'https://www.infraestructura.org.co/', 4),
  (N'COMERCIO_INDUSTRIA', N'Acopi', N'Pymes', N'https://www.acopi.org.co/', 5),
  (N'COMERCIO_INDUSTRIA', N'Cámara Marítima', N'Marítimo', N'https://www.camaramaritima.org.co/', 6),
  (N'GOBIERNO_MEDIOS', N'Min. Transporte', N'Gobierno', N'https://www.mintransporte.gov.co/', 1),
  (N'GOBIERNO_MEDIOS', N'Supertransporte', N'Gobierno', N'https://www.supertransporte.gov.co/', 2),
  (N'GOBIERNO_MEDIOS', N'DNP', N'Planeación', N'https://www.dnp.gov.co/', 3),
  (N'GOBIERNO_MEDIOS', N'Portafolio', N'Economía', N'https://www.portafolio.co/', 4),
  (N'GOBIERNO_MEDIOS', N'La República', N'Economía', N'https://www.larepublica.co/', 5),
  (N'GOBIERNO_MEDIOS', N'Forbes Colombia', N'Medio', N'https://forbes.co/', 6)
) AS o (grupo, nombre, descripcion, url, orden)
ON d.url = o.url
WHEN NOT MATCHED THEN INSERT (grupo, nombre, descripcion, url, orden) VALUES (o.grupo, o.nombre, o.descripcion, o.url, o.orden);
PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' fuentes de información');

-- Nodos de Buenaventura (sin bodegas: esas viven en TCL_MaestroBodegas)
DECLARE @bun NVARCHAR(50) = (SELECT TOP (1) CAST(id_puerto AS NVARCHAR(50)) FROM dbo.TCL_MaestroPuertos
                             WHERE UPPER(nombre) LIKE N'%BUENAVENTURA%' OR UPPER(CAST(id_puerto AS NVARCHAR(50))) LIKE N'%BUENAVENTURA%');
IF @bun IS NULL
  PRINT N'⚠ No se encontró Buenaventura en TCL_MaestroPuertos: el catálogo de nodos no se cargó';
ELSE
BEGIN
  MERGE dbo.TCL_CapacidadNodos AS d
  USING (VALUES
    (N'TER-SPRBUN', N'SPRBUN', N'TERMINAL', N'Soc. Portuaria Regional Buenaventura', N'TEU', 57000, N'13 muelles · 171k TEU/trimestre', N'Contenedores (M1-8)|Multipropósito (M9)|Granel sólido (M10-12)|Líquidos (M14)'),
    (N'TER-TCBUEN', N'TCBUEN', N'TERMINAL', N'Terminal de Contenedores de Buenaventura', N'TEU', 34000, N'8 muelles · 102k TEU/trimestre', N'Atraque|Descarga buque|Cargue buque|FCL|Transbordo|Reefer'),
    (N'TER-SPIA', N'Puerto Aguadulce (SPIA)', N'TERMINAL', N'Soc. Puerto Industrial Aguadulce', N'TEU', 51000, N'2 puestos · 154k TEU/trimestre · 16 m', N'Contenedores|Reefer|FCL'),
    (N'TER-COMPAS-CAS', N'COMPAS Cascajal', N'TERMINAL', N'Compañía de Puertos Asociados (COMPAS)', N'TON', 47200, N'47.200 t · 10,5 m · acceso férreo', N'Granel sólido|Granos|Subproductos'),
    (N'TER-COMPAS-AGD', N'COMPAS Aguadulce', N'TERMINAL', N'Compañía de Puertos Asociados (COMPAS)', N'TON', 80000, N'hasta 80.000 t · 15 m', N'Granel alimenticio|Minerales|Carbón|Vehículos|Carga general'),
    (N'TER-GRUPOPORT', N'Grupo Portuario (M13)', N'TERMINAL', N'Grupo Portuario S.A.', N'TON', 20000, N'1 muelle multipropósito · 12 m', N'Carga general|Multipropósito|Break-bulk|Proyecto'),
    (N'PAT-TCB-N', N'Patio Norte TCBUEN', N'PATIO_CONTENEDOR', N'TCBUEN', N'TEU', 12400, NULL, N'Storage import|Storage export|Reefer|Inspección DIAN'),
    (N'PAT-SPR-S', N'Patio Sur SPRBUN', N'PATIO_CONTENEDOR', N'SPRBUN', N'TEU', 9800, NULL, N'Storage import|Storage export|FCL'),
    (N'PAT-AGD', N'Patio Aguadulce', N'PATIO_CONTENEDOR', N'Aguadulce', N'TEU', 8200, NULL, N'Storage import|Storage export|Reefer'),
    (N'PAT-SPR-N', N'Patio Norte SPRBUN', N'PATIO_CONTENEDOR', N'SPRBUN', N'TEU', 6500, NULL, N'Storage export|Reefer|Consolidación'),
    (N'PAT-TCB-S', N'Patio Sur TCBUEN', N'PATIO_CONTENEDOR', N'TCBUEN', N'TEU', 7800, NULL, N'Storage import|Transbordo'),
    (N'PAT-AGD-RF', N'Patio reefer Aguadulce', N'PATIO_CONTENEDOR', N'Aguadulce', N'TEU', 1200, N'1.200 TEU reefer', N'Reefer|Conexión eléctrica|Inspección'),
    (N'PAT-SPR-RF', N'Patio reefer SPRBUN', N'PATIO_CONTENEDOR', N'SPRBUN', N'TEU', 980, N'980 TEU reefer', N'Reefer|Conexión eléctrica'),
    (N'PAT-TCB-IMO', N'Patio IMO TCBUEN', N'PATIO_CONTENEDOR', N'TCBUEN', N'TEU', 420, N'420 TEU IMO', N'Mercancías peligrosas|IMDG|Inspección DIMAR'),
    (N'DEP-CONTECAR', N'Depot CONTECAR', N'DEPOT_VACIOS', N'CONTECAR', N'TEU', 8200, NULL, N'Devolución vacío|Reparación|Limpieza|Inspección'),
    (N'DEP-OPL', N'Depot OPL', N'DEPOT_VACIOS', N'Operadores Portuarios Ltda', N'TEU', 5400, NULL, N'Devolución vacío|Reparación|Limpieza'),
    (N'DEP-BUEN', N'Depot BUEN-LOG', N'DEPOT_VACIOS', N'Buenaventura Logística', N'TEU', 6800, NULL, N'Devolución vacío|Reparación|Limpieza|Pre-trip inspection'),
    (N'DEP-CARP', N'Depot CARPATIO', N'DEPOT_VACIOS', N'Carpatio SAS', N'TEU', 4200, NULL, N'Devolución vacío|Reparación'),
    (N'DEP-ALT', N'Patio alterno', N'DEPOT_VACIOS', N'Asociación de patios', N'TEU', 9800, NULL, N'Devolución vacío|Almacenamiento prolongado'),
    (N'DEP-PAC', N'Depot Pacífico', N'DEPOT_VACIOS', N'Pacífico Container', N'TEU', 3600, NULL, N'Devolución vacío|Reparación|Limpieza|Lavado'),
    (N'PDI-01', N'Patio PDI 01', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 450, NULL, N'PDI vehículos|Storage Ro-Ro|Trasiego niñeras|Inspección DIAN'),
    (N'PDI-02', N'Patio PDI 02', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 340, NULL, N'PDI vehículos|Storage Ro-Ro|Nacionalización'),
    (N'PDI-03', N'Patio PDI 03', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 250, NULL, N'PDI vehículos|Storage Ro-Ro'),
    (N'PDI-04', N'Patio PDI 04', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 210, NULL, N'PDI vehículos|Storage Ro-Ro'),
    (N'PDI-05', N'Patio PDI 05', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 250, NULL, N'PDI vehículos|Storage Ro-Ro|Vehículos eléctricos'),
    (N'PDI-EXP', N'Patio export vehículos', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 230, NULL, N'Exportación|Pre-embarque'),
    (N'PDI-PES', N'Patio pesados (buses y maquinaria)', N'PATIO_PDI', N'Aguadulce', N'UNIDADES', 62, NULL, N'Buses|Maquinaria amarilla|Pesados'),
    (N'PB-N', N'Patio break-bulk Norte', N'PATIO_BREAKBULK', N'SPRBUN', N'M2', 8500, N'8.500 m²', N'Acero estructural|Tubería|Cobre|Bobinas'),
    (N'PB-PRJ', N'Patio project cargo', N'PATIO_BREAKBULK', N'Aguadulce', N'M2', 5200, N'5.200 m²', N'Maquinaria pesada|Generadores|Aspas eólicas|Transformadores')
  ) AS o (id_nodo, nombre, categoria, operador, unidad, capacidad, descripcion, operaciones)
  ON d.id_puerto = @bun AND d.id_nodo = o.id_nodo
  WHEN NOT MATCHED THEN INSERT (id_puerto, id_nodo, nombre, categoria, operador, unidad_capacidad, capacidad, descripcion_capacidad, operaciones, fuente, fechaModificacion)
    VALUES (@bun, o.id_nodo, o.nombre, o.categoria, o.operador, o.unidad, o.capacidad, o.descripcion, o.operaciones, N'CATALOGO_REFERENCIA', @ahora);
  PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' nodos de capacidad para ', @bun, N' (capacidades de referencia: validar con cada operador)');
END

-- 7. Widgets de las 4 pestañas -------------------------------------------------------------------
DECLARE @referencia NVARCHAR(200) = (SELECT TOP (1) codigoWidget FROM dbo.PTLWidgetsMaestro
                                      WHERE codigoWidget IN (N'PTT_BOD_PANEL_SATURACION', N'PTT_CONT_KPI_CARGADOS') ORDER BY codigoWidget);
IF @referencia IS NULL
  SELECT TOP (1) @referencia = codigoWidget FROM dbo.PTLWidgetsMaestro WHERE codigoWidget LIKE N'PTT[_]%' ORDER BY codigoWidget;

DECLARE @w TABLE (pestana NVARCHAR(200), codigo NVARCHAR(200), nombre NVARCHAR(150), descripcion NVARCHAR(4000), cols INT, filas INT, x INT, y INT);
INSERT INTO @w VALUES
  -- Granel
  (N'TLC_GRANEL_001', N'PTT_GRA_KPI_AGRICOLA', N'Granel agrícola', N'Toneladas de granel agrícola operadas hoy (maíz, soya, trigo, cebada).', 3, 2, 0, 0),
  (N'TLC_GRANEL_001', N'PTT_GRA_KPI_MINERAL', N'Granel mineral', N'Toneladas de granel mineral operadas hoy (clinker, carbón, fertilizantes).', 3, 2, 3, 0),
  (N'TLC_GRANEL_001', N'PTT_GRA_KPI_LIQUIDO', N'Granel líquido', N'Toneladas de granel líquido operadas hoy (aceites, químicos, melaza).', 3, 2, 6, 0),
  (N'TLC_GRANEL_001', N'PTT_GRA_KPI_EQUIPOS', N'Equipos de granel en uso', N'Aspiradores, grúas y cintas operando frente al total.', 3, 2, 9, 0),
  (N'TLC_GRANEL_001', N'PTT_GRA_TAB_MOTONAVES', N'Motonaves graneleras activas', N'Operación de cada motonave granelera: producto, toneladas y avance.', 8, 3, 0, 2),
  (N'TLC_GRANEL_001', N'PTT_GRA_CHRT_PRODUCTO', N'Distribución por producto', N'Toneladas en operación por producto.', 4, 3, 8, 2),
  (N'TLC_GRANEL_001', N'PTT_GRA_TAB_EQUIPOS', N'Equipos de descarga', N'Asignación de aspiradores, grúas, cintas y volquetas.', 8, 3, 0, 5),
  (N'TLC_GRANEL_001', N'PTT_GRA_PANEL_BODEGAS', N'Bodegas de granel', N'Saturación de las bodegas de granel con semáforo.', 4, 3, 8, 5),
  (N'TLC_GRANEL_001', N'PTT_GRA_CHRT_TENDENCIA', N'Tendencia de granel 24 h', N'Toneladas por hora en las últimas 24 horas y hora pico.', 6, 3, 0, 8),
  (N'TLC_GRANEL_001', N'PTT_GRA_CHRT_HISTORICO', N'Histórico mensual de granel', N'Granel sólido, líquido y carbón por mes (Supertransporte).', 6, 3, 6, 8),
  -- Carga suelta y vehículos
  (N'TLC_SUELTA_001', N'PTT_SUE_KPI_BREAKBULK', N'Break-bulk activo', N'Toneladas de carga suelta en operación (acero, madera, papel, cobre).', 3, 2, 0, 0),
  (N'TLC_SUELTA_001', N'PTT_SUE_KPI_PROYECTO', N'Project cargo', N'Bultos de proyecto activos y cuántos esperan permiso vial.', 3, 2, 3, 0),
  (N'TLC_SUELTA_001', N'PTT_SUE_KPI_VEH_IMPORT', N'Vehículos importados', N'Vehículos de importación en patios.', 3, 2, 6, 0),
  (N'TLC_SUELTA_001', N'PTT_SUE_KPI_VEH_EXPORT', N'Vehículos de exportación', N'Vehículos en parqueo pre-embarque.', 3, 2, 9, 0),
  (N'TLC_SUELTA_001', N'PTT_SUE_TAB_BREAKBULK', N'Carga suelta activa', N'Folios de break-bulk con producto, cliente, bultos y estado.', 8, 3, 0, 2),
  (N'TLC_SUELTA_001', N'PTT_SUE_CHRT_COMPOSICION', N'Composición de la carga suelta', N'Toneladas por producto.', 4, 3, 8, 2),
  (N'TLC_SUELTA_001', N'PTT_SUE_TAB_PROYECTO', N'Project cargo', N'Bultos de gran tamaño y peso: equipo requerido, permiso y estado.', 8, 3, 0, 5),
  (N'TLC_SUELTA_001', N'PTT_SUE_PANEL_INDICADORES', N'Indicadores de operación especial', N'Ritmo de descarga Ro-Ro, estadía en patio, bultos recibidos y permisos.', 4, 3, 8, 5),
  (N'TLC_SUELTA_001', N'PTT_SUE_PANEL_PATIOS', N'Patios de vehículos', N'Saturación de los patios PDI y de exportación.', 4, 3, 0, 8),
  (N'TLC_SUELTA_001', N'PTT_SUE_TAB_RORO', N'Buques Ro-Ro', N'Buques de vehículos operando y próximos.', 4, 3, 4, 8),
  (N'TLC_SUELTA_001', N'PTT_SUE_CHRT_MARCAS', N'Vehículos por marca', N'Stock en patios por marca.', 4, 3, 8, 8),
  (N'TLC_SUELTA_001', N'PTT_SUE_CHRT_HISTORICO', N'Histórico mensual de carga general', N'Toneladas de carga general por mes (Supertransporte).', 12, 3, 0, 11),
  -- Capacidad
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_KPI_NODOS', N'Nodos monitoreados', N'Terminales, patios, depots, bodegas y patios de vehículos.', 3, 2, 0, 0),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_KPI_TEU', N'Capacidad para contenedores', N'TEU de terminales, patios y depots.', 3, 2, 3, 0),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_KPI_TON', N'Capacidad de granel y suelta', N'Toneladas en bodegas y terminales graneleras.', 3, 2, 6, 0),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_KPI_CRITICOS', N'Nodos críticos', N'Nodos con 85 % o más de ocupación.', 3, 2, 9, 0),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_CHRT_SATURACION', N'Saturación por categoría', N'Ocupación promedio de cada categoría de nodo.', 6, 3, 0, 2),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_CHRT_TRAFICO', N'Tráfico de entrada y salida', N'Camiones por hora que entran y salen, por categoría.', 6, 3, 6, 2),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_TAB_NODOS', N'Catálogo de nodos operativos', N'Capacidad, ocupación, operaciones y tráfico de cada nodo.', 12, 4, 0, 5),
  (N'TLC_CAPACIDAD_001', N'PTT_CAP_CHRT_TENDENCIA', N'Ocupación en las últimas 24 h', N'Ocupación promedio por categoría, hora a hora.', 12, 3, 0, 9),
  -- Noticias
  (N'TLC_NOTICIAS', N'PTT_NOT_KPI_TRM', N'TRM hoy', N'Tasa representativa del mercado (Banco de la República vía datos.gov.co).', 3, 2, 0, 0),
  (N'TLC_NOTICIAS', N'PTT_NOT_KPI_NOTICIAS', N'Noticias de hoy', N'Noticias del sector publicadas hoy.', 3, 2, 3, 0),
  (N'TLC_NOTICIAS', N'PTT_NOT_KPI_VIAS', N'Restricciones viales', N'Eventos viales activos en los corredores del puerto.', 3, 2, 6, 0),
  (N'TLC_NOTICIAS', N'PTT_NOT_KPI_CLIMA', N'Alertas climáticas', N'Alertas climáticas oficiales activas.', 3, 2, 9, 0),
  (N'TLC_NOTICIAS', N'PTT_NOT_FEED', N'Actualidad portuaria y logística', N'Noticias de puertos, transporte, carreteras, comercio exterior y gremios.', 8, 5, 0, 2),
  (N'TLC_NOTICIAS', N'PTT_NOT_CORREDORES', N'Estado de los corredores', N'Eventos viales activos por corredor.', 4, 5, 8, 2),
  (N'TLC_NOTICIAS', N'PTT_NOT_CLIMA_PUERTOS', N'Clima de los puertos', N'Temperatura y viento en los principales puertos (Open-Meteo).', 6, 3, 0, 7),
  (N'TLC_NOTICIAS', N'PTT_NOT_FUENTES', N'Fuentes oficiales y gremiales', N'Enlaces directos a entidades, gremios y medios.', 6, 3, 6, 7);

IF @referencia IS NULL
  PRINT N'⚠ No hay widgets de referencia en PTLWidgetsMaestro: los widgets no se registraron';
ELSE
BEGIN
  INSERT INTO dbo.PTLWidgetsMaestro
    (codigoWidget, codigoTipo, codigoPestana, codigoAplicacion, codigoSuite, nombreWidget, descripcionWidget,
     imagenWidget_light, imagenWidget_dark, defaultCols, defaultRows, pos_x, pos_y, layoutVersion, inicial,
     anclajeTipo, offsetY, estadoWidget, codigoUsuarioCreacion, fechaCreacion)
  SELECT n.codigo, r.codigoTipo, n.pestana, r.codigoAplicacion, r.codigoSuite, n.nombre, n.descripcion,
         r.imagenWidget_light, r.imagenWidget_dark, n.cols, n.filas, n.x, n.y, 1, 1,
         N'RELATIVO', 0, 1, N'MIGRACION_013', @ahora
  FROM @w n
  CROSS JOIN (SELECT * FROM dbo.PTLWidgetsMaestro WHERE codigoWidget = @referencia) r
  WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsMaestro x WHERE x.codigoWidget = n.codigo);
  PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' widgets registrados (referencia: ', @referencia, N')');

  INSERT INTO dbo.PTLWidgetsRoles (codigoWidgetRole, codigoWidget, codigoRole, estadoRelacion, codigoUsuarioCreacion, fechaCreacion)
  SELECT LEFT(CONCAT(n.codigo, N'_', wr.codigoRole), 200), n.codigo, wr.codigoRole, 1, N'MIGRACION_013', @ahora
  FROM @w n
  CROSS JOIN dbo.PTLWidgetsRoles wr
  WHERE wr.codigoWidget = @referencia AND wr.estadoRelacion = 1
    AND NOT EXISTS (SELECT 1 FROM dbo.PTLWidgetsRoles x WHERE x.codigoWidget = n.codigo AND x.codigoRole = wr.codigoRole);
  PRINT CONCAT(N'✔ ', @@ROWCOUNT, N' permisos por rol copiados');
END

COMMIT TRANSACTION;

-- Pestañas que no existan en PTLPestanas (los widgets quedan registrados, pero la pestaña no se verá)
SELECT DISTINCT n.pestana AS pestana_sin_registro
FROM @w n WHERE NOT EXISTS (SELECT 1 FROM dbo.PTLPestanas p WHERE p.codigoPestana = n.pestana);

SELECT w.codigoPestana, COUNT(*) AS widgets
FROM dbo.PTLWidgetsMaestro w WHERE w.codigoUsuarioCreacion = N'MIGRACION_013'
GROUP BY w.codigoPestana;
