const express = require("express");
const userDashboardController = require("../controllers/userDashboard.controller");
const bookingController = require("../controllers/booking.controller");
const favoriteController = require("../controllers/favorite.controller");
const trainerApplicationController = require("../controllers/trainerApplication.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");
const { checkUserBlocked } = require("../middleware/checkUserBlocked");

const router = express.Router();

router.use(verifyToken, requireRole("user", "trainer", "admin"));

router.get("/overview", asyncHandler(userDashboardController.getOverview));
router.get("/profile", asyncHandler(userDashboardController.getProfile));
router.patch("/profile", asyncHandler(userDashboardController.updateProfile));

router.get("/booked-classes", asyncHandler(bookingController.getBookedClasses));
router.get("/favorites", asyncHandler(favoriteController.getFavorites));
router.post("/favorites", checkUserBlocked, asyncHandler(favoriteController.addFavorite));
router.delete("/favorites/:id", checkUserBlocked, asyncHandler(favoriteController.removeFavorite));
router.post(
  "/apply-trainer",
  requireRole("user"),
  checkUserBlocked,
  asyncHandler(trainerApplicationController.applyTrainer)
);

module.exports = router;
