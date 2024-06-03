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

            if(!user) return res.status(404).json({
                success: false,
                message: 'User not found...!',
                error
            });
            queryObj = { ...queryObj, userID: user._id };
        }

        if (!isAdmin) queryObj = { ...queryObj, userID: _id };
        if (startDate || endDate) {
            let sdate = startDate ? new Date(startDate) : new Date('2024-01-01');
            let edate = endDate ? new Date(endDate) : new Date();
            edate.setDate(edate.getDate() + 1);
            queryObj = { ...queryObj, createdAt: { $gte: sdate, $lt: edate } };
        }
        if (minValue || maxValue) queryObj = { ...queryObj, amount: { $gte: minValue ? minValue : 0, $lte: maxValue ? maxValue : 4000 } };
        if (minUnit || maxUnit) queryObj = { ...queryObj, units: { $gte: minUnit ? minUnit : 0, $lte: maxUnit ? maxUnit : 500 } };
        if (paymentMethod) queryObj = { ...queryObj, method: paymentMethod };

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

        const user = await Users.findById(userID);
        if (!user) return res.status(404).json({
            success: false,
            message: "User Not Found"
        });

        const data = await Payments.find({ userID }).sort({ createdAt: -1 }).limit(1);

        if (data.length === 0) return res.status(404).json({
            success: false,
            message: "No payment record found !"
        })

        const { billNo } = data[0];
        const bill = await Bills.findById(billNo);

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

        return res.status(200).json({
            success: true,
            receipt
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
        const htmlTemplate = `<!DOCTYPE html>
        <html lang="en">
        
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>Reciept PDF</title>
            <style>
                * {
                    box-sizing: border-box;
                }
        
                body {
                    overflow: hidden;
                    margin: 0;
                    padding: 0;
                    font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, Cantarell, 'Open Sans', 'Helvetica Neue', sans-serif
                }
        
                .container,
                .container-fluid {
                    width: 100%;
                    margin-right: auto;
                    margin-left: auto;
                    border-bottom: 4px solid #212529;
                }
        
                .container {
                    max-width: 1320px;
                    padding-right: 25px;
                    padding-left: 25px;
                }
        
                .p-3 {
                    padding: 16px !important;
                }
        
                .row {
                    display: grid;
                    grid-template-columns: repeat(12, 1fr);
                    gap: 12px;
                }
        
                .col-3 {
                    grid-column: span 3;
                }
        
                .col-4 {
                    grid-column: span 4;
                }
        
                .col-6 {
                    grid-column: span 6;
                }
        
                .col-8 {
                    grid-column: span 8;
                }
        
                .table {
                    width: 100%;
                    margin-bottom: 16px;
                    color: #212529;
                    border-collapse: collapse;
                }
        
                .table th,
                .table td {
                    padding: 12px;
                    vertical-align: top;
                    border-top: 1px solid #dee2e6;
                }
        
                .table thead th {
                    vertical-align: bottom;
                    border-bottom: 2px solid #dee2e6;
                }
        
                .table-bordered {
                    border: 1px solid #dee2e6;
                }
        
                .table-bordered th,
                .table-bordered td {
                    border: 1px solid #dee2e6;
                }
        
                .table-striped tbody tr:nth-of-type(odd) {
                    background-color: rgba(0, 0, 0, 0.05);
                }
        
                .heading {
                    padding: 0.3rem;
                    text-align: center;
                    background-color: rgb(69, 69, 219);
                    color: white;
                    border-radius: 1rem;
                }
        
                .common-heading {
                    padding: 0.3rem;
                    text-align: center;
                    color: rgb(48, 46, 56);
                    border-bottom: 2px solid grey;
                }
        
                .border {
                    border: 3px solid #dee2e6 !important;
                    border-radius: 0.5rem;
                }
            </style>
        </head>
        
        <body>
            <header>
                <div class="container-fluid" >
                    <div style="width: 170px; background-color: #212529;">                            
                        <svg version="1.1" xmlns="http://www.w3.org/2000/svg" width="170" height="72" viewBox="0 0 596 262">
                            <path d="M0 0 C196.68 0 393.36 0 596 0 C596 86.46 596 172.92 596 262 C399.32 262 202.64 262 0 262 C0 175.54 0 89.08 0 0 Z " fill="#212529" transform="translate(0,0)"/>
                            <path d="M0 0 C-0.5604803 7.36204423 -1.78935326 14.43043928 -3.37109375 21.63671875 C-3.72782669 23.28909546 -3.72782669 23.28909546 -4.09176636 24.97485352 C-4.866354 28.54737882 -5.65079208 32.11762531 -6.4375 35.6875 C-6.70533295 36.90853424 -6.97316589 38.12956848 -7.24911499 39.38760376 C-26.84984474 128.5687721 -26.84984474 128.5687721 -46 152 C-46.77214844 152.97839844 -47.54429687 153.95679688 -48.33984375 154.96484375 C-65.3907777 175.2752773 -93.87784836 182.75682372 -117.97064209 190.72497559 C-119.6510141 191.28138264 -121.33026892 191.84117556 -123.00836182 192.40441895 C-125.38709665 193.20006412 -127.7706268 193.97919618 -130.15625 194.75390625 C-130.8731601 194.99615433 -131.59007019 195.2384024 -132.32870483 195.48799133 C-136.251823 196.73951537 -139.03344276 197.26388237 -143 196 C-142.3339813 191.68724761 -140.82678756 187.90356729 -139.0859375 183.93359375 C-138.64684555 182.92148582 -138.64684555 182.92148582 -138.19888306 181.88893127 C-137.57766924 180.46155073 -136.95386322 179.0352959 -136.32763672 177.61010742 C-135.39030971 175.47241572 -134.46616573 173.32937147 -133.54296875 171.18554688 C-125.77642164 153.32680103 -117.05939066 138.02969533 -99 129 C-115.30867167 131.89347401 -124.79098656 140.54332694 -134.046875 153.66796875 C-140.52390965 163.06229128 -147.10698425 172.66846337 -152 183 C-153.65 183 -155.3 183 -157 183 C-158.31699102 178.93894205 -159.62780397 174.87591589 -160.9375 170.8125 C-161.49727539 169.08676758 -161.49727539 169.08676758 -162.06835938 167.32617188 C-162.42607422 166.21435547 -162.78378906 165.10253906 -163.15234375 163.95703125 C-163.48226318 162.93585205 -163.81218262 161.91467285 -164.15209961 160.86254883 C-166.347544 153.45063248 -165.83019301 146.64632162 -165.17382812 139.03076172 C-165.02070926 137.24193764 -164.89130647 135.45111721 -164.765625 133.66015625 C-163.26724179 119.51470522 -155.79765608 106.88835381 -147 96 C-146.30132812 95.08863281 -145.60265625 94.17726563 -144.8828125 93.23828125 C-121.64593502 63.59265642 -84.94273613 47.93176104 -51.8125 32.1875 C-26.22227774 20.46535789 -26.22227774 20.46535789 -5.71875 1.65234375 C-4 0 -4 0 0 0 Z " fill="#22B14C" transform="translate(199,14)"/>
                            <path d="M0 0 C0 3.96 0 7.92 0 12 C4.62 12 9.24 12 14 12 C14.33 13.32 14.66 14.64 15 16 C14 17 14 17 10.83984375 17.09765625 C9.55207031 17.08605469 8.26429688 17.07445312 6.9375 17.0625 C5.64714844 17.05347656 4.35679687 17.04445312 3.02734375 17.03515625 C2.02832031 17.02355469 1.02929688 17.01195312 0 17 C0 20.96 0 24.92 0 29 C4.29 29 8.58 29 13 29 C13.33 30.32 13.66 31.64 14 33 C13 34 13 34 10.05859375 34.09765625 C8.86363281 34.08605469 7.66867187 34.07445312 6.4375 34.0625 C4.64119141 34.04896484 4.64119141 34.04896484 2.80859375 34.03515625 C1.88175781 34.02355469 0.95492187 34.01195312 0 34 C0 36.64 0 39.28 0 42 C-2.60582371 42.93065133 -3.64198224 43.14917407 -6.25 42.0625 C-7.11625 41.5365625 -7.11625 41.5365625 -8 41 C-8 40.01 -8 39.02 -8 38 C-8.969375 38.0825 -9.93875 38.165 -10.9375 38.25 C-16.43715152 38.22768904 -21.61000887 36.17372743 -25.68359375 32.46875 C-29 28.63562323 -29 28.63562323 -29 26 C-83.24411135 26.05886682 -137.48818168 26.13340341 -191.73224145 26.22898628 C-198.13472653 26.24025459 -204.53721182 26.25139302 -210.93969727 26.26245117 C-212.21432898 26.26465486 -213.48896069 26.26685854 -214.80221761 26.269129 C-235.44698341 26.3045115 -256.09174917 26.32937026 -276.73653405 26.35034702 C-297.91642422 26.37210147 -319.09627501 26.40514853 -340.27613169 26.44870156 C-353.34759731 26.47522435 -366.41901385 26.49291512 -379.49050505 26.49934604 C-388.45136448 26.50459798 -397.41216212 26.52080849 -406.37298845 26.54566566 C-411.54463905 26.5596872 -416.71617902 26.56884899 -421.88784981 26.56500816 C-426.62364787 26.56159768 -431.35920965 26.57196442 -436.09495933 26.59323552 C-437.80707849 26.59850331 -439.51922219 26.59873842 -441.23134112 26.59339563 C-449.66879288 26.56975046 -457.09089149 26.67082316 -465 30 C-482.81025626 34.1998965 -511.85670853 35.87969438 -528 26 C-530.34476953 23.41087533 -530.98838665 22.55744085 -531.0625 19 C-529.94613173 15.84790136 -528.95413416 14.54149808 -526.05859375 12.875 C-506.48603575 4.55573436 -477.8830967 5.63524863 -457.9296875 11.92578125 C-456 13 -456 13 -453.82877904 15.52868623 C-450.24936433 18.65577984 -448.51134323 18.62222918 -443.80984783 18.61523914 C-443.09327329 18.62100836 -442.37669875 18.62677759 -441.63840982 18.63272163 C-439.23033723 18.64598702 -436.82392677 18.62350486 -434.41593933 18.60127258 C-432.67507912 18.60345249 -430.9342205 18.60782953 -429.19337064 18.61421841 C-424.40439536 18.6254172 -419.61597746 18.60537342 -414.82707322 18.58032811 C-409.66487702 18.55876879 -404.50271316 18.56604033 -399.34048462 18.56983948 C-390.39486917 18.57246333 -381.44943583 18.55675401 -372.5038662 18.52865028 C-359.5700489 18.48804335 -346.6363198 18.47499593 -333.70244566 18.46871033 C-312.71897959 18.45776274 -291.73561061 18.42447592 -270.75219727 18.37719727 C-250.36678555 18.3313137 -229.98140019 18.29591589 -209.59594727 18.2746582 C-207.71162998 18.27268778 -207.71162998 18.27268778 -205.78924569 18.27067754 C-199.48730503 18.26415243 -193.18536418 18.25783388 -186.88342321 18.25161803 C-134.58888169 18.19977057 -82.29444558 18.11169262 -30 18 C-29.37689941 16.88093262 -28.75379883 15.76186523 -28.11181641 14.60888672 C-25.6205931 10.1347347 -22.75219423 7.92504139 -18 6 C-14.66136142 5.35795412 -11.39630576 5.07655607 -8 5 C-7.67 3.35 -7.34 1.7 -7 0 C-4 -1 -4 -1 0 0 Z " fill="#FFFFFF" transform="translate(560,207)"/>
                            <path d="M0 0 C4.73222455 -0.07445407 9.46410411 -0.1287447 14.19677734 -0.16479492 C15.80491072 -0.17983176 17.41300344 -0.20026672 19.02099609 -0.22631836 C21.33962064 -0.26292822 23.65770049 -0.27977722 25.9765625 -0.29296875 C27.04567368 -0.31619453 27.04567368 -0.31619453 28.13638306 -0.33988953 C33.9557627 -0.34182797 37.6580499 1.39761309 42.375 4.625 C44.51208213 7.74842773 44.62498401 10.01820438 44.453125 13.75 C43.66762887 17.65039459 41.90221509 19.29126591 39 22 C37.34949046 23.02644827 35.68511594 24.03141235 34 25 C35.35488306 26.8275867 36.73478487 28.63664377 38.125 30.4375 C38.89070313 31.44683594 39.65640625 32.45617187 40.4453125 33.49609375 C43.36710276 36.35980561 44.98312056 36.77295899 49 37 C49 39.31 49 41.62 49 44 C43.81413469 44.66849045 39.16908773 44.94364685 34 44 C30.32074377 40.88423346 28.27146386 37.20955367 26 33 C22.69720513 27.54033109 22.69720513 27.54033109 17 25 C17.33 28.96 17.66 32.92 18 37 C19.32 37.33 20.64 37.66 22 38 C22 39.98 22 41.96 22 44 C14.74 44 7.48 44 0 44 C0 42.02 0 40.04 0 38 C1.65 37.34 3.3 36.68 5 36 C5.33 26.43 5.66 16.86 6 7 C4.35 7 2.7 7 1 7 C0 6 0 6 -0.0625 2.9375 C-0.041875 1.968125 -0.02125 0.99875 0 0 Z " fill="#F6F6F6" transform="translate(371,128)"/>
                            <path d="M0 0 C5.94 0 11.88 0 18 0 C20.73010108 4.77767689 22.89867994 9.00936486 25 14 C26.29987802 16.68483895 27.64724072 19.34112831 29 22 C29 17.05 29 12.1 29 7 C27.68 6.67 26.36 6.34 25 6 C25 4.02 25 2.04 25 0 C30.94 0 36.88 0 43 0 C43 1.98 43 3.96 43 6 C41.68 6.33 40.36 6.66 39 7 C38.67 19.21 38.34 31.42 38 44 C34.7 44 31.4 44 28 44 C26.20243993 40.29449549 24.41301007 36.58512089 22.625 32.875 C22.11710937 31.82828125 21.60921875 30.7815625 21.0859375 29.703125 C20.35117187 28.17558594 20.35117187 28.17558594 19.6015625 26.6171875 C19.15119629 25.68503418 18.70083008 24.75288086 18.23681641 23.79248047 C16.95930946 20.90812902 15.95039727 18.00635872 15 15 C14.34 15 13.68 15 13 15 C13 22.26 13 29.52 13 37 C14.65 37 16.3 37 18 37 C18 39.31 18 41.62 18 44 C11.73 44 5.46 44 -1 44 C-1 41.69 -1 39.38 -1 37 C1.475 36.505 1.475 36.505 4 36 C4 26.43 4 16.86 4 7 C2.68 6.67 1.36 6.34 0 6 C0 4.02 0 2.04 0 0 Z " fill="#F1F2F2" transform="translate(413,53)"/>
                            <path d="M0 0 C12.54 0 25.08 0 38 0 C42 11 42 11 42 14 C40.02 14.33 38.04 14.66 36 15 C35.46375 14.21625 34.9275 13.4325 34.375 12.625 C29.73717339 7.49898111 23.53214322 7.5938312 17 7 C17 10.3 17 13.6 17 17 C18.98 17 20.96 17 23 17 C23 15.02 23 13.04 23 11 C25.31 11 27.62 11 30 11 C30 17.6 30 24.2 30 31 C28.02 31 26.04 31 24 31 C23.34 29.02 22.68 27.04 22 25 C20.35 24.67 18.7 24.34 17 24 C17 28.29 17 32.58 17 37 C19.041875 36.7525 21.08375 36.505 23.1875 36.25 C24.33605469 36.11078125 25.48460937 35.9715625 26.66796875 35.828125 C31.53146859 34.61937709 34.08539734 32.387673 36.8125 28.25 C37.204375 27.5075 37.59625 26.765 38 26 C39.98 26.33 41.96 26.66 44 27 C43.73733305 28.33496612 43.46427347 29.66788705 43.1875 31 C43.03667969 31.7425 42.88585937 32.485 42.73046875 33.25 C41.7567302 36.91583924 40.3317971 40.44854106 39 44 C26.13 44 13.26 44 0 44 C0 41.69 0 39.38 0 37 C1.98 37 3.96 37 6 37 C5.67 27.1 5.34 17.2 5 7 C3.35 6.67 1.7 6.34 0 6 C0 4.02 0 2.04 0 0 Z " fill="#F2F2F2" transform="translate(320,53)"/>
                            <path d="M0 0 C12.21 0 24.42 0 37 0 C39.83750114 5.67500227 40.48838932 8.06531606 41 14 C39.02 14.33 37.04 14.66 35 15 C34.814375 14.401875 34.62875 13.80375 34.4375 13.1875 C32.33853807 9.9934275 29.54911194 9.01023411 26 8 C22.98936525 7.50300633 20.04837159 7.23449012 17 7 C17 10.3 17 13.6 17 17 C18.98 17 20.96 17 23 17 C23 15.02 23 13.04 23 11 C24.98 11 26.96 11 29 11 C29 17.27 29 23.54 29 30 C27.02 30 25.04 30 23 30 C22.505 27.525 22.505 27.525 22 25 C20.35 24.67 18.7 24.34 17 24 C17 28.29 17 32.58 17 37 C26.83823739 35.95074064 26.83823739 35.95074064 35 31 C36.41190564 28.39562767 36.41190564 28.39562767 37 26 C38.66611905 25.957279 40.33382885 25.95936168 42 26 C42.33 26.33 42.66 26.66 43 27 C42.63137532 33.88099408 40.98834052 37.27623382 38 44 C25.79 44 13.58 44 1 44 C1 42.02 1 40.04 1 38 C2.485 37.505 2.485 37.505 4 37 C4.33 27.1 4.66 17.2 5 7 C3.35 7 1.7 7 0 7 C0 4.69 0 2.38 0 0 Z " fill="#F2F2F3" transform="translate(232,128)"/>
                            <path d="M0 0 C4.57176779 -0.34181441 9.10235068 -0.57861081 13.6875 -0.47265625 C14.43644531 -0.45726807 15.18539063 -0.44187988 15.95703125 -0.42602539 C18.53580133 0.11173199 19.50871822 1.06913247 21.1875 3.0625 C21.84065859 4.68951216 22.43508928 6.34028297 23 8 C23.88021826 9.92884822 24.80227427 11.83407427 25.73095703 13.73999023 C27.19816811 16.80589836 28.59144586 19.90670464 30 23 C30.33 17.72 30.66 12.44 31 7 C29.02 7 27.04 7 25 7 C25 4.69 25 2.38 25 0 C31.27 0 37.54 0 44 0 C44 2.31 44 4.62 44 7 C42.35 7.33 40.7 7.66 39 8 C38.67 19.88 38.34 31.76 38 44 C35.03 44 32.06 44 29 44 C28.58113525 43.15703369 28.16227051 42.31406738 27.73071289 41.44555664 C26.17990055 38.32691846 24.6273082 35.20918012 23.07348633 32.09204102 C22.40056582 30.74116245 21.72836282 29.38992622 21.05688477 28.03833008 C20.09318155 26.09883291 19.12692932 24.16062464 18.16015625 22.22265625 C17.57886963 21.05484619 16.99758301 19.88703613 16.39868164 18.68383789 C15.24773752 16.14764799 15.24773752 16.14764799 14 15 C13.67 22.26 13.34 29.52 13 37 C14.98 37 16.96 37 19 37 C19 39.31 19 41.62 19 44 C12.73 44 6.46 44 0 44 C0 41.69 0 39.38 0 37 C2.475 36.505 2.475 36.505 5 36 C5 26.76 5 17.52 5 8 C3.35 7.67 1.7 7.34 0 7 C0 4.69 0 2.38 0 0 Z " fill="#F4F4F5" transform="translate(278,128)"/>
                            <path d="M0 0 C12.54 0 25.08 0 38 0 C42 10 42 10 42 14 C40.02 14.33 38.04 14.66 36 15 C35.46375 14.21625 34.9275 13.4325 34.375 12.625 C29.73717339 7.49898111 23.53214322 7.5938312 17 7 C17 10.63 17 14.26 17 18 C20.00384054 17.3045656 20.00384054 17.3045656 23 16 C23.96877057 13.96756452 23.96877057 13.96756452 24 12 C25.65 12 27.3 12 29 12 C29 17.94 29 23.88 29 30 C27.35 30 25.7 30 24 30 C23.6596875 28.7934375 23.6596875 28.7934375 23.3125 27.5625 C22.879375 26.716875 22.44625 25.87125 22 25 C20.35 24.67 18.7 24.34 17 24 C17 28.29 17 32.58 17 37 C19.041875 36.7525 21.08375 36.505 23.1875 36.25 C24.33605469 36.11078125 25.48460937 35.9715625 26.66796875 35.828125 C31.53146859 34.61937709 34.08539734 32.387673 36.8125 28.25 C37.204375 27.5075 37.59625 26.765 38 26 C39.98 26.33 41.96 26.66 44 27 C43.73733305 28.33496612 43.46427347 29.66788705 43.1875 31 C43.03667969 31.7425 42.88585937 32.485 42.73046875 33.25 C41.7567302 36.91583924 40.3317971 40.44854106 39 44 C26.46 44 13.92 44 1 44 C1 42.02 1 40.04 1 38 C3.475 37.505 3.475 37.505 6 37 C6 27.1 6 17.2 6 7 C4.02 7 2.04 7 0 7 C0 4.69 0 2.38 0 0 Z " fill="#F5F5F5" transform="translate(325,128)"/>
                            <path d="M0 0 C1.9996441 0.03772913 4.00054061 0.04649906 6 0 C6.508783 1.55966218 7.00663469 3.12289241 7.5 4.6875 C7.7784375 5.55761719 8.056875 6.42773438 8.34375 7.32421875 C8.99850805 9.99391677 9.11831495 12.26396684 9 15 C6.03 15.495 6.03 15.495 3 16 C2.13375 14.6078125 2.13375 14.6078125 1.25 13.1875 C-1.33332349 9.42510631 -1.33332349 9.42510631 -5 7 C-10.00037064 6.3650323 -11.86484175 6.15466939 -15.9375 9.1875 C-20.05565661 14.8031681 -19.68286243 22.27152889 -19 29 C-17.66249969 32.31522588 -15.5174191 34.4825809 -13 37 C-10.8601368 37.318384 -10.8601368 37.318384 -8.5 37.25 C-7.7059375 37.25515625 -6.911875 37.2603125 -6.09375 37.265625 C-3.78107249 37.18939909 -3.78107249 37.18939909 -2 35 C-1.83322718 31.41656024 -1.83322718 31.41656024 -2 28 C-3.65 27.67 -5.3 27.34 -7 27 C-7 25.02 -7 23.04 -7 21 C0.26 21 7.52 21 15 21 C15 22.98 15 24.96 15 27 C13.68 27.33 12.36 27.66 11 28 C10.67 33.28 10.34 38.56 10 44 C3 44 3 44 0.875 43.375 C-1.11009339 42.79686872 -1.11009339 42.79686872 -3.28515625 43.94921875 C-8.38696553 45.92387587 -14.13832999 46.09762685 -19.28125 44.125 C-25.23557882 40.64400777 -29.8078674 35.98033151 -32.375 29.5625 C-33.67527092 22.15095574 -33.44450384 15.77946515 -30 9 C-22.25000063 -1.35335833 -12.00755469 -2.47272543 0 0 Z " fill="#F2F2F2" transform="translate(454,128)"/>
                            <path d="M0 0 C3.63 0 7.26 0 11 0 C11.639375 1.670625 12.27875 3.34125 12.9375 5.0625 C13.38867188 6.22394531 13.83984375 7.38539062 14.3046875 8.58203125 C15.63681738 12.02513749 16.91865808 15.48518599 18.1953125 18.94921875 C18.98400289 21.04961893 19.77306737 23.14987868 20.5625 25.25 C20.93818115 26.28648682 21.3138623 27.32297363 21.70092773 28.39086914 C22.06903564 29.36016357 22.43714355 30.32945801 22.81640625 31.328125 C23.30282593 32.64151855 23.30282593 32.64151855 23.79907227 33.98144531 C24.82711365 36.19029763 24.82711365 36.19029763 27.13647461 36.79199219 C28.05891968 36.89495605 28.05891968 36.89495605 29 37 C29 39.31 29 41.62 29 44 C21.74 44 14.48 44 7 44 C7 41.69 7 39.38 7 37 C8.65 37 10.3 37 12 37 C11.34 35.02 10.68 33.04 10 31 C5.71 30.67 1.42 30.34 -3 30 C-3.33 32.31 -3.66 34.62 -4 37 C-2.68 37 -1.36 37 0 37 C0 39.31 0 41.62 0 44 C-5.94 44 -11.88 44 -18 44 C-18 41.69 -18 39.38 -18 37 C-17.40058594 36.82339844 -16.80117188 36.64679688 -16.18359375 36.46484375 C-12.92366388 34.27794983 -12.2479096 31.13880661 -11.0625 27.5625 C-10.54997042 26.10437702 -10.03432745 24.64734477 -9.515625 23.19140625 C-9.26232422 22.4761377 -9.00902344 21.76086914 -8.74804688 21.02392578 C-7.40613019 17.39321779 -5.743759 13.91955548 -4.1015625 10.41796875 C-2.5470018 7.00565289 -1.26501811 3.52873473 0 0 Z " fill="#F0F0F0" transform="translate(382,53)"/>
                            <path d="M0 0 C2.88911055 0.55645427 5.59991775 0.55654261 8.53515625 0.48828125 C9.20700243 2.59079986 9.87246593 4.69535888 10.53515625 6.80078125 C10.90640625 7.97253906 11.27765625 9.14429688 11.66015625 10.3515625 C12.53515625 13.48828125 12.53515625 13.48828125 12.53515625 16.48828125 C10.22515625 16.81828125 7.91515625 17.14828125 5.53515625 17.48828125 C4.95765625 16.39515625 4.38015625 15.30203125 3.78515625 14.17578125 C1.41037234 10.0748279 1.41037234 10.0748279 -2.46484375 7.48828125 C-5.60412171 6.9099932 -8.33423717 6.82421319 -11.46484375 7.48828125 C-15.51621579 10.69561745 -16.70584826 13.23290513 -17.46484375 18.30078125 C-17.81004878 24.84981388 -15.86513109 29.84927818 -12.83984375 35.55078125 C-9.72787072 38.08949609 -7.6458543 38.14020714 -3.7109375 37.9140625 C1.51521205 36.92336632 5.03367751 33.2591045 8.53515625 29.48828125 C11.01015625 30.47828125 11.01015625 30.47828125 13.53515625 31.48828125 C12.67004996 36.56941188 9.5407236 38.57938379 5.53515625 41.48828125 C-0.48845694 45.6223821 -6.24100206 46.53978659 -13.46484375 45.48828125 C-18.27704977 43.9136696 -22.27186179 41.47950871 -25.46484375 37.48828125 C-25.46484375 36.82828125 -25.46484375 36.16828125 -25.46484375 35.48828125 C-26.12484375 35.48828125 -26.78484375 35.48828125 -27.46484375 35.48828125 C-30.81142972 28.23734499 -32.27981365 20.63845226 -29.55078125 12.89453125 C-26.49754112 6.98503423 -22.79944173 3.11680584 -16.77734375 0.17578125 C-11.29143497 -0.96280359 -5.50598146 -1.14308014 0 0 Z " fill="#F1F1F1" transform="translate(262.46484375,52.51171875)"/>
                            <path d="M0 0 C7.26 0 14.52 0 22 0 C22 2.31 22 4.62 22 7 C21.01 7 20.02 7 19 7 C19.433125 8.093125 19.86625 9.18625 20.3125 10.3125 C20.67794922 11.23482422 20.67794922 11.23482422 21.05078125 12.17578125 C22.09857236 14.18943741 23.32966519 15.47938708 25 17 C25.81721717 15.89932004 26.62859451 14.79430269 27.4375 13.6875 C27.88996094 13.07261719 28.34242188 12.45773438 28.80859375 11.82421875 C30.17336308 9.90322899 30.17336308 9.90322899 31 7 C29.68 7 28.36 7 27 7 C27 4.69 27 2.38 27 0 C32.94 0 38.88 0 45 0 C45 1.98 45 3.96 45 6 C43.36580734 7.05223197 41.6912863 8.04222737 40 9 C38.02140094 11.39430765 36.39991177 13.99699681 34.75 16.625 C33.87045586 17.99261488 32.99028058 19.35982415 32.109375 20.7265625 C31.41328125 21.80679688 30.7171875 22.88703125 30 24 C29.67 24.33 29.34 24.66 29 25 C28.92755947 27.01964199 28.91622812 29.04167124 28.9375 31.0625 C28.94652344 32.16722656 28.95554687 33.27195313 28.96484375 34.41015625 C28.97644531 35.26480469 28.98804688 36.11945313 29 37 C30.32 37.33 31.64 37.66 33 38 C33 39.98 33 41.96 33 44 C26.07 44 19.14 44 12 44 C12 41.69 12 39.38 12 37 C13.65 37 15.3 37 17 37 C17.28240018 26.88654345 14.31383849 21.66062596 8 14 C7.23023669 12.80415975 6.47526552 11.59833943 5.75 10.375 C4.21957341 7.85428809 4.21957341 7.85428809 1.75 7.125 C0.88375 7.063125 0.88375 7.063125 0 7 C0 4.69 0 2.38 0 0 Z " fill="#F3F3F3" transform="translate(469,128)"/>
                            <path d="M0 0 C6.93 0 13.86 0 21 0 C21 1.98 21 3.96 21 6 C19.68 6.33 18.36 6.66 17 7 C16.67 16.57 16.34 26.14 16 36 C24.48446815 35.54944891 24.48446815 35.54944891 30 31 C31.33298974 28.38181544 31.33298974 28.38181544 32 26 C34.31 26.33 36.62 26.66 39 27 C37.84160441 32.79197795 35.86785676 38.39642971 34 44 C22.78 44 11.56 44 0 44 C0 42.02 0 40.04 0 38 C1.32 37.34 2.64 36.68 4 36 C4 26.43 4 16.86 4 7 C2.68 6.67 1.36 6.34 0 6 C0 4.02 0 2.04 0 0 Z " fill="#F4F5F5" transform="translate(280,53)"/>
                            <path d="M0 0 C10.71428571 -0.28571429 10.71428571 -0.28571429 15 2 C15.125 5.375 15.125 5.375 15 9 C12.33684806 11.66315194 10.34655932 11.94426493 6.640625 12.09765625 C5.85171875 12.08605469 5.0628125 12.07445312 4.25 12.0625 C2.14625 12.0315625 2.14625 12.0315625 0 12 C0 8.04 0 4.08 0 0 Z " fill="#33363A" transform="translate(388,135)"/>
                            <path d="M0 0 C6.34911318 -0.29303599 10.33974243 0.10965571 16 3 C15.01 3.495 15.01 3.495 14 4 C14.00523682 4.57032959 14.01047363 5.14065918 14.01586914 5.72827148 C14.03658221 8.29800323 14.0496419 10.86771747 14.0625 13.4375 C14.07087891 14.33533203 14.07925781 15.23316406 14.08789062 16.15820312 C14.09111328 17.01220703 14.09433594 17.86621094 14.09765625 18.74609375 C14.10289307 19.53685303 14.10812988 20.3276123 14.11352539 21.14233398 C14 23 14 23 13 24 C11.00041636 24.04080783 8.99954746 24.04254356 7 24 C7 23.67 7 23.34 7 23 C8.65 23 10.3 23 12 23 C12 17.06 12 11.12 12 5 C10.35 5 8.7 5 7 5 C6.855625 5.804375 6.71125 6.60875 6.5625 7.4375 C6 10 6 10 5 11 C3.35 11 1.7 11 0 11 C0 7.37 0 3.74 0 0 Z " fill="#4A4D50" transform="translate(342,135)"/>
                            <path d="M0 0 C1.36125 -0.04125 2.7225 -0.0825 4.125 -0.125 C4.89070313 -0.14820313 5.65640625 -0.17140625 6.4453125 -0.1953125 C9 0 9 0 15 2 C14.67 8.93 14.34 15.86 14 23 C13.67 23 13.34 23 13 23 C13 16.73 13 10.46 13 4 C10.69 4 8.38 4 6 4 C6 5.98 6 7.96 6 10 C4.02 10 2.04 10 0 10 C0 6.7 0 3.4 0 0 Z " fill="#2E3236" transform="translate(337,60)"/>
                            <path d="M0 0 C1.4025 -0.020625 2.805 -0.04125 4.25 -0.0625 C5.43335938 -0.07990234 5.43335938 -0.07990234 6.640625 -0.09765625 C9 0 9 0 13 1 C13 8.26 13 15.52 13 23 C12.67 23 12.34 23 12 23 C12 16.73 12 10.46 12 4 C10.02 4 8.04 4 6 4 C6 5.98 6 7.96 6 10 C4.02 10 2.04 10 0 10 C0 6.7 0 3.4 0 0 Z " fill="#34373B" transform="translate(249,135)"/>
                            <path d="M0 0 C1.32229189 2.64458379 1.09677194 4.67761301 1.0625 7.625 C1.05347656 8.62789062 1.04445313 9.63078125 1.03515625 10.6640625 C1.02355469 11.43492187 1.01195312 12.20578125 1 13 C1.99 13.33 2.98 13.66 4 14 C4 16.64 4 19.28 4 22 C-3.26 22 -10.52 22 -18 22 C-18 21.67 -18 21.34 -18 21 C-11.07 21 -4.14 21 3 21 C3 19.02 3 17.04 3 15 C0.525 14.505 0.525 14.505 -2 14 C-2.05389087 12.04196493 -2.09274217 10.08351091 -2.125 8.125 C-2.14820313 7.03445312 -2.17140625 5.94390625 -2.1953125 4.8203125 C-2 2 -2 2 0 0 Z " fill="#595C5F" transform="translate(499,151)"/>
                            <path d="M0 0 C2 1 2 1 3.125 3.25 C4.00513321 6.01613295 4.1645438 8.12048351 4 11 C1.69 11 -0.62 11 -3 11 C-2.53199289 6.94393835 -2.12046792 3.53411321 0 0 Z " fill="#44474A" transform="translate(385,66)"/>
                            <path d="M0 0 C0 0.99 0 1.98 0 3 C-0.99 3 -1.98 3 -3 3 C-3 4.32 -3 5.64 -3 7 C3.6 7 10.2 7 17 7 C17 7.33 17 7.66 17 8 C9.74 8 2.48 8 -5 8 C-5 6.02 -5 4.04 -5 2 C-3.35 1.34 -1.7 0.68 0 0 Z " fill="#E2E2E3" transform="translate(376,164)"/>
                            <path d="M0 0 C1.32 1.32 2.64 2.64 4 4 C3.67 4.66 3.34 5.32 3 6 C2.34 5.67 1.68 5.34 1 5 C1 10.94 1 16.88 1 23 C0.67 23 0.34 23 0 23 C0 15.41 0 7.82 0 0 Z " fill="#6E7174" transform="translate(291,142)"/>
                            <path d="M0 0 C0 0.99 0 1.98 0 3 C-0.99 3 -1.98 3 -3 3 C-3.33 4.65 -3.66 6.3 -4 8 C-4.33 8 -4.66 8 -5 8 C-5 6.02 -5 4.04 -5 2 C-3.35 1.34 -1.7 0.68 0 0 Z " fill="#B3B4B5" transform="translate(376,164)"/>
                            <path d="M0 0 C0.66 0.33 1.32 0.66 2 1 C0.88121617 2.17262904 -0.24523051 3.33795138 -1.375 4.5 C-2.00148437 5.1496875 -2.62796875 5.799375 -3.2734375 6.46875 C-5 8 -5 8 -7 8 C-5.50902342 4.2047869 -3.24299151 2.38957269 0 0 Z " fill="#CCCDCE" transform="translate(243,54)"/>
                            <path d="M0 0 C-1.52708963 3.43595166 -3.59927045 6.11912454 -6 9 C-5.38983051 3.50847458 -5.38983051 3.50847458 -3.5625 1.125 C-2 0 -2 0 0 0 Z " fill="#474A4D" transform="translate(441,135)"/>
                            </svg>
                            
                    </div>            
                </div>
            </header>
        
            <section class="container my-3">
                <h3 class="heading">Payment Reciept</h3>
                <div class="row p-3">
                    <div class="col-8">
                        <table class="table table-bordered table-striped " style="font-weight: 600;">
                            <tbody id="recieptBody">
        
                                <tr>
                                    <td>Transaction No.</td>
                                    <td>{{transactionNo}}</td>
                                </tr>
                                <tr>
                                    <td>Customer ID</td>
                                    <td>{{customerId}}</td>
                                </tr>
                                <tr>
                                    <td>Bill Number</td>
                                    <td>{{billNo}}</td>
                                </tr>
                                <tr>
                                    <td>Payment Amount</td>
                                    <td>{{amount}}</td>
                                </tr>
                                <tr>
                                    <td>Payment Method</td>
                                    <td>{{method}}</td>
                                </tr>
                                <tr>
                                    <td>Payment Date</td>
                                    <td>{{date}}</td>
                                </tr>
        
                            </tbody>
                        </table>
        
                        <div class="border border-3 p-3">
                            <p>
                                <strong>Note:</strong><br>
                                Thank you for your payment! Your contribution helps us maintain reliable electricity services
                                and supports our commitment to sustainable energy practices. We appreciate your continued
                                partnership in building a greener future. For any inquiries or assistance, please don't hesitate
                                to contact us. Have a wonderful day!
                            </p>
                        </div>
                    </div>
        
                    <div class="col-4 border border-3 p-3 " style="margin-top: 16px;">
        
                        <h4 class="common-heading">About Me </h4>
                        <p>
                            Hello and thank you for visiting my Electricity Bill Management System Clean Energy!
                            <br>
                            I'm SK IMTIAJ UDDIN, pre-final year undergraduate student, currently pursuing B.Tech in
                            Information Technology, from Budge Budge Institute of Technology, Kolkata.
                            <br>
                            I'm showcasing my skills in Web Development by creating this platform for learning and
                            demonstration purpose only. Dive into the features, enjoy this Full Stack project and experience the
                            beauty of MERN Stack Application, and feel free to navigate through various sections.
                        </p>
        
                    </div>
        
                </div>
        
            </section>
        
        
        </body>
        
        </html>`
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