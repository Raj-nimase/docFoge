require('dotenv').config();
const mongoose = require('mongoose');
const User = require('../src/models/User');

(async () => {
  await mongoose.connect(process.env.MONGO_URI);
  const users = await User.find().select('+password email name');
  for (const u of users) {
    console.log({
      email: u.email,
      isBcrypt: String(u.password || '').startsWith('$2'),
      pwPrefix: String(u.password || '').slice(0, 7),
    });
  }
  await mongoose.disconnect();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
