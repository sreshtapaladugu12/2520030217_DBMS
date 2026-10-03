const mongoose = require('mongoose');

async function connectDb(serviceName, attempts = 20) {
  mongoose.set('strictQuery', true);
  for (let i = 1; i <= attempts; i++) {
    try {
      await mongoose.connect(process.env.MONGODB_URI, { serverSelectionTimeoutMS: 4000 });
      console.log(`[${serviceName}] MongoDB connected`);
      return;
    } catch (e) {
      console.warn(`[${serviceName}] MongoDB not reachable (attempt ${i}/${attempts}): ${e.message}`);
      await new Promise((r) => setTimeout(r, 2000));
    }
  }
  console.error(`[${serviceName}] Could not connect to MongoDB. Is it running? Check MONGODB_URI.`);
  process.exit(1);
}

const dbStatus = () => (mongoose.connection.readyState === 1 ? 'connected' : 'disconnected');

module.exports = { connectDb, dbStatus };
