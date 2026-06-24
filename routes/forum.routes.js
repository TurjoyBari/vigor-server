const express = require("express");
const forumController = require("../controllers/forum.controller");
const asyncHandler = require("../utils/asyncHandler");
const { verifyToken, optionalAuth } = require("../middleware/verifyToken");
const { requireRole } = require("../middleware/requireRole");
const { checkUserBlocked } = require("../middleware/checkUserBlocked");

const router = express.Router();

/**
 * @route   GET /api/forum/posts
 * @desc    Get all forum posts
 * @access  Public
 */
router.get("/posts", asyncHandler(forumController.getAllPosts));

/**
 * @route   GET /api/forum/posts/:id
 * @desc    Get single post with comments
 * @access  Public
 */
router.get("/posts/:id", asyncHandler(forumController.getPostById));

/**
 * @route   POST /api/forum/posts
 * @desc    Create forum post
 * @access  Trainer, Admin
 */
router.post(
  "/posts",
  verifyToken,
  requireRole("trainer", "admin"),
  asyncHandler(forumController.createPost)
);

/**
 * @route   DELETE /api/forum/posts/:id
 * @desc    Delete forum post
 * @access  Author, Admin
 */
router.delete(
  "/posts/:id",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  asyncHandler(forumController.deletePost)
);

/**
 * @route   POST /api/forum/posts/:id/like
 * @desc    Like / toggle like on post
 * @access  Private
 */
router.post(
  "/posts/:id/like",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  checkUserBlocked,
  asyncHandler(forumController.likePost)
);

/**
 * @route   POST /api/forum/posts/:id/dislike
 * @desc    Dislike / toggle dislike on post
 * @access  Private
 */
router.post(
  "/posts/:id/dislike",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  checkUserBlocked,
  asyncHandler(forumController.dislikePost)
);

/**
 * @route   POST /api/forum/posts/:id/comments
 * @desc    Add comment to post
 * @access  Private
 */
router.post(
  "/posts/:id/comments",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  checkUserBlocked,
  asyncHandler(forumController.addComment)
);

/**
 * @route   POST /api/forum/comments/:id/reply
 * @desc    Reply to a comment
 * @access  Private
 */
router.post(
  "/comments/:id/reply",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  checkUserBlocked,
  asyncHandler(forumController.replyComment)
);

/**
 * @route   PATCH /api/forum/comments/:id
 * @desc    Edit a comment
 * @access  Comment owner, Admin
 */
router.patch(
  "/comments/:id",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  checkUserBlocked,
  asyncHandler(forumController.editComment)
);

/**
 * @route   DELETE /api/forum/comments/:id
 * @desc    Delete a comment
 * @access  Comment owner, Admin
 */
router.delete(
  "/comments/:id",
  verifyToken,
  requireRole("user", "trainer", "admin"),
  checkUserBlocked,
  asyncHandler(forumController.deleteComment)
);

module.exports = router;
