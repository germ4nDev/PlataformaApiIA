/*
    Author: German Valencia
    Pattern: QPLUS Model - TLCRNDCOperacionTerrestre
    Descripción: Mapeo completo de la estructura de operación terrestre RNDC
*/
module.exports = (sequelize, DataTypes) => {
  const RNDCOperacion = sequelize.define('TLCRNDCOperacionTerrestre', {
    codigoRegistroRNDC: { type: DataTypes.UUID, primaryKey: true, allowNull: false },
    anomes: { type: DataTypes.INTEGER },
    codConfiguracionVehicular: { type: DataTypes.STRING(20) },
    configuracionVehiculo: { type: DataTypes.STRING(100) },
    codOperacionTransporte: { type: DataTypes.STRING(20) },
    operacionTransporte: { type: DataTypes.STRING(100) },
    codTipoContenedor: { type: DataTypes.STRING(20) },
    tipoContenedor: { type: DataTypes.STRING(100) },
    codMunicipioOrigen: { type: DataTypes.STRING(20) },
    municipioOrigen: { type: DataTypes.STRING(150) },
    departamentoOrigen: { type: DataTypes.STRING(150) },
    codMunicipioDestino: { type: DataTypes.STRING(20) },
    municipioDestino: { type: DataTypes.STRING(150) },
    departamentoDestino: { type: DataTypes.STRING(150) },
    codMunicipioIntermedio: { type: DataTypes.STRING(20) },
    municipioIntermedio: { type: DataTypes.STRING(150) },
    departamentoIntermedio: { type: DataTypes.STRING(150) },
    codMercancia: { type: DataTypes.STRING(20) },
    mercancia: { type: DataTypes.STRING(255) },
    naturalezaCarga: { type: DataTypes.STRING(100) },
    viajesTotales: { type: DataTypes.INTEGER },
    kilogramos: { type: DataTypes.DECIMAL(18, 2) },
    galones: { type: DataTypes.DECIMAL(18, 2) },
    viajesLiquidos: { type: DataTypes.INTEGER },
    viajesValorCero: { type: DataTypes.INTEGER },
    kilometros: { type: DataTypes.DECIMAL(18, 2) },
    valoresPagados: { type: DataTypes.DECIMAL(18, 2) },
    kilometrosRegreso: { type: DataTypes.DECIMAL(18, 2) },
    kilogramosRegreso: { type: DataTypes.DECIMAL(18, 2) },
    galonesRegreso: { type: DataTypes.DECIMAL(18, 2) },
    fechaInicioPeriodo: { type: DataTypes.DATE },
    fechaFinPeriodo: { type: DataTypes.DATE },
    codigoUsuarioCreacion: { type: DataTypes.STRING(200) },
    fechaCreacion: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
  }, {
    tableName: 'TLCRNDCOperacionTerrestre',
    timestamps: false
  });

  return RNDCOperacion;
};