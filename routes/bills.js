const express = require('express');
const { fetchUser } = require('../middlewares/auth');
const {
    getBills,
    getBillById,
    getUserBillsById,
    createBill,
    updateBill,
    deleteBill,
    sendPDF,
} = require('../controllers/bills');

const router = express.Router();

router.get('/', fetchUser, getBills);
router.get('/:_id', getBillById);
router.get('/user/:_id', getUserBillsById);

router.route('/createBill')
    .post(fetchUser, createBill)
    .patch(fetchUser, updateBill)
    .delete(fetchUser, deleteBill);

router.get('/createBill/:_id', sendPDF);

module.exports = router;