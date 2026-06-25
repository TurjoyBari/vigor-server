const forumService = require("../services/forum.service");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");

async function createPost(req, res) {
  // console.log(req.body);
  const post = await forumService.createPost(req.user, req.body);
  return sendCreated(res, { post, insertedId: post?.id }, "Forum post created successfully");
}

async function getAllPosts(req, res) {
  const result = await forumService.getAllPosts(req.query);
  return sendSuccess(res, result, "Forum posts fetched successfully");
}

async function getTrainerPosts(req, res) {
  const result = await forumService.getAllPosts({
    ...req.query,
    authorId: req.user.userId,
  });
  return sendSuccess(res, result, "Trainer forum posts fetched successfully");
}

async function getPostById(req, res) {
  const data = await forumService.getPostById(req.params.id);
  return sendSuccess(res, data, "Forum post fetched successfully");
}

async function deletePost(req, res) {
  const result = await forumService.deletePost(req.params.id, req.user);
  return sendSuccess(res, result, "Forum post deleted successfully");
}

async function likePost(req, res) {
  const post = await forumService.likePost(req.params.id, req.user.userId);
  return sendSuccess(res, { post }, "Post like updated successfully");
}

async function dislikePost(req, res) {
  const post = await forumService.dislikePost(req.params.id, req.user.userId);
  return sendSuccess(res, { post }, "Post dislike updated successfully");
}

async function addComment(req, res) {
  const comment = await forumService.addComment(
    req.params.id,
    req.user,
    req.body.content
  );
  return sendCreated(res, { comment }, "Comment added successfully");
}

async function replyComment(req, res) {
  const comment = await forumService.replyComment(
    req.params.id,
    req.user,
    req.body.content
  );
  return sendCreated(res, { comment }, "Reply added successfully");
}

async function editComment(req, res) {
  const comment = await forumService.editComment(
    req.params.id,
    req.user,
    req.body.content
  );
  return sendSuccess(res, { comment }, "Comment updated successfully");
}

async function deleteComment(req, res) {
  const result = await forumService.deleteComment(req.params.id, req.user);
  return sendSuccess(res, result, "Comment deleted successfully");
}

module.exports = {
  createPost,
  getAllPosts,
  getTrainerPosts,
  getPostById,
  deletePost,
  likePost,
  dislikePost,
  addComment,
  replyComment,
  editComment,
  deleteComment,
};
