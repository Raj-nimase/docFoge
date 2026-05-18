require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

const email = process.argv[2];
const password = process.argv[3];

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const user = await User.findOne({ email: email.trim().toLowerCase() }).select('+password');
  console.log('found:', !!user);
  console.log('has password field:', !!user?.password);
  if (user) {
    const ok = await user.comparePassword(password);
    console.log('comparePassword:', ok);
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
