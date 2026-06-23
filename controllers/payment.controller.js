const paymentService = require("../services/payment.service");
const { sendSuccess } = require("../utils/apiResponse");

/**
 * POST /api/payments/create-intent
 * Stripe payment intent placeholder.
 */
async function createPaymentIntent(req, res) {
  const classId = req.body.classId || req.body.class_id;

  const payment = await paymentService.createPaymentIntent(
    req.user.userId,
    classId
  );

  return sendSuccess(res, { payment }, "Payment intent created successfully");
}

module.exports = {
  createPaymentIntent,
};
