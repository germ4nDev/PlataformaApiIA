// Para instalar: npm install nodemailer
import nodemailer from 'nodemailer';

// *************************************************************
// PASO 1: REEMPLAZA ESTOS VALORES CON LA INFORMACIÓN DE TU EMPRESA
// *************************************************************
const SMTP_HOST = 'smtp.miempresa.com';     // Ej: smtp.office365.com, smtp.servidorlocal.net
const SMTP_PORT = 587;                      // Puertos comunes: 587 (TLS/STARTTLS) o 465 (SSL/SMTPS)
const SMTP_USER = 'api_user@miempresa.com'; // Cuenta de correo autorizada
const SMTP_PASS = 'tu_contraseña_secreta';  // Contraseña de esa cuenta
// *************************************************************


/**
 * Función para enviar un correo electrónico usando el Transporter SMTP
 * configurado con los datos de tu empresa.
 * @param {string} toEmail El destinatario del correo.
 */
async function enviarCorreoEmpresarial(toEmail) {
    // Definición de la configuración de seguridad:
    // secure: true -> Usa el protocolo SMTPS (Secure SMTP, generalmente en puerto 465).
    // secure: false -> Usa el protocolo STARTTLS (generalmente en puerto 587, y es el predeterminado si el puerto es 587).

    const isSecure = SMTP_PORT === 465; 
    
    // 1. Configurar el "transporter"
    let transporter = nodemailer.createTransport({
        host: SMTP_HOST,
        port: SMTP_PORT,
        secure: isSecure, // Se configura automáticamente si es 465, sino usa STARTTLS por defecto
        auth: {
            user: SMTP_USER,
            pass: SMTP_PASS
        },
        // Opcional: Para entornos de desarrollo donde el certificado pueda ser autofirmado
        // tls: {
        //     rejectUnauthorized: false
        // }
    });

    // 2. Configurar y enviar el contenido del correo
    try {
        let info = await transporter.sendMail({
            from: `"${SMTP_USER.split('@')[0]} (Notificaciones)" <${SMTP_USER}>`, // Remitente
            to: toEmail, // Destinatario
            subject: "Prueba desde API con Servidor Empresarial",
            text: "¡El envío SMTP con Nodemailer ha sido exitoso!",
            html: `
                <div style="font-family: 'Inter', Arial, sans-serif; padding: 20px; background-color: #f4f7f6; border-radius: 10px;">
                    <h1 style="color: #004d99;">Sistema de Notificación Empresarial</h1>
                    <p>Estimado/a, este correo confirma que la conexión a su servidor SMTP
                    (<code>${SMTP_HOST}:${SMTP_PORT}</code>) es funcional.</p>
                    <p>¡Listo para usar en producción!</p>
                </div>
            `,
        });

        console.log("------------------------------------------");
        console.log("✔ Correo enviado exitosamente.");
        console.log(`Mensaje ID: ${info.messageId}`);
        console.log("------------------------------------------");

    } catch (error) {
        console.error("------------------------------------------");
        console.error("❌ ERROR al enviar el correo con el servidor empresarial.");
        console.error("Detalle del error:", error.message);
        console.error("------------------------------------------");
        console.error("Sugerencia: Verifica la configuración de host, puerto y credenciales (auth).");
    }
}

// Ejecutar la función
enviarCorreoEmpresarial('otro_destinatario@ejemplo.com');


// Para instalar: npm install @sendgrid/mail
import sgMail from '@sendgrid/mail';

// *************************************************************
// PASO 1: Configuración de la API Key
// *************************************************************
// En una aplicación real, NUNCA expongas la API Key. Usa variables de entorno.
const SENDGRID_API_KEY = process.env.SENDGRID_API_KEY || 'TU_API_KEY_AQUÍ';
sgMail.setApiKey(SENDGRID_API_KEY);

// Lista de destinatarios
const listaDestinatarios = [
    { email: 'usuario1@ejemplo.com', name: 'Usuario Uno', id: 101 },
    { email: 'usuario2@ejemplo.com', name: 'Usuario Dos', id: 102 },
    { email: 'usuario3@ejemplo.com', name: 'Usuario Tres', id: 103 }
];

/**
 * Envía un correo individual a varios destinatarios.
 * @param {Array<Object>} recipients - Lista de objetos {email, name, ...}
 */
async function enviarCorreosMasivos(recipients) {
    if (!SENDGRID_API_KEY) {
        console.error("❌ ERROR: La clave API de SendGrid no está configurada.");
        return;
    }

    // 1. Mapear los destinatarios en el formato requerido
    const toList = recipients.map(r => r.email);

    // 2. Definir el mensaje (mismo mensaje para todos)
    const mensaje = {
        to: toList, // Se envían a toda la lista
        from: 'notificaciones@tuempresa.com', // Debe ser un correo verificado en SendGrid
        subject: `¡Tenemos una actualización para ti!`,
        text: 'Hola, revisa las últimas novedades en nuestra plataforma.',
        html: '<strong>Hola</strong>, revisa las últimas novedades en nuestra plataforma. <p>Haz clic <a href="https://tuempresa.com/updates">aquí</a>.</p>',
        // Para enviar a cada uno individualmente (sin que vean a los otros)
        // SendGrid lo gestiona internamente para evitar que se vean entre sí.
    };

    console.log(`Intentando enviar correo a ${recipients.length} destinatarios...`);

    try {
        // 3. Envío de la solicitud a la API de SendGrid
        const response = await sgMail.send(mensaje);

        console.log("------------------------------------------");
        console.log("✔ Envío Masivo Iniciado.");
        console.log("Código de respuesta de la API:", response[0].statusCode);
        console.log("Mensaje de cabecera:", response[0].headers['x-message-id']);
        console.log("------------------------------------------");
        console.log("SendGrid ahora es responsable de la entrega. Puedes monitorear el estado en su panel.");
        
    } catch (error) {
        console.error("------------------------------------------");
        console.error("❌ ERROR al enviar con SendGrid:", error.message);
        // Si el error es de red o de la API
        if (error.response) {
            console.error(error.response.body);
        }
        console.error("------------------------------------------");
        console.error("Sugerencia: Revisa tu API Key y asegúrate de que el correo 'from' esté verificado en SendGrid.");
    }
}

// Llamar a la función
// NOTA: Para que esto funcione, necesitas una cuenta de SendGrid activa y una clave API válida.
// El código fallará con el mensaje de error si la clave es inválida.
enviarCorreosMasivos(listaDestinatarios);       