const express = require('express');
const serverless = require('serverless-http');
const userRoutes = require('../routes/user')

const app = express();

app.use('/.netlify/functions/hello', userRoutes);
module.exports.handler = serverless(app);

