const Orders = require("../models/Orders");
const OrderDetails = require("../models/OrderDetails");
const Accounts = require("../models/Accounts");
const newProductVariant = require("../models/newProductVariant");
const Vouchers = require("../models/Voucher");
const mongoose = require("mongoose");

// Sample Vietnamese addresses (in English format)
const SAMPLE_ADDRESSES = [
  "123 Nguyen Hue Street, District 1, Ho Chi Minh City",
  "456 Le Loi Boulevard, District 1, Ho Chi Minh City",
  "789 Dien Bien Phu Street, Binh Thanh District, Ho Chi Minh City",
  "321 Vo Van Tan Street, District 3, Ho Chi Minh City",
  "654 Nguyen Dinh Chieu Street, District 3, Ho Chi Minh City",
  "987 Truong Chinh Street, District 12, Ho Chi Minh City",
  "147 Ly Tu Trong Street, District 1, Ho Chi Minh City",
  "258 Pham Van Dong Street, Thu Duc District, Ho Chi Minh City",
  "369 Hoang Dieu Street, District 4, Ho Chi Minh City",
  "741 Nguyen Trai Street, District 5, Ho Chi Minh City",
  "159 Pasteur Street, District 3, Ho Chi Minh City",
  "753 Hai Ba Trung Street, District 1, Ho Chi Minh City",
  "852 Ton Duc Thang Street, District 1, Ho Chi Minh City",
  "741 Cao Thang Street, District 10, Ho Chi Minh City",
  "369 Tran Hung Dao Street, District 5, Ho Chi Minh City",
  "147 Dong Khoi Street, District 1, Ho Chi Minh City",
  "258 Nam Ky Khoi Nghia Street, District 1, Ho Chi Minh City",
  "456 Ham Nghi Boulevard, District 1, Ho Chi Minh City",
  "789 Cach Mang Thang Tam Street, District 10, Ho Chi Minh City",
  "321 Pham Ngu Lao Street, District 1, Ho Chi Minh City",
];

// Sample Vietnamese names (in English format)
const SAMPLE_NAMES = [
  "Nguyen Van An",
  "Tran Thi Binh",
  "Le Van Cuong",
  "Pham Thi Dung",
  "Hoang Van Duc",
  "Vu Thi Hoa",
  "Dang Van Hung",
  "Bui Thi Lan",
  "Phan Van Minh",
  "Ngo Thi Nga",
  "Nguyen Thi Mai",
  "Tran Van Nam",
  "Le Thi Hong",
  "Pham Van Tan",
  "Hoang Thi Linh",
  "Vu Van Tuan",
  "Dang Thi Thao",
  "Bui Van Hieu",
  "Phan Thi Nhung",
  "Ngo Van Long",
  "Nguyen Thi Hue",
  "Tran Van Son",
  "Le Thi Lan",
  "Pham Van Kien",
  "Hoang Thi My",
];

/**
 * Generate random phone number
 */
function generateRandomPhone() {
  const prefixes = ["090", "091", "092", "093", "094", "096", "097", "098", "032", "033", "034", "035", "036", "037", "038", "039"];
  const prefix = prefixes[Math.floor(Math.random() * prefixes.length)];
  const number = Math.floor(1000000 + Math.random() * 9000000);
  return `${prefix}${number}`;
}

/**
 * Generate random date within the last N days
 */
function generateRandomDate(daysBack = 30) {
  const now = new Date();
  const daysAgo = Math.floor(Math.random() * daysBack);
  const hoursAgo = Math.floor(Math.random() * 24);
  const minutesAgo = Math.floor(Math.random() * 60);
  const date = new Date(now);
  date.setDate(date.getDate() - daysAgo);
  date.setHours(date.getHours() - hoursAgo);
  date.setMinutes(date.getMinutes() - minutesAgo);
  return date;
}

/**
 * Generate random order status
 */
function generateRandomOrderStatus() {
  const statuses = ["pending", "confirmed", "shipping", "delivered", "cancelled"];
  // Weighted probabilities - more delivered than cancelled
  const weights = [0.1, 0.15, 0.15, 0.5, 0.1];
  const random = Math.random();
  let cumulative = 0;
  for (let i = 0; i < statuses.length; i++) {
    cumulative += weights[i];
    if (random < cumulative) {
      return statuses[i];
    }
  }
  return statuses[statuses.length - 1];
}

/**
 * Generate random payment status based on order status
 */
