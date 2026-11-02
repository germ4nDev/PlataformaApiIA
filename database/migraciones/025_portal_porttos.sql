/*
  PORTTOS · Migración 025 · Portal público porttos.co (aprobado por el usuario el 2026-10-30)
  Qué hace (idempotente, se puede correr varias veces; no borra nada):
    1. dbo.TCL_PortalConfig                 Valores sueltos del portal (correo de contacto, ruta del login, avisos).
    2. dbo.TCL_PortalSecciones              Bloques de cada página (inicio, solucion, app, perfiles, puertos, gobierno, planes, mision,
                                            contacto), por idioma.
    3. dbo.TCL_PortalElementos              Tarjetas, pasos, cifras y enlaces dentro de una sección.
    4. dbo.TCL_PortalPlanes                 Planes y precios. Los de esta semilla son SIMULADOS (simulado = 1, fuente SIMULADOR):
       dbo.TCL_PortalPlanCaracteristicas    se reemplazan por los reales desde la administración; el portal los rotula como
       dbo.TCL_PortalComparativo            «valores de referencia» mientras simulado = 1.
       dbo.TCL_PortalComparativoValores
    5. dbo.TCL_PortalPreguntas              Preguntas frecuentes por página.
    6. dbo.TCL_PortalMensajes               Mensajes de Contáctenos (motivo, plan, puerto) para el equipo comercial.
  La semilla nunca pisa lo editado: config, planes y preguntas solo si la tabla está vacía; cada sección solo si no existe
  (pagina, codigo, idioma). Correrla de nuevo agrega lo que falte (CC-097: columna detalle y las páginas perfiles, puertos y gobierno).
  App móvil (CC-103, CC-105): urlAndroid y urlIos en la configuración (vacías hasta publicar la app), página «app» con el detalle
  y una banda que la anuncia en Inicio y Solución.
  Planes de comercialización (CC-106, usuario 2026-11-01): apagados con planesActivos = '0'; se activan con
  UPDATE dbo.TCL_PortalConfig SET valor = N'1' WHERE clave = N'planesActivos' (el API lo toma en máximo 5 minutos).
  Las cifras con {{tableros}} y {{puertos}} las calcula el API desde PTLPestanas y TCL_MaestroPuertos (datos honestos).
  El portal vive dentro de la web de la plataforma (ruta pública /websites/porttos); los enlaces que empiezan con / son rutas
  del portal (/solucion, /planes…) y la web les antepone su base. Iniciar sesión = rutaIngreso (el login de la plataforma).
  El API funciona antes de correrla: /api/portal responde 503 (MIGRACION_PENDIENTE) con el nombre de esta migración.
  Reversa: DROP de las 10 tablas TCL_Portal* (en orden inverso).
*/
SET NOCOUNT ON;
SET XACT_ABORT ON;

DECLARE @base sysname = DB_NAME();
IF @base <> N'plataformaBD'
BEGIN
  RAISERROR('Este script debe ejecutarse sobre plataformaBD y estás en %s. Cambia la base activa (USE plataformaBD).', 16, 1, @base);
  RETURN;
END

BEGIN TRANSACTION;

