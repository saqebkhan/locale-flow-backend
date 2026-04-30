import mongoose from 'mongoose';
import User from './src/models/User.js';
import dotenv from 'dotenv';
dotenv.config();

async function check() {
  await mongoose.connect(process.env.MONGODB_URI);
  const user = await User.findOne({ email: 'test_auth_verification@example.com' });
  console.log('Mongoose User:', user);
  if (user) {
    user.isVerified = false;
    user.verificationToken = 'manual-token';
    await user.save();
    console.log('Saved user:', await User.findOne({ email: 'test_auth_verification@example.com' }));
  }
  process.exit(0);
}

check();
