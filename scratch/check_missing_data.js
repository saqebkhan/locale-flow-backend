import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

const MissingTranslationSchema = new mongoose.Schema({
  projectId: { type: mongoose.Schema.Types.ObjectId, ref: 'Project', required: true },
  language: { type: String, required: true },
  key: { type: String, required: true },
  count: { type: Number, default: 1 },
  lastSeenAt: { type: Date, default: Date.now }
});

const MissingTranslation = mongoose.model('MissingTranslation', MissingTranslationSchema);

async function checkData() {
  await mongoose.connect(process.env.MONGODB_URI);
  const data = await MissingTranslation.find({}).limit(5);
  console.log('Missing Translations Data:', JSON.stringify(data, null, 2));
  await mongoose.disconnect();
}

checkData().catch(console.error);
