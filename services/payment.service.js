const AppError = require("../utils/AppError");
const classService = require("./class.service");

/**
 * Stripe placeholder — returns mock payment intent data.
 * Replace with real Stripe SDK when STRIPE_SECRET_KEY is configured.
 */
async function createPaymentIntent(userId, classId) {
  if (!classId) {
    throw new AppError("classId is required", 400);
  }

  const classItem = await classService.getClassById(classId);
  const amount = Math.round(Number(classItem.price) * 100);

  if (!amount || amount < 0) {
    throw new AppError("Invalid class price", 400);
  }

  const paymentIntentId = `pi_placeholder_${Date.now()}`;

  return {
    mode: "placeholder",
    paymentIntentId,
    clientSecret: `${paymentIntentId}_secret_placeholder`,
    amount,
    amountDisplay: classItem.price,
    currency: "usd",
    classId: classItem.id,
    className: classItem.className,
    trainer: classItem.trainer,
    userId,
    message:
      "Stripe keys not configured yet. Use mock checkout flow on the frontend.",
  };
}

module.exports = {
  createPaymentIntent,
};
