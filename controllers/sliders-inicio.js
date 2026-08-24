/*
    Author: German Valencia
    Refactored for: QPLUS Architecture, Context Injection & Error Handling
*/
const { response } = require("express");
const SliderService = require("../services/sliders-inicio.service");

const service = new SliderService();

const getSliders = async (req, res = response) => {
  try {
    const slidersInicio = await service.getSliders();
    return res.status(200).json({ ok: true, sliders: slidersInicio });
  } catch (error) {
    return res.status(error.statusCode || 500).json({
      ok: false,
      msg: error || `Error interno al obtener los slidersInicio.`
    });
  }
};

const getSliderById = async (req, res = response) => {
  try {
    const { id } = req.params;
    const sliderInicio = await service.getSliderById(id);
    return res.status(200).json({ ok: true, sliderInicio });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al obtener el sliderInicio solicitado."
    });
  }
};

const createSlider = async (req, res = response) => {
  try {
    // QPLUS: Inyección de auditoría
    const usuarioAccion = req.usuario?.codigoUsuario || 'SISTEMA';
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const sliderInicio = await service.createSlider(dataDTO);
    return res.status(201).json({ ok: true, sliderInicio });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al crear el sliderInicio."
    });
  }
};

const updateSlider = async (req, res = response) => {
  try {
    const { id } = req.params;
    console.log('body', req.body);

    // QPLUS: Hidratación del payload de auditoría
    const dataDTO = { ...req.body, codigoUsuario: usuarioAccion };

    const sliderInicio = await service.updateSlider(id, dataDTO);
    return res.status(200).json({ ok: true, sliderInicio });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al actualizar el sliderInicio."
    });
  }
};

const deleteSlider = async (req, res = response) => {
  try {
    const { id } = req.params;
    await service.deleteSlider(id);

    return res.status(200).json({
      ok: true,
      msg: "Slider eliminado correctamente."
    });
  } catch (error) {
    return res.status(error.statusCode || 400).json({
      ok: false,
      msg: error.msg || "Error al eliminar el slider."
    });
  }
};

module.exports = {
  getSliders,
  getSliderById,
  createSlider,
  updateSlider,
  deleteSlider
};