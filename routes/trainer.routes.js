const express = require("express");
const trainerController = require("../controllers/trainer.controller");
const classController = require("../controllers/class.controller");
const forumController = require("../controllers/forum.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");

const router = express.Router();

router.use(verifyToken, requireRole("trainer", "admin"));

router.get("/overview", asyncHandler(trainerController.getOverview));
router.get("/profile", asyncHandler(trainerController.getProfile));
router.patch("/profile", asyncHandler(trainerController.updateProfile));

router.get("/classes", asyncHandler(classController.getTrainerClasses));
router.post("/classes", asyncHandler(classController.createClass));
router.patch("/classes/:id", asyncHandler(classController.updateClass));
router.delete("/classes/:id", asyncHandler(classController.deleteClass));
router.get("/classes/:id/students", asyncHandler(classController.getClassStudents));

router.get("/forum-posts", asyncHandler(forumController.getTrainerPosts));
router.post("/forum-posts", asyncHandler(forumController.createPost));
router.delete("/forum-posts/:id", asyncHandler(forumController.deletePost));

module.exports = router;
