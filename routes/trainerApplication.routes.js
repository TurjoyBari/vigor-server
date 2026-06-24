const express = require("express");
const trainerApplicationController = require("../controllers/trainerApplication.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken);

/**
 * @route   POST /api/trainer-applications
 * @desc    Submit trainer application (saved to MongoDB trainerApplications)
 * @access  Private (user)
 */
router.post("/", asyncHandler(trainerApplicationController.applyTrainer));

/**
 * @route   GET /api/trainer-applications/user/:userId
 * @desc    Get trainer application for a specific user
 * @access  Private (own user or admin)
 */
router.get(
  "/user/:userId",
  requireRole("user", "trainer", "admin"),
  asyncHandler(trainerApplicationController.getApplicationByUserId)
);

/**
 * @route   GET /api/trainer-applications
 * @desc    Get all trainer applications (admin)
 * @access  Private (admin)
 */
router.get(
  "/",
  requireRole("admin"),
  asyncHandler(trainerApplicationController.getApplications)
);

/**
 * @route   PATCH /api/trainer-applications/:id/approve
 * @desc    Approve application and promote user to trainer
 * @access  Private (admin)
 */
router.patch(
  "/:id/approve",
  requireRole("admin"),
  asyncHandler(trainerApplicationController.approveApplication)
);

/**
 * @route   PATCH /api/trainer-applications/:id/reject
 * @desc    Reject application with feedback
 * @access  Private (admin)
 */
router.patch(
  "/:id/reject",
  requireRole("admin"),
  asyncHandler(trainerApplicationController.rejectApplication)
);

module.exports = router;
