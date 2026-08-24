// 1. Importar los módulos necesarios
const fs = require('fs');
const path = require('path');
const archiver = require('archiver');

// Nombre de la carpeta a comprimir (que debe existir)
const FOLDER_TO_ZIP = 'files_to_compress';
// Nombre del archivo ZIP de salida
const OUTPUT_ZIP_PATH = path.join(__dirname, 'output_archive.zip');
// El formato de archivo a usar (por ejemplo, 'zip', 'tar')
const ARCHIVE_FORMAT = 'zip'; 

function setupTestFolder() {
    console.log(`[SETUP] Creando carpeta de prueba: ${FOLDER_TO_ZIP}`);
    if (fs.existsSync(FOLDER_TO_ZIP)) {
        fs.rmSync(FOLDER_TO_ZIP, { recursive: true, force: true });
    }
    fs.mkdirSync(FOLDER_TO_ZIP);

    fs.writeFileSync(path.join(FOLDER_TO_ZIP, 'documento_1.txt'), 'Este es el primer archivo de texto.');
    fs.writeFileSync(path.join(FOLDER_TO_ZIP, 'config.json'), JSON.stringify({ version: '1.0', author: 'Gemini' }, null, 2));
    
    // Crear una subcarpeta
    const subFolder = path.join(FOLDER_TO_ZIP, 'assets');
    fs.mkdirSync(subFolder);
    fs.writeFileSync(path.join(subFolder, 'style.css'), 'body { background-color: #f0f0f0; }');
    console.log('[SETUP] Carpeta de prueba lista con 4 archivos/directorios.');
}

function compressDirectory(sourceDir, outPath) {
    // 1. Crear una stream de escritura para el archivo de salida
    const output = fs.createWriteStream(outPath);
    
    // 2. Inicializar el archivador con el formato deseado
    const archive = archiver(ARCHIVE_FORMAT, {
        zlib: { level: 9 } // Nivel de compresión (0-9)
    });

    // Escuchar eventos para informar al usuario sobre el proceso
    output.on('close', function() {
        console.log(`\n✅ Compresión completada. Tamaño total: ${archive.pointer()} bytes.`);
        console.log(`El archivo ZIP se ha guardado en: ${outPath}`);
    });

    archive.on('warning', function(err) {
        if (err.code === 'ENOENT') {
            console.warn(`[ADVERTENCIA] Archivo no encontrado: ${err.message}`);
        } else {
            throw err;
        }
    });

    archive.on('error', function(err) {
        throw err;
    });

    // 3. Pipe (Conectar) la stream del archivador a la stream de salida
    // Esto significa que los datos comprimidos se escribirán en el archivo
    archive.pipe(output);

    // 4. Añadir la carpeta al archivo ZIP.
    // El segundo parámetro, { name: '/' }, asegura que el contenido de la carpeta 
    // se coloque en la raíz del ZIP, no dentro de una carpeta llamada 'files_to_compress/'
    archive.directory(sourceDir, false); // El segundo argumento 'false' omite la carpeta raíz en el ZIP

    // 5. Finalizar el archivo (escribir el pie de página y cerrar streams)
    archive.finalize();
}

try {
    // 1. Configurar la carpeta de prueba
    setupTestFolder();

    // 2. Iniciar la compresión
    compressDirectory(FOLDER_TO_ZIP, OUTPUT_ZIP_PATH);

} catch (error) {
    console.error(`\n❌ Ha ocurrido un error:`, error.message);
}