IF OBJECT_ID(N'dbo.TCL_PortalConfig', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalConfig (
  clave              NVARCHAR(60)   NOT NULL CONSTRAINT PK_TCL_PortalConfig PRIMARY KEY,
  valor              NVARCHAR(1000) NULL,
  descripcion        NVARCHAR(300)  NULL,
  fechaModificacion  DATETIME2(0)   NOT NULL CONSTRAINT DF_TCL_PortalConfig_fecha DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'dbo.TCL_PortalSecciones', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalSecciones (
  id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PortalSecciones PRIMARY KEY,
  pagina             NVARCHAR(40)   NOT NULL,
  codigo             NVARCHAR(60)   NOT NULL,
  idioma             NVARCHAR(5)    NOT NULL CONSTRAINT DF_TCL_PortalSecciones_idioma DEFAULT (N'es'),
  tipo               NVARCHAR(30)   NOT NULL,
  orden              INT            NOT NULL CONSTRAINT DF_TCL_PortalSecciones_orden DEFAULT (0),
  antetitulo         NVARCHAR(200)  NULL,
  titulo             NVARCHAR(400)  NULL,
  subtitulo          NVARCHAR(1500) NULL,
  cuerpo             NVARCHAR(MAX)  NULL,
  imagen             NVARCHAR(500)  NULL,
  enlaceTexto        NVARCHAR(120)  NULL,
  enlaceUrl          NVARCHAR(500)  NULL,
  activo             BIT            NOT NULL CONSTRAINT DF_TCL_PortalSecciones_activo DEFAULT (1),
  fechaModificacion  DATETIME2(0)   NOT NULL CONSTRAINT DF_TCL_PortalSecciones_fecha DEFAULT (SYSUTCDATETIME()),
  CONSTRAINT UQ_TCL_PortalSecciones UNIQUE (pagina, codigo, idioma)
);

IF OBJECT_ID(N'dbo.TCL_PortalElementos', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalElementos (
  id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PortalElementos PRIMARY KEY,
  idSeccion          INT            NOT NULL CONSTRAINT FK_TCL_PortalElementos_seccion REFERENCES dbo.TCL_PortalSecciones(id),
  orden              INT            NOT NULL CONSTRAINT DF_TCL_PortalElementos_orden DEFAULT (0),
  titulo             NVARCHAR(200)  NULL,
  texto              NVARCHAR(1500) NULL,
  detalle            NVARCHAR(1500) NULL,
  icono              NVARCHAR(60)   NULL,
  color              NVARCHAR(9)    NULL,
  valor              NVARCHAR(200)  NULL,
  enlaceUrl          NVARCHAR(500)  NULL,
  activo             BIT            NOT NULL CONSTRAINT DF_TCL_PortalElementos_activo DEFAULT (1)
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_PortalElementos_seccion')
CREATE INDEX IX_TCL_PortalElementos_seccion ON dbo.TCL_PortalElementos (idSeccion, orden);

IF OBJECT_ID(N'dbo.TCL_PortalPlanes', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalPlanes (
  codigo             NVARCHAR(40)   NOT NULL CONSTRAINT PK_TCL_PortalPlanes PRIMARY KEY,
  nombre             NVARCHAR(80)   NOT NULL,
  descripcion        NVARCHAR(500)  NULL,
  precioMensual      DECIMAL(18,2)  NULL,
  precioAnual        DECIMAL(18,2)  NULL,
  moneda             CHAR(3)        NOT NULL CONSTRAINT DF_TCL_PortalPlanes_moneda DEFAULT ('COP'),
  etiquetaPrecio     NVARCHAR(60)   NULL,
  destacado          BIT            NOT NULL CONSTRAINT DF_TCL_PortalPlanes_destacado DEFAULT (0),
  orden              INT            NOT NULL CONSTRAINT DF_TCL_PortalPlanes_orden DEFAULT (0),
  activo             BIT            NOT NULL CONSTRAINT DF_TCL_PortalPlanes_activo DEFAULT (1),
  fuente             NVARCHAR(40)   NOT NULL CONSTRAINT DF_TCL_PortalPlanes_fuente DEFAULT (N'ADMINISTRACION'),
  simulado           BIT            NOT NULL CONSTRAINT DF_TCL_PortalPlanes_simulado DEFAULT (0),
  fechaModificacion  DATETIME2(0)   NOT NULL CONSTRAINT DF_TCL_PortalPlanes_fecha DEFAULT (SYSUTCDATETIME())
);

IF OBJECT_ID(N'dbo.TCL_PortalPlanCaracteristicas', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalPlanCaracteristicas (
  id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PortalPlanCaracteristicas PRIMARY KEY,
  codigoPlan         NVARCHAR(40)   NOT NULL CONSTRAINT FK_TCL_PortalPlanCaract_plan REFERENCES dbo.TCL_PortalPlanes(codigo),
  orden              INT            NOT NULL CONSTRAINT DF_TCL_PortalPlanCaract_orden DEFAULT (0),
  texto              NVARCHAR(300)  NOT NULL,
  activo             BIT            NOT NULL CONSTRAINT DF_TCL_PortalPlanCaract_activo DEFAULT (1)
);

IF OBJECT_ID(N'dbo.TCL_PortalComparativo', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalComparativo (
  id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PortalComparativo PRIMARY KEY,
  orden              INT            NOT NULL CONSTRAINT DF_TCL_PortalComparativo_orden DEFAULT (0),
  concepto           NVARCHAR(200)  NOT NULL,
  activo             BIT            NOT NULL CONSTRAINT DF_TCL_PortalComparativo_activo DEFAULT (1)
);

IF OBJECT_ID(N'dbo.TCL_PortalComparativoValores', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalComparativoValores (
  idFila             INT            NOT NULL CONSTRAINT FK_TCL_PortalCompValores_fila REFERENCES dbo.TCL_PortalComparativo(id),
  codigoPlan         NVARCHAR(40)   NOT NULL CONSTRAINT FK_TCL_PortalCompValores_plan REFERENCES dbo.TCL_PortalPlanes(codigo),
  valor              NVARCHAR(120)  NOT NULL,
  CONSTRAINT PK_TCL_PortalComparativoValores PRIMARY KEY (idFila, codigoPlan)
);

IF OBJECT_ID(N'dbo.TCL_PortalPreguntas', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalPreguntas (
  id                 INT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PortalPreguntas PRIMARY KEY,
  pagina             NVARCHAR(40)   NOT NULL,
  idioma             NVARCHAR(5)    NOT NULL CONSTRAINT DF_TCL_PortalPreguntas_idioma DEFAULT (N'es'),
  orden              INT            NOT NULL CONSTRAINT DF_TCL_PortalPreguntas_orden DEFAULT (0),
  pregunta           NVARCHAR(300)  NOT NULL,
  respuesta          NVARCHAR(2000) NOT NULL,
  activo             BIT            NOT NULL CONSTRAINT DF_TCL_PortalPreguntas_activo DEFAULT (1)
);

IF OBJECT_ID(N'dbo.TCL_PortalMensajes', N'U') IS NULL
CREATE TABLE dbo.TCL_PortalMensajes (
  id                 BIGINT IDENTITY(1,1) NOT NULL CONSTRAINT PK_TCL_PortalMensajes PRIMARY KEY,
  fecha              DATETIME2(0)   NOT NULL CONSTRAINT DF_TCL_PortalMensajes_fecha DEFAULT (SYSUTCDATETIME()),
  motivo             NVARCHAR(40)   NOT NULL,
  codigoPlan         NVARCHAR(40)   NULL,
  nombre             NVARCHAR(120)  NOT NULL,
  empresa            NVARCHAR(160)  NULL,
  correo             NVARCHAR(160)  NOT NULL,
  telefono           NVARCHAR(40)   NULL,
  puerto             NVARCHAR(60)   NULL,
  mensaje            NVARCHAR(4000) NOT NULL,
  aceptaDatos        BIT            NOT NULL,
  estado             NVARCHAR(20)   NOT NULL CONSTRAINT DF_TCL_PortalMensajes_estado DEFAULT (N'NUEVO'),
  notificado         BIT            NOT NULL CONSTRAINT DF_TCL_PortalMensajes_notificado DEFAULT (0),
  origen             NVARCHAR(64)   NULL
);
IF NOT EXISTS (SELECT 1 FROM sys.indexes WHERE name = N'IX_TCL_PortalMensajes_fecha')
CREATE INDEX IX_TCL_PortalMensajes_fecha ON dbo.TCL_PortalMensajes (fecha DESC) INCLUDE (motivo, estado, notificado);

-- ---------------- Semilla (solo si está vacío)
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'correoContacto')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'correoContacto', N'tecnologia@porttos.co', N'Correo que recibe los mensajes de Contáctenos');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'rutaIngreso')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'rutaIngreso', N'/autenticacion/login', N'Ruta del ingreso de la plataforma: el portal vive dentro de la misma web (decisión del usuario, 2026-10-30)');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'avisoPrecios')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'avisoPrecios', N'Valores de referencia sujetos a confirmación. Precios en pesos colombianos, sin IVA.', N'Texto bajo los planes mientras los precios sean simulados');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'tiempoRespuesta')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'tiempoRespuesta', N'Respondemos en menos de 2 días hábiles', N'Promesa de respuesta en Contáctenos');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'textoPie')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'textoPie', N'Torre de control portuaria de Colombia', N'Texto del pie de página');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'urlAndroid')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'urlAndroid', NULL, N'Enlace https de la app en Google Play (CC-103). Vacío: el portal muestra «Próximamente»');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'urlIos')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'urlIos', NULL, N'Enlace https de la app en App Store (CC-103). Vacío: el portal muestra «Próximamente»');
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalConfig WHERE clave = N'planesActivos')
  INSERT INTO dbo.TCL_PortalConfig (clave, valor, descripcion) VALUES (N'planesActivos', N'0', N'Planes de comercialización: 1 = se ven (página, menú y enlaces); 0 = ocultos. La primera versión es para el Gobierno (CC-106)');

