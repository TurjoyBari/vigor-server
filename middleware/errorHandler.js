const AppError = require("../utils/AppError");

/**
 * Global Express error handler.
 */
function errorHandler(err, req, res, next) {
  console.error("[VIGOR API Error]", err);

  const isProduction = process.env.NODE_ENV === "production";

  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";

  if (err.name === "JsonWebTokenError") {
    statusCode = 401;
    message = "Invalid token";
  }

  if (err.name === "TokenExpiredError") {
    statusCode = 401;
    message = "Token expired";
  }

  if (err.name === "MongoServerError" && err.code === 11000) {
    statusCode = 409;
    message = "Duplicate entry — record already exists";
  }

  if (isProduction && statusCode === 500 && !err.isOperational) {
    message = "Internal server error";
  }

  res.status(statusCode).json({
    success: false,
    message,
    ...(!isProduction && err.stack ? { stack: err.stack } : {}),
  });
}

/**
 * 404 handler for unmatched routes.
 */
function notFoundHandler(req, res, next) {
  next(new AppError(`Route not found: ${req.method} ${req.originalUrl}`, 404));
}

module.exports = {
  errorHandler,
  notFoundHandler,
};