function generatePaymentStatus(orderStatus) {
  // If cancelled or pending, more likely unpaid
  if (orderStatus === "cancelled" || orderStatus === "pending") {
    return Math.random() > 0.3 ? "unpaid" : "paid";
  }
  // If delivered or shipping, more likely paid
  if (orderStatus === "delivered" || orderStatus === "shipping") {
    return Math.random() > 0.2 ? "paid" : "unpaid";
  }
  // For confirmed, 50/50
  return Math.random() > 0.5 ? "paid" : "unpaid";
}

/**
 * Generate random payment method
 */
function generatePaymentMethod() {
  return Math.random() > 0.5 ? "COD" : "VNPAY";
}

/**
 * Generate random refund status based on order status
 */
function generateRefundStatus(orderStatus, payStatus) {
  if (orderStatus !== "cancelled" || payStatus === "unpaid") {
    return "not_applicable";
  }
  // If cancelled and paid, might have refund
  return Math.random() > 0.7 ? "refunded" : "pending_refund";
}

/**
 * Generate cancel reason if order is cancelled (Vietnamese reasons in English format)
 */
function generateCancelReason() {
  const reasons = [
    "No longer need the product",
    "Found a better alternative product",
    "Changed delivery address",
    "Product does not match description",
    "Changed mind about the purchase",
    "Cancelled due to technical error",
    "Duplicate order",
    "Payment issue occurred",
    "Shipping time is too long",
    "Price changed after placing order",
    "Ordered by mistake",
    "Found product at better price elsewhere",
    "Product out of stock notification",
    "Address information incorrect",
  ];
  return reasons[Math.floor(Math.random() * reasons.length)];
}

/**
 * Generate feedback rating (weighted towards positive ratings)
 */
function generateFeedbackRating() {
  // Weighted distribution: 5 stars (40%), 4 stars (30%), 3 stars (15%), 2 stars (10%), 1 star (5%)
  const random = Math.random();
  if (random < 0.4) return 5;
  if (random < 0.7) return 4;
  if (random < 0.85) return 3;
  if (random < 0.95) return 2;
  return 1;
}

/**
 * Generate feedback content based on rating
 */
function generateFeedbackContent(rating) {
  const feedbacks = {
    5: [
      "Excellent product! Very satisfied with the quality and fast delivery. Highly recommend!",
      "Perfect! Product arrived on time and exceeded my expectations. Will definitely order again.",
      "Outstanding quality and service. The product is exactly as described. Very happy with my purchase!",
      "Amazing product! Great value for money. Fast shipping and excellent packaging. 5 stars!",
      "Love it! The quality is top-notch and the delivery was super quick. Highly satisfied customer!",
      "Fantastic product! Exceeded expectations in every way. Fast delivery and great customer service.",
      "Perfect quality! The product is beautiful and well-made. Very pleased with my purchase!",
      "Excellent! Product is exactly what I was looking for. Fast shipping and great packaging.",
      "Outstanding! Great quality, fast delivery, and excellent value. Highly recommend this product!",
      "Wonderful product! Very satisfied with the quality and service. Will definitely buy again!",
    ],
    4: [
      "Great product! Good quality and reasonable price. Delivery was fast and packaging was good.",
      "Very good product. Met my expectations. Quick delivery and good customer service.",
      "Nice product! Quality is good and delivery was on time. Would recommend to others.",
      "Satisfied with my purchase. Product quality is good and shipping was fast.",
      "Good product overall. Quality is decent and price is fair. Delivery was prompt.",
      "Pretty good! The product is as expected. Fast shipping and good packaging.",
      "Nice quality! Product arrived on time. Satisfied with my purchase overall.",
      "Good value for money. Quality is acceptable and delivery was quick.",
      "Decent product. Quality meets expectations. Shipping was fast and reliable.",
      "Satisfactory purchase. Product quality is good and delivery was efficient.",
    ],
    3: [
      "Okay product. Quality is average. Could be better but acceptable for the price.",
      "Average quality. Product is fine but nothing special. Delivery was okay.",
      "Decent product. Not bad but not great either. Satisfactory for the price.",
      "Product is okay. Quality is acceptable but could use some improvements.",
      "Average purchase. Product meets basic expectations but nothing extraordinary.",
      "Fair quality. Product is acceptable but not exceptional. Delivery was fine.",
      "Okay overall. Quality is decent but room for improvement. Price is reasonable.",
      "Average product. Quality is fine but could be better. Satisfactory purchase.",
      "Decent quality. Product is acceptable but not impressive. Delivery was okay.",
      "Fair purchase. Product quality is average. Could use some improvements.",
    ],
    2: [
      "Disappointed with the quality. Product doesn't meet expectations. Not worth the price.",
      "Below average quality. Product has some issues. Expected better for this price.",
      "Not satisfied. Quality is poor and product doesn't match description well.",
      "Could be better. Product quality is below expectations. Not recommended.",
      "Disappointing purchase. Quality is not good and product has defects.",
      "Poor quality. Product doesn't meet my expectations. Expected better.",
      "Not happy with the quality. Product has issues and doesn't match description.",
      "Below expectations. Quality is poor and product arrived with some problems.",
      "Disappointed. Product quality is not good. Would not recommend.",
      "Unsatisfactory. Quality is below average and product has some defects.",
    ],
    1: [
      "Very disappointed. Poor quality and product doesn't work as described. Waste of money.",
      "Terrible quality! Product is defective and doesn't meet basic standards. Very unsatisfied.",
      "Extremely disappointed. Product is broken and quality is awful. Would not recommend.",
      "Poor quality product. Defective item and terrible customer service. Not worth buying.",
      "Very bad purchase. Product is broken and quality is terrible. Regret buying this.",
      "Worst purchase ever. Product is completely defective and quality is unacceptable.",
      "Extremely poor quality. Product doesn't work and is a waste of money. Very unhappy.",
      "Terrible product! Broken on arrival and quality is awful. Would never buy again.",
      "Very disappointed. Product is defective and quality is terrible. Complete waste.",
      "Poor quality and defective product. Does not work as described. Very unsatisfied.",
    ],
  };

  const ratingFeedbacks = feedbacks[rating] || feedbacks[3];
  return ratingFeedbacks[Math.floor(Math.random() * ratingFeedbacks.length)];
}

