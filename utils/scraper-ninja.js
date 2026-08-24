// // // // // const puppeteer = require('puppeteer-extra');
// // // // // const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// // // // // // Activamos el modo sigilo para evadir Cloudflare
// // // // // puppeteer.use(StealthPlugin());

// // // // // async function iniciarScrapingNinja() {
// // // // //   console.log("==================================================");
// // // // //   console.log("🥷 INICIANDO MISIÓN DE SCRAPING SIGILOSO (AIS)");
// // // // //   console.log("==================================================");

// // // // //   // Para la primera prueba, te recomiendo poner headless en 'false' 
// // // // //   // para que veas en tu pantalla cómo se abre el navegador. 
// // // // //   // Luego lo pasas a 'new' o 'true' para que corra de fondo en tu ETL.
// // // // //   const browser = await puppeteer.launch({
// // // // //     headless: false,
// // // // //     args: ['--no-sandbox', '--disable-setuid-sandbox']
// // // // //   });

// // // // //   const page = await browser.newPage();

// // // // //   // Configuramos un User-Agent de un navegador real de Windows
// // // // //   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

// // // // //   let barcosInterceptados = [];

// // // // //   // 1. EL TRUCO: Escuchamos todas las respuestas de red que recibe la página
// // // // //   page.on('response', async (response) => {
// // // // //     const request = response.request();
// // // // //     const url = request.url();

// // // // //     // Buscamos si la URL de la petición interna contiene "vessels" o "click" (los endpoints internos del mapa)
// // // // //     if (url.includes('vesselfinder.com/api/pub/vessels') || url.includes('vesselfinder.com/api/map')) {
// // // // //       try {
// // // // //         // Atrapamos el JSON puro que el servidor le manda al mapa web
// // // // //         const data = await response.json();

// // // // //         // Extraemos las naves si vienen en el formato esperado
// // // // //         if (data && Array.isArray(data)) {
// // // // //           barcosInterceptados = data;
// // // // //           console.log(`✅ ¡BINGO! JSON interno interceptado con ${data.length} barcos.`);
// // // // //         } else if (data && data.vessels) {
// // // // //           barcosInterceptados = data.vessels;
// // // // //           console.log(`✅ ¡BINGO! JSON interno interceptado con ${data.vessels.length} barcos.`);
// // // // //         }
// // // // //       } catch (err) {
// // // // //         // Ignoramos respuestas que no sean JSON válido
// // // // //       }
// // // // //     }
// // // // //   });

// // // // //   try {
// // // // //     console.log("📡 Navegando al mapa centrado en Buenaventura...");
// // // // //     // Coordenadas aproximadas de la bahía de Buenaventura con buen zoom
// // // // //     const urlBuenaventura = 'https://www.vesselfinder.com/?lat=3.88&lon=-77.05&zoom=11';

// // // // //     // Vamos a la página y esperamos a que no haya más peticiones de red (networkidle2)
// // // // //     await page.goto(urlBuenaventura, { waitUntil: 'networkidle2', timeout: 45000 });

// // // // //     console.log("⏳ Esperando 5 segundos extra para asegurar la carga del mapa...");
// // // // //     await new Promise(r => setTimeout(r, 5000));

// // // // //     if (barcosInterceptados.length > 0) {
// // // // //       console.log("==================================================");
// // // // //       console.log("📊 MUESTRA DEL PRIMER BARCO CAPTURADO:");
// // // // //       console.log(barcosInterceptados[0]);
// // // // //       console.log("==================================================");
// // // // //       console.log("🎯 Siguiente paso: Mapear estos datos y pasarlos a guardarVesselEnBD()");
// // // // //     } else {
// // // // //       console.log("⚠️ No se interceptaron barcos. Es posible que Cloudflare haya pedido un Captcha o el endpoint haya cambiado.");
// // // // //     }

// // // // //   } catch (error) {
// // // // //     console.error("❌ Error durante la navegación:", error.message);
// // // // //   } finally {
// // // // //     console.log("🧹 Cerrando navegador ninja...");
// // // // //     await browser.close();
// // // // //   }
// // // // // }

// // // // // iniciarScrapingNinja();

// // // // const puppeteer = require('puppeteer-extra');
// // // // const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// // // // puppeteer.use(StealthPlugin());

