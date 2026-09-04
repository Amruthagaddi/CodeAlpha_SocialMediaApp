const express = require('express');
const router = express.Router();
const upload = require('../middleware/uploadMiddleware');
const { registerUser, loginUser, getMe } = require('../controllers/authController');
const { protect } = require('../middleware/authMiddleware');

router.post('/register', upload.single('profilePicture'), registerUser);
router.post('/login', loginUser);
router.get('/me', protect, getMe);

module.exports = router;
