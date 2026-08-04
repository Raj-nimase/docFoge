const express = require('express');
const {
  register,
  login,
  getMe,
  updateMe,
  changePassword,
  resetWithCurrentPassword,
  forgotPassword,
  verifyOtp,
  resetPassword,
} = require('../controllers/authController');
const { requireAuth } = require('../middleware/auth');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/change-password', requireAuth, changePassword);
router.post('/reset-with-current-password', resetWithCurrentPassword);
router.post('/forgot-password', forgotPassword);
router.post('/verify-otp', verifyOtp);
router.post('/reset-password', resetPassword);
router.get('/me', requireAuth, getMe);
router.patch('/me', requireAuth, updateMe);

module.exports = router;
