/*
    Author: German Valencia
    Actualización: Integración TCL, Motor Multi-Agente, Cron y Socket Helper (2026)
*/
require("dotenv").config();
const path = require("path");
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const fileUpload = require('express-fileupload');
const cors = require("cors");
const cron = require('node-cron');

// === Base de Datos y Modelos ===
const { db, sequelize } = require("./database/connection");
const { UsuarioModel } = require('./models/usuario');
const PTLUsuarios = UsuarioModel(sequelize);

// === Helpers y Servicios ===
const { setIO } = require('./helpers/socket.helper');
const { socketAuth, esModoEstricto } = require('./middlewares/socket-auth');
const { registrarSalas } = require('./sockets/salas.socket');
const SuscripcionCronService = require('./services/cron.service');
const { iniciarVigilanteSupertransporte } = require('./controllers/torre-control/dashboard/alertas.cron');
const simuladorGNL = require('./services/torre-control/gnl-telemetria.service');
const AISStreamService = require('./services/torre-control/ais-stream.service');

// ================================================
// === CONFIGURACIÓN BASE DEL SERVIDOR ===
// ================================================
const app = express();
const server = http.createServer(app);

// Orígenes permitidos (HTTP y Socket.IO). Extra: CORS_ORIGINS=https://a.com,https://b.com
const normalizarOrigen = (url) => (url || '').trim().replace(/\/+$/, '');
const whitelist = [...new Set([
  'http://localhost:4200',
  'http://localhost:3000',
  'https://porttos.co',
  process.env.ANGULAR_URL_LOCAL,
  process.env.ANGULAR_URL_LOCL, // nombre usado hoy en .env
  process.env.ANGULAR_URL_PRUE,
  process.env.ANGULAR_URL_PROD,
  ...(process.env.CORS_ORIGINS || '').split(','),
].map(normalizarOrigen).filter(Boolean))];

const io = new Server(server, {
  cors: {
    origin: whitelist,
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
  transports: ['polling', 'websocket']
});

// Autenticación JWT en el handshake + salas por puerto/módulo
io.use(socketAuth);
registrarSalas(io);
console.log(`🔐 [SOCKET] Autenticación en modo ${esModoEstricto() ? 'ESTRICTO' : 'TRANSICIÓN (SOCKET_AUTH_STRICT != true)'}.`);

// 🟢 Instanciamos el Socket globalmente en el helper
setIO(io);

// Compatibilidad: varios servicios hacen `const { io } = require('../../index')`.
// Debe exportarse ANTES de requerir las rutas, que cargan esos servicios.
// (Lo correcto a futuro es usar getIO() de helpers/socket.helper en todos.)
module.exports.io = io;

// ================================================
// === CORS Y SEGURIDAD ===
// ================================================
const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true);
    } else {
      callback(new Error('El origen CORS: ' + origin + ' no tiene permiso.'));
    }
  }
};
app.use(cors(corsOptions));

// ================================================
// === MIDDLEWARES ===
// ================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(fileUpload({ useTempFiles: false }));

