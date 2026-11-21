/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Latido de la plataforma (CC-279)
    Description: ¿Responde la base de datos? SELECT 1 con tope de 3 s, revisada como mucho cada 20 s (el latido de muchas
      pestañas no carga la base). No expone nombres de servidor ni mensajes del motor: solo ok y milisegundos.
*/
const { db } = require('../../database/connection');

const CADA_MS = 20000;
const TOPE_MS = 3000;

class SaludService {
  constructor(consultar = () => db.sequelize.query('SELECT 1 AS uno', { plain: true })) {
    this.consultar = consultar;
    this.ultima = null;
    this.enCurso = null;
  }

  async baseDeDatos(ahora = Date.now()) {
    if (this.ultima && ahora - this.ultima.t < CADA_MS) return this.ultima.valor;
    if (!this.enCurso) {
      this.enCurso = (async () => {
        const inicio = Date.now();
        let ok = false;
        try {
          let temporizador;
          await Promise.race([this.consultar(), new Promise((_, rej) => { temporizador = setTimeout(() => rej(new Error('tope')), TOPE_MS); })])
            .finally(() => clearTimeout(temporizador));
          ok = true;
        } catch { ok = false; }
        const valor = { ok, ms: Date.now() - inicio, revisadaEn: new Date().toISOString() };
        this.ultima = { t: Date.now(), valor };
        this.enCurso = null;
        return valor;
      })();
    }
    return this.enCurso;
  }
}

module.exports = new SaludService();
module.exports.SaludService = SaludService;
