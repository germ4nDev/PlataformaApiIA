/*
index.js
Author: German Valencia
Actualización: Integración TCL, Motor Multi-Agente y Cron de Suscripciones (20260523)
*/
require("dotenv").config();
const path = require("path");
const express = require("express");
const { Server } = require("socket.io");
const { db, sequelize } = require("./database/connection");
const http = require("http");
const fileUpload = require('express-fileupload');
const { iniciarVigilanteSupertransporte } = require('./controllers/torre-control/dashboard/alertas.cron');
const cors = require("cors");
const cron = require('node-cron');
const { UsuarioModel } = require('./models/usuario');
const PTLUsuarios = UsuarioModel(sequelize);

(async () => {
  try {
    await PTLUsuarios.update({ isOnline: false }, { where: { isOnline: true } });
    console.log('🧹 Estados de conexión de usuarios reiniciados a offline.');
  } catch (e) {
    console.error('Error al limpiar estados de socket:', e);
  }
})();

// 🟢 Importación de tu nuevo servicio Cron
const SuscripcionCronService = require('./services/cron.service');
// ================================================

const app = express();
const server = http.createServer(app);

// ================================================
// === CONFIGURACIÓN DE CORS Y SEGURIDAD ===
// ================================================
const whitelist = [
  'http://localhost:4200',
  'http://localhost:3000',
  'https://porttos.co' // Puedes cambiar esto por tu dominio real
];

const corsOptions = {
  origin: function (origin, callback) {
    if (whitelist.indexOf(origin) !== -1 || !origin) {
      callback(null, true)
    } else {
      callback(new Error('El origen CORS: ' + origin + ' no tiene permiso.'))
    }
  }
}

app.use(cors(corsOptions));

// ================================================
// === INICIALIZACIÓN DE WEBSOCKETS (Socket.io) ===
// ================================================
const io = new Server(server, {
  cors: {
    origin: process.env.ANGULAR_URL_LOCAL || "*",
    methods: ["GET", "POST", "PUT", "DELETE"],
  },
  transports: ['polling', 'websocket'] // Fundamental para evitar bloqueos en IIS
});

app.set('socketio', io);

module.exports = { io };

// ================================================
// === MIDDLEWARES Y UTILIDADES ===
// ================================================
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use(fileUpload({
  useTempFiles: false
}));

// ================================================
// === RUTAS DE LA API ===
// ================================================

// PLATAFORMA
app.use('/api/dashboard', require("./routes/dashboard.routes"));
app.use("/api/actividades", require("./routes/actividades.routes"));
app.use("/api/actividades-roles", require("./routes/actividades-roles.routes"));
app.use("/api/tipos-actividad", require("./routes/tipos-actividad.routes"));
app.use("/api/auth", require("./routes/auth"));
app.use("/api/upload", require("./routes/uploads.routes"));
app.use("/api/sliders", require("./routes/sliders-inicio"));
app.use("/api/colores", require("./routes/colores-settings"));
app.use("/api/tipos-item", require("./routes/tipos-item"));
app.use("/api/items", require("./routes/items"));
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
app.use('/api/email', require('./routes/email.routes'));
app.use('/api/widgets', require('./routes/widgets.routes'));
app.use('/api/widgets-roles', require('./routes/widget-roles.routes'));
app.use('/api/layout', require('./routes/layout.routes'));

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

console.log('Servidor inicializando procesos...');

// =======================================================
// === INICIALIZACIÓN DE SOCKETS Y BASE DE DATOS ===
// =======================================================
io.on("connection", async (socket) => {
  console.log("Cliente conectado:", socket.id);

  // Extraemos el código de usuario que envía Angular en el auth
  const codigoUsuario = socket.handshake.auth?.codigoUsuario || socket.handshake.query?.codigoUsuario;

  if (codigoUsuario) {
    // 🟢 Guardamos el código directamente en la instancia del socket
    socket.codigoUsuario = codigoUsuario;

    try {
      await PTLUsuarios.update(
        { isOnline: true, ultimaConexion: new Date() },
        { where: { codigoUsuario } }
      );

      io.emit("usuariosActualizados");
      console.log(`🟢 Usuario ${codigoUsuario} marcado como Online.`);
    } catch (error) {
      console.error("Error al actualizar usuario a Online:", error);
    }
  } else {
    console.warn(`⚠️ El socket ${socket.id} se conectó de forma anónima.`);
  }

  // El evento disconnect se disparará automáticamente al cerrar la X del navegador
  socket.on("disconnect", async () => {
    console.log("Cliente desconectado:", socket.id);

    // 🟢 Recuperamos el codigoUsuario que guardamos en la instancia
    const usuarioDesconectado = socket.codigoUsuario;

    if (usuarioDesconectado) {
      try {
        await PTLUsuarios.update(
          { isOnline: false },
          { where: { codigoUsuario: usuarioDesconectado } }
        );

        io.emit("usuariosActualizados");
        console.log(`🔴 Usuario ${usuarioDesconectado} marcado como Offline por cierre de navegador/red.`);
      } catch (error) {
        console.error("Error al actualizar usuario a Offline:", error);
      }
    }
  });
});

sequelize
  .authenticate()
  .then(async () => {
    await sequelize.sync();
    const puerto = process.env.PORT || 3000;
    server.listen(puerto, async () => {
      console.log(`🚀 Ecosistema QPLUS escuchando en puerto ${puerto}`);

      // 🟢 AQUÍ INICIAMOS TU NUEVO SERVICIO CRON
      const cronService = new SuscripcionCronService();
      cronService.iniciarTareasProgramadas();

      // (Opcional: Descomenta la siguiente línea si quieres que haga una revisión
      // inmediatamente apenas prendas el servidor, en lugar de esperar a la medianoche)
      // cronService.auditarPaquetesVencidos();

      // require('./jobs/cron.manager');
      // initCronJobs(sequelize);

      try {
        console.log('📡 [Boot] Encendiendo Motor de Ingesta Satelital (AIS)...');
        // await AISStreamService.iniciarConexion(io);
      } catch (aisError) {
        console.error('❌ [Boot] Error encendiendo el radar AIS:', aisError.message);
      }

      setTimeout(async () => {
        try {
          // console.log('🔄 [COLD START] Ejecutando sincronización de arranque (Sitmar)...');
          // await SitmarEtlService.sincronizarTodasLasNaves();
          // aisRadar.iniciarRadarGlobal(io);
          console.log('✅ [COLD START] Sincronización inicial completada.');
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