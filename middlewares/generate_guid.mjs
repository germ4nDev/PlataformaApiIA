import { v4 as uuidv4 } from 'uuid';

function generarGuid() {
    // Generar un UUID de versión 4 (basado en números aleatorios)
    const guid = uuidv4();

    console.log("-----------------------------------------");
    console.log("UUID Generado (Versión 4):");
    console.log(guid);
    console.log("-----------------------------------------");
}

generarGuid();