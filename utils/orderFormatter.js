function formatOrderResponse(order) {
  if (!order) return null;

  return {
    _id: order._id,
    orderDate: order.orderDate,
    addressReceive: order.addressReceive,
    name: order.name,
    phone: order.phone,
    totalPrice: order.totalPrice,
    discountAmount: order.discountAmount,
    finalPrice: order.finalPrice,
    order_status: order.order_status,
    pay_status: order.pay_status,
    payment_method: order.payment_method,
    refund_status: order.refund_status,
    refund_proof: order.refund_proof,
    cancelReason: order.cancelReason,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,

    // Customer information
    customer: order.acc_id ? {
      _id: order.acc_id._id,
      username: order.acc_id.username,
      name: order.acc_id.name,
      email: order.acc_id.email,
      phone: order.acc_id.phone,
      address: order.acc_id.address,
      image: order.acc_id.image
    } : null,

    // Voucher information
    voucher: order.voucher_id ? {
      _id: order.voucher_id._id,
      code: order.voucher_id.code,
      voucher_name: order.voucher_id.voucher_name,
      discountType: order.voucher_id.discountType,
      discountValue: order.voucher_id.discountValue,
      discount_percentage: order.voucher_id.discount_percentage,
      discount_amount: order.voucher_id.discount_amount,
    } : null,

    // Order details
    orderDetails: order.orderDetails ? order.orderDetails.map(detail => ({
      _id: detail._id,
      variant: detail.variant_id ? {
        _id: detail.variant_id._id,
        product: detail.variant_id.productId ? {
          _id: detail.variant_id.productId._id,
          name: detail.variant_id.productId.productName
        } : null,
        color: detail.variant_id.productColorId ? {
          _id: detail.variant_id.productColorId._id,
          name: detail.variant_id.productColorId.color_name
        } : null,
        size: detail.variant_id.productSizeId ? {
          _id: detail.variant_id.productSizeId._id,
          name: detail.variant_id.productSizeId.size_name
        } : null,
        image: detail.variant_id.variantImage || null
      } : null,
      unitPrice: detail.UnitPrice,
      quantity: detail.Quantity,
      totalPrice: detail.UnitPrice * detail.Quantity,
      feedback: detail.feedback ? {
        rating: detail.feedback.rating,
        content: detail.feedback.content,
        created_at: detail.feedback.created_at,
        updated_at: detail.feedback.updated_at,
        is_deleted: detail.feedback.is_deleted,
        has_rating: detail.feedback.rating !== null && detail.feedback.rating !== undefined,
        has_content: detail.feedback.content && detail.feedback.content.trim() !== ''
      } : null
    })) : [],

    // Summary
    summary: {
      totalItems: order.orderDetails ? order.orderDetails.length : 0,
      totalQuantity: order.orderDetails ? order.orderDetails.reduce((sum, detail) => sum + detail.Quantity, 0) : 0,
      hasVoucher: !!order.voucher_id,
      hasFeedback: false
    }
  };
}

module.exports = {
  formatOrderResponse
};
