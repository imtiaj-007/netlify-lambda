const { Router } = require('express');
const {
    handleGetAllUsers,
    findUserbyID,
    handleGetUser,
    handleCreateUser
} = require('../controllers/user');
const { fetchUser } = require('../middlewares/auth');

const router = Router();

router.get('/', fetchUser, handleGetAllUsers);
router.get('/:_id', findUserbyID);
router.post('/login', handleGetUser);
router.post('/signup', handleCreateUser);

module.exports = router;