// // // // async function iniciarScrapingNinja() {
// // // //   console.log("==================================================");
// // // //   console.log("🥷 INICIANDO MISIÓN DE SCRAPING SIGILOSO (AIS)");
// // // //   console.log("==================================================");

// // // //   const browser = await puppeteer.launch({
// // // //     headless: false,
// // // //     args: ['--no-sandbox', '--disable-setuid-sandbox']
// // // //   });

// // // //   const page = await browser.newPage();
// // // //   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

// // // //   let barcosInterceptados = [];

// // // //   // Escuchamos el tráfico de red
// // // //   page.on('response', async (response) => {
// // // //     const url = response.url();

// // // //     // RASTREADOR
// // // //     if (url.includes('api') && (url.includes('pub') || url.includes('map') || url.includes('bbox'))) {
// // // //       console.log(`🔍 [Rastreador] Detectado: ${url.split('?')[0]}`);
// // // //     }

// // // //     // INTERCEPTOR PARA DATOS BINARIOS
// // // //     if (url.includes('/api/pub/sf1') || url.includes('/api/pub/mp2')) {
// // // //       try {
// // // //         const status = response.status();
// // // //         console.log(`\n📦 [INTERCEPTADO] Petición a ${url.split('?')[0]} - Status HTTP: ${status}`);

// // // //         if (response.request().method() !== 'OPTIONS' && status === 200) {

// // // //           // 1. EL CAMBIO CLAVE: Atrapamos la respuesta como BUFFER (Binario), no como texto.
// // // //           const buffer = await response.buffer();
// // // //           console.log(`✅ ¡Buffer binario descargado! Tamaño: ${buffer.length} bytes`);

// // // //           // 2. Imprimimos los primeros 20 bytes en Hexadecimal para "adivinar" el formato
// // // //           console.log(`🔬 [HEX DUMP]:`, buffer.subarray(0, 20).toString('hex'));

// // // //           // 3. Intentamos ver si hay texto legible camuflado (reemplazando lo ilegible por puntitos)
// // // //           console.log(`📝 [TEXTO CAMUFLADO]:`, buffer.subarray(0, 100).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));

// // // //           console.log(`==================================================`);
// // // //         }
// // // //       } catch (err) {
// // // //         console.error(`❌ Error al intentar leer el buffer: ${err.message}`);
// // // //       }
// // // //     }
// // // //   });

// // // //   try {
// // // //     console.log("📡 Navegando al mapa centrado en Buenaventura...");
// // // //     const urlBuenaventura = 'https://www.vesselfinder.com/?lat=3.88&lon=-77.05&zoom=11';

// // // //     // CAMBIO CLAVE: 'domcontentloaded' hace que no espere a que carguen imágenes ni anuncios
// // // //     await page.goto(urlBuenaventura, { waitUntil: 'domcontentloaded', timeout: 30000 });

// // // //     console.log("⏳ Página abierta. Escuchando tráfico por 10 segundos...");
// // // //     // Dejamos pasar 10 segundos fijos para que la página haga sus peticiones AJAX
// // // //     await new Promise(r => setTimeout(r, 10000));

// // // //     if (barcosInterceptados.length > 0) {
// // // //       console.log("==================================================");
// // // //       console.log(`✅ ¡BINGO! Se interceptaron ${barcosInterceptados.length} barcos.`);
// // // //       console.log("📊 MUESTRA DEL PRIMER BARCO CAPTURADO:");
// // // //       console.log(barcosInterceptados[0]);
// // // //       console.log("==================================================");
// // // //     } else {
// // // //       console.log("⚠️ No se atrapó el JSON de los barcos en estos 10 segundos.");
// // // //       console.log("Revisa los logs del [Rastreador] arriba para ver si las URLs de la API han cambiado.");
// // // //     }

// // // //   } catch (error) {
// // // //     console.error("❌ Error durante la navegación:", error.message);
// // // //   } finally {
// // // //     console.log("🧹 Cerrando navegador ninja...");
// // // //     await browser.close();
// // // //   }
// // // // }

// // // // iniciarScrapingNinja();

// // // const puppeteer = require('puppeteer-extra');
// // // const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// // // puppeteer.use(StealthPlugin());

// // // async function iniciarScrapingNinja() {
// // //   console.log("==================================================");
// // //   console.log("🥷 INICIANDO MISIÓN DE SCRAPING SIGILOSO (AIS)");
// // //   console.log("==================================================");