-- Columnas agregadas después de la primera corrida en local (2026-10-30, CC-097): se agregan si faltan
IF COL_LENGTH(N'dbo.TCL_PortalElementos', N'detalle') IS NULL
  ALTER TABLE dbo.TCL_PortalElementos ADD detalle NVARCHAR(1500) NULL;
-- valor guarda también el instrumento de cada nivel del sector público (OT-011): de 60 a 200 caracteres
IF COL_LENGTH(N'dbo.TCL_PortalElementos', N'valor') < 400
  ALTER TABLE dbo.TCL_PortalElementos ALTER COLUMN valor NVARCHAR(200) NULL;


-- Cada sección se inserta solo si no existe (pagina, codigo, idioma): una corrida nueva agrega lo que falte y nunca pisa lo editado
DECLARE @s INT;
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'hero', N'es', N'hero', 1, N'Torre de control portuaria de Colombia', N'Toda la operación portuaria, en una sola pantalla.', N'Porttos reúne buques, camiones, bodegas, contenedores, granel, GNL y capacidad de los puertos colombianos en tiempo real, y un analista de inteligencia artificial que avisa antes de que el problema llegue al muelle.', NULL, N'Conozca la solución', N'/solucion');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Solicitar una demostración'', NULL, NULL, NULL, NULL, NULL, N''/contacto'');', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'cifras' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'cifras', N'es', N'cifras', 2, NULL, NULL, NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, NULL, N''tableros especializados, de marítimo a GNL'', NULL, NULL, NULL, N''{{tableros}}'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, NULL, N''puertos del país en un mismo selector'', NULL, NULL, NULL, N''{{puertos}}'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, NULL, N''en vivo por socket: GNL, alertas y radar'', NULL, NULL, NULL, N''24/7'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, NULL, N''pantallas con el mismo tablero: web, tableta y teléfono'', NULL, NULL, NULL, N''3'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'resuelve' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'resuelve', N'es', N'tarjetas', 3, N'Qué resuelve Porttos', N'La información del puerto existe. El problema es que está en diez lugares distintos.', N'Capitanía, terminales, transportadores, autoridades y operadores miran cada uno su parte. Porttos la junta, la ordena y la vuelve decisiones.', NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Una sola torre de control'', N''Diez tableros conectados a las mismas fuentes, con el layout que cada usuario arma y guarda.'', NULL, N''cuadricula'', N''#4C9BFF'', N''Información dispersa'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Del fondeo al gate, a la vista'', N''Line-up, buques en fondeo, cola de camiones y citas del Virtual Gate en tiempo real, por puerto y por terminal.'', NULL, N''barco'', N''#F28A3C'', N''Esperas y congestión'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Un analista de IA que avisa antes'', N''Alertas tempranas por turno, resúmenes del día y un asistente que responde preguntas sobre la operación.'', NULL, N''estrella'', N''#2ED8B6'', N''Decisiones tardías'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Fuentes oficiales, datos honestos'', N''DIMAR, Supertransporte, AIS y TomTom. Si un dato no llega, Porttos lo dice; si es simulado, lo rotula.'', NULL, N''escudo'', N''#FFB64D'', N''Datos sin respaldo'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'tableros' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'tableros', N'es', N'tableros', 4, N'Los tableros', N'Cada carga, cada eslabón, su propio tablero.', NULL, NULL, N'Ver la solución completa', N'/solucion');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Marítimo'', N''Line-up, fondeo, terminales y productividad'', NULL, N''barco'', N''#00BCD4'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Virtual Gate'', N''Citas, cola y camiones a 10 km'', NULL, N''camion'', N''#FFB64D'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Bodegas'', N''Ocupación, entradas y salidas'', NULL, N''bodega'', N''#4099FF'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Contenedores'', N''Patio, reefer y free time vencido'', NULL, N''contenedor'', N''#2ED8B6'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 5, N''Granel'', N''Avance de descargue por terminal'', NULL, N''granel'', N''#2ED8B6'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 6, N''Carga suelta'', N''Break-bulk, proyecto y Ro-Ro'', NULL, N''suelta'', N''#FFB64D'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 7, N''GNL'', N''Telemetría en vivo, presión y temperatura'', NULL, N''gnl'', N''#FF5370'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 8, N''Capacidad'', N''Ocupación de terminales, patios y depósitos'', NULL, N''capacidad'', N''#00BCD4'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 9, N''Noticias y corredores'', N''Estado de las vías de acceso y noticias del sector'', NULL, N''noticias'', N''#4099FF'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 10, N''Mapa logístico'', N''Buques, flota, geocercas y alertas en un mapa'', NULL, N''mapa'', N''#FF5370'', NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'movil' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'movil', N'es', N'destacado', 5, N'Web, tableta y teléfono', N'El mismo tablero en el escritorio y en el muelle.', N'Lo que el usuario arma en la web aparece igual en la tableta y se reacomoda en el teléfono: indicadores arriba, de a dos, y el resto uno por fila. Con alertas push y una sola sesión por usuario.', NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''GNL, alertas y radar en vivo'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Analista IA a un toque'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Mapa con geocercas y alertas'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'cta' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'cta', N'es', N'cta', 7, NULL, N'Vea su puerto en Porttos.', N'Le mostramos los tableros con los datos de su puerto y le ayudamos a escoger el plan que corresponde a su operación.', NULL, N'Solicitar una demostración', N'/contacto');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Ver planes y precios'', NULL, NULL, NULL, NULL, NULL, N''/planes'');', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'hero', N'es', N'hero', 1, N'La solución', N'Una torre de control para todo el puerto: del buque en fondeo al camión en la vía.', N'Porttos conecta las fuentes oficiales y operativas de cada puerto, las valida y las presenta en tableros que cada usuario organiza a su medida, con la misma información en la web, la tableta y el teléfono.', NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'como' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'como', N'es', N'pasos', 2, NULL, N'Cómo funciona', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Fuentes'', N''DIMAR, Supertransporte, señal AIS, TomTom, clima y mareas, y la ingesta de terminales y operadores.'', NULL, NULL, NULL, N''01'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Validación'', N''Cada dato se normaliza por puerto, se fecha y se marca con su origen. Lo que falta, se dice.'', NULL, NULL, NULL, N''02'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Torre de control'', N''Indicadores, reglas de alerta y el analista de IA trabajan sobre los mismos datos, en vivo.'', NULL, NULL, NULL, N''03'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Web, tableta y teléfono'', N''El tablero de cada usuario, igual en todas las pantallas, con alertas push en el teléfono.'', NULL, NULL, NULL, N''04'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'tableros' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'tableros', N'es', N'tableros', 3, NULL, N'Diez tableros, una operación', N'Cada tablero se elige por puerto y se arma con los widgets que el usuario necesita.', NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Marítimo'', N''Line-up de motonaves, buques en fondeo y atracados, ETA frente a ATA, ocupación de muelles por terminal, productividad por hora, toneladas movidas hoy y reportes operativos.'', NULL, N''barco'', N''#00BCD4'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Virtual Gate'', N''Citas de las próximas 12 horas, camiones en puerto y en cola, distribución en un radio de 10 km, pesaje y alertas de congestión.'', NULL, N''camion'', N''#FFB64D'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Bodegas'', N''Ocupación por bodega, flujo de entradas y salidas de 24 horas y 7 días, movimientos y tipo de carga almacenada.'', NULL, N''bodega'', N''#4099FF'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Contenedores'', N''Inventario en patio, llenos y vacíos, reefer conectados, contenedores con free time vencido y vacíos por devolver.'', NULL, N''contenedor'', N''#2ED8B6'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 5, N''Granel'', N''Avance de descargue de las graneleras por terminal, toneladas del día y mezcla de productos agrícolas, minerales y líquidos.'', NULL, N''granel'', N''#2ED8B6'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 6, N''Carga suelta'', N''Break-bulk, carga de proyecto, paletizada y vehículos Ro-Ro, con su inventario y avance de operación.'', NULL, N''suelta'', N''#FFB64D'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 7, N''GNL'', N''Telemetría en vivo de cada brazo: flujo, presión en tacómetro, temperatura criogénica, BOG, nivel de tanques y energía transferida.'', NULL, N''gnl'', N''#FF5370'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 8, N''Capacidad'', N''Ocupación de terminales, patios, depósitos de vacíos y zonas de inspección, con tendencia de las últimas horas.'', NULL, N''capacidad'', N''#00BCD4'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 9, N''Noticias y corredores'', N''Estado de las vías de acceso a cada puerto con eventos viales reales, y las noticias del sector portuario.'', NULL, N''noticias'', N''#4099FF'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 10, N''Mapa logístico'', N''Buques por estado, flota terrestre, eventos viales, faros y geocercas, con las alertas del motor en el punto donde ocurren y la reproducción de las últimas horas.'', NULL, N''mapa'', N''#FF5370'', NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'capacidades' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'capacidades', N'es', N'tarjetas', 4, NULL, N'Lo que trae cada tablero', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Analista de IA'', N''Revisa cada turno, detecta riesgos temprano, resume el día y responde preguntas sobre la operación.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Alertas en vivo'', N''Atraques, zarpes, fondeos prolongados, geocercas, ocupación de muelles y eventos viales, en el mapa y en el teléfono.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Tablero a la medida'', N''Cada usuario arrastra, agranda y guarda sus widgets; la tableta respeta su diseño y el teléfono lo reacomoda.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Todos los puertos'', N''Un selector cambia el puerto en todos los tableros; nada está atado a un solo puerto.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 5, N''Datos honestos'', N''Cada cifra dice de dónde viene. Lo que aún no llega se muestra como simulado, rotulado, y se reemplaza solo cuando aparece el dato real.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 6, N''Seguridad'', N''Roles y permisos por pestaña y widget, sesión única por usuario y acceso cifrado.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'fuentes' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'fuentes', N'es', N'lista', 5, NULL, N'Fuentes que respaldan cada cifra', N'Porttos se conecta a fuentes públicas y operativas y se prepara para recibir las de cada terminal.', NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''DIMAR · naves avisadas y arribos'', NULL, NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Supertransporte · datos abiertos'', NULL, NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''AIS · posición de los buques'', NULL, NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''TomTom · eventos viales'', NULL, NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 5, N''Clima y mareas'', NULL, NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 6, N''Terminales y operadores · ingesta por API'', NULL, NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'cta' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'cta', N'es', N'cta', 6, NULL, N'¿Quiere verlo con los datos de su puerto?', NULL, NULL, N'Solicitar una demostración', N'/contacto');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Planes y precios'', NULL, NULL, NULL, NULL, NULL, N''/planes'');', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'planes' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'planes', N'hero', N'es', N'hero', 1, N'Planes y precios', N'Un plan para cada tamaño de operación.', N'Todos incluyen web, tableta y teléfono, los diez tableros y los datos de fuentes oficiales. Cambian el alcance, los usuarios y las integraciones.', NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'mision' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'mision', N'hero', N'es', N'hero', 1, N'Quiénes somos', N'Creemos que un puerto que se ve completo decide mejor.', NULL, NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'mision' AND codigo = N'mision' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'mision', N'mision', N'es', N'texto', 2, NULL, N'Misión', NULL, N'Integrar en una sola torre de control la información de la operación portuaria de Colombia —buques, carga, transporte terrestre y capacidad— para que autoridades, terminales y operadores tomen decisiones oportunas con datos confiables y de origen conocido.', NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'mision' AND codigo = N'vision' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'mision', N'vision', N'es', N'texto', 3, NULL, N'Visión', NULL, N'Ser la plataforma de referencia para la gestión de la cadena logística portuaria de Colombia, presente en todos sus puertos y conectada con las fuentes oficiales del país.', NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'mision' AND codigo = N'valores' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'mision', N'valores', N'es', N'tarjetas', 4, NULL, N'Lo que nos guía', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Datos honestos'', N''Ningún valor inventado. Si un dato no llega, se dice; si es simulado, se rotula.'', NULL, NULL, N''#F28A3C'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Oportunidad'', N''Lo importante es saber a tiempo: en vivo, con alertas tempranas y en el teléfono.'', NULL, NULL, N''#7DB6FF'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Todos los puertos'', N''La misma herramienta para el puerto grande y el pequeño, del Pacífico al Caribe.'', NULL, NULL, N''#2ED8B6'', NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Colaboración'', N''Autoridades, terminales y transportadores mirando la misma información.'', NULL, NULL, N''#FFB64D'', NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'mision' AND codigo = N'cita' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'mision', N'cita', N'es', N'cta', 5, NULL, N'«Cada buque en fondeo, cada camión en cola y cada contenedor vencido es una decisión que llegó tarde.»', NULL, NULL, N'Conversemos', N'/contacto');
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'contacto' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'contacto', N'hero', N'es', N'hero', 1, N'Contáctenos', N'Hablemos de su puerto.', N'Cuéntenos qué operación quiere ver y le preparamos una demostración con sus datos. El acceso a la plataforma se da con un plan y después de una aprobación: solicítelo aquí.', NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'perfiles' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'perfiles', N'hero', N'es', N'hero', 1, N'Para quién es Porttos', N'Cada actor del puerto mira su parte. Porttos les da la misma información.', N'Encuentre su perfil: qué decisiones toma con Porttos, qué tableros usa y qué plan le corresponde.', NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'perfiles' AND codigo = N'perfiles' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'perfiles', N'perfiles', N'es', N'perfiles', 2, NULL, NULL, NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Sector público'', N''Todos los puertos en un tablero nacional, alertas tempranas y series para decidir.'', N''Ver la cadena completa a tiempo y medir las metas de la política logística.'', N''gobierno'', N''#F28A3C'', N''Sector público'', N''/gobierno'');', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Sociedades portuarias y terminales'', N''Ocupación de muelles, productividad por hora, line-up y alertas de su terminal.'', N''Muelles, patios y bodegas que se saturan sin aviso.'', N''barco'', N''#00BCD4'', N''PUERTO'', N''/planes'');', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Operadores logísticos, navieras y agencias'', N''Line-up, ETA frente a ATA, free time y varios puertos en una sola pantalla.'', N''Esperas en fondeo, ETA que cambian y contenedores que vencen.'', N''contenedor'', N''#4099FF'', N''OPERADOR'', N''/planes'');', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Transportadores y generadores de carga'', N''Citas, cola, distribución a 10 km y estado de las vías de acceso.'', N''Colas en el gate y corredores bloqueados que nadie avisa.'', N''camion'', N''#FFB64D'', N''PUERTO'', N''/planes'');', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 5, N''Gremios del sector'', N''Indicadores comparables por puerto y por mes, con su fuente.'', N''Discusiones sin cifras comunes entre puertos y actores.'', N''capacidad'', N''#2ED8B6'', N''CORPORATIVO'', N''/planes'');', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'perfiles' AND codigo = N'cta' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'perfiles', N'cta', N'es', N'cta', 3, NULL, N'¿No ve su caso?', N'Cuéntenos qué operación sigue y le mostramos los tableros que le sirven, con los datos de su puerto.', NULL, N'Solicitar una demostración', N'/contacto');
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'puertos' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'puertos', N'hero', N'es', N'hero', 1, N'Puertos en vivo', N'Así están hoy los puertos de Colombia.', N'Solo datos públicos y oficiales: vías de acceso, tráfico portuario reportado a Supertransporte, clima y marea. La operación completa de cada puerto está en la plataforma.', NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'puertos' AND codigo = N'plataforma' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'puertos', N'plataforma', N'es', N'lista', 2, NULL, N'En la plataforma, además', NULL, NULL, N'Solicitar una demostración', N'/contacto');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Buques en fondeo, atracados y line-up'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Citas y cola del Virtual Gate'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Bodegas, patios y contenedores'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Alertas tempranas y analista de IA'', NULL, NULL, N''check'', NULL, NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'gobierno' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'gobierno', N'hero', N'es', N'hero', 1, N'Sector público', N'Una torre de control portuaria para el país, lista para un piloto.', N'Porttos puede darle al Estado una vista continua de la operación de los puertos, con datos oficiales donde existen, para medir y bajar los tiempos y costos logísticos sin construir un sistema desde cero.', NULL, N'Agendar una reunión técnica', N'/contacto');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Ver puertos en vivo'', NULL, NULL, NULL, NULL, NULL, N''/puertos'');', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'gobierno' AND codigo = N'metas' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'gobierno', N'metas', N'es', N'metas', 2, N'Las metas del país', N'La Política Nacional Logística fijó la meta. Porttos puede ayudar a medirla todos los días.', N'Metas del CONPES 3982 de 2020 hacia 2030.', N'Fuente: Documento CONPES 3982 de 2020, Política Nacional Logística.', NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Tiempo portuario de importación'', N''Espera en fondeo, atraque y gate, medibles en vivo con los datos de cada puerto'', N''230 h'', NULL, NULL, N''48 h'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Tiempo portuario de exportación'', N''Line-up, ETA frente a ATA y cola de camiones'', N''156 h'', NULL, NULL, N''48 h'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Costo logístico sobre las ventas'', N''Productividad, saturación y corredores'', N''13,5 %'', NULL, NULL, N''9,5 %'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'gobierno' AND codigo = N'niveles' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'gobierno', N'niveles', N'es', N'niveles', 3, N'Cómo participar', N'Tres formas de trabajar con el Estado, de menor a mayor alcance.', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Usuario institucional'', N''Tablero nacional, alertas tempranas, analista de IA e informes para política pública.'', N''Usa Porttos para seguir todos los puertos del país.'', NULL, NULL, N''Licencia institucional o compra pública de tecnología e innovación'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Aliado de datos'', N''Esos datos ordenados, cruzados y en vivo, y un observatorio público con indicadores por puerto.'', N''Da acceso formal a la información que hoy no es abierta: naves, citas, cargue y vías.'', N''destacado'', NULL, N''Convenio de intercambio de información o memorando de entendimiento'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Socio de país'', N''Una plataforma nacional con gobernanza pública de los datos y costos compartidos.'', N''Impulsa una torre de control logística nacional con todos los actores.'', NULL, NULL, N''Esquema por definir con asesoría jurídica (por ejemplo, asociación público-privada)'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'gobierno' AND codigo = N'ruta' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'gobierno', N'ruta', N'es', N'pasos', 4, N'Hoja de ruta propuesta', N'Empezamos con un piloto de 90 días, sin costo para la entidad.', NULL, N'Fechas de referencia, sujetas al acuerdo con cada entidad.', NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Acuerdo'', N''Contraparte técnica · Memorando de entendimiento · Indicadores acordados'', NULL, NULL, NULL, N''Nov a dic 2026'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Piloto de 90 días'', N''1 o 2 entidades · 1 o 2 puertos · Informe de cierre'', NULL, N''destacado'', NULL, N''Ene a mar 2027'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Aliado de datos'', N''Convenio de datos · Observatorio público · Todos los puertos'', NULL, NULL, NULL, N''Abr a sep 2027'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Socio de país'', N''Torre logística nacional · Gobernanza pública · Costos compartidos'', NULL, NULL, NULL, N''Desde oct 2027'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'gobierno' AND codigo = N'confianza' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'gobierno', N'confianza', N'es', N'tarjetas', 5, NULL, N'Reglas claras sobre los datos', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''La entidad decide'', N''Qué se comparte, con quién y qué se publica en el observatorio.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Cada actor ve lo suyo'', N''Permisos por rol, tablero y widget; la información de un operador no se expone a otro.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Datos honestos'', N''Cada cifra dice su origen; lo que no llega se rotula y se reemplaza al llegar el dato oficial.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Igualdad de acceso'', N''Los indicadores públicos quedan disponibles para todos los actores en las mismas condiciones.'', NULL, NULL, NULL, NULL, NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'gobierno' AND codigo = N'cta' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'gobierno', N'cta', N'es', N'cta', 6, NULL, N'Hablemos de un piloto con su entidad.', N'Una contraparte técnica, un memorando y 90 días para medir resultados.', NULL, N'Agendar una reunión técnica', N'/contacto');
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'publico' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'publico', N'es', N'destacado', 6, N'Sector público', N'Una aliada para las metas logísticas del país.', N'La Política Nacional Logística busca llevar los tiempos portuarios a 48 horas hacia 2030. Porttos puede medirlos todos los días en cada puerto que comparta sus datos.', NULL, N'Ver la propuesta', N'/gobierno');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Puertos en vivo'', NULL, NULL, NULL, NULL, NULL, N''/puertos'');', N'@s INT', @s = @s;
END
-- App móvil (usuario, CC-103 y CC-105): la app de tienda tiene su propia página «app»; Inicio y Solución solo la anuncian (banda).
-- Solo lo que la app ya hace; lo que aún no (push, iPhone) se dice como «Próximamente» o «vendrá después».
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'app' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'inicio', N'app', N'es', N'destacado', 5, N'App móvil', N'Lleve Porttos a donde vaya.', N'Una app para teléfono y tableta, descargada desde la tienda, con el mismo tablero, las alertas y el analista de IA de la web.', NULL, N'Conozca la app', N'/app');
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'solucion' AND codigo = N'app' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'solucion', N'app', N'es', N'destacado', 6, N'App móvil', N'La torre de control también va en el bolsillo.', N'La app para teléfono y tableta lleva los tableros, las alertas y el analista de IA a quien decide en el muelle, en la vía o en el camino.', NULL, N'Conozca la app móvil', N'/app');
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'app' AND codigo = N'hero' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'app', N'hero', N'es', N'hero', 1, N'App móvil', N'Porttos en el bolsillo.', N'Una aplicación para teléfono y tableta, descargada desde la tienda, con el mismo tablero, las mismas alertas y el mismo analista de IA que usa en la web.', NULL, NULL, NULL);
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'app' AND codigo = N'ventajas' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'app', N'ventajas', N'es', N'app', 2, N'Qué es', N'Una app instalada, no la página web en el teléfono.', N'Abre con huella o rostro, recuerda su puerto y tiene una navegación pensada para el teléfono y la tableta. Los datos son los mismos de la plataforma, en vivo.', N'Se ingresa con el mismo usuario de la plataforma. Primero llega a Android; la versión para iPhone y iPad vendrá después.', NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Su tablero, igual que en la web'', N''El layout que cada usuario guarda en la web llega a la app: en la tableta con el mismo diseño y en el teléfono reacomodado.'', NULL, N''cuadricula'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Mapa logístico a pantalla completa'', N''Buques por estado, flota, geocercas, faros y eventos viales, con las alertas en el punto donde ocurren.'', NULL, N''mapa'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Alertas de la operación'', N''La bandeja de alertas del puerto en vivo, sin esperar a estar frente al computador.'', NULL, N''campana'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Analista y asistente de IA'', N''El análisis de cada turno y un asistente al que se le pregunta por la operación con palabras sencillas.'', NULL, N''estrella'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 5, N''Todos los puertos en un selector'', N''Se cambia de puerto desde el menú y todos los tableros se actualizan.'', NULL, N''barco'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 6, N''Ingreso con huella o rostro'', N''Después del primer ingreso, la app abre con la biometría del equipo. Una sola sesión por usuario.'', NULL, N''huella'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 7, N''Vertical u horizontal'', N''En el teléfono y en la tableta, en la orientación que resulte más cómoda.'', NULL, N''rotar'', NULL, NULL, NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 8, N''Notificaciones push'', N''Avisos en el teléfono aunque la app esté cerrada.'', NULL, N''telefono'', NULL, N''Próximamente'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'app' AND codigo = N'dispositivos' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'app', N'dispositivos', N'es', N'tarjetas', 3, N'Teléfono y tableta', N'Cada pantalla, a su medida.', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Teléfono'', N''Los indicadores arriba, de a dos, y el resto de widgets uno por fila. La barra inferior lleva a tablero, alertas, asistente y ajustes.'', NULL, N''telefono'', N''#F28A3C'', N''Una columna'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Tableta'', N''Respeta la disposición del tablero que cada usuario guardó en la web, con el selector de puerto arriba, como en el escritorio.'', NULL, N''cuadricula'', N''#4C9BFF'', N''El diseño de la web'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Una sola sesión'', N''Una sesión activa por usuario: si entra desde otro equipo, la anterior se cierra. Después del primer ingreso, la app abre con huella o rostro.'', NULL, N''escudo'', N''#2ED8B6'', N''Seguridad'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'app' AND codigo = N'empezar' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'app', N'empezar', N'es', N'pasos', 4, NULL, N'Cómo empezar', NULL, NULL, NULL, NULL);
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Descargue la app'', N''Desde Google Play en Android. La versión para iPhone y iPad vendrá después.'', NULL, NULL, NULL, N''01'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 2, N''Ingrese con su usuario'', N''El mismo usuario y la misma clave de la plataforma web; no hay registro aparte.'', NULL, NULL, NULL, N''02'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 3, N''Elija el puerto'', N''Desde el menú lateral; todos los tableros cambian a ese puerto.'', NULL, NULL, NULL, N''03'', NULL);', N'@s INT', @s = @s;
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 4, N''Active la huella o el rostro'', N''Para entrar más rápido las siguientes veces.'', NULL, NULL, NULL, N''04'', NULL);', N'@s INT', @s = @s;
END
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'app' AND codigo = N'cta' AND idioma = N'es')
BEGIN
  INSERT INTO dbo.TCL_PortalSecciones (pagina, codigo, idioma, tipo, orden, antetitulo, titulo, subtitulo, cuerpo, enlaceTexto, enlaceUrl)
    VALUES (N'app', N'cta', N'es', N'cta', 5, NULL, N'¿Su equipo aún no tiene acceso?', N'El acceso a la app viene con su plan de Porttos. Escríbanos y le ayudamos a activarlo.', NULL, N'Solicitar acceso', N'/contacto?motivo=ACCESO');
  SET @s = SCOPE_IDENTITY();
  EXEC sp_executesql N'INSERT INTO dbo.TCL_PortalElementos (idSeccion, orden, titulo, texto, detalle, icono, color, valor, enlaceUrl) VALUES (@s, 1, N''Ver planes'', NULL, NULL, NULL, NULL, NULL, N''/planes'');', N'@s INT', @s = @s;
