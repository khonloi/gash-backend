const Orders = require('../models/Orders');
const config = require('config');
const moment = require('moment');
const crypto = require('crypto');
const qs = require('qs');

// VNPay merchant credentials from environment variables (NOT from config file).
// Validated at startup by config/env.js.
const VNP_TMN_CODE = process.env.VNP_TMN_CODE;
const VNP_HASH_SECRET = process.env.VNP_HASH_SECRET;
const VNP_RETURN_URL = process.env.VNP_RETURN_URL || 'http://localhost:5173/vnpay-return';

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
    sorted[str[key]] = encodeURIComponent(obj[str[key]]).replace(/%20/g, '+');
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
  const hmac = crypto.createHmac('sha512', secretKey);
  return hmac.update(Buffer.from(signData, 'utf-8')).digest('hex');
}

/**
 * Resolve the effective amount to charge: use finalPrice when > 0, else totalPrice.
 * Returns the amount rounded to the nearest integer (VND has no subunits).
 */
function resolveOrderAmount(order) {
  return Math.round(order.finalPrice > 0 ? order.finalPrice : order.totalPrice);
}

exports.createPaymentUrl = async (orderId, bankCode, language, user, req) => {
  if (!orderId) throw new Error('Order ID is required');

  const order = await Orders.findById(orderId);
  if (!order) {
    const error = new Error('Order not found');
    error.status = 404;
    throw error;
  }

  if (user.role !== 'admin' && user.role !== 'manager' && order.accountId.toString() !== user.id) {
    const error = new Error('Access denied: Can only pay for own order');
    error.status = 403;
    throw error;
  }

  if (order.payStatus === 'paid') {
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
  const ipAddr =
    req.headers['x-forwarded-for'] ||
    req.connection.remoteAddress ||
    req.socket.remoteAddress ||
    req.connection.socket.remoteAddress;

  const amount = resolveOrderAmount(order);
  if (amount <= 0) {
    const error = new Error('Invalid payment amount');
    error.status = 400;
    throw error;
  }

  let vnp_Params = {
    vnp_Version: '2.1.0',
    vnp_Command: 'pay',
    vnp_TmnCode: VNP_TMN_CODE,
    vnp_Locale: language || 'vn',
    vnp_CurrCode: 'VND',
    vnp_TxnRef: orderId,
    vnp_OrderInfo: 'Thanh toan don hang:' + orderId,
    vnp_OrderType: 'other',
    vnp_Amount: amount * 100,
    vnp_ReturnUrl: VNP_RETURN_URL,
    vnp_IpAddr: ipAddr,
    vnp_CreateDate: createDate,
  };

  if (bankCode) vnp_Params['vnp_BankCode'] = bankCode;

  const signed = createSecureHash(vnp_Params, VNP_HASH_SECRET);
  vnp_Params['vnp_SecureHash'] = signed;

  let vnpUrl = config.get('vnp_Url');
  vnpUrl += '?' + qs.stringify(vnp_Params, { encode: false });

  // Save the payment URL to the order
  order.vnpay_payment_url = vnpUrl;
  await order.save();

  return vnpUrl;
};

exports.handleReturn = async (vnp_Params) => {
  validateVNPayParams(vnp_Params);

  const secureHash = vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHash'];
  delete vnp_Params['vnp_SecureHashType'];

  const signed = createSecureHash(vnp_Params, VNP_HASH_SECRET);
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

  // Validate amount using finalPrice (consistent with createPaymentUrl)
  const receivedAmount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;
  const expectedAmount = resolveOrderAmount(order);
  if (expectedAmount !== Math.round(receivedAmount)) {
    const error = new Error(`Amount mismatch: expected ${expectedAmount}, received ${receivedAmount}`);
    error.status = 400;
    throw error;
  }

  if (rspCode === '00') {
    // Payment successful
    if (order.payStatus === 'paid') {
      return { code: '00', message: 'Payment successful' };
    }
    order.payStatus = 'paid';
    order.vnpay_expiry_time = null;
    order.vnpay_payment_url = '';
    await order.save();
    return { code: rspCode, message: 'Payment successful' };
  } else {
    // Payment failed or cancelled by user.
    // FIX: 'failed' is NOT a valid payStatus enum value (['unpaid', 'paid']).
    // Keep payStatus as 'unpaid' and set orderStatus to 'cancelled'.
    order.orderStatus = 'cancelled';
    order.cancelReason = 'Payment was not completed or was cancelled by the user.';
    order.vnpay_expiry_time = null;
    order.vnpay_payment_url = '';
    await order.save();
    return { code: rspCode, message: 'Payment failed or cancelled' };
  }
};

exports.handleIpn = async (vnp_Params) => {
  try {
    validateVNPayParams(vnp_Params);

    const secureHash = vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHash'];
    delete vnp_Params['vnp_SecureHashType'];

    const signed = createSecureHash(vnp_Params, VNP_HASH_SECRET);
    if (secureHash !== signed) {
      return { RspCode: '97', Message: 'Checksum failed' };
    }

    const orderId = vnp_Params['vnp_TxnRef'];
    const rspCode = vnp_Params['vnp_ResponseCode'];
    const receivedAmount = parseInt(vnp_Params['vnp_Amount'], 10) / 100;

    const order = await Orders.findById(orderId);
    if (!order) {
      return { RspCode: '01', Message: 'Order not found' };
    }

    // FIX: IPN must validate against finalPrice (same field used in createPaymentUrl),
    // not totalPrice — they differ when a voucher is applied.
    const expectedAmount = resolveOrderAmount(order);
    if (expectedAmount !== Math.round(receivedAmount)) {
      return { RspCode: '04', Message: 'Amount invalid' };
    }

    if (order.payStatus === 'paid') {
      return { RspCode: '02', Message: 'Order already updated' };
    }

    if (rspCode === '00') {
      order.payStatus = 'paid';
      order.vnpay_expiry_time = null;
      order.vnpay_payment_url = '';
      await order.save();
      return { RspCode: '00', Message: 'Success' };
    } else {
      // FIX: 'failed' is NOT a valid payStatus enum value.
      // Keep payStatus as 'unpaid' and mark order as cancelled.
      order.orderStatus = 'cancelled';
      order.cancelReason = 'Payment was not completed or was cancelled by the user.';
      order.vnpay_expiry_time = null;
      order.vnpay_payment_url = '';
      await order.save();
      return { RspCode: '00', Message: 'Payment failed' };
    }
  } catch (error) {
    console.error('IPN Error:', error);
    return { RspCode: '99', Message: 'Internal server error' };
  }
};