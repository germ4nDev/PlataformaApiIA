// const mongoose = require('mongoose');
const sql = require('mssql')
const { Sequelize } = require('sequelize');

const sqlConfig = {
    user: process.env.DB_USER,
    password: process.env.DB_PWD,
    database: process.env.DB_NAME_MASTER,
    server: process.env.DB_SERVER,
}

const sequelize = new Sequelize(sqlConfig.database, sqlConfig.user, sqlConfig.password, {
    host: sqlConfig.server,
    dialect: 'mssql',
    port: 1433,
    logging: console.log,
    dialectOptions: {
        options: {
            encrypt: false,
            trustServerCertificate: true
        }
    }
});

module.exports = sequelize;