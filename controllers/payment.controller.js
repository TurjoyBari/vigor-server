const paymentService = require("../services/payment.service");
const AppError = require("../utils/AppError");
const { sendSuccess } = require("../utils/apiResponse");

/**
 * POST /api/payments/create-checkout-session
 */
async function createCheckoutSession(req, res) {
  const classId = req.body.classId || req.body.class_id;

  const session = await paymentService.createCheckoutSession(
    req.user.userId,
    classId
  );

  return sendSuccess(res, session, "Checkout session created successfully");
}

/**
 * POST /api/payments/webhook
 * Stripe webhook — raw body required for signature verification.
 */
async function handleStripeWebhook(req, res) {
  const signature = req.headers["stripe-signature"];

  let event;
  try {
    event = paymentService.constructWebhookEvent(req.body, signature);
  } catch (error) {
    console.error("Stripe webhook signature error:", error.message);
    return res.status(400).send(`Webhook Error: ${error.message}`);
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object;
    // console.log("Payment completed:", event);

    try {
      await paymentService.fulfillCheckoutSession(session);
    } catch (error) {
      console.error("Checkout fulfillment error:", error);
      return res.status(500).send("Webhook fulfillment failed");
    }
  }

  return res.json({ received: true });
}

/**
 * GET /api/payments/my
 * Current user's payments from MongoDB payments collection only.
 */
async function getMyPayments(req, res) {
  const payments = await paymentService.getPaymentsByUserId(req.user.userId);

  return sendSuccess(
    res,
    { payments, total: payments.length },
    "User payments fetched successfully"
  );
}

/**
 * GET /api/payments/user/:userId
 * Payments for a specific user from MongoDB payments collection (own user or admin).
 */
async function getPaymentsByUserId(req, res) {
  const { userId } = req.params;

  if (req.user.role !== "admin" && String(req.user.userId) !== String(userId)) {
    throw new AppError("You do not have permission to view these payments", 403);
  }

  const payments = await paymentService.getPaymentsByUserId(userId);

  return sendSuccess(
    res,
    { payments, total: payments.length },
    "User payments fetched successfully"
  );
}

/**
 * GET /api/payments/session/:sessionId
 * Success page data after Stripe redirect.
 */
async function getCheckoutSession(req, res) {
  const data = await paymentService.retrieveCheckoutSession(req.params.sessionId);
  return sendSuccess(res, data, "Checkout session retrieved successfully");
}

module.exports = {
  createCheckoutSession,
  handleStripeWebhook,
  getMyPayments,
  getPaymentsByUserId,
  getCheckoutSession,
};
