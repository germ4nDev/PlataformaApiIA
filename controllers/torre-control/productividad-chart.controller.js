
const { responderError } = require('../../helpers/errores.helper');const ProductividadService = require('../../services/torre-control/productividad.service'); // Ajusta la ruta

class ProductividadChartController {

    static async getProductividadGrafica(req, res) {
        try {
            // 🚨 EL FIX: Angular manda '?puerto=CARTAGENA', así que extraemos 'puerto'
            // Ponemos 'ciudad' también por si acaso en algún otro lado lo llaman así
            const ciudadFiltro = req.query.puerto || req.query.ciudad;

            // Le pasamos la variable correcta al servicio
            const datos = await ProductividadService.obtenerProductividadPorCiudad(ciudadFiltro);

            return res.status(200).json({
                ok: true,
                data: datos,
                mensaje: 'Datos de productividad gráfica obtenidos correctamente'
            });

        } catch (error) {
          return responderError(res, error, 'productividad-chart.getProductividadGrafica');
        }
    }
}

module.exports = ProductividadChartController;