// // //   const browser = await puppeteer.launch({
// // //     headless: false,
// // //     args: ['--no-sandbox', '--disable-setuid-sandbox']
// // //   });

// // //   const page = await browser.newPage();
// // //   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

// // //   // Cambiamos el nombre de la variable para que tenga más sentido ahora que extraemos textos
// // //   let datosExtraidosGlobal = [];

// // //   // Escuchamos el tráfico de red
// // //   page.on('response', async (response) => {
// // //     const url = response.url();

// // //     // RASTREADOR
// // //     if (url.includes('api') && (url.includes('pub') || url.includes('map') || url.includes('bbox'))) {
// // //       console.log(`🔍 [Rastreador] Detectado: ${url.split('?')[0]}`);
// // //     }

// // //     // INTERCEPTOR PARA DATOS BINARIOS
// // //     if (url.includes('/api/pub/sf1') || url.includes('/api/pub/mp2')) {
// // //       try {
// // //         const status = response.status();
// // //         console.log(`\n📦 [INTERCEPTADO] Petición a ${url.split('?')[0]} - Status HTTP: ${status}`);

// // //         if (response.request().method() !== 'OPTIONS' && status === 200) {

// // //           // 1. Atrapamos la respuesta como BUFFER (Binario), no como texto.
// // //           const buffer = await response.buffer();
// // //           console.log(`✅ ¡Buffer binario descargado! Tamaño: ${buffer.length} bytes`);

// // //           // 2. Imprimimos los primeros 20 bytes en Hexadecimal
// // //           console.log(`🔬 [HEX DUMP]:`, buffer.subarray(0, 20).toString('hex'));

// // //           // 3. Texto camuflado
// // //           console.log(`📝 [TEXTO CAMUFLADO]:`, buffer.subarray(0, 100).toString('ascii').replace(/[^\x20-\x7E]/g, '.'));

// // //           // 4. EL EXTRACTOR DE STRINGS: Filtramos solo el texto legible
// // //           let currentString = "";
// // //           const extractedStrings = [];

// // //           for (let i = 0; i < buffer.length; i++) {
// // //             const charCode = buffer[i];
// // //             // Rango ASCII imprimible (letras, números, espacios, símbolos básicos)
// // //             if (charCode >= 32 && charCode <= 126) {
// // //               currentString += String.fromCharCode(charCode);
// // //             } else {
// // //               // Si la cadena tiene 4 o más caracteres, probablemente es un dato real
// // //               if (currentString.length >= 4) {
// // //                 extractedStrings.push(currentString.trim());
// // //               }
// // //               currentString = "";
// // //             }
// // //           }

// // //           console.log(`\n🕵️‍♂️ [DATOS EXTRAÍDOS]: Encontramos ${extractedStrings.length} posibles datos en texto plano.`);
// // //           console.log(`📋 [MUESTRA]:`, extractedStrings.slice(0, 30));
// // //           console.log(`==================================================`);

// // //           // Guardamos los datos en la variable global para el reporte final
// // //           if (extractedStrings.length > 0) {
// // //             datosExtraidosGlobal = datosExtraidosGlobal.concat(extractedStrings);
// // //           }
// // //         }
// // //       } catch (err) {
// // //         console.error(`❌ Error al intentar leer el buffer: ${err.message}`);
// // //       }
// // //     }
// // //   });

// // //   try {
// // //     console.log("📡 Navegando al mapa centrado en Buenaventura...");
// // //     const urlBuenaventura = 'https://www.vesselfinder.com/?lat=3.88&lon=-77.05&zoom=11';

// // //     // 'domcontentloaded' hace que no espere a que carguen imágenes ni anuncios
// // //     await page.goto(urlBuenaventura, { waitUntil: 'domcontentloaded', timeout: 30000 });

// // //     console.log("⏳ Página abierta. Escuchando tráfico por 10 segundos...");
// // //     // Dejamos pasar 10 segundos fijos para que la página haga sus peticiones AJAX
// // //     await new Promise(r => setTimeout(r, 10000));

// // //     // REPORTE FINAL ACTUALIZADO
// // //     if (datosExtraidosGlobal.length > 0) {
// // //       console.log("==================================================");
// // //       console.log(`✅ ¡BINGO! Se logró extraer información de los archivos binarios.`);
// // //       console.log(`📊 Total de cadenas de texto rescatadas: ${datosExtraidosGlobal.length}`);
// // //       console.log("==================================================");
// // //     } else {
// // //       console.log("⚠️ No se atraparon datos útiles en estos 10 segundos.");
// // //       console.log("Revisa los logs del [Rastreador] arriba para ver si las URLs de la API han cambiado.");
// // //     }

