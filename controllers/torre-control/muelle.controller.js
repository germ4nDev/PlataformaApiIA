/*
    Author: German Valencia
    Pattern: QPLUS Standard - Controlador de Muelles
*/
const { response } = require('express');
const MuellesService = require('../../services/torre-control/muelles.service');

const muellesService = new MuellesService();

const getMuelles = async (req, res = response) => {
  try {
    const respuesta = await muellesService.getMuelles();

    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el listado de muelles. Hable con el administrador.',
      error: error.message || error
    });
  }
};

const getMuelleById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const respuesta = await muellesService.getMuelleById(id);

    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró un muelle con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el muelle'
    });
  }
};

const crearMuelle = async (req, res = response) => {
  try {
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };
    const nuevoMuelle = await muellesService.crearMuelle(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Muelle creado exitosamente',
      data: nuevoMuelle
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al crear el muelle'),
      detalles: error.details || error
    });
  }
};

const updateMuelle = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    // if (dataDTO.geocerca_geo) {
    //   // Si viene una geocerca nueva, la convertimos para SQL Server
    //   dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.geocerca_geo}', 4326)`);
    // } else {
    //   // 🟢 LA MAGIA AQUÍ: Si es null o no viene, borramos la propiedad.
    //   // Así Sequelize no la incluye en el SET del UPDATE y respeta la existente en BD.
    //   delete dataDTO.geocerca_geo;
    // }

    console.log('actualizar muelle id', id);
    console.log('actualizar muelle', req.body);
    const muelleActualizado = await muellesService.updateMuelle(id, req.body, userContext);
    console.log('actualizado muelle', muelleActualizado);

    res.json({
      ok: true,
      msg: 'Muelle actualizado exitosamente',
      data: muelleActualizado
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al actualizar el muelle'),
      detalles: error.details || error
    });
  }
};

const deleteMuelle = async (req, res = response) => {
  try {
    const { id_muelle } = req.params;
    const muelleEliminado = await muellesService.deleteMuelle(id_muelle);

    res.json({
      ok: true,
      msg: 'Muelle eliminado correctamente',
      data: muelleEliminado
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al eliminar el muelle'
    });
  }
};

module.exports = {
  getMuelles,
  getMuelleById,
  crearMuelle,
  updateMuelle,
  deleteMuelle
};