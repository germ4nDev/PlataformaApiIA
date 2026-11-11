/*
    Author: German Valencia
    Pattern: PLATAFORMA Repository - Listas de precios y su detalle (OT-029)
    Description: Lectura con SQL (el detalle trae el nombre de su paquete o item) y escritura con los modelos de models/lista-precios.model.js.
      listas()                     cabeceras, la más reciente primero
      lista(codigo)                una cabecera o null
      detalles(codigoLista)        filas del detalle con nombreReferencia
      detalle(codigoDetalle)       una fila o null
      crearLista(l, t) / modificarLista(codigo, cambios) / crearDetalles(filas, t) / modificarDetalle(cod, cambios) / eliminarDetalle(cod)
      tipoPaquete(codigo)          { codigoTipoPaquete, nombreTipoPaquete, numMeses, descuentoMeses } o null
      itemsDePaquete(codigo)       [{ codigoItem (= codigoValor, el ítem del catálogo), cantidad, estadoItem }] (composición del paquete)
      enTransaccion(fn)            fn(t) dentro de una transacción
*/
const { QueryTypes } = require('sequelize');
const { db, sequelize } = require('../../database/connection');
const { ListaPreciosModel, ListaPreciosDetalleModel } = require('../../models/lista-precios.model');

const Lista = ListaPreciosModel(sequelize);
const Detalle = ListaPreciosDetalleModel(sequelize);
const q = (sql, replacements = {}) => db.sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const plano = (r) => (r && r.get ? r.get({ plain: true }) : r);

const listas = () => q(`SELECT codigoLista, nombreLista, moneda, paisAplica, fechaInicio, fechaFin, estadoLista,
    (SELECT COUNT(*) FROM dbo.PTL_ListasPreciosDetalle d WHERE d.codigoLista = l.codigoLista) AS numPrecios
  FROM dbo.PTL_ListasPrecios l ORDER BY fechaInicio DESC, nombreLista`);

async function lista(codigoLista) {
  const [fila] = await q('SELECT * FROM dbo.PTL_ListasPrecios WHERE codigoLista = :codigoLista', { codigoLista });
  return fila || null;
}

const detalles = (codigoLista) => q(`SELECT d.codigoDetalle, d.codigoLista, d.tipoReferencia, d.codigoReferencia, d.valorMensual, d.valorAnual,
    d.precioSetup, d.estadoDetalle, COALESCE(p.nombrePaquete, i.nombreItem, d.codigoReferencia) AS nombreReferencia
  FROM dbo.PTL_ListasPreciosDetalle d
  LEFT JOIN dbo.PTL_Paquetes p ON d.tipoReferencia = 'PAQUETE' AND p.codigoPaquete = d.codigoReferencia
  LEFT JOIN dbo.PTL_Items i ON d.tipoReferencia = 'ITEM' AND i.codigoItem = d.codigoReferencia
  WHERE d.codigoLista = :codigoLista
  ORDER BY d.tipoReferencia DESC, nombreReferencia`, { codigoLista });

async function detalle(codigoDetalle) {
  const [fila] = await q('SELECT * FROM dbo.PTL_ListasPreciosDetalle WHERE codigoDetalle = :codigoDetalle', { codigoDetalle });
  return fila || null;
}

const crearLista = async (l, transaction) => plano(await Lista.create(l, { transaction }));
const modificarLista = (codigoLista, cambios) => Lista.update(cambios, { where: { codigoLista } });
const crearDetalles = (filas, transaction) => Detalle.bulkCreate(filas, { transaction });
const modificarDetalle = (codigoDetalle, cambios) => Detalle.update(cambios, { where: { codigoDetalle } });
const eliminarDetalle = (codigoDetalle) => Detalle.destroy({ where: { codigoDetalle } });

async function tipoPaquete(codigoTipoPaquete) {
  const [fila] = await q(`SELECT codigoTipoPaquete, nombreTipoPaquete, numMeses, descuentoMeses
    FROM dbo.PTL_TiposPaquete WHERE codigoTipoPaquete = :codigoTipoPaquete`, { codigoTipoPaquete });
  return fila || null;
}

// PTL_ItemsPaquete.codigoValor es el ítem del catálogo (codigoItem es el código de la fila)
const itemsDePaquete = (codigoPaquete) => q(`SELECT codigoValor AS codigoItem, cantidad, estadoItem FROM dbo.PTL_ItemsPaquete
  WHERE codigoPaquete = :codigoPaquete`, { codigoPaquete });

const enTransaccion = (fn) => sequelize.transaction(fn);

module.exports = { listas, lista, detalles, detalle, crearLista, modificarLista, crearDetalles, modificarDetalle, eliminarDetalle, tipoPaquete, itemsDePaquete, enTransaccion };