END
-- La banda del sector público va antes del cierre de Inicio (solo si el cierre conserva su orden de la semilla)
UPDATE dbo.TCL_PortalSecciones SET orden = 7 WHERE pagina = N'inicio' AND codigo = N'cta' AND idioma = N'es' AND orden = 6;

-- Textos sin afirmar medición en vivo de hoy en todos los puertos (usuario, CC-099: fondeo, gate y line-up aún son SIMULADOS).
-- Solo si la fila conserva el texto de la semilla anterior: lo editado a mano no se toca.
UPDATE dbo.TCL_PortalSecciones
  SET titulo = N'Una torre de control portuaria para el país, lista para un piloto.',
      subtitulo = N'Porttos puede darle al Estado una vista continua de la operación de los puertos, con datos oficiales donde existen, para medir y bajar los tiempos y costos logísticos sin construir un sistema desde cero.'
  WHERE pagina = N'gobierno' AND codigo = N'hero' AND idioma = N'es'
    AND titulo = N'Una torre de control portuaria para el país, funcionando hoy.'
    AND subtitulo = N'Porttos le da al Estado una vista continua de la operación de los puertos para medir y bajar los tiempos y costos logísticos, sin construir un sistema desde cero.';
UPDATE dbo.TCL_PortalSecciones
  SET titulo = N'La Política Nacional Logística fijó la meta. Porttos puede ayudar a medirla todos los días.'
  WHERE pagina = N'gobierno' AND codigo = N'metas' AND idioma = N'es'
    AND titulo = N'La Política Nacional Logística fijó la meta. Porttos ayuda a medirla todos los días.';
