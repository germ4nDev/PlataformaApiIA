// 🟢 Apuntando al servicio renombrado
const UsuariosWidgetsService = require('../services/usuarios-widgets.service');
const layoutService = new UsuariosWidgetsService();

const getLayoutByUsuario = async (req, res) => {
  try {
    const { codigoUsuario } = req.params;
    const layout = await layoutService.getLayoutUsuario(codigoUsuario);
    res.status(200).json({ ok: true, layoutData: layout });
  } catch (error) {
    res.status(error.statusCode || 500).json({ ok: false, msg: error.msg });
  }
};

const saveOrUpdateLayout = async (req, res) => {
  try {
    const { codigoUsuario, layoutData } = req.body;
    const resultado = await layoutService.guardarLayout(codigoUsuario, layoutData);
    res.status(200).json(resultado);
  } catch (error) {
    console.error("🔥 ERROR REAL AL GUARDAR LAYOUT:", error); // 🟢 Esto revelará al culpable

    if (error.type === 'ValidationError') {
      return res.status(400).json({ ok: false, msg: "Error de validación", errores: error.details });
    }
    res.status(error.statusCode || 500).json({ ok: false, msg: error.msg || 'Error interno.' });
  }
};

module.exports = { getLayoutByUsuario, saveOrUpdateLayout };