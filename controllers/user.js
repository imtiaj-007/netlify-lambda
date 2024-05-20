require('dotenv').config();
const jwt = require('jsonwebtoken')
const bcrypt = require('bcryptjs')
const mongoose = require('mongoose')
const Users = require('../models/user');

const jwtSecret = process.env.SECRET;

const handleGetAllUsers = async (req, res) => {
    try {
        const users = await Users.find({});
        return res.status(200).json({
            success: true,
            message: "Request Successful",
            users
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            error
        });
    }
}

const findUserbyID = async (req, res) => {
    try {
        const { _id } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({
                success: false,
                message: 'User Not Found...! Invalid user ID'
            });
        }
        const user = await Users.findById(_id);
        if(!user)
            return res.status(400).json({
                success: false,
                message: 'User Not Found...!'
            });

        return res.status(200).json({
            success: true,
            message: "Request Successful",
            user
        });
        
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: error.message,
            error
        });
    }
}

const handleGetUser = async (req, res) => {
        try {
            const { email, password } = req.body;
            const user = await Users.findOne({ email });

            if (!user) return res.status(404).json({
                success: false,
                message: "User not found"
            })

            const checkPass = await bcrypt.compare(password, user.password);
            if (!checkPass) return res.status(401).json({
                success: false,
                message: "Invalid Credentials"
            })

            const authToken = jwt.sign({ ...user }, jwtSecret);

            return res.status(200).json({
                success: true,
                message: "User login successfull",
                authToken,
                isAdmin: user.isAdmin
            });

        } catch (error) {
            return res.status(500).json({
                success: false,
                message: error.message,
                error
            })
        }
    }

    const handleCreateUser = async (req, res) => {
        try {
            const { customerName, email, password, phoneNo, address, connectionType, isAdmin } = req.body;
            const user = await Users.findOne({ email });

            if (user) {
                return res.status(400).json({
                    success: false,
                    message: "User with mail id already exists",
                });
            }

            const salt = await bcrypt.genSalt(10);
            const securePassword = await bcrypt.hash(password, salt);

            const newUser = await Users.create({
                customerName,
                email,
                password: securePassword,
                phoneNo,
                address,
                connectionType,
                isAdmin
            });

            const authToken = jwt.sign({ ...newUser }, jwtSecret);

            return res.status(200).json({
                success: true,
                message: "User created successfully",
                authToken,
                isAdmin: user.isAdmin
            });
        } catch (error) {
            return res.status(500).send({
                success: false,
                message: error.message,
                error
            })
        }
    }

    module.exports = {
        handleGetAllUsers,
        findUserbyID,
        handleGetUser,
        handleCreateUser
    }