EXEC sp_executesql N'UPDATE e SET texto = N''Espera en fondeo, atraque y gate, medibles en vivo con los datos de cada puerto''
  FROM dbo.TCL_PortalElementos e JOIN dbo.TCL_PortalSecciones s ON s.id = e.idSeccion
  WHERE s.pagina = N''gobierno'' AND s.codigo = N''metas'' AND s.idioma = N''es'' AND e.texto = N''Espera en fondeo, atraque y gate, medidos en vivo'';';
UPDATE dbo.TCL_PortalSecciones
  SET subtitulo = N'La Política Nacional Logística busca llevar los tiempos portuarios a 48 horas hacia 2030. Porttos puede medirlos todos los días en cada puerto que comparta sus datos.'
  WHERE pagina = N'inicio' AND codigo = N'publico' AND idioma = N'es'
    AND subtitulo = N'La Política Nacional Logística busca llevar los tiempos portuarios a 48 horas hacia 2030. Porttos los mide todos los días, en todos los puertos.';

-- App móvil (CC-103). Solo si la fila conserva lo de la semilla: lo editado a mano no se toca.
-- La sección «app» reemplaza a la antigua «movil» de Inicio (se desactiva, no se borra) y la de Solución va antes de su cierre.
UPDATE dbo.TCL_PortalSecciones SET activo = 0
  WHERE pagina = N'inicio' AND codigo = N'movil' AND idioma = N'es' AND activo = 1
    AND titulo = N'El mismo tablero en el escritorio y en el muelle.'
    AND EXISTS (SELECT 1 FROM dbo.TCL_PortalSecciones WHERE pagina = N'inicio' AND codigo = N'app' AND idioma = N'es' AND activo = 1);
