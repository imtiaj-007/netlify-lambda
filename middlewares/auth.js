require('dotenv').config();
const jwt = require('jsonwebtoken');
const jwtSecret = process.env.SECRET;

async function fetchUser(req, res, next) {
    const token = req.header('authToken');
    
    if(!token){
        return res.status(401).json({
            success: false,
            message: "Please Login to continue"
        })
    }
    try {
        const user = jwt.verify(token, jwtSecret);
        req.user = user._doc;        
    } catch (error) {
        return res.status(401).send({
            success: false,
            message: "Invalid Credentials"
        })
    }
    next();
}

async function getUser(req, res, next) {
    const token = req.header('authToken');
    if(!token)
        next();
    try {
        const user = jwt.verify(token, jwtSecret);
        req.user = user._doc;        
    } catch (error) {
        return res.status(401).send({
            success: false,
            message: "Invalid Credentials"
        })
    }
    next();
}

module.exports = {
    fetchUser,
    getUser
};