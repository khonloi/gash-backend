const mongoose = require('mongoose');
require('dotenv').config();

// Connect to MongoDB
const dbConfig = process.env.MONGO_URI || 'mongodb://localhost:27017/ecommerce';
mongoose.connect(dbConfig);

const db = mongoose.connection;

db.on('error', console.error.bind(console, 'connection error:'));
db.once('open', async () => {
  console.log('Connected to MongoDB');

  try {
    // Fix ALL products with orphan variants
    const allProducts = await mongoose.connection.collection('newproducts').find({}).toArray();

    console.log(`Checking ${allProducts.length} products for orphan variants...\n`);

    for (const product of allProducts) {
      // Get all variants with this productId
      const allVariants = await mongoose.connection.collection('newproductvariants')
        .find({ productId: product._id })
        .toArray();

      if (allVariants.length === 0) continue;

      // Find orphan variants (active or inactive, but not discontinued)
      const orphanVariants = allVariants.filter(v => 
        v.variantStatus !== 'discontinued' &&
        !product.productVariantIds?.some(id => id.toString() === v._id.toString())
      );

      if (orphanVariants.length > 0) {
        console.log(`Product: ${product.productName} (${product._id})`);
        console.log(`  Current linked variants: ${product.productVariantIds?.length || 0}`);
        console.log(`  Orphan variants found: ${orphanVariants.length}`);

        // Add orphan variants to product
        const orphanIds = orphanVariants.map(v => v._id);
        const allVariantIds = [...(product.productVariantIds || []), ...orphanIds];

        const result = await mongoose.connection.collection('newproducts').updateOne(
          { _id: product._id },
          { 
            $set: { 
              productVariantIds: allVariantIds,
              updatedAt: new Date()
            } 
          }
        );

        console.log(`  Fixed! Now has ${allVariantIds.length} variants\n`);
      }
    }

    console.log('=== SUMMARY ===');
    console.log('All orphan variants have been linked to their products!');

  } catch (error) {
    console.error('Error during fix:', error);
  } finally {
    await mongoose.connection.close();
    console.log('Database connection closed');
  }
});

