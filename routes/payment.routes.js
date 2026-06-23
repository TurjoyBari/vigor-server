const express = require("express");
const paymentController = require("../controllers/payment.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken, requireRole("user", "trainer", "admin"));

/**
 * @route   POST /api/payments/create-intent
 * @desc    Create Stripe payment intent (placeholder until keys added)
 * @access  Private
 */
router.post(
  "/create-intent",
  asyncHandler(paymentController.createPaymentIntent)
);

module.exports = router;
