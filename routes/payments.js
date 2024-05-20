const { Router } = require('express');
const { fetchUser } = require('../middlewares/auth');
const {
    getPayments,
    handleNewPayment,
    getLastPayment,
    sendPdf
} = require('../controllers/payments')

const router = Router();

router.route('/')
    .get(fetchUser, getPayments)
    .post(fetchUser, handleNewPayment)

router.get('/receipt/:_id', sendPdf);
router.get('/:userID', getLastPayment);

module.exports = router;