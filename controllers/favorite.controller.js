const favoriteService = require("../services/favorite.service");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");

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

async function removeFavorite(req, res) {
  const result = await favoriteService.removeFavorite(req.user.userId, req.params.id);
  return sendSuccess(res, result, "Favorite removed successfully");
}

module.exports = {
  addFavorite,
  getFavorites,
  removeFavorite,
};
