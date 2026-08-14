const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const dbConfig = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce';
mongoose.connect(dbConfig, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  try {
    // Update all variants without variantStatus to have 'active' status
    const result = await mongoose.connection.collection('newproductvariants').updateMany(
      { variantStatus: { $exists: false } },
      { $set: { variantStatus: 'active' } }
    );

    console.log(`Updated ${result.modifiedCount} variants with variantStatus: 'active'`);

    // Also update any variants with null or empty variantStatus
    const result2 = await mongoose.connection.collection('newproductvariants').updateMany(
      { $or: [{ variantStatus: null }, { variantStatus: '' }] },
      { $set: { variantStatus: 'active' } }
    );

    console.log(`Updated ${result2.modifiedCount} variants with null/empty variantStatus to 'active'`);

    console.log('Migration completed successfully');
  } catch (error) {
    console.error('Error during migration:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
});

