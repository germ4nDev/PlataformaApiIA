const ProductividadService = require('../../services/torre-control/productividad.service'); // Ajusta la ruta

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
            // console.error('Error en ProductividadController.getProductividadGrafica:', error);
            return res.status(500).json({
                ok: false,
                data: null,
                mensaje: 'Error interno al calcular la productividad de la terminal'
            });
        }
    }
}

module.exports = ProductividadChartController;