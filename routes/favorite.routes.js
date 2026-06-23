const express = require("express");
const favoriteController = require("../controllers/favorite.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken, requireRole("user", "trainer", "admin"));

/**
 * @route   GET /api/favorites/check?classId=
 * @desc    Check if class is favorited
 * @access  Private
 */
router.get("/check", asyncHandler(favoriteController.checkFavorite));

/**
 * @route   POST /api/favorites
 * @desc    Add class to favorites
 * @access  Private
 */
router.post("/", asyncHandler(favoriteController.addFavorite));

/**
 * @route   GET /api/favorites
 * @desc    Get user favorites
 * @access  Private
 */
router.get("/", asyncHandler(favoriteController.getFavorites));

/**
 * @route   DELETE /api/favorites/:id
 * @desc    Remove favorite
 * @access  Private
 */
router.delete("/:id", asyncHandler(favoriteController.removeFavorite));

module.exports = router;
