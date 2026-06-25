require("dotenv").config();

const express = require("express");
const cors = require("cors");
const cookieParser = require("cookie-parser");
const { connectDB, closeDB, isDbConnected } = require("./config/db");
const { errorHandler, notFoundHandler } = require("./middleware/errorHandler");
const asyncHandler = require("./utils/asyncHandler");
const paymentController = require("./controllers/payment.controller");

const app = express();

const PORT = process.env.PORT || 5000;
const NODE_ENV = process.env.NODE_ENV || "development";
const IS_VERCEL = Boolean(process.env.VERCEL);

function getAllowedOrigins() {
  const raw = process.env.CLIENT_URL || "http://localhost:3000";
  return raw
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
}

function isOriginAllowed(origin) {
  if (!origin) return true;

  const allowed = getAllowedOrigins();
  if (allowed.includes(origin)) return true;

  // Vercel preview + production frontends (*.vercel.app)
  if (/^https:\/\/[\w.-]+\.vercel\.app$/.test(origin)) return true;

  return false;
}

// ---------------------------------------------------------------------------
// Global middleware
// ---------------------------------------------------------------------------
app.use(
  cors({
    origin(origin, callback) {
      if (isOriginAllowed(origin)) {
        callback(null, true);
      } else {
        callback(null, false);
      }
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Stripe webhook — raw body (must be before express.json)
app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  asyncHandler(paymentController.handleStripeWebhook)
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// ---------------------------------------------------------------------------
// Health & root routes
// ---------------------------------------------------------------------------
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "VIGOR API is running",
    version: "1.0.0",
    docs: "/api/health",
  });
});

app.get(
  "/api/health",
  asyncHandler(async (req, res) => {
    try {
      await connectDB();
    } catch {
      // Health still returns so deploy checks can surface DB status.
    }

    res.json({
      success: true,
      status: "ok",
      database: isDbConnected() ? "connected" : "disconnected",
      environment: NODE_ENV,
      timestamp: new Date().toISOString(),
    });
  })
);

// Ensure MongoDB is connected before API handlers (required on Vercel serverless).
app.use(
  "/api",
  asyncHandler(async (req, res, next) => {
    await connectDB();
    next();
  })
);

// ---------------------------------------------------------------------------
// API routes
// ---------------------------------------------------------------------------
app.use("/api/auth", require("./routes/auth.routes"));
app.use("/api/users", require("./routes/user.routes"));
app.use("/api/admin", require("./routes/admin.routes"));
app.use("/api/trainer", require("./routes/trainer.routes"));
app.use("/api/user", require("./routes/userDashboard.routes"));
app.use("/api/classes", require("./routes/class.routes"));
app.use("/api/forum", require("./routes/forum.routes"));
app.use("/api/bookings", require("./routes/booking.routes"));
app.use("/api/favorites", require("./routes/favorite.routes"));
app.use("/api/payments", require("./routes/payment.routes"));
app.use("/api/trainer-applications", require("./routes/trainerApplication.routes"));
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// 404 + global error handlers
// ---------------------------------------------------------------------------
app.use(notFoundHandler);
app.use(errorHandler);

// ---------------------------------------------------------------------------
// Server bootstrap (DB connection added in Step 4)
// ---------------------------------------------------------------------------
let server;

async function startServer() {
  try {
    await connectDB();

    server = app.listen(PORT, () => {
      // console.log(`VIGOR API running on http://localhost:${PORT}`);
      // console.log(`Environment: ${NODE_ENV}`);
      // console.log(`CORS origin: ${CLIENT_URL}`);
    });
  } catch (error) {
    console.error("Failed to start server:", error);
    process.exit(1);
  }
}

function shutdown(signal) {
  // console.log(`\n${signal} received. Shutting down gracefully...`);

  const finish = async () => {
    try {
      await closeDB();
    } catch (error) {
      console.error("Error closing database:", error);
    }
    process.exit(0);
  };

  if (server) {
    server.close(() => {
      // console.log("HTTP server closed.");
      finish();
    });
  } else {
    finish();
  }
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

process.on("unhandledRejection", (reason) => {
  console.error("Unhandled Rejection:", reason);
});

process.on("uncaughtException", (error) => {
  console.error("Uncaught Exception:", error);
  process.exit(1);
});

// Vercel serverless: export app only — do not call app.listen().
if (IS_VERCEL) {
  module.exports = app;
} else {
  startServer();
  module.exports = app;
}
