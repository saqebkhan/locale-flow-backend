import mongoose from 'mongoose';
import dotenv from 'dotenv';
dotenv.config();

async function run() {
  await mongoose.connect(process.env.MONGODB_URI);
  const db = mongoose.connection.db;
  const collections = await db.listCollections().toArray();
  for (const col of collections) {
    const docs = await db.collection(col.name).find({ key: { $exists: true } }).limit(1).toArray();
    if (docs.length > 0) {
      console.log(`Collection: ${col.name}`);
      console.log(`Example:`, JSON.stringify(docs[0], null, 2));
    }
  }
  await mongoose.disconnect();
}

run().catch(console.error);
