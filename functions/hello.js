const express = require('express');
const serverless = require('serverless-http');

const app = express();
const router = express.Router();

router.get('/', (req, res) => {
  res.json({ message: 'Hello, World!' });
});

app.use('/.netlify/functions/hello', router);
module.exports.handler = serverless(app);


// exports.handler = async (event, context) => {
//     return {
//         statusCode: 200,
//         body: JSON.stringify({ message: "Hello, World!" })
//     };
// };