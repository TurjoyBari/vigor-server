const express = require("express");
const adminController = require("../controllers/admin.controller");
const classController = require("../controllers/class.controller");
const forumController = require("../controllers/forum.controller");
const userController = require("../controllers/user.controller");
const trainerApplicationController = require("../controllers/trainerApplication.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken, requireRole("admin"));

router.get("/overview", asyncHandler(adminController.getOverview));
router.get("/transactions", asyncHandler(adminController.getTransactions));
router.get("/profile", asyncHandler(adminController.getProfile));
router.patch("/profile", asyncHandler(adminController.updateProfile));

router.get("/users", asyncHandler(userController.getAllUsers));
router.patch("/users/:id/block", asyncHandler(userController.blockUser));
router.patch("/users/:id/unblock", asyncHandler(userController.unblockUser));
router.patch("/users/:id/promote", asyncHandler(userController.makeAdmin));

router.get("/trainer-applications", asyncHandler(trainerApplicationController.getApplications));
router.patch(
  "/trainer-applications/:id",
  asyncHandler(trainerApplicationController.reviewApplication)
);

router.get("/trainers", asyncHandler(trainerApplicationController.getTrainers));
router.patch("/trainers/:id/demote", asyncHandler(trainerApplicationController.demoteTrainer));

router.get("/classes", asyncHandler(classController.getAllClasses));
router.patch("/classes/:id/approve", asyncHandler(classController.approveClass));
router.patch("/classes/:id/reject", asyncHandler(classController.rejectClass));
router.delete("/classes/:id", asyncHandler(classController.deleteClass));

router.get("/forum-posts", asyncHandler(forumController.getAllPosts));
router.post("/forum-posts", asyncHandler(forumController.createPost));
router.delete("/forum-posts/:id", asyncHandler(forumController.deletePost));

module.exports = router;
