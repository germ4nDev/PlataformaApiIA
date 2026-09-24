
/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, File System Management, Async I/O & Dynamic Image Compression
*/
const path = require("path");
const fs = require("fs").promises;
const fsSync = require("fs");
const { v4: uuidv4 } = require("uuid");
const sharp = require("sharp");

class UploadsService {
  constructor() {
    this.baseUploadPath = path.join(__dirname, '..', 'uploads');

    this.imageProcessingConfig = {
      maxWidth: 1200,
      quality: 80
    };

    this.folderMap = {
      'aplicaciones': path.join('aplicaciones'),
      'biblioteca': path.join('biblioteca', 'biblioteca'),
      'idiomas': path.join('idiomas'),
      'scripts': path.join('scripts'),
      'sitios': path.join('sitios'),
      'sliders': path.join('sliders'),
      'suscriptores': path.join('suscriptores'),
      'suites': path.join('aplicaciones', 'suites'),
      'usuarios': path.join('usuarios'),
      'galeria': path.join('biblioteca', 'galerias'),
      'galeria-img': path.join('biblioteca', 'galerias', 'imagenes'),
      'galeria-vid': path.join('biblioteca', 'galerias', 'videos'),
      'galeria-doc': path.join('biblioteca', 'galerias', 'documentos'),
      'qplus10': path.join('websites', 'qplus10'),
      'qplus10carrusel': path.join('websites', 'qplus10', 'carrusel-inicio'),
      'qplus10clientes': path.join('websites', 'qplus10', 'clientes'),
      'tickets': path.join('tickets', 'tickets'),
      'requerimientos': path.join('tickets', 'requerimientos'),
      'seguimientos': path.join('tickets', 'seguimientos'),

      // PORTTOS
      'widgets': path.join('widgets'),
      'puertos': path.join('puertos'),
    };
    this.validTypes = Object.keys(this.folderMap);
  }

  validateType(type) {
    if (!this.validTypes.includes(type)) {
      throw {
        statusCode: 400,
        msg: `Tipo no válido: '${type}'. Tipos permitidos: ${this.validTypes.join(', ')}.`
      };
    }
  }

  async createFolder(folderName) {
    const targetDirectory = path.join(this.baseUploadPath, folderName);
    if (!fsSync.existsSync(targetDirectory)) {
      await fs.mkdir(targetDirectory, { recursive: true });
    }
  }

  async uploadFile(file, susc, type) {
    console.log('file', file);
    console.log('susc', susc);
    console.log('type', type);

    this.validateType(type);

    const isImage = file.mimetype.startsWith('image/') && !file.mimetype.includes('svg');

    // Extraemos y conservamos SIEMPRE la extensión original
    const originalExtension = file.name.split(".").pop().toLowerCase();
    const newFileName = `${uuidv4()}.${originalExtension}`;

    const relativeFolder = this.folderMap[type];
    const targetDirectory = path.join(this.baseUploadPath, susc.toString(), relativeFolder);
    const absolutePath = path.join(targetDirectory, newFileName);

    await fs.mkdir(targetDirectory, { recursive: true });

    try {
      if (isImage) {

        // 1. Iniciamos el proceso de redimensionamiento base
        let imgPipeline = sharp(file.data).resize({
          width: this.imageProcessingConfig.maxWidth,
          withoutEnlargement: true // Evita estirar imágenes pequeñas
        });

        // 2. Aplicamos la compresión dinámica según el formato original
        if (originalExtension === 'png') {
          // PNG necesita un trato especial para no perder calidad/transparencia
          imgPipeline = imgPipeline.png({ quality: this.imageProcessingConfig.quality, compressionLevel: 8 });
        } else if (originalExtension === 'webp') {
          imgPipeline = imgPipeline.webp({ quality: this.imageProcessingConfig.quality });
        } else {
          // Por defecto tratamos como JPEG (para .jpg, .jpeg, etc.)
          imgPipeline = imgPipeline.jpeg({ quality: this.imageProcessingConfig.quality });
        }

        // 3. Guardamos el archivo final
        await imgPipeline.toFile(absolutePath);

        console.log(`[FileManager] Imagen optimizada y guardada como .${originalExtension}: ${newFileName}`);
        return newFileName;

      } else {
        // Archivos normales (PDFs, scripts, videos, SVG)
        return new Promise((resolve, reject) => {
          file.mv(absolutePath, (err) => {
            if (err) return reject({ statusCode: 500, msg: 'Error al mover el archivo al storage.' });
            resolve(newFileName);
          });
        });
      }
    } catch (error) {
      console.error('[FileManager] Error procesando archivo:', error);
      throw { statusCode: 500, msg: 'Error interno al procesar/comprimir el archivo.' };
    }
  }

  getFilePath(susc, type, fileName) {
    this.validateType(type);

    const relativeFolder = this.folderMap[type];
    const fullPath = path.join(this.baseUploadPath, susc.toString(), relativeFolder, fileName);

    if (fsSync.existsSync(fullPath)) {
      return fullPath;
    }

    const noImgPath = path.join(this.baseUploadPath, 'assets', 'no-imagen.png');
    return fsSync.existsSync(noImgPath) ? noImgPath : null;
  }

  async deleteFile(susc, type, fileName) {
    this.validateType(type);

    const relativeFolder = this.folderMap[type];
    const targetPath = path.join(this.baseUploadPath, susc.toString(), relativeFolder, fileName);

    try {
      await fs.unlink(targetPath);
      return true;
    } catch (error) {
      if (error.code === 'ENOENT') {
        throw { statusCode: 404, msg: 'El archivo ya no existe en el servidor.' };
      }
      throw { statusCode: 500, msg: 'No se pudo eliminar el recurso físico.' };
    }
  }

  async deleteFolderContent(susc, type) {
    this.validateType(type);

    const relativeFolder = this.folderMap[type];
    const targetDirectory = path.join(this.baseUploadPath, susc.toString(), relativeFolder);

    try {
      if (fsSync.existsSync(targetDirectory)) {
        const entries = await fs.readdir(targetDirectory, { withFileTypes: true });

        const deletePromises = entries.map(entry => {
          const fullPath = path.join(targetDirectory, entry.name);
          return entry.isDirectory()
            ? fs.rm(fullPath, { recursive: true, force: true })
            : fs.unlink(fullPath);
        });

        await Promise.all(deletePromises);

        console.log(`[FileManager] Contenido de la carpeta '${type}' eliminado para el suscriptor ${susc}.`);
        return true;
      }
      return false;
    } catch (error) {
      console.error(`[FileManager] Error al limpiar carpeta ${type}:`, error);
      throw { statusCode: 500, msg: `Error interno al limpiar el directorio de ${type}.` };
    }
  }
}

module.exports = UploadsService;