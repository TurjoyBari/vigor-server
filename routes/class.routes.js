const express = require("express");
const classController = require("../controllers/class.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, optionalAuth } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

/**
 * @route   GET /api/classes/approved
 * @desc    Get approved/published classes (public catalog)
 * @access  Public
 */
router.get("/approved", asyncHandler(classController.getApprovedClasses));

/**
 * @route   GET /api/classes/featured
 * @desc    Get top featured classes (approved, highest booking count)
 * @access  Public
 */
router.get("/featured", asyncHandler(classController.getFeaturedClasses));

/**
 * @route   GET /api/classes
 * @desc    Get all classes with search/filter
 * @access  Public (optional auth)
 */
router.get("/", optionalAuth, asyncHandler(classController.getAllClasses));

/**
 * @route   GET /api/classes/:id
 * @desc    Get single class
 * @access  Public
 */
router.get("/:id", asyncHandler(classController.getClassById));

/**
 * @route   POST /api/classes
 * @desc    Add a new class
 * @access  Trainer, Admin
 */
router.post(
  "/",
  verifyToken,
  requireRole("trainer", "admin"),
  asyncHandler(classController.createClass)
);

/**
 * @route   PATCH /api/classes/:id
 * @desc    Update class
 * @access  Trainer (own), Admin
 */
router.patch(
  "/:id",
  verifyToken,
  requireRole("trainer", "admin"),
  asyncHandler(classController.updateClass)
);

/**
 * @route   DELETE /api/classes/:id
 * @desc    Delete class
 * @access  Trainer (own), Admin
 */
router.delete(
  "/:id",
  verifyToken,
  requireRole("trainer", "admin"),
  asyncHandler(classController.deleteClass)
);

/**
 * @route   PATCH /api/classes/:id/approve
 * @desc    Approve class
 * @access  Admin
 */
router.patch(
  "/:id/approve",
  verifyToken,
  requireRole("admin"),
  asyncHandler(classController.approveClass)
);

/**
 * @route   PATCH /api/classes/:id/reject
 * @desc    Reject class
 * @access  Admin
 */
router.patch(
  "/:id/reject",
  verifyToken,
  requireRole("admin"),
  asyncHandler(classController.rejectClass)
);

module.exports = router;
