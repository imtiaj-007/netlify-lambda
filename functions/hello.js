const express = require('express');
const serverless = require('serverless-http');
const testRoutes = require('../routes/test')

const app = express();

app.use('/.netlify/functions/hello', testRoutes);
module.exports.handler = serverless(app);

