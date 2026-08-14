const orderService = require('../services/orderService');

// Export bill for a specific order
exports.exportBill = async (req, res) => {
    try {
        const { orderId } = req.params;
        
        const billData = await orderService.exportBillService(orderId, req.user);

        res.status(200).json({
            success: true,
            message: 'Bill exported successfully',
            data: billData
        });
    } catch (error) {
        console.error('Export bill error:', error);
        res.status(error.status || 500).json({
            success: false,
            message: error.message || 'Error exporting bill',
            error: error.message
        });
    }
};
