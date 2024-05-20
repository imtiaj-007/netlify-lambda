const fs = require('fs');
const pdf = require('pdf-creator-node');
const path = require('path');
const mongoose = require('mongoose');

const Payments = require('../models/payments');
const Bills = require('../models/bills');
const Users = require('../models/user');

const getPayments = async (req, res) => {
    try {
        const { _id, isAdmin } = req.user;

        let queryObj = {};
        const { searchID, startDate, endDate, minValue, maxValue, minUnit, maxUnit, paymentMethod, sort } = req.query;

        if (searchID) {
            let user;
            if (searchID.includes('@'))
                user = await Users.findOne({ email: searchID });
            else
                user = await Users.findOne({ _id: searchID });
            queryObj = { ...queryObj, userID: user._id };
        }

        if (!isAdmin) queryObj = { ...queryObj, userID: _id };
        if (startDate || endDate) {
            let sdate = startDate ? new Date(startDate) : new Date('2024-01-01');
            let edate  = endDate ? new Date(endDate) : new Date();
            edate.setDate(edate.getDate() + 1);
            queryObj = { ...queryObj, createdAt: { $gte: sdate, $lt: edate } };
        }
        if (minValue || maxValue) queryObj = { ...queryObj, amount: { $gte: minValue ? minValue : 0, $lte: maxValue ? maxValue : 4000 } };
        if (minUnit || maxUnit) queryObj = { ...queryObj, units: { $gte: minUnit ? minUnit : 0, $lte: maxUnit ? maxUnit : 500 } };
        if(paymentMethod) queryObj = { ...queryObj, method: paymentMethod };

        let queryData = Payments.find(queryObj);
        if (sort) {
            let sortFix = sort.replaceAll(",", " ");
            queryData = queryData.sort(sortFix);
        }

        const payments = await queryData;
        return res.status(200).json({
            success: true,
            payments
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            error
        })
    }
}

const handleNewPayment = async (req, res) => {
    try {
        const { userID, billNo } = req.body;
        const user = await Users.findOne({ _id: userID });
        if (!user) return res.status(404).json({
            success: false,
            message: "User Not Found"
        });

        const bill = await Bills.findOne({ _id: billNo, userID });
        if (!bill) return res.status(404).json({
            success: false,
            message: "Bill doesn't Exists"
        });

        let method = 'Online';
        if (req.user && req.user.isAdmin)
            method = 'Offline'

        const { amount, units } = bill;
        let payment = await Payments.create({
            userID,
            billNo,
            amount,
            method
        })

        if (payment) await Bills.updateOne({ _id: billNo }, { $set: { status: 'Paid' } });
        payment = { ...payment._doc, customerName: user.customerName, units }

        return res.status(200).json({
            success: true,
            payment
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message
        })
    }
}

const getLastPayment = async (req, res) => {
    try {
        const { userID } = req.params;

        // Validate ObjectId
        if (!mongoose.Types.ObjectId.isValid(userID)) {
            return res.status(400).json({
                success: false,
                message: 'User Not Found...! Invalid user ID'
            });
        }

        const user = await Users.findById( userID );
        if (!user) return res.status(404).json({
            success: false,
            message: "User Not Found"
        });

        const data = await Payments.find({ userID }).sort({ createdAt: -1 }).limit(1);

        const { billNo } = data[0];
        const bill = await Bills.findById( billNo );

        payment = { ...data[0]._doc, customerName: user.customerName, units: bill.units };
        return res.status(200).json({
            success: true,
            payment
        });
    } catch (error) {
        return res.status(500).json({
            success: false,
            message: error.message,
            error
        })
    }
}

const sendPdf = async (req, res) => {
    try {
        const { _id } = req.params;
        const receipt = await Payments.findById(_id); 

        const fileName = `${Date.now()}.pdf`;
        const filePath = path.resolve(`./docs/payments/${fileName}`);

        // Generate the PDF file
        await generatePdf(filePath, receipt);

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
              console.error(`Error deleting file: ${err}`);
            } 
        });

    } catch (error) {
        console.log(error);
        return res.status(500).json({
            success: false,
            message: error.message,
            error
        });
    }
};

const generatePdf = async (filePath, paymentObj) => {
    try {
        const htmlTemplate = fs.readFileSync(path.resolve('./views/paymentTemplate.html'), 'utf8');
        const html = htmlTemplate.replace(/{{transactionNo}}/g, paymentObj._id)
            .replace(/{{customerId}}/g, paymentObj.userID)
            .replace(/{{billNo}}/g, paymentObj.billNo)
            .replace(/{{amount}}/g, paymentObj.amount)
            .replace(/{{method}}/g, paymentObj.method)
            .replace(/{{date}}/g, paymentObj.createdAt.toISOString().substr(0, 10));

        const options = {
            format: "A4",
            orientation: "portrait",
            border: "20mm",
        };

        const document = {
            html: html,
            data: { paymentObj },
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
    getPayments,
    handleNewPayment,
    getLastPayment,
    sendPdf
}