// // //   } catch (error) {
// // //     console.error("❌ Error durante la navegación:", error.message);
// // //   } finally {
// // //     console.log("🧹 Cerrando navegador ninja...");
// // //     await browser.close();
// // //   }
// // // }

// // // iniciarScrapingNinja();
// // const puppeteer = require('puppeteer-extra');
// // const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// // puppeteer.use(StealthPlugin());

// // async function iniciarScrapingNinja() {
// //   console.log("==================================================");
// //   console.log("🥷 INICIANDO MISIÓN: SECUESTRO DE MEMORIA CLIENT-SIDE");
// //   console.log("==================================================");

// //   const browser = await puppeteer.launch({
// //     headless: false,
// //     args: ['--no-sandbox', '--disable-setuid-sandbox']
// //   });

// //   const page = await browser.newPage();
// //   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

// //   // 🔥 EL ARMA SECRETA: Monkey Patching
// //   // Inyectamos este script ANTES de que la página ejecute su propio código.
// //   await page.evaluateOnNewDocument(() => {
// //     // Creamos una bóveda secreta en el navegador para guardar los barcos
// //     window.bovedaSecretaVessels = new Map();

// //     // Función para identificar si un objeto de Javascript parece un barco
// //     const esUnBarco = (obj) => {
// //       if (!obj || typeof obj !== 'object') return false;

// //       // Buscamos coordenadas (las variables suelen estar minificadas como 'l', 'ln', 'lat', 'lng')
// //       const tieneLat = 'lat' in obj || 'latitude' in obj || 'l' in obj || '_lat' in obj;
// //       const tieneLon = 'lon' in obj || 'lng' in obj || 'longitude' in obj || 'ln' in obj || '_lng' in obj;

// //       if (tieneLat && tieneLon) {
// //         // Verificamos si tiene datos adicionales para confirmar (nombre, ID, mmsi, velocidad, rumbo)
// //         return ('name' in obj || 'n' in obj || 'mmsi' in obj || 'id' in obj || 'speed' in obj || 's' in obj || 'course' in obj || 'c' in obj);
// //       }
// //       return false;
// //     };

// //     // 1. Interceptamos (Hackeamos) el método Array.prototype.push nativo
// //     const originalPush = Array.prototype.push;
// //     Array.prototype.push = function (...args) {
// //       args.forEach(item => {
// //         if (esUnBarco(item)) {
// //           // Si es un barco, hacemos una copia y lo guardamos en nuestra bóveda
// //           const id = item.mmsi || item.id || item.name || item.n || Math.random();
// //           window.bovedaSecretaVessels.set(id, JSON.parse(JSON.stringify(item)));
// //         }
// //       });
// //       // Dejamos que el push original siga su curso para no romper el mapa
// //       return originalPush.apply(this, args);
// //     };

// //     // 2. Interceptamos Map.prototype.set (algunos frameworks modernos lo usan en lugar de Arrays)
// //     const originalMapSet = Map.prototype.set;
// //     Map.prototype.set = function (key, value) {
// //       if (esUnBarco(value)) {
// //         const id = value.mmsi || value.id || value.name || value.n || key;
// //         window.bovedaSecretaVessels.set(id, JSON.parse(JSON.stringify(value)));
// //       }
// //       return originalMapSet.call(this, key, value);
// //     };
// //   });

// //   try {
// //     console.log("📡 Navegando a la bahía de Buenaventura...");
// //     const urlBuenaventura = 'https://www.vesselfinder.com/?lat=3.88&lon=-77.05&zoom=11';

// //     // networkidle2 asegura que el código interno haya tenido tiempo de descargarse
// //     // await page.goto(urlBuenaventura, { waitUntil: 'networkidle2', timeout: 45000 });
// //     await page.goto(urlBuenaventura, { waitUntil: 'domcontentloaded', timeout: 60000 });

// //     console.log("⏳ Página cargada. Esperando 15 segundos a que se decodifiquen los binarios y se pinte el mapa...");
// //     await new Promise(r => setTimeout(r, 15000));

