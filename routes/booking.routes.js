const express = require("express");
const bookingController = require("../controllers/booking.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken, requireRole("user", "trainer", "admin"));

/**
 * @route   GET /api/bookings/check?classId=
 * @desc    Check if user already booked a class
 * @access  Private
 */
router.get("/check", asyncHandler(bookingController.checkBooking));

/**
 * @route   POST /api/bookings
 * @desc    Book a class
 * @access  Private
 */
router.post("/", asyncHandler(bookingController.bookClass));

/**
 * @route   GET /api/bookings/my
 * @desc    Get current user's booked classes
 * @access  Private
 */
router.get("/my", asyncHandler(bookingController.getBookedClasses));

module.exports = router;
