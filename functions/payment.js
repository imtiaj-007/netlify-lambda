require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const expressLayouts = require('express-ejs-layouts');
const serverless = require('serverless-http');

const paymentRoutes = require('../routes/payments');
const url = process.env.MONGO_URL;

mongoose
    .connect(url)
    .then(() => {
        console.log("Connected to MongoDB");
    })
    .catch((error) => {
        console.log(`Internal Server Error : ${error}`);
    })

const app = express();

app.use(expressLayouts);
app.set('view engine', 'ejs');
app.use(express.static(path.resolve('./public')));

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({extended: false}));


app.use('/.netlify/functions/payment', paymentRoutes);
module.exports.handler = serverless(app);