// //     // 🕵️‍♂️ MOMENTO DE EXTRACCIÓN: Le pedimos a la página que nos entregue la bóveda
// //     const botin = await page.evaluate(() => {
// //       // 1. Extraemos de nuestra intercepción
// //       let barcos = Array.from(window.bovedaSecretaVessels.values());

// //       // 2. Plan B: Si la intercepción falló, buscamos arrays globales a la fuerza bruta en 'window'
// //       if (barcos.length === 0) {
// //         for (let key of Object.keys(window)) {
// //           try {
// //             const obj = window[key];
// //             // Buscamos arreglos de más de 50 elementos que parezcan tener datos de naves
// //             if (Array.isArray(obj) && obj.length > 50 && obj[0] && typeof obj[0] === 'object') {
// //               if ('lat' in obj[0] || 'l' in obj[0] || 'mmsi' in obj[0]) {
// //                 barcos = obj;
// //                 break;
// //               }
// //             }
// //           } catch (e) { }
// //         }
// //       }
// //       return barcos;
// //     });

// //     if (botin.length > 0) {
// //       console.log("==================================================");
// //       console.log(`✅ ¡JACKPOT! Se interceptaron ${botin.length} barcos estructurados.`);
// //       console.log("📊 MUESTRA DEL PRIMER BARCO (Totalmente decodificado):");
// //       console.log(botin[0]);
// //       console.log("==================================================");
// //       console.log("🎯 Siguiente paso: Mapear estas propiedades (lat, lon, etc.) y pasarlas a SQL Server para poblar TCLAisUltimaPosicion.");
// //     } else {
// //       console.log("⚠️ No logramos atrapar el JSON en memoria.");
// //       console.log("Posiblemente están usando Canvas WebGL puro y manteniendo la información en un worker aislado.");
// //     }

// //   } catch (error) {
// //     console.error("❌ Error durante la misión:", error.message);
// //   } finally {
// //     console.log("🧹 Cerrando navegador ninja...");
// //     await browser.close();
// //   }
// // }

// // iniciarScrapingNinja();

// const puppeteer = require('puppeteer-extra');
// const StealthPlugin = require('puppeteer-extra-plugin-stealth');

// puppeteer.use(StealthPlugin());

// async function iniciarScrapingNinja() {
//   console.log("==================================================");
//   console.log("🥷 INICIANDO MISIÓN: SECUESTRO DE MEMORIA CLIENT-SIDE");
//   console.log("==================================================");

//   const browser = await puppeteer.launch({
//     headless: false, // Mantenemos false para que veas qué ocurre
//     args: ['--no-sandbox', '--disable-setuid-sandbox']
//   });

//   const page = await browser.newPage();
//   await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

//   // 🔥 EL ARMA SECRETA: Monkey Patching
//   // Inyectamos este script ANTES de que la página ejecute su propio código.
//   await page.evaluateOnNewDocument(() => {
//     // Creamos una bóveda secreta en el navegador para guardar los barcos
//     window.bovedaSecretaVessels = new Map();

//     // Función para identificar si un objeto de Javascript parece un barco
//     const esUnBarco = (obj) => {
//       if (!obj || typeof obj !== 'object') return false;

//       // Buscamos coordenadas (las variables suelen estar minificadas como 'l', 'ln', 'lat', 'lng')
//       const tieneLat = 'lat' in obj || 'latitude' in obj || 'l' in obj || '_lat' in obj;
//       const tieneLon = 'lon' in obj || 'lng' in obj || 'longitude' in obj || 'ln' in obj || '_lng' in obj;

//       if (tieneLat && tieneLon) {
//         // Verificamos si tiene datos adicionales para confirmar (nombre, ID, mmsi, velocidad, rumbo)
//         return ('name' in obj || 'n' in obj || 'mmsi' in obj || 'id' in obj || 'speed' in obj || 's' in obj || 'course' in obj || 'c' in obj);
//       }
//       return false;
//     };

//     // 1. Interceptamos (Hackeamos) el método Array.prototype.push nativo
//     const originalPush = Array.prototype.push;
//     Array.prototype.push = function (...args) {
//       args.forEach(item => {
//         if (esUnBarco(item)) {
//           // Si es un barco, hacemos una copia y lo guardamos en nuestra bóveda
//           const id = item.mmsi || item.id || item.name || item.n || Math.random();
//           window.bovedaSecretaVessels.set(id, JSON.parse(JSON.stringify(item)));
//         }
//       });
//       // Dejamos que el push original siga su curso para no romper el mapa
//       return originalPush.apply(this, args);
//     };

