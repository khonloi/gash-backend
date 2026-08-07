const express = require("express");
const cors = require("cors");
const morgan = require("morgan");
const helmet = require("helmet");
const compression = require("compression");
const cookieParser = require("cookie-parser");
const path = require("path");

const app = express();

// ===== CORS =====
// Shared origin list — also used in server.js for Socket.IO.
// Update this list to add new allowed origins.
const CORS_ORIGINS = [
  "http://localhost:5173",
  "http://localhost:5174",
  "http://localhost:5175",
  "http://localhost:3000",
  "http://localhost:3001",
  "https://gash-pi.vercel.app",
];
module.exports.CORS_ORIGINS = CORS_ORIGINS;

app.use(
  cors({
    origin: CORS_ORIGINS,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    credentials: true,
  }),
);

// ===== Security Headers (helmet) =====
// crossOriginResourcePolicy relaxed to allow images/assets served from Cloudinary CDN.
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: false, // managed by the frontend (Vite/Vercel)
  }),
);

// ===== Response Compression =====
app.use(compression());

// ===== Request Logging =====
if (process.env.NODE_ENV === "development" || process.env.DEBUG === "true") {
  app.use(morgan("dev"));
} else {
  // Production: only log errors (4xx/5xx)
  app.use(morgan("combined", { skip: (req, res) => res.statusCode < 400 }));
}

// ===== Body Parsing =====
// NOTE: body-parser is not needed — express.json() and express.urlencoded() cover everything
// since Express 4.16+. 50MB limit is required for multi-file uploads.
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ extended: true, limit: "50mb" }));
app.use(cookieParser());

// ===== Static Files =====
app.use(express.static(path.join(__dirname, "public")));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// ===== Routes =====
// All route imports and mounts are consolidated here, grouped by domain.

// -- Auth & Accounts --
const authRoutes = require("./routes/authRoutes");
const accountsRoutes = require("./routes/accountRoutes");
const passkeyRoutes = require("./routes/passkeyRoutes");

// -- Catalog --
const productRoutes = require("./routes/productRoutes");
const productSpecRoutes = require("./routes/specificationRoutes");
const favoritesRoutes = require("./routes/favoriteRoutes");

// -- Cart & Orders --
const cartRoutes = require("./routes/cartRoutes");
const ordersRoutes = require("./routes/orderRoutes");
const billRoutes = require("./routes/billRoutes");
const voucherRoutes = require("./routes/voucherRoutes");
const feedbackRoutes = require("./routes/feedbackRoutes");

// -- Messaging --
const conversationRoutes = require("./routes/conversationRoutes");
const messageRoutes = require("./routes/messageRoutes");

// -- Notifications --
const notificationRoutes = require("./routes/notificationRoutes");

// -- Livestream --
const livestreamRoutes = require("./routes/livestreamRoutes");

// -- Statistics --
const statisticsRoutes = require("./routes/statisticRoutes");
// -- Upload --
const uploadRoutes = require("./routes/uploadRoutes");

// ===== Mount Routes =====

// Auth & Accounts
app.use("/auth", authRoutes);
app.use("/accounts", accountsRoutes);
app.use("/passkeys", passkeyRoutes);

// Catalog
app.use("/categories", productSpecRoutes);
app.use("/products", productRoutes);
app.use("/variants", productRoutes);
app.use("/specifications", productSpecRoutes);
app.use("/favorites", favoritesRoutes);

// Cart & Orders
app.use("/carts", cartRoutes);
app.use("/orders", ordersRoutes);
app.use("/order-details", ordersRoutes);
app.use("/bills", billRoutes);
app.use("/vouchers", voucherRoutes);
app.use("/feedback", feedbackRoutes);

// Messaging
// NOTE: messageRoutes mounted ONLY on /messages — previously it was erroneously
// also mounted on /conversations (shadowing conversationRoutes).
app.use("/conversations", conversationRoutes);
app.use("/messages", messageRoutes);

// Notifications
app.use("/notifications", notificationRoutes);

// Livestream
app.use("/livestream", livestreamRoutes);
app.use("/livestream-products", livestreamRoutes);
app.use("/livestream-comments", livestreamRoutes);
app.use("/livestream-reactions", livestreamRoutes);

// Statistics
app.use("/statistics", statisticsRoutes);

// Upload
app.use("/upload", uploadRoutes);

// ===== 404 Handler =====
app.use((req, res) => {
  res.status(404).json({ success: false, message: "Route not found" });
});

// ===== Global Error Handler =====
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";

  if (status >= 500) {
    console.error("Unhandled error:", err);
  }

  res.status(status).json({
    success: false,
    message,
    ...(process.env.NODE_ENV === "development" && { stack: err.stack }),
  });
});

module.exports = app;
