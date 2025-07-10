const environment = process.env.NODE_ENV || "local";

const config = require(`./config/${environment}.json`);

module.exports = config;
