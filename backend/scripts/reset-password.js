/**
 * Reset a user's password (run from backend folder):
 *   node scripts/reset-password.js user@email.com NewPassword123
 */
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const email = process.argv[2];
const newPassword = process.argv[3];

if (!email || !newPassword) {
  console.error('Usage: node scripts/reset-password.js <email> <newPassword>');
  process.exit(1);
}

if (newPassword.length < 8) {
  console.error('Password must be at least 8 characters');
  process.exit(1);
}

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  if (!user) {
    console.error('No user found for:', email);
    process.exit(1);
  }
  user.password = newPassword;
  await user.save();
  console.log('Password updated for:', user.email);
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