//     // 2. Interceptamos Map.prototype.set (algunos frameworks modernos lo usan en lugar de Arrays)
//     const originalMapSet = Map.prototype.set;
//     Map.prototype.set = function (key, value) {
//       if (esUnBarco(value)) {
//         const id = value.mmsi || value.id || value.name || value.n || key;
//         window.bovedaSecretaVessels.set(id, JSON.parse(JSON.stringify(value)));
//       }
//       return originalMapSet.call(this, key, value);
//     };
//   });

//   try {
//     console.log("📡 Navegando a la bahía de Buenaventura...");
//     const urlBuenaventura = 'https://www.vesselfinder.com/?lat=3.88&lon=-77.05&zoom=11';

//     try {
//       // Usamos domcontentloaded para que no se quede colgado esperando a la publicidad y WebSockets
//       await page.goto(urlBuenaventura, { waitUntil: 'domcontentloaded', timeout: 60000 });
//     } catch (navErr) {
//       console.log("⚠️ Timeout de navegación detectado, pero continuamos con los scripts cargados en memoria...");
//     }

//     console.log("⏳ Página iniciada. Esperando 15 segundos a que se decodifiquen los binarios y se pinte el mapa...");
//     await new Promise(r => setTimeout(r, 15000));

//     // 🕵️‍♂️ MOMENTO DE EXTRACCIÓN: Le pedimos a la página que nos entregue la bóveda
//     const botin = await page.evaluate(() => {
//       // 1. Extraemos de nuestra intercepción
//       let barcos = Array.from(window.bovedaSecretaVessels.values());

//       // 2. Plan B: Si la intercepción falló, buscamos arrays globales a fuerza bruta en 'window'
//       if (barcos.length === 0) {
//         for (let key of Object.keys(window)) {
//           try {
//             const obj = window[key];
//             // Buscamos arreglos de más de 50 elementos que parezcan tener datos de naves
//             if (Array.isArray(obj) && obj.length > 50 && obj[0] && typeof obj[0] === 'object') {
//               if ('lat' in obj[0] || 'l' in obj[0] || 'mmsi' in obj[0]) {
//                 barcos = obj;
//                 break;
//               }
//             }
//           } catch (e) { }
//         }
//       }
//       return barcos;
//     });

//     if (botin.length > 0) {
//       console.log("==================================================");
//       console.log(`✅ ¡JACKPOT! Se interceptaron ${botin.length} barcos estructurados.`);
//       console.log("📊 MUESTRA DEL PRIMER BARCO (Totalmente decodificado):");
//       console.log(botin[0]);
//       console.log("==================================================");
//       console.log("🎯 Siguiente paso: Mapear estas propiedades para guardarlas en tu base de datos.");
//     } else {
//       console.log("⚠️ No logramos atrapar el JSON en memoria.");
//       console.log("Posiblemente están usando Canvas WebGL puro y manteniendo la información en un worker aislado.");
//     }

//   } catch (error) {
//     console.error("❌ Error grave durante la misión:", error.message);
//   } finally {
//     console.log("🧹 Cerrando navegador ninja...");
//     await browser.close();
//     process.exit();
//   }
// }

// iniciarScrapingNinja();
const puppeteer = require('puppeteer-extra');
const StealthPlugin = require('puppeteer-extra-plugin-stealth');

puppeteer.use(StealthPlugin());

