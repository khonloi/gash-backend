const Orders = require('../models/Orders');
const config = require('config');
const moment = require('moment');
const crypto = require('crypto');
const qs = require('qs');

function sortObject(obj) {
  let sorted = {};
  let str = [];
  let key;
  for (key in obj) {
    if (Object.prototype.hasOwnProperty.call(obj, key)) {
      str.push(encodeURIComponent(key));
    }
  }
  str.sort();
  for (key = 0; key < str.length; key++) {
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, "+");
  }
  return sorted;
}

function validateVNPayParams(vnp_Params) {
  const requiredParams = ['vnp_Amount', 'vnp_TxnRef', 'vnp_ResponseCode', 'vnp_SecureHash'];
  for (const param of requiredParams) {
    if (!vnp_Params[param]) {
      throw new Error(`Missing required parameter: ${param}`);
    }
  }
}

function createSecureHash(vnp_Params, secretKey) {
  const sortedParams = sortObject(vnp_Params);
  const signData = qs.stringify(sortedParams, { encode: false });
  const hmac = crypto.createHmac("sha512", secretKey);
  return hmac.update(Buffer.from(signData, 'utf-8')).digest("hex");
}

exports.createPaymentUrl = async (orderId, bankCode, language, user, req) => {
  try {
    if (!orderId) throw new Error('Order ID is required');

    const order = await Orders.findById(orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }

    if (user.role !== 'admin' && user.role !== 'manager' && order.acc_id.toString() !== user.id) {
      const error = new Error('Access denied: Can only pay for own order');
      error.status = 403;
      throw error;
    }

    if (order.pay_status === 'paid') {
      const error = new Error('Order already paid');
      error.status = 400;
      throw error;
    }

    // Set VNPay expiry time (15 minutes from now)
    const expiryTime = new Date();
    expiryTime.setMinutes(expiryTime.getMinutes() + 15);
    order.vnpay_expiry_time = expiryTime;
    order.vnpay_payment_url = ''; // Will be set after URL creation
    await order.save();

    const date = new Date();
    const createDate = moment(date).format('YYYYMMDDHHmmss');
    const ipAddr = req.headers['x-forwarded-for'] || 
                  req.connection.remoteAddress || 
                  req.socket.remoteAddress || 
                  req.connection.socket.remoteAddress;

    const tmnCode = config.get('vnp_TmnCode');
    const secretKey = config.get('vnp_HashSecret');
    let vnpUrl = config.get('vnp_Url');
    const returnUrl = config.get('vnp_ReturnUrl');
    const amountToPay = order.finalPrice > 0 ? order.finalPrice : order.totalPrice;
    const amount = Math.round(amountToPay);
    if (amount <= 0) {
      const error = new Error('Invalid payment amount');
      error.status = 400;
      throw error;
    }
    const orderRef = orderId;

    let vnp_Params = {
      'vnp_Version': '2.1.0',
      'vnp_Command': 'pay',
      'vnp_TmnCode': tmnCode,
      'vnp_Locale': language || 'vn',
      'vnp_CurrCode': 'VND',
      'vnp_TxnRef': orderRef,
      'vnp_OrderInfo': 'Thanh toan don hang:' + orderRef,
      'vnp_OrderType': 'other',
      'vnp_Amount': amount * 100,
      'vnp_ReturnUrl': returnUrl,
      'vnp_IpAddr': ipAddr,
      'vnp_CreateDate': createDate
    };

    if (bankCode) vnp_Params['vnp_BankCode'] = bankCode;

    const signed = createSecureHash(vnp_Params, secretKey);
    vnp_Params['vnp_SecureHash'] = signed;
    vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

    // Save the payment URL to the order
    order.vnpay_payment_url = vnpUrl;
    await order.save();

    return vnpUrl;
  } catch (error) {
    throw error;
  }
};

exports.handleReturn = async (vnp_Params) => {
  try {
    console.log('VNPay Return Params:', vnp_Params);
    validateVNPayParams(vnp_Params);

    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const secretKey = config.get('vnp_HashSecret');
    const signed = createSecureHash(vnp_Params, secretKey);

    if (secureHash !== signed) {
      const error = new Error('Checksum failed');
      error.status = 400;
      throw error;
    }

    const orderId = vnp_Params['vnp_TxnRef'];
    const rspCode = vnp_Params['vnp_ResponseCode'];
    
    const order = await Orders.findById(orderId);
    if (!order) {
      const error = new Error('Order not found');
      error.status = 404;
      throw error;
    }

    // Validate amount
    const amount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;
    const expectedAmount = order.finalPrice > 0 ? order.finalPrice : order.totalPrice;
    if (Math.round(expectedAmount) !== Math.round(amount)) {
      const error = new Error(`Amount mismatch: expected ${expectedAmount}, received ${amount}`);
      error.status = 400;
      throw error;
    }

    if (rspCode === "00") {
      if (order.pay_status === 'paid') {
        return { code: "00", message: 'Payment successful' };
      }
      order.pay_status = 'paid';
      order.vnpay_expiry_time = null; // Clear expiry time on successful payment
      order.vnpay_payment_url = ''; // Clear payment URL
      await order.save();
      return { code: rspCode, message: 'Payment successful' };
    } else {
      order.pay_status = 'failed';
      order.order_status = 'cancelled'; // Set order status to cancelled when payment fails
      order.vnpay_expiry_time = null; // Clear expiry time on failed payment
      order.vnpay_payment_url = ''; // Clear payment URL
      await order.save();
      return { code: rspCode, message: 'Payment failed or cancelled' };
    }
  } catch (error) {
    console.error('VNPay Return Error:', error);
    throw error;
  }
};

exports.handleIpn = async (vnp_Params) => {
  try {
    validateVNPayParams(vnp_Params);

    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const secretKey = config.get('vnp_HashSecret');
    const signed = createSecureHash(vnp_Params, secretKey);

    if (secureHash !== signed) {
      return { RspCode: '97', Message: 'Checksum failed' };
    }

    const orderId = vnp_Params['vnp_TxnRef'];
    const rspCode = vnp_Params['vnp_ResponseCode'];
    const amount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;

    const order = await Orders.findById(orderId);
    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    if (Math.round(order.totalPrice) !== Math.round(amount)) {
      return { RspCode: '04', Message: 'Amount invalid' };
    }

    if (order.pay_status === 'paid') {
      return { RspCode: '02', Message: 'Order already updated' };
    }

    if (rspCode === "00") {
      order.pay_status = 'paid';
      order.vnpay_expiry_time = null; // Clear expiry time on successful payment
      order.vnpay_payment_url = ''; // Clear payment URL
      await order.save();
      return { RspCode: '00', Message: 'Success' };
    } else {
      order.pay_status = 'failed';
      order.order_status = 'cancelled'; // Set order status to cancelled when payment fails
      order.vnpay_expiry_time = null; // Clear expiry time on failed payment
      order.vnpay_payment_url = ''; // Clear payment URL
      await order.save();
      return { RspCode: '00', Message: 'Payment failed' };
    }
  } catch (error) {
    console.error('IPN Error:', error);
    return { RspCode: '99', Message: 'Internal server error' };
  }
}; 