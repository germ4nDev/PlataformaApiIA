const puppeteer = require('puppeteer');

async function cazarConNavegador() {
  console.log("🚢 Arrancando el Navegador Fantasma (Chrome Invisible)...");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();

  try {
    await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.goto('https://www.myshiptracking.com/', { waitUntil: 'networkidle2' });

    const urlApi = 'https://www.myshiptracking.com/requests/vesselsonmaptempTTT.php?type=json&minlat=-4.0&maxlat=14.0&minlon=-82.0&maxlon=-70.0&zoom=6&selid=-1&seltype=0&timecode=-1&filters=%7B%22vtypes%22%3A%22%2C0%2C3%2C4%2C6%2C7%2C8%2C9%2C10%2C11%2C12%2C13%2C2%22%2C%22ports%22%3A%221%22%2C%22minsog%22%3A0%2C%22maxsog%22%3A60%2C%22minsz%22%3A0%2C%22maxsz%22%3A500%2C%22minyr%22%3A1950%2C%22maxyr%22%3A2026%2C%22status%22%3A%22%22%2C%22mapflt_from%22%3A%22%22%2C%22mapflt_dest%22%3A%22%22%7D';

    await page.goto(urlApi, { waitUntil: 'domcontentloaded' });

    const contenido = await page.evaluate(() => document.body.innerText);

    console.log("✅ ¡HACK MATE! Datos extraídos. Iniciando traducción...");

    // --- 🟢 EL TRADUCTOR DE TEXTO CRUDO A JSON ---
    const lineas = contenido.split('\n');
    const barcosCapturados = [];

    for (const linea of lineas) {
      // Separamos la línea por los espacios de tabulación
      const col = linea.trim().split('\t');

      // Si la línea tiene suficientes columnas, extraemos los datos
      if (col.length >= 6) {
        const barco = {
          mmsi: col[2],                     // Columna 3
          nombre: col[3] || 'DESCONOCIDO',  // Columna 4
          lat: parseFloat(col[4]),          // Columna 5
          lon: parseFloat(col[5]),          // Columna 6
          velocidad: parseFloat(col[6]) || 0, // Columna 7
          rumbo: parseFloat(col[7]) || 0      // Columna 8
        };

        // Filtro de seguridad por si lee una línea basura
        if (barco.mmsi && !isNaN(barco.lat)) {
          barcosCapturados.push(barco);
        }
      }
    }

    console.log(`🎯 ¡ÉXITO! Se estructuraron ${barcosCapturados.length} barcos perfectamente.`);

    if (barcosCapturados.length > 0) {
      console.log("--------------------------------------------------");
      console.log("Mira el primer barco listo para tu Base de Datos:");
      console.log(barcosCapturados[0]);
      console.log("--------------------------------------------------");
    }

  } catch (error) {
    console.error("❌ Error en el proceso:", error.message);
  } finally {
    await browser.close();
  }
}

cazarConNavegador();