async function iniciarScrapingNinja() {
  console.log("==================================================");
  console.log("🥷 INICIANDO MISIÓN: INTERCEPCIÓN DE COMUNICACIONES (WORKERS & WEBSOCKETS)");
  console.log("==================================================");

  const browser = await puppeteer.launch({
    headless: false,
    args: ['--no-sandbox', '--disable-setuid-sandbox']
  });

  const page = await browser.newPage();
  await page.setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');

  // 🔥 NUEVO ARMA SECRETA: Pinchando los teléfonos (Workers y WebSockets)
  await page.evaluateOnNewDocument(() => {
    // Aquí guardaremos los paquetes sospechosos
    window.radarInterceptado = [];

    // HACK 1: Interceptar Web Workers
    const OriginalWorker = window.Worker;
    window.Worker = function (...args) {
      const worker = new OriginalWorker(...args);

      // Escuchamos todo lo que el worker le envía a la ventana principal
      worker.addEventListener('message', function (e) {
        if (e.data) {
          let esInteresante = false;
          let resumen = "";
          let muestra = null;

          // Si es un arreglo binario (como un Float32Array usado en WebGL)
          if (e.data instanceof ArrayBuffer || ArrayBuffer.isView(e.data)) {
            esInteresante = true;
            resumen = `Datos Binarios (TypedArray) de longitud ${e.data.byteLength || e.data.length}`;
            // Intentamos convertir los primeros bytes a números para ver si son coordenadas
            try { muestra = Array.from(new Float32Array(e.data.buffer || e.data).slice(0, 6)); } catch (err) { }
          }
          // Si es un arreglo gigante de JS
          else if (Array.isArray(e.data) && e.data.length > 50) {
            esInteresante = true;
            resumen = `Arreglo masivo con ${e.data.length} elementos`;
            muestra = e.data.slice(0, 2); // Tomamos 2 elementos de muestra
          }
          // Si es un objeto que contiene arreglos gigantes adentro
          else if (typeof e.data === 'object') {
            for (let k in e.data) {
              let val = e.data[k];
              if (val && (val instanceof ArrayBuffer || ArrayBuffer.isView(val) || (Array.isArray(val) && val.length > 50))) {
                esInteresante = true;
                resumen = `Objeto complejo. Propiedad [${k}] contiene datos masivos`;
                try { muestra = "No se puede previsualizar fácilmente, pero atrapamos el objeto"; } catch (err) { }
                break;
              }
            }
          }

          // Guardamos un máximo de 10 intercepciones para no explotar la memoria de Node
          if (esInteresante && window.radarInterceptado.length < 10) {
            window.radarInterceptado.push({
              origen: 'Web Worker',
              resumen: resumen,
              muestra: muestra
            });
          }
        }
      });
      return worker;
    };

    // HACK 2: Interceptar WebSockets (Por si envían el JSON en tiempo real)
    const OriginalWebSocket = window.WebSocket;
    window.WebSocket = function (...args) {
      const ws = new OriginalWebSocket(...args);
      ws.addEventListener('message', function (e) {
        if (e.data && e.data.length > 100) { // Si el mensaje es larguito
          window.radarInterceptado.push({
            origen: 'WebSocket',
            resumen: `Mensaje de ${e.data.length} caracteres`,
            muestra: typeof e.data === 'string' ? e.data.substring(0, 150) + "..." : "Datos Binarios"
          });
        }
      });
      return ws;
    };
  });

  try {
    console.log("📡 Navegando a la bahía de Buenaventura...");
    const urlBuenaventura = 'https://www.vesselfinder.com/?lat=3.88&lon=-77.05&zoom=11';

    try {
      await page.goto(urlBuenaventura, { waitUntil: 'domcontentloaded', timeout: 60000 });
    } catch (navErr) {
      console.log("⚠️ Timeout de navegación detectado, pero continuamos...");
    }

    console.log("⏳ Esperando 15 segundos a que la página intercambie datos por los Web Workers...");
    await new Promise(r => setTimeout(r, 15000));

    // 🕵️‍♂️ MOMENTO DE EXTRACCIÓN: Pedimos el registro de intercepciones
    const botin = await page.evaluate(() => window.radarInterceptado);

    if (botin && botin.length > 0) {
      console.log("==================================================");
      console.log(`✅ ¡CONTACTO! Se interceptaron ${botin.length} flujos de datos sospechosos.`);
      console.log("📊 RESULTADOS DEL RADAR (Imprimiendo todo lo capturado):");
      console.dir(botin, { depth: null, colors: true });
      console.log("==================================================");
      console.log("🎯 Analiza la 'muestra'. Si vemos números que parecen coordenadas (ej. 3.88, -77.05) sabremos qué variable hackear.");
    } else {
      console.log("⚠️ Radar vacío. Están usando métodos de renderizado aún más oscuros (ej. WebAssembly directo al Canvas sin pasar por JS).");
    }

  } catch (error) {
    console.error("❌ Error grave durante la misión:", error.message);
  } finally {
    console.log("🧹 Cerrando navegador ninja...");
    await browser.close();
    process.exit();
  }
}

iniciarScrapingNinja();