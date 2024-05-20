const { Router } = require('express');
const { sendHello } = require('../controllers/test');

const router = Router();

router.get('/', sendHello);

module.exports = router;