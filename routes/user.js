const { Router } = require('express');
const { sendHello } = require('../controllers/user');

const router = Router();

router.get('/', sendHello);

module.exports = router;