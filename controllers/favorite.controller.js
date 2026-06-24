const favoriteService = require("../services/favorite.service");
const AppError = require("../utils/AppError");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");

async function checkFavorite(req, res) {
  const { classId } = req.query;
  const result = await favoriteService.checkFavorite(req.user.userId, classId);
  return sendSuccess(res, result, "Favorite status checked successfully");
}

async function addFavorite(req, res) {
  const favorite = await favoriteService.addFavorite(
    req.user.userId,
    req.body.classId
  );
  return sendCreated(res, { favorite }, "Added to favorites successfully");
}

async function getFavorites(req, res) {
  const favorites = await favoriteService.getFavorites(req.user.userId);
  return sendSuccess(
    res,
    { favorites, total: favorites.length },
    "Favorites fetched successfully"
  );
}

/**
 * GET /api/favorites/user/:userId
 * Favorites for a specific user from MongoDB favorites collection (own user or admin).
 */
async function getFavoritesByUserId(req, res) {
  const { userId } = req.params;

  if (req.user.role !== "admin" && String(req.user.userId) !== String(userId)) {
    throw new AppError("You do not have permission to view these favorites", 403);
  }

  const favorites = await favoriteService.getFavoritesByUserId(userId);

  return sendSuccess(
    res,
    { favorites, total: favorites.length },
    "User favorites fetched successfully"
  );
}

async function removeFavorite(req, res) {
  const result = await favoriteService.removeFavorite(req.user.userId, req.params.id);
  return sendSuccess(res, result, "Favorite removed successfully");
}

module.exports = {
  checkFavorite,
  addFavorite,
  getFavorites,
  getFavoritesByUserId,
  removeFavorite,
};