UPDATE dbo.TCL_PortalSecciones SET orden = 7 WHERE pagina = N'solucion' AND codigo = N'cta' AND idioma = N'es' AND orden = 6;
-- Las push aún no están activas (falta Firebase): el paso 4 de «Cómo funciona» no las afirma.
EXEC sp_executesql N'UPDATE e SET texto = N''El tablero de cada usuario, igual en todas las pantallas, con la app para teléfono y tableta.''
  FROM dbo.TCL_PortalElementos e JOIN dbo.TCL_PortalSecciones s ON s.id = e.idSeccion
  WHERE s.pagina = N''solucion'' AND s.codigo = N''como'' AND s.idioma = N''es''
    AND e.texto = N''El tablero de cada usuario, igual en todas las pantallas, con alertas push en el teléfono.'';';

-- Quien ya corrió la 025 del CC-103: las secciones «app» de Inicio y Solución pasan a banda con enlace a la página «app» (CC-105).
-- Solo si conservan el texto de la semilla del CC-103; sus ventajas se desactivan (no se borran: viven en la página «app»).
EXEC sp_executesql N'UPDATE e SET activo = 0
  FROM dbo.TCL_PortalElementos e JOIN dbo.TCL_PortalSecciones s ON s.id = e.idSeccion
  WHERE s.pagina IN (N''inicio'', N''solucion'') AND s.codigo = N''app'' AND s.idioma = N''es'' AND s.tipo = N''app''
    AND s.titulo IN (N''Lleve Porttos a donde vaya.'', N''Porttos va con usted, en el teléfono y en la tableta.'');';
