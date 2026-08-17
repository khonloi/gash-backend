const orderService = require('../services/orderService');
const catchAsync = require('./utils/catchAsync');

// Export bill for a specific order
exports.exportBill = catchAsync(async (req, res) => {
    const { orderId } = req.params;
    
    const billData = await orderService.exportBillService(orderId, req.user);

    res.status(200).json({
        success: true,
        message: 'Bill exported successfully',
        data: billData
    });
});
