const express = require('express');
const serverless = require('serverless-http');

const app = express();

app.get('/hello', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

module.exports.handler = serverless(app);


// exports.handler = async (event, context) => {
//     return {
//         statusCode: 200,
//         body: JSON.stringify({ message: "Hello, World!" })
//     };
// };