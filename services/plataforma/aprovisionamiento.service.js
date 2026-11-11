/*
    Author: German Valencia
    Pattern: PLATAFORMA Service - Aprovisionamiento de bases por suscriptor (OT-030)
    Description (decisiones del usuario, 2026-11-10): al asignar un paquete se crea una base por cada aplicación del paquete (menos la
    Plataforma), con nombre prefijoBD + '_' + codigoSuscriptor y su esquema versionado (database/suscriptores/<PREFIJO>/NNN_*.sql). La venta
    no espera ni se bloquea: el trabajo queda en PTL_Aprovisionamientos y un trabajador del API lo procesa una base a la vez; si falla queda
    ERROR con su mensaje y se reintenta desde Suscriptores › Paquetes.
      encolar({ codigoSuscriptor, codigoPaquete })   registra PENDIENTE las aplicaciones del paquete y despierta al trabajador
      listar({ codigoSuscriptor })                   estado de sus bases
      reintentar({ codigoSuscriptor, codigoAplicacion })
      actualizarTodas()                              corre los scripts nuevos en todas las bases LISTA (después de agregar un NNN_*.sql)
      iniciar()                                      al arrancar el API: retoma pendientes y atascadas
*/
const fs = require('fs');
const path = require('path');
const Repo = require('../../repositories/plataforma/aprovisionamiento.repository');
const N = require('../../utils/plataforma/aprovisionamiento');
const { validarCon, crearError } = require('../../helpers/errores.helper');
const M = require('../../models/plataforma/aprovisionamiento.model');

const CARPETA = path.join(__dirname, '../../database/suscriptores');
const TABLA_VERSIONES = `IF OBJECT_ID(N'dbo.EsquemaVersiones') IS NULL
  CREATE TABLE dbo.EsquemaVersiones (version INT NOT NULL PRIMARY KEY, archivo NVARCHAR(200) NOT NULL, fechaAplicacion DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME());`;
const MAX_VUELTAS = 200;

class AprovisionamientoService {
  constructor({ repo = Repo, carpeta = CARPETA, leer = (p) => fs.readFileSync(p, 'utf8'), listarDir = (d) => (fs.existsSync(d) ? fs.readdirSync(d) : []),
    avisar = null } = {}) {
    Object.assign(this, { repo, carpeta, leer, listarDir });
    this.avisar = avisar || ((datos) => { try { require('../../helpers/socket.helper').getIO().emit('aprovisionamientos-actualizados', datos); } catch { /* sin socket */ } });
    this.trabajando = null;
  }

  scripts(prefijo) {
    const dir = path.join(this.carpeta, String(prefijo).toUpperCase());
    return this.listarDir(dir).filter((a) => N.versionDe(a) !== null).map((a) => ({ archivo: a, ruta: path.join(dir, a) }));
  }

  async encolar({ codigoSuscriptor, codigoPaquete }) {
    const apps = N.aprovisionables(await this.repo.aplicacionesDePaquete(codigoPaquete));
    const filas = [];
    for (const a of apps) {
      filas.push(await this.repo.registrar({ codigoSuscriptor, codigoAplicacion: a.codigoAplicacion, codigoPaquete, nombreBD: N.nombreBD(a.prefijoBD, codigoSuscriptor) }));
    }
    this.despertar();
    return filas;
  }

  /** Un solo trabajador a la vez; devuelve la promesa del trabajo en curso (las pruebas la esperan). */
  despertar() {
    if (!this.trabajando) this.trabajando = this.procesar().catch((e) => console.error('❌ [Aprovisionamiento]', e?.message || e)).finally(() => { this.trabajando = null; });
    return this.trabajando;
  }

  async procesar() {
    for (let i = 0; i < MAX_VUELTAS; i++) {
      const f = N.porTomar(await this.repo.filas());
      if (!f) return;
      await this.aprovisionar(f);
    }
  }

  async aprovisionar(f) {
    await this.repo.marcar(f.codigoAprovisionamiento, { estado: 'EN_CURSO', sumarIntento: true });
    try {
      const nombre = f.nombreBD;
      if (!(await this.repo.existeBD(nombre))) await this.repo.crearBD(nombre);
      await this.repo.ejecutar(nombre, [TABLA_VERSIONES]);
      const prefijo = f.prefijoBD || nombre.split('_')[0];
      const todos = this.scripts(prefijo);
      const faltan = N.pendientes(todos.map((s) => s.archivo), await this.repo.versionesAplicadas(nombre));
      let version = Math.max(0, ...(await this.repo.versionesAplicadas(nombre)));
      for (const archivo of faltan) {
        const v = N.versionDe(archivo);
        const lotes = [...N.partirLotes(this.leer(todos.find((s) => s.archivo === archivo).ruta)),
          `INSERT INTO dbo.EsquemaVersiones (version, archivo) VALUES (${v}, N'${archivo}');`];
        await this.repo.ejecutar(nombre, lotes);
        version = v;
      }
      await this.repo.registrarConexion({ ...f, nombreBD: nombre });
      await this.repo.marcar(f.codigoAprovisionamiento, { estado: 'LISTA', mensaje: null, version });
      this.avisar({ codigoSuscriptor: f.codigoSuscriptor, estado: 'LISTA', nombreBD: nombre });
    } catch (e) {
      console.error(`❌ [Aprovisionamiento] ${f.nombreBD}:`, e?.message || e);
      await this.repo.marcar(f.codigoAprovisionamiento, { estado: 'ERROR', mensaje: e?.original?.message || e?.message || e?.msg || 'Error desconocido' });
      this.avisar({ codigoSuscriptor: f.codigoSuscriptor, estado: 'ERROR', nombreBD: f.nombreBD });
    }
  }

  async listar(params) {
    const { codigoSuscriptor } = validarCon(M.SuscriptorSchema, params);
    return this.repo.filas({ codigoSuscriptor });
  }

  async reintentar(body) {
    const { codigoSuscriptor, codigoAplicacion } = validarCon(M.ReintentarSchema, body);
    const f = (await this.repo.filas({ codigoSuscriptor })).find((x) => x.codigoAplicacion === codigoAplicacion);
    if (!f) throw crearError(404, 'Ese suscriptor no tiene base para esa aplicación.', 'NO_EXISTE');
    if (f.estado === 'EN_CURSO') throw { statusCode: 409, msg: 'La base se está creando en este momento.', codigo: 'EN_CURSO' };
    await this.repo.marcar(f.codigoAprovisionamiento, { estado: 'PENDIENTE', mensaje: null });
    this.despertar();
    return { ...f, estado: 'PENDIENTE', mensaje: null };
  }

  async actualizarTodas() {
    const listas = (await this.repo.filas()).filter((f) => f.estado === 'LISTA');
    for (const f of listas) await this.aprovisionar(f);
    const despues = await this.repo.filas();
    return { revisadas: listas.length, conError: despues.filter((f) => f.estado === 'ERROR').map((f) => f.nombreBD) };
  }

  iniciar() { return this.despertar(); }
}

module.exports = new AprovisionamientoService();
module.exports.AprovisionamientoService = AprovisionamientoService;