/**
 * Generate feedback date (should be after order date, typically 1-7 days after delivery)
 */
function generateFeedbackDate(orderDate, orderStatus) {
  if (orderStatus !== "delivered") {
    return null; // Only delivered orders can have feedback
  }

  // Feedback is typically left 1-7 days after delivery
  // For simplicity, we'll assume delivery happens shortly after order (1-3 days)
  // So feedback is 2-10 days after order date
  const daysAfterOrder = Math.floor(Math.random() * 9) + 2; // 2-10 days
  const feedbackDate = new Date(orderDate);
  feedbackDate.setDate(feedbackDate.getDate() + daysAfterOrder);
  
  // Add random hours and minutes
  feedbackDate.setHours(Math.floor(Math.random() * 24));
  feedbackDate.setMinutes(Math.floor(Math.random() * 60));
  
  return feedbackDate;
}

/**
 * Bulk generate random orders
 */
const bulkGenerateOrders = async (count) => {
  try {
    // Check if debug mode is enabled (this should be checked in controller, but double-check here)
    if (process.env.ENABLE_DEBUG_ORDERS !== "true") {
      throw new Error("Debug order generation is disabled. Set ENABLE_DEBUG_ORDERS=true in environment variables.");
    }

    // Validate count
    if (!count || count < 1 || count > 1000) {
      throw new Error("Count must be between 1 and 1000");
    }

    // Get available accounts (only user accounts, not admin/manager)
    const accounts = await Accounts.find({
      role: { $in: ["user"] },
      isDeleted: { $ne: true },
    }).select("_id name email phone address");

    if (accounts.length === 0) {
      throw new Error("No user accounts found. Please create user accounts first.");
    }

    // Get available variants (only active ones)
    const variants = await newProductVariant
      .find({
        variantStatus: "active",
      })
      .populate("productId", "productName")
      .populate("productColorId", "productColorName")
      .populate("productSizeId", "productSizeName");

    if (variants.length === 0) {
      throw new Error("No active product variants found. Please create product variants first.");
    }

    // Get available vouchers (only active ones)
    const vouchers = await Vouchers.find({
      isActive: true,
      startDate: { $lte: new Date() },
      $or: [
        { endDate: { $gte: new Date() } },
        { endDate: null },
      ],
    }).select("_id discountType discountValue discount_percentage discount_amount minOrderValue maxDiscountAmount");

    const generatedOrders = [];

    // Generate orders
    for (let i = 0; i < count; i++) {
      // Random account
      const account = accounts[Math.floor(Math.random() * accounts.length)];

      // Random order date (within last year - 365 days)
      const orderDate = generateRandomDate(365);

      // Random number of items in order (1-5)
      const itemCount = Math.floor(Math.random() * 5) + 1;

      // Select random variants (no duplicates)
      const selectedVariants = [];
      const availableVariants = [...variants];
      
      for (let j = 0; j < itemCount && availableVariants.length > 0; j++) {
        const randomIndex = Math.floor(Math.random() * availableVariants.length);
        const variant = availableVariants.splice(randomIndex, 1)[0];
        const quantity = Math.floor(Math.random() * 5) + 1; // 1-5 items
        selectedVariants.push({ variant, quantity });
      }

      if (selectedVariants.length === 0) {
        continue; // Skip if no variants selected
      }

      // Calculate total price
      let totalPrice = 0;
      const orderDetailsData = [];

      for (const { variant, quantity } of selectedVariants) {
        const unitPrice = variant.variantPrice || 0;
        const itemTotal = unitPrice * quantity;
        totalPrice += itemTotal;

        orderDetailsData.push({
          variantId: variant._id,
          unitPrice: unitPrice,
          Quantity: quantity,
        });
      }

      // Random voucher (30% chance)
      let voucher = null;
      let discountAmount = 0;
      if (vouchers.length > 0 && Math.random() > 0.7) {
        voucher = vouchers[Math.floor(Math.random() * vouchers.length)];
        
        // Calculate discount based on voucher type
        if (voucher.discountType === "percentage") {
          const discountPercent = voucher.discount_percentage || voucher.discountValue || 0;
          discountAmount = (totalPrice * discountPercent) / 100;
          if (voucher.maxDiscountAmount) {
            discountAmount = Math.min(discountAmount, voucher.maxDiscountAmount);
          }
        } else if (voucher.discountType === "fixed") {
          discountAmount = voucher.discount_amount || voucher.discountValue || 0;
        }

        // Check min order value
        if (voucher.minOrderValue && totalPrice < voucher.minOrderValue) {
          voucher = null;
          discountAmount = 0;
        }
      }

      const finalPrice = Math.max(0, totalPrice - discountAmount);

      // Generate order status
      const orderStatus = generateRandomOrderStatus();
      const payStatus = generatePaymentStatus(orderStatus);
      const paymentMethod = generatePaymentMethod();
      const refundStatus = generateRefundStatus(orderStatus, payStatus);

      // Use account info or generate random
      const name = account.name || SAMPLE_NAMES[Math.floor(Math.random() * SAMPLE_NAMES.length)];
      const phone = account.phone || generateRandomPhone();
      const addressReceive = account.address || SAMPLE_ADDRESSES[Math.floor(Math.random() * SAMPLE_ADDRESSES.length)];

      // Create order
      const orderData = {
        accountId: account._id,
        voucherId: voucher ? voucher._id : null,
        orderDate,
        addressReceive,
        name,
        phone,
        totalPrice,
        discountAmount,
        finalPrice,
        orderStatus,
        payStatus,
        paymentMethod,
        refundStatus,
        refundProof: refundStatus === "refunded" ? "https://example.com/refund-proof.jpg" : "",
        cancelReason: orderStatus === "cancelled" ? generateCancelReason() : "",
        orderDetails: [],
      };

      const order = new Orders(orderData);
      await order.save();

      // Create order details
      const createdOrderDetails = [];
      for (const detailData of orderDetailsData) {
        const orderDetailData = {
          ...detailData,
          orderId: order._id,
        };

        // Add feedback for delivered orders (70% chance)
        // Feedback should only exist for delivered orders
        if (orderStatus === "delivered" && Math.random() > 0.3) {
          const rating = generateFeedbackRating();
          const feedbackDate = generateFeedbackDate(orderDate, orderStatus);
          
          orderDetailData.feedback = {
            rating: rating,
            content: generateFeedbackContent(rating),
            createdAt: feedbackDate,
            updatedAt: feedbackDate,
            isDeleted: false,
          };
        } else {
          // No feedback for non-delivered orders
          orderDetailData.feedback = {
            rating: null,
            content: "",
            createdAt: null,
            updatedAt: null,
            isDeleted: false,
          };
        }

        const orderDetail = new OrderDetails(orderDetailData);
        await orderDetail.save();
        createdOrderDetails.push(orderDetail._id);
      }

      // Update order with order details IDs
      order.orderDetails = createdOrderDetails;
      await order.save();

      generatedOrders.push({
        orderId: order._id,
        account: account.name || account.email,
        itemCount: selectedVariants.length,
        totalPrice,
        discountAmount,
        finalPrice,
        orderStatus,
        payStatus,
      });
    }

    return {
      success: true,
      count: generatedOrders.length,
      orders: generatedOrders,
      message: `Successfully generated ${generatedOrders.length} random order(s)`,
    };
  } catch (error) {
    throw new Error(`Failed to generate debug orders: ${error.message}`);
  }
};

module.exports = {
  bulkGenerateOrders,
};