// ================================================
// === RUTAS DE LA API ===
// ================================================
// PLATAFORMA
app.use('/api/dashboard', require("./routes/dashboard.routes"));
app.use("/api/actividades", require("./routes/actividades.routes"));
app.use("/api/actividades-roles", require("./routes/actividades-roles.routes"));
app.use("/api/tipos-actividad", require("./routes/tipos-actividad.routes"));
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/upload", require("./routes/uploads.routes"));
app.use("/api/sliders", require("./routes/sliders-inicio"));
app.use("/api/colores", require("./routes/colores-settings"));
app.use("/api/tipos-item", require("./routes/tipos-item.routes"));
app.use("/api/items", require("./routes/items.routes"));
app.use("/api/db-setup", require("./routes/db-setup"));
app.use("/api/bibliotecas", require("./routes/bibliotecas"));
app.use("/api/galerias", require("./routes/galerias.routes"));
app.use("/api/tipos-galeria", require("./routes/tipos-galeria"));
app.use("/api/formatos-galeria", require("./routes/formatos-galeria"));
app.use('/api/tipos-scripts', require('./routes/tipos-scripts.routes'));
app.use('/api/scripts', require('./routes/scripts'));
app.use("/api/roles", require("./routes/roles.routes"));
app.use("/api/usuarios", require("./routes/usuarios.routes"));
app.use("/api/usuarios-roles", require("./routes/usuarios-roles.routes"));
app.use("/api/ia", require("./routes/ia"));
app.use("/api/historial-facturacion", require("./routes/historial-facturacion.routes"));
app.use('/api/tipos-pago', require('./routes/tipos-pago.routes'));
app.use('/api/tipos-paquete', require('./routes/tipos-paquete.routes'));
app.use('/api/tipos-roles', require('./routes/tipos-roles.routes'));
app.use('/api/tipos-items', require('./routes/tipos-item.routes'));
app.use('/api/email', require('./routes/email.routes'));
app.use('/api/widgets', require('./routes/widgets.routes'));
app.use('/api/widgets-roles', require('./routes/widget-roles.routes'));
app.use('/api/layout', require('./routes/layout.routes'));
app.use('/api/usuarios-widgets', require('./routes/usuarios-widgets.routes'));
app.use('/api/sesiones', require('./routes/sesiones.routes'));
app.use('/api/lista-precios', require('./routes/lista-precios.routes'));
app.use('/api/parametros', require('./routes/parametros-sistema.routes'));
app.use('/api/pestanas', require('./routes/pestanas.routes'));
app.use('/api/tipos-widget', require('./routes/tipos-widget.routes'));
app.use('/api/tipos-pestana', require('./routes/tipos-pestana.routes'));

// APLICACIONES
app.use("/api/aplicaciones", require("./routes/aplicaciones"));
app.use("/api/versiones", require("./routes/versiones-ap.routes"));
app.use("/api/paquetes", require("./routes/paquetes.routes"));
app.use("/api/items-paquete", require("./routes/items-paquete"));
app.use("/api/modulos-paquete", require("./routes/modulos-paquete.routes"));
app.use("/api/modulos", require("./routes/modulos-ap"));
app.use("/api/suites", require("./routes/suites-ap"));

// CONEXIONES BD
app.use("/api/conexiones-bd", require("./routes/conexiones-bd"));
app.use("/api/servidores", require("./routes/servidores"));

// SUSCRIPTORES
app.use("/api/suscriptores", require("./routes/suscriptores"));
app.use("/api/empresas-sc", require("./routes/empresas-sc.routes"));
app.use("/api/usuarios-sc", require("./routes/usuarios-sc.routes"));
app.use("/api/usuarios-empresas-sc", require("./routes/usuarios-empresas-sc.routes"));
app.use("/api/paquetes-sc", require("./routes/paquetes-sc.routes"));

// TICKETS
app.use("/api/tipos-estados", require("./routes/tipos-estados"));
app.use("/api/estados", require("./routes/estados"));
app.use("/api/tickets-ap", require("./routes/tickets-ap"));
app.use("/api/requerimientos-tk", require("./routes/requerimientos-tk"));
app.use("/api/seguimientos-tk", require("./routes/seguimientos-rq"));
app.use("/api/clases-ticket", require("./routes/clases-ticket"));

// SITIOS
app.use("/api/sitios-ap", require("./routes/sitios-ap"));
app.use("/api/contenidos-el", require("./routes/contenidos-el"));
app.use("/api/enlaces-st", require("./routes/enlaces-st"));

// IDIOMAS
app.use("/api/idiomas", require("./routes/idiomas"));
app.use("/api/textos-id", require("./routes/textos-id"));

