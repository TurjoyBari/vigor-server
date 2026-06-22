const express = require("express");
const userController = require("../controllers/user.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken);

/**
 * @route   POST /api/users
 * @desc    Create a new user
 * @access  Admin
 */
router.post(
  "/",
  requireRole("admin"),
  asyncHandler(userController.createUser)
);

/**
 * @route   GET /api/users
 * @desc    Get all users
 * @access  Admin
 */
router.get(
  "/",
  requireRole("admin"),
  asyncHandler(userController.getAllUsers)
);

/**
 * @route   GET /api/users/:id
 * @desc    Get a single user
 * @access  Admin or self
 */
router.get("/:id", asyncHandler(userController.getUser));

/**
 * @route   PATCH /api/users/:id/block
 * @desc    Block a user
 * @access  Admin
 */
router.patch(
  "/:id/block",
  requireRole("admin"),
  asyncHandler(userController.blockUser)
);

/**
 * @route   PATCH /api/users/:id/unblock
 * @desc    Unblock a user
 * @access  Admin
 */
router.patch(
  "/:id/unblock",
  requireRole("admin"),
  asyncHandler(userController.unblockUser)
);

/**
 * @route   PATCH /api/users/:id/make-admin
 * @desc    Promote user to admin
 * @access  Admin
 */
router.patch(
  "/:id/make-admin",
  requireRole("admin"),
  asyncHandler(userController.makeAdmin)
);

module.exports = router;
