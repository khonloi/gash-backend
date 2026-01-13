const mongoose = require('mongoose');
const Orders = require('./models/Orders');
const config = require('config');

// Connect to MongoDB
mongoose.connect(config.get('mongoURI'))
  .then(() => console.log('MongoDB Connected...'))
  .catch(err => {
    console.error('MongoDB Connection Error:', err);
    process.exit(1);
  });

async function testOrderPaymentStatus() {
  try {
    console.log('Testing order payment status update...');
    
    // Create a test order
    const testOrder = new Orders({
      accountId: new mongoose.Types.ObjectId(), // This is just a placeholder
      addressReceive: 'Test Address',
      phone: '1234567890',
      totalPrice: 100,
      orderStatus: 'pending',
      payStatus: 'unpaid',
      shipping_status: 'not_shipped'
    });
    
    const savedOrder = await testOrder.save();
    console.log('Created test order:', savedOrder);
    
    // Update payment status to failed
    savedOrder.payStatus = 'failed';
    
    // This should trigger our new logic in the save middleware
    const updatedOrder = await Orders.findByIdAndUpdate(
      savedOrder._id,
      { payStatus: 'failed' },
      { new: true, runValidators: true }
    );
    
    console.log('Updated order:', updatedOrder);
    
    // Verify that orderStatus is now 'cancelled'
    const finalOrder = await Orders.findById(savedOrder._id);
    console.log('Final order state:', finalOrder);
    
    if (finalOrder.payStatus === 'failed' && finalOrder.orderStatus === 'cancelled') {
      console.log('Test PASSED: Order status was automatically set to cancelled when payment failed');
    } else {
      console.log('Test FAILED: Order status was not updated correctly');
      console.log('payStatus:', finalOrder.payStatus);
      console.log('orderStatus:', finalOrder.orderStatus);
    }
    
    // Clean up - delete test order
    await Orders.findByIdAndDelete(savedOrder._id);
    console.log('Test order deleted');
    
  } catch (error) {
    console.error('Test error:', error);
  } finally {
    // Disconnect from MongoDB
    await mongoose.disconnect();
    console.log('MongoDB Disconnected');
  }
}

// Run the test
testOrderPaymentStatus(); 