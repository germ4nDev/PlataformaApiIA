// /*
//     Author: German Valencia
//     Refactored for: PORTTOS Standard - Controlador de Faros
//     Update: Manejo estricto de códigos HTTP y respuestas del Servicio
// */
// const { response } = require('express');
// const FarosService = require('../../services/torre-control/faro.service');

// // Instanciamos el servicio
// const farosService = new FarosService();

// const getFaros = async (req, res = response) => {
//   try {
//     const respuesta = await farosService.getFaros();

//     // El servicio ya nos devuelve el statusCode y la data formateada
//     res.status(respuesta.statusCode).json({
//       ok: respuesta.ok,
//       data: respuesta.data
//     });
//   } catch (error) {
//     res.status(error.statusCode || 500).json({
//       ok: false,
//       msg: error.msg || 'Error al obtener el listado de faros. Hable con el administrador',
//       error: error.message || error
//     });
//   }
// };

// const getFaroById = async (req, res = response) => {
//   try {
//     const { id } = req.params;
//     const respuesta = await farosService.getFaroById(id);

//     // 🟢 CORRECCIÓN: Si el servicio reporta un 404, lo enviamos correctamente a Angular
//     if (!respuesta.ok) {
//       return res.status(respuesta.statusCode).json({
//         ok: false,
//         msg: `No se encontró un puerto con el ID: ${id}`
//       });
//     }

//     res.status(respuesta.statusCode).json({
//       ok: true,
//       data: respuesta.data
//     });
//   } catch (error) {
//     res.status(error.statusCode || 500).json({
//       ok: false,
//       msg: error.msg || 'Error al obtener el puerto'
//     });
//   }
// };

// const crearFaro = async (req, res = response) => {
//   try {
//     const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

//     const nuevoFaro = await farosService.crearFaro(req.body, userContext);

//     res.status(201).json({
//       ok: true,
//       msg: 'Faro creado exitosamente',
//       data: nuevoFaro
//     });
//   } catch (error) {
//     // 🟢 MAGIA PORTTOS: Atrapa el error de Joi (DTO) e informa a Angular exactamente qué falló
//     const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
//     res.status(statusCode).json({
//       ok: false,
//       msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al crear el puerto'),
//       detalles: error.details || error
//     });
//   }
// };

// const updateFaro = async (req, res = response) => {
//   try {
//     const { id } = req.params;
//     const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

//     if (dataDTO.geocerca_geo) {
//       // Si viene una geocerca nueva, la convertimos para SQL Server
//       dataDTO.geocerca_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.geocerca_geo}', 4326)`);
//     } else {
//       // 🟢 LA MAGIA AQUÍ: Si es null o no viene, borramos la propiedad.
//       // Así Sequelize no la incluye en el SET del UPDATE y respeta la existente en BD.
//       delete dataDTO.geocerca_geo;
//     }

//     if (dataDTO.ubicacion_geo) {
//       dataDTO.ubicacion_geo = Sequelize.literal(`geometry::STGeomFromText('${dataDTO.ubicacion_geo}', 4326)`);
//     } else {
//       // Si no viene, la borramos para no sobreescribir con NULL
//       delete dataDTO.ubicacion_geo;
//     }

//     const puertoActualizado = await farosService.updateFaro(id_puerto, req.body, userContext);

//     res.json({
//       ok: true,
//       msg: 'Faro actualizado exitosamente',
//       data: puertoActualizado
//     });
//   } catch (error) {
//     const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
//     res.status(statusCode).json({
//       ok: false,
//       msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al actualizar el puerto'),
//       detalles: error.details || error
//     });
//   }
// };

// const deleteFaro = async (req, res = response) => {
//   try {
//     const { id_puerto } = req.params;
//     const puertoEliminado = await farosService.deleteFaro(id_puerto);

//     res.json({
//       ok: true,
//       msg: 'Faro eliminado correctamente',
//       data: puertoEliminado
//     });
//   } catch (error) {
//     res.status(error.statusCode || 500).json({
//       ok: false,
//       msg: error.msg || 'Error al eliminar el puerto'
//     });
//   }
// };

// module.exports = {
//   getFaros,
//   getFaroById,
//   crearFaro,
//   updateFaro,
//   deleteFaro
// };

/*
    Author: German Valencia
    Refactored for: PORTTOS Standard - Controlador de Faros
    Update: Corrección de constructor, limpieza de código legado y variables
*/
const { response } = require('express');
const farosService = require('../../services/torre-control/faro.service');

const getFaros = async (req, res = response) => {
  try {
    const respuesta = await farosService.getFaros();

    res.status(respuesta.statusCode).json({
      ok: respuesta.ok,
      data: respuesta.data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el listado de faros. Hable con el administrador',
      error: error.message || error
    });
  }
};

const getFaroById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const respuesta = await farosService.getFaroById(id);

    if (!respuesta.ok) {
      return res.status(respuesta.statusCode).json({
        ok: false,
        msg: `No se encontró un faro con el ID: ${id}`
      });
    }

    res.status(respuesta.statusCode).json({
      ok: true,
      data: respuesta.data
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al obtener el faro'
    });
  }
};

const crearFaro = async (req, res = response) => {
  try {
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    const nuevoFaro = await farosService.crearFaro(req.body, userContext);

    res.status(201).json({
      ok: true,
      msg: 'Faro creado exitosamente',
      data: nuevoFaro
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al crear el faro'),
      detalles: error.details || error
    });
  }
};

const updateFaro = async (req, res = response) => {
  try {
    const { id } = req.params;
    const userContext = { codigoUsuario: req.uid || 'SISTEMA_ADMIN' };

    const faroActualizado = await farosService.updateFaro(id, req.body, userContext);

    res.json({
      ok: true,
      msg: 'Faro actualizado exitosamente',
      data: faroActualizado
    });
  } catch (error) {
    const statusCode = error.type === 'ValidationError' ? 400 : (error.statusCode || 500);
    res.status(statusCode).json({
      ok: false,
      msg: error.type === 'ValidationError' ? 'Error de validación en los datos enviados' : (error.msg || 'Error al actualizar el faro'),
      detalles: error.details || error
    });
  }
};

const deleteFaro = async (req, res = response) => {
  try {
    const { id } = req.params;
    const faroEliminado = await farosService.deleteFaro(id);

    res.json({
      ok: true,
      msg: 'Faro eliminado correctamente',
      data: faroEliminado
    });
  } catch (error) {
    res.status(error.statusCode || 500).json({
      ok: false,
      msg: error.msg || 'Error al eliminar el faro'
    });
  }
};

module.exports = {
  getFaros,
  getFaroById,
  crearFaro,
  updateFaro,
  deleteFaro
};