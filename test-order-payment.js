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
      acc_id: new mongoose.Types.ObjectId(), // This is just a placeholder
      addressReceive: 'Test Address',
      phone: '1234567890',
      totalPrice: 100,
      order_status: 'pending',
      pay_status: 'unpaid',
      shipping_status: 'not_shipped'
    });
    
    const savedOrder = await testOrder.save();
    console.log('Created test order:', savedOrder);
    
    // Update payment status to failed
    savedOrder.pay_status = 'failed';
    
    // This should trigger our new logic in the save middleware
    const updatedOrder = await Orders.findByIdAndUpdate(
      savedOrder._id,
      { pay_status: 'failed' },
      { new: true, runValidators: true }
    );
    
    console.log('Updated order:', updatedOrder);
    
    // Verify that order_status is now 'cancelled'
    const finalOrder = await Orders.findById(savedOrder._id);
    console.log('Final order state:', finalOrder);
    
    if (finalOrder.pay_status === 'failed' && finalOrder.order_status === 'cancelled') {
      console.log('Test PASSED: Order status was automatically set to cancelled when payment failed');
    } else {
      console.log('Test FAILED: Order status was not updated correctly');
      console.log('pay_status:', finalOrder.pay_status);
      console.log('order_status:', finalOrder.order_status);
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