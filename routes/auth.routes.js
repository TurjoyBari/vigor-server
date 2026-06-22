const express = require("express");
const authController = require("../controllers/auth.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");

const router = express.Router();

/**
 * @route   POST /api/auth/token
 * @desc    Issue JWT after Better Auth login
 * @access  Public (requires valid Better Auth session payload)
 */
router.post("/token", asyncHandler(authController.createToken));

/**
 * @route   POST /api/auth/logout
 * @desc    Clear auth cookie
 * @access  Public
 */
router.post("/logout", asyncHandler(authController.logout));

/**
 * @route   GET /api/auth/me
 * @desc    Get current authenticated user
 * @access  Private
 */
router.get("/me", verifyToken, asyncHandler(authController.getMe));

module.exports = router;
