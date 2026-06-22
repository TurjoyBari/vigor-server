/**
 * Standardized API response helpers.
 */
function sendSuccess(res, data = null, message = "Success", statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    message,
    data,
  });
}

function sendCreated(res, data = null, message = "Created successfully") {
  return sendSuccess(res, data, message, 201);
}

function sendError(res, message = "Something went wrong", statusCode = 500, errors = null) {
  return res.status(statusCode).json({
    success: false,
    message,
    ...(errors ? { errors } : {}),
  });
}

module.exports = {
  sendSuccess,
  sendCreated,
  sendError,
};
