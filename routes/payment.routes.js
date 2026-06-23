const express = require("express");
const paymentController = require("../controllers/payment.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken, requireRole("user", "trainer", "admin"));

/**
 * @route   POST /api/payments/create-checkout-session
 * @desc    Create Stripe Checkout Session
 * @access  Private
 */
router.post(
  "/create-checkout-session",
  asyncHandler(paymentController.createCheckoutSession)
);

/**
 * @route   GET /api/payments/session/:sessionId
 * @desc    Retrieve checkout session for success page
 * @access  Private
 */
router.get(
  "/session/:sessionId",
  asyncHandler(paymentController.getCheckoutSession)
);

module.exports = router;
