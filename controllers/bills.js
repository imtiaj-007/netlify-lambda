const fs = require('fs');
const path = require('path');
const pdf = require('pdf-creator-node');
const mongoose = require('mongoose');

const Bills = require('../models/bills');
const Users = require('../models/user');


const getBills = async (req, res) => {
    try {
        const { _id, isAdmin } = req.user;

        let queryObj = {};
        const { searchID, startDate, endDate, minValue, maxValue, minUnit, maxUnit, paymentStatus, connecType, sort } = req.query;

        if (searchID) {
            let user;
            if (searchID.includes('@'))
                user = await Users.findOne({ email: searchID });
            else
                user = await Users.findOne({ _id: searchID });
            queryObj = { ...queryObj, userID: user._id };
        }

        if (!isAdmin) queryObj = { ...queryObj, userID: _id };
        if (paymentStatus) queryObj = { ...queryObj, status: paymentStatus };
        if (startDate || endDate) queryObj = { ...queryObj, date: { $gte: startDate ? startDate : '2024-01-01', $lte: endDate ? endDate : new Date().toISOString().slice(0, 10) } };
        if (minValue || maxValue) queryObj = { ...queryObj, amount: { $gte: minValue ? minValue : 0, $lte: maxValue ? maxValue : 4000 } };
        if (minUnit || maxUnit) queryObj = { ...queryObj, units: { $gte: minUnit ? minUnit : 0, $lte: maxUnit ? maxUnit : 500 } };

        if (connecType) {
            let str = connecType.toLowerCase();
            let users = await Users.find({ connectionType: str });
            let userIds = users.map(ele => { return ele._id })
            queryObj = { ...queryObj, userID: { $in: userIds } };
        }

        let queryData = Bills.find(queryObj);
        if (sort) {
            let sortFix = sort.replaceAll(",", " ");
            queryData = queryData.sort(sortFix);
        }

        const bills = await queryData;
        return res.status(200).json({
            success: true,
            bills
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const getBillById = async (req, res) => {
    try {
        const { _id } = req.params;
        if (!mongoose.Types.ObjectId.isValid(_id)) {
            return res.status(400).json({
                success: false,
                message: 'Bill Not Found...! Invalid Bill No'
            });
        }
        const bill = await Bills.findById(_id);
        if (!bill) return res.status(404).json({
            success: false,
            message: "Bill Not Found"
        });

        return res.status(200).json({
            success: true,
            bill
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}


const getUserBillsById = async (req, res) => {
    try {
        const { _id } = req.params;

        let user;
        if (_id) {
            if (_id.includes('@'))
                user = await Users.findOne({ email: _id });
            else {
                // Validate ObjectId
                if (!mongoose.Types.ObjectId.isValid(_id)) {
                    return res.status(400).json({
                        success: false,
                        message: 'User Not Found...! Invalid user ID'
                    });
                }
                user = await Users.findById( _id );
            }
        }
        if (!user) 
            return res.status(400).json({
                success: false,
                message: 'User Not Found...!'
            });

        const bills = await Bills.find({ userID: user._id }).sort({ date: -1 });
        return res.status(200).json({
            success: true,
            bills,
            user
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const createBill = async (req, res) => {
    try {
        const { _id, units } = req.body;
        const user = await Users.findById(_id);
        if (!user)
            return res.status(404).json({
                success: false,
                message: "User doesn't exists"
            });

        let date = new Date();
        const currentMonth = date.getMonth() + 1; // Month is zero-based
        const currentYear = date.getFullYear();

        // Calculate the start and end dates for the current month
        const startOfMonth = new Date(`${currentYear}-${currentMonth}-01`);
        const endOfMonth = new Date(`${currentYear}-${currentMonth + 1}-01`);

        const bill = await Bills.findOne({
            userID: _id,
            createdAt: {
                $gte: startOfMonth, // First day of the current month
                $lte: endOfMonth // Last day of the current month
            }
        });

        if (bill)
            return res.status(400).json({
                success: false,
                message: `Bill already exists for the month of ${date.toLocaleString('default', { month: 'long' })}`
            });

        date = new Date().toISOString().slice(0, 10);
        let amount = 0, type = user.connectionType;
        switch (type) {
            case "domestic":
                amount = parseInt(units) * 8;
                break;
            case "workshop":
                amount = parseInt(units) * 11;
                break;
            case "industrial":
                amount = parseInt(units) * 14;
                break;
        }

        const newBill = await Bills.create({ userID: _id, date, units, amount });
        return res.status(200).json({
            success: true,
            message: "Bill created Successfully",
            newBill
        });
    } catch (error) {
        console.log(error)
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

const updateBill = async (req, res) => {
    try {
        const { _id, units, billNo } = req.body;
        const user = await Users.findById(_id);
        if (!user)
            return res.status(404).json({
                success: false,
                message: "User doesn't exists"
            });
        let amount = 0, type = user.connectionType;

        switch (type) {
            case "domestic":
                amount = parseInt(units) * 8;
                break;
            case "workshop":
                amount = parseInt(units) * 11;
                break;
            case "industrial":
                amount = parseInt(units) * 14;
                break;
        }

        await Bills.updateOne({ _id: billNo, userID: _id }, { $set: { units: units, amount: amount } });
        const newBill = await Bills.findOne({ _id: billNo });
        return res.status(200).json({
            success: true,
            message: "Bill updated Successfully",
            newBill
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

const deleteBill = async (req, res) => {
    try {
        const { _id, billNo } = req.body;
        const user = await Users.findById(_id);
        if (!user)
            return res.status(404).json({
                success: false,
                message: "User doesn't exists"
            });

        const newBill = await Bills.findOne({ _id: billNo, userID: _id });
        if (!newBill)
            return res.status(404).json({
                success: false,
                message: "Bill doesn't exists"
            });
        if (newBill.status === 'Paid')
            return res.status(400).json({
                success: false,
                message: "Can't Delete...! Transaction has been found for the bill."
            });

        await Bills.deleteOne({ _id: billNo });

        return res.status(200).json({
            success: true,
            message: "Bill deleted Successfully",
            newBill
        });
    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

const sendPDF = async (req, res) => {
    try {
        const { _id } = req.params;
        const bill = await Bills.findById(_id);
        const user = await Users.findById(bill.userID);

        const fileName = `${Date.now()}.pdf`;
        const filePath = path.resolve(`./docs/bills/${fileName}`);

        // Generate the PDF file
        await generatePdf(filePath, bill, user);

        // Check if the PDF file exists
        if (!fs.existsSync(filePath)) {
            return res.status(404).json({
                success: false,
                message: 'PDF file not found'
            });
        }

        // Send the PDF file as a response
        res.contentType('application/pdf');
        res.sendFile(filePath);

        fs.unlink(filePath, (err) => {
            if (err) {
                console.log(`Error deleting file: ${err}`);
            }
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
        });
    }
}

const generatePdf = async (filePath, billObj, userObj) => {
    try {
        const htmlTemplate = fs.readFileSync(path.resolve('./views/billTemplate.html'), 'utf8');
        const html = htmlTemplate.replace(/{{customerId}}/g, userObj._id)
            .replace(/{{customerName}}/g, userObj.customerName)
            .replace(/{{email}}/g, userObj.email)
            .replace(/{{billNo}}/g, billObj._id)
            .replace(/{{units}}/g, billObj.units)
            .replace(/{{amount}}/g, billObj.amount)
            .replace(/{{connecType}}/g, userObj.connectionType)
            .replace(/{{date}}/g, billObj.date);

        const options = {
            format: "A4",
            orientation: "portrait",
            border: "20mm",
        };

        const document = {
            html: html,
            data: { billObj },
            path: filePath,
        };

        // Generate the PDF
        await pdf.create(document, options);

    } catch (error) {
        console.log(error);
        throw error;
    }
};


module.exports = {
    getBills,
    getBillById,
    getUserBillsById,
    createBill,
    updateBill,
    deleteBill,
    sendPDF,
}