// LOGS
app.use("/api/tios-logs", require("./routes/tipos-logs"));
app.use("/api/logs-actividades", require("./routes/logs-actividades"));
app.use("/api/logs-actualizaciones", require("./routes/logs-actualizaciones"));
app.use("/api/logs-transacciones", require("./routes/logs-transacciones"));

// TCLP
app.use("/api/tclp-dashboard", require("./routes/torre-control/dashboard.routes"));
app.use("/api/tclp-ingesta", require("./routes/torre-control/ingesta.routes"));
app.use("/api/torre-control", require("./routes/torre-control/torre-control.routes"));
app.use("/api/maritimo", require("./routes/torre-control/maritimo.routes"));
app.use('/api/widgets', require('./routes/torre-control/widget.routes'));
app.use('/api/mapa-general', require('./routes/torre-control/mapa-general.routes'));
app.use('/api/alertas', require('./routes/torre-control/alertas-climaticas.routes'));
app.use('/api/puertos', require('./routes/torre-control/puertos.routes'));
app.use('/api/terminales', require('./routes/torre-control/terminales.routes'));
app.use('/api/muelles', require('./routes/torre-control/muelles.routes'));
app.use('/api/infraestructura', require('./routes/torre-control/infraestructura.routes'));
app.use('/api/tipos-infraestructura', require('./routes/torre-control/tipos-infraestructura.routes'));
app.use('/api/eventos-viales', require('./routes/torre-control/evento-vial.routes'));
app.use('/api/flota-terrestre', require('./routes/torre-control/flota-terrestre.routes'));
app.use('/api/motonaves', require('./routes/torre-control/motonaves.routes'));
app.use('/api/faros', require('./routes/torre-control/faros.routes'));
app.use('/api/radar', require('./routes/torre-control/radar.routes'));
app.use('/api/contenedores', require('./routes/torre-control/contenedores.routes'));
app.use('/api/inventario-contenedores', require('./routes/torre-control/inventario-contenedores.routes'));
app.use('/api/gnl-telemetria', require('./routes/torre-control/gnl-telemetria.routes'));
app.use('/api/bodegas', require('./routes/torre-control/bodegas.routes'));
app.use('/api/virtual-gate', require('./routes/torre-control/virtual-gate.routes'));

// Manejador central de errores: siempre después de la última ruta (JSON mal formado, next(error), etc.)
app.use(require('./middlewares/manejador-errores'));

// Simulador GNL: activo en desarrollo; en producción solo con GNL_SIMULADOR=true
const simuladorGnlActivo = process.env.GNL_SIMULADOR
  ? process.env.GNL_SIMULADOR === 'true'
  : process.env.NODE_ENV !== 'production';

if (simuladorGnlActivo) {
  simuladorGNL.iniciarSimulador('BUENAVENTURA')
    .then(res => console.log(res.msg))
    .catch(err => console.error("❌ Error arrancando simulador GNL:", err.msg || err));
}

// =======================================================
// === EVENTOS SOCKET.IO ===
// =======================================================
io.on("connection", async (socket) => {
  console.log("Cliente conectado:", socket.id);

  // La identidad sale del JWT verificado; el codigoUsuario enviado por el cliente solo se acepta en modo transición
  const codigoUsuario = socket.data.usuario?.codigoUsuario
    || (esModoEstricto() ? null : (socket.handshake.auth?.codigoUsuario || socket.handshake.query?.codigoUsuario));

  if (codigoUsuario) {
    socket.codigoUsuario = codigoUsuario;
    socket.join(codigoUsuario);
    console.log(`🏠 Socket ${socket.id} unido a la sala [Room: ${codigoUsuario}]`);

    try {
      await PTLUsuarios.update(
        {
          isOnline: true,
          ultimaConexion: new Date().toISOString()
        },
        { where: { codigoUsuario } }
      );
      io.emit("usuarios-actualizados");
      console.log(`🟢 Usuario ${codigoUsuario} marcado como Online.`);
    } catch (error) {
      console.error("Error al actualizar usuario a Online:", error);
    }
  } else {
    console.warn(`⚠️ El socket ${socket.id} se conectó de forma anónima.`);
  }

  socket.on("disconnect", async () => {
    console.log("Cliente desconectado:", socket.id);
    const usuarioDesconectado = socket.codigoUsuario;

    if (usuarioDesconectado) {
      try {
        await PTLUsuarios.update(
          {
            isOnline: false,
            ultimaConexion: new Date().toISOString()
          },
          { where: { codigoUsuario: usuarioDesconectado } }
        );
        io.emit("usuarios-actualizados");
        console.log(`🔴 Usuario ${usuarioDesconectado} marcado como Offline.`);
      } catch (error) {
        console.error("Error al actualizar usuario a Offline:", error);
      }
    }
  });
});

// =======================================================
// === INICIALIZACIÓN DEL ECOSISTEMA (DB & SERVER) ===
// =======================================================
console.log('Servidor inicializando procesos...');

sequelize
  .authenticate()
  .then(async () => {
    // El esquema se gestiona con migraciones (database/migraciones). sync() solo si se pide explícitamente:
    // con tablas renombradas + sinónimos, sync() intentaría recrear nombres viejos y tumbaría el arranque.
    if (process.env.DB_SYNC === 'true') {
      await sequelize.sync();
    }

    // 🟢 Limpieza de estados de socket (Movido aquí para asegurar conexión a DB)
    try {
      await PTLUsuarios.update({ isOnline: false }, { where: { isOnline: true } });
      console.log('🧹 Estados de conexión de usuarios reiniciados a offline.');
    } catch (e) {
      console.error('Error al limpiar estados de socket:', e);
    }

    const puerto = process.env.PORT || 3000;

    server.listen(puerto, async () => {
      console.log(`🚀 Ecosistema QPLUS escuchando en puerto ${puerto}`);

      // === SERVICIOS EN SEGUNDO PLANO ===
      const cronService = new SuscripcionCronService();
      cronService.iniciarTareasProgramadas();

      // Se requiere aquí (y no arriba) para que sus servicios ya encuentren `io` exportado
      require('./jobs/cron.manager').initCronJobs();

      // Motor AIS: proceso aislado, se enciende con AIS_ENABLED=true
      if (process.env.AIS_ENABLED === 'true') {
        AISStreamService.iniciarConexion(io)
          .catch(aisError => console.error('❌ [Boot] Error encendiendo el radar AIS:', aisError.message));
      } else {
        console.log('⏸️ [AIS] Motor apagado (AIS_ENABLED != true).');
      }

      setTimeout(async () => {
        try {
          // await SitmarEtlService.sincronizarTodasLasNaves();
          // aisRadar.iniciarRadarGlobal(io);
          console.log('✅ [COLD START] Secuencia inicial completada.');
        } catch (syncError) {
          console.error('❌ [COLD START ERROR] Fallo inicial de Sitmar:', syncError.message);
        }
      }, 1000);
    });
  })
  .catch((err) => {
    console.error("❌ Error catastrófico en la inicialización del ecosistema QPLUS:", err.message);
    process.exit(1);
  });

// =======================================================
// === APAGADO ORDENADO ===
// =======================================================
let apagando = false;
const apagar = async (senal) => {
  if (apagando) return;
  apagando = true;
  console.log(`🛑 ${senal} recibido. Cerrando servicios...`);
  try {
    await AISStreamService.detener(); // persiste el buffer AIS pendiente
  } catch (e) {
    console.error('Error deteniendo AIS:', e.message);
  }
  server.close(() => process.exit(0));
  setTimeout(() => process.exit(0), 5000).unref();
};
process.on('SIGINT', () => apagar('SIGINT'));
process.on('SIGTERM', () => apagar('SIGTERM'));