UPDATE dbo.TCL_PortalSecciones
  SET tipo = N'destacado', cuerpo = NULL, enlaceTexto = N'Conozca la app', enlaceUrl = N'/app',
      subtitulo = N'Una app para teléfono y tableta, descargada desde la tienda, con el mismo tablero, las alertas y el analista de IA de la web.'
  WHERE pagina = N'inicio' AND codigo = N'app' AND idioma = N'es' AND tipo = N'app' AND titulo = N'Lleve Porttos a donde vaya.';
UPDATE dbo.TCL_PortalSecciones
  SET tipo = N'destacado', cuerpo = NULL, enlaceTexto = N'Conozca la app móvil', enlaceUrl = N'/app',
      titulo = N'La torre de control también va en el bolsillo.',
      subtitulo = N'La app para teléfono y tableta lleva los tableros, las alertas y el analista de IA a quien decide en el muelle, en la vía o en el camino.'
  WHERE pagina = N'solucion' AND codigo = N'app' AND idioma = N'es' AND tipo = N'app' AND titulo = N'Porttos va con usted, en el teléfono y en la tableta.';

IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalPlanes)
BEGIN
  INSERT INTO dbo.TCL_PortalPlanes (codigo, nombre, descripcion, precioMensual, precioAnual, moneda, etiquetaPrecio, destacado, orden, fuente, simulado)
    VALUES (N'PUERTO', N'Puerto', N'Para una terminal o una autoridad que sigue un solo puerto.', 3500000, 37800000, 'COP', NULL, 0, 1, N'SIMULADOR', 1);
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'PUERTO', 1, N'1 puerto');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'PUERTO', 2, N'Hasta 10 usuarios');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'PUERTO', 3, N'Los 10 tableros y el mapa logístico');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'PUERTO', 4, N'App para tableta y teléfono');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'PUERTO', 5, N'Soporte por correo');
  INSERT INTO dbo.TCL_PortalPlanes (codigo, nombre, descripcion, precioMensual, precioAnual, moneda, etiquetaPrecio, destacado, orden, fuente, simulado)
    VALUES (N'OPERADOR', N'Operador', N'Para operadores logísticos y navieras que trabajan en varios puertos.', 9500000, 102600000, 'COP', NULL, 1, 2, N'SIMULADOR', 1);
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'OPERADOR', 1, N'Hasta 3 puertos');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'OPERADOR', 2, N'Hasta 40 usuarios');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'OPERADOR', 3, N'Todo lo del plan Puerto');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'OPERADOR', 4, N'Analista de IA y asistente');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'OPERADOR', 5, N'Alertas push y reglas por puerto');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'OPERADOR', 6, N'Soporte en horario laboral');
  INSERT INTO dbo.TCL_PortalPlanes (codigo, nombre, descripcion, precioMensual, precioAnual, moneda, etiquetaPrecio, destacado, orden, fuente, simulado)
    VALUES (N'CORPORATIVO', N'Corporativo', N'Para gremios, entidades y grupos con operación en todo el país.', NULL, NULL, 'COP', N'A la medida', 0, 3, N'SIMULADOR', 1);
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'CORPORATIVO', 1, N'Todos los puertos del maestro');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'CORPORATIVO', 2, N'Usuarios sin límite');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'CORPORATIVO', 3, N'Todo lo del plan Operador');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'CORPORATIVO', 4, N'Ingesta por API de sus propios sistemas');
  INSERT INTO dbo.TCL_PortalPlanCaracteristicas (codigoPlan, orden, texto) VALUES (N'CORPORATIVO', 5, N'Acompañamiento y soporte dedicado');
  DECLARE @f INT;
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (1, N'Puertos'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'1');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Hasta 3');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Todos');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (2, N'Usuarios'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'Hasta 10');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Hasta 40');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Sin límite');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (3, N'Diez tableros y mapa logístico'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (4, N'App para tableta y teléfono'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (5, N'Analista de IA y asistente'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'—');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (6, N'Alertas push y reglas por puerto'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'—');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (7, N'Ingesta por API de sus sistemas'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'—');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'—');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Sí');
  INSERT INTO dbo.TCL_PortalComparativo (orden, concepto) VALUES (8, N'Soporte'); SET @f = SCOPE_IDENTITY();
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'PUERTO', N'Correo');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'OPERADOR', N'Horario laboral');
  INSERT INTO dbo.TCL_PortalComparativoValores (idFila, codigoPlan, valor) VALUES (@f, N'CORPORATIVO', N'Dedicado');
END

IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalPreguntas)
BEGIN
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'planes', 1, N'¿Puedo probar Porttos antes de contratar?', N'Sí. Agendamos una demostración con los datos de su puerto.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'planes', 2, N'¿De dónde salen los datos?', N'De fuentes oficiales y operativas (DIMAR, Supertransporte, AIS, TomTom) y de la ingesta de cada terminal. Cada cifra muestra su origen; lo que aún no llega se rotula como simulado.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'planes', 3, N'¿Cómo obtengo acceso?', N'El acceso se da con un plan contratado y después de una aprobación; no hay registro abierto. Escríbanos desde Contáctenos con el motivo «Solicitar acceso con un plan».');
END

-- Preguntas de la página «app» (CC-105): solo si esa página aún no tiene preguntas
IF NOT EXISTS (SELECT 1 FROM dbo.TCL_PortalPreguntas WHERE pagina = N'app')
BEGIN
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'app', 1, N'¿Necesito un usuario distinto para la app?', N'No. Se ingresa con el mismo usuario y la misma clave de la plataforma web; los permisos y los tableros son los mismos.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'app', 2, N'¿La app tiene costo adicional?', N'No. Todos los planes incluyen la web, la tableta y el teléfono.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'app', 3, N'¿Hay versión para iPhone y iPad?', N'Todavía no. La app llega primero a Android; la versión para iPhone y iPad vendrá después.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'app', 4, N'¿Puedo tener la sesión abierta en la web y en la app al mismo tiempo?', N'No. Porttos permite una sola sesión activa por usuario: al entrar en un equipo, la sesión del otro se cierra.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'app', 5, N'¿La app es lo mismo que abrir la web en el teléfono?', N'No. Es una aplicación instalada: abre con huella o rostro, recuerda su puerto y tiene su propia navegación. Desde el navegador del teléfono, porttos.co muestra este portal informativo.');
  INSERT INTO dbo.TCL_PortalPreguntas (pagina, orden, pregunta, respuesta) VALUES (N'app', 6, N'¿Recibiré notificaciones?', N'Las alertas se ven en vivo dentro de la app. Las notificaciones push, con la app cerrada, llegarán próximamente.');
END

COMMIT TRANSACTION;
PRINT 'Migración 025 aplicada: portal Porttos (tablas TCL_Portal* y contenido inicial; planes simulados).';
