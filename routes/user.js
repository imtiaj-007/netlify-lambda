const { Router } = require('express');
const { sendHello } = require('./controller/user');

const router = Router();

router.get('/', sendHello);

module.exports = router;