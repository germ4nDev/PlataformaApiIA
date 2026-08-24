// utils/paginate.js
const { Op } = require('sequelize');

module.exports = async function paginate(model, req, searchableFields = []) {
  const page = Math.max(parseInt(req.query.page) || 1, 1);
  const limit = Math.max(parseInt(req.query.limit) || 10, 1);
  const offset = (page - 1) * limit;

  const allowedOrderFields = searchableFields.length ? searchableFields : ['id'];
  const orderBy = allowedOrderFields.includes(req.query.orderBy) ? req.query.orderBy : allowedOrderFields[0];
  const direction = req.query.direction?.toLowerCase() === 'desc' ? 'DESC' : 'ASC';

  const search = req.query.search?.trim() || '';
  if (search.length > 100) throw new Error('Búsqueda demasiado larga');

  const where = {};
  if (search && searchableFields.length) {
    where[Op.or] = searchableFields.map(field => ({
      [field]: { [Op.like]: `%${search}%` }
    }));
  }

  const result = await model.findAndCountAll({
    where,
    limit,
    offset,
    order: [[orderBy, direction]]
  });

  return {
    currentPage: page,
    totalPages: Math.ceil(result.count / limit),
    totalItems: result.count,
    items: result.rows
  };
};
