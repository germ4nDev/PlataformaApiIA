const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// Activamos el plugin de sigilo para evitar bloqueos por detección de bots
puppeteer.use(StealthPlugin());

async function pruebaRastreoConSigilo(numeroContenedor) {
    console.log(`\n🚀 Iniciando túnel blindado para: ${numeroContenedor}`);

    // Lanzamos el navegador utilizando puppeteer-extra
    const browser = await puppeteer.launch({
        headless: false, // Visible para que puedas monitorear el proceso
        defaultViewport: null,
        args: [
            '--start-maximized',
            '--disable-blink-features=AutomationControlled' // Refuerzo extra contra detección
        ]
    });

    const page = await browser.newPage();

    try {
        // 1. Navegación al portal de rastreo
        const url = `https://www.track-trace.com/container`;
        console.log(`📡 Navegando a ${url}...`);
        await page.goto(url, { waitUntil: 'networkidle2' });

        // 2. Escribir número de contenedor de forma humana (con retraso)
        const inputSelector = 'input[name="number"]';
        await page.waitForSelector(inputSelector);
        console.log(`⌨️ Escribiendo número de contenedor...`);
        await page.type(inputSelector, numeroContenedor, { delay: 150 });

        // 3. Clic inicial en "Track direct"
        const buttonSelector = '#wc-multi-form-button_direct';
        await page.waitForSelector(buttonSelector);
        console.log(`🖱️ Haciendo clic en Track direct...`);
        await page.click(buttonSelector);

        // 4. Pausa prudente para simular tiempo de reacción humano
        await new Promise(r => setTimeout(r, 2000));

        // 5. Verificación y salto del modal de confirmación por texto ("I'm sure")
        console.log(`🔎 Verificando si aparece modal de confirmación...`);
        const confirmacionExitosa = await page.evaluate(() => {
            const buttons = Array.from(document.querySelectorAll('button'));
            const targetButton = buttons.find(b => b.innerText.includes("I'm sure"));

            if (targetButton) {
                targetButton.click();
                return true;
            }
            return false;
        });

        if (confirmacionExitosa) {
            console.log("✅ Modal superado con éxito.");
        } else {
            console.log("ℹ️ No se requirió confirmación adicional.");
        }

        // 6. Esperar la carga de la página final de resultados
        console.log(`⏳ Esperando la respuesta del servidor...`);
        await page.waitForNavigation({ waitUntil: 'networkidle2', timeout: 25000 });

        console.log(`🎉 ¡Túnel abierto con éxito! Página de resultados cargada.`);

        // Mantenemos el navegador abierto unos segundos para validar visualmente
        await new Promise(r => setTimeout(r, 10000));
        await browser.close();

    } catch (error) {
        console.error(`❌ Error en el túnel blindado:`, error.message);
        await browser.close();
    }
}

// Ejecución de prueba
pruebaRastreoConSigilo('CMAU1234567');