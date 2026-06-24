const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");

function serializePost(post) {
  if (!post) return null;

  const likeCount = post.likeCount || 0;
  const dislikeCount = post.dislikeCount || 0;
  const commentCount = post.commentCount ?? post.commentsCount ?? 0;

  return {
    _id: String(post._id),
    id: String(post._id),
    title: post.title,
    description: post.description,
    image: post.image ?? null,
    authorName: post.authorName || post.trainerName,
    author: post.authorName || post.trainerName,
    authorEmail: post.authorEmail || post.trainerEmail || "",
    authorRole: post.authorRole,
    authorId: String(post.authorId || post.trainerId),
    trainerId: String(post.trainerId || post.authorId),
    trainerName: post.trainerName || post.authorName,
    trainerEmail: post.trainerEmail || post.authorEmail || "",
    likes: post.likes ?? likeCount,
    dislikes: post.dislikes ?? dislikeCount,
    likeCount,
    dislikeCount,
    commentCount,
    commentsCount: commentCount,
    createdAt: post.createdAt,
    updatedAt: post.updatedAt,
  };
}

function serializeComment(comment, replies = []) {
  return {
    id: String(comment._id),
    postId: String(comment.postId),
    userId: String(comment.userId),
    author: comment.authorName,
    content: comment.content,
    parentId: comment.parentId ? String(comment.parentId) : null,
    replies,
    createdAt: comment.createdAt,
    updatedAt: comment.updatedAt,
  };
}

async function getPostDocument(postId) {
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const post = await posts.findOne({ _id: toObjectId(postId, "postId") });

  if (!post) {
    throw new AppError("Forum post not found", 404);
  }

  return post;
}

async function getCommentDocument(commentId) {
  const comments = getCollection(COLLECTIONS.COMMENTS);
  const comment = await comments.findOne({ _id: toObjectId(commentId, "commentId") });

  if (!comment) {
    throw new AppError("Comment not found", 404);
  }

  return comment;
}

function assertPostOwnerOrAdmin(post, user) {
  const ownerId = String(post.trainerId || post.authorId);
  const isOwner = ownerId === String(user.userId);
  const isAdmin = user.role === "admin";

  if (!isOwner && !isAdmin) {
    throw new AppError("You do not have permission to modify this post", 403);
  }
}

function assertCommentOwner(comment, user) {
  if (String(comment.userId) !== String(user.userId) && user.role !== "admin") {
    throw new AppError("You do not have permission to modify this comment", 403);
  }
}

/**
 * Create a forum post — saved to MongoDB forumPosts collection.
 */
async function createPost(user, payload) {
  const { title, description, image = null } = payload;

  console.log("Create forum post body:", payload);
  console.log("Create forum post user:", {
    authorId: user.userId,
    authorName: user.name,
    authorEmail: user.email,
    authorRole: user.role,
  });

  if (!title?.trim()) throw new AppError("Title is required", 400);
  if (!description?.trim()) throw new AppError("Description is required", 400);

  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const now = new Date();
  const authorObjectId = toObjectId(user.userId, "userId");
  const authorEmail = user.email || "";

  const doc = {
    authorId: authorObjectId,
    authorName: user.name,
    authorEmail,
    authorRole: user.role,
    trainerId: authorObjectId,
    trainerName: user.name,
    trainerEmail: authorEmail,
    title: title.trim(),
    description: description.trim(),
    image: image?.trim() || null,
    likedBy: [],
    dislikedBy: [],
    likes: 0,
    dislikes: 0,
    likeCount: 0,
    dislikeCount: 0,
    commentCount: 0,
    commentsCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await posts.insertOne(doc);

  console.log("Forum post insert result:", {
    acknowledged: result.acknowledged,
    insertedId: String(result.insertedId),
  });

  const created = await posts.findOne({ _id: result.insertedId });

  return serializePost(created);
}

/**
 * Get all forum posts with optional search.
 */
async function getAllPosts(filters = {}) {
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const query = {};

  if (filters.authorId) {
    const authorObjectId = toObjectId(filters.authorId, "authorId");
    query.$or = [{ authorId: authorObjectId }, { trainerId: authorObjectId }];
  }

  if (filters.search) {
    const regex = new RegExp(filters.search.trim(), "i");
    query.$or = [{ title: regex }, { description: regex }];
  }

  const list = await posts.find(query).sort({ createdAt: -1 }).toArray();
  return list.map(serializePost);
}

/**
 * Get a single post with nested comments.
 */
async function getPostById(postId) {
  const post = await getPostDocument(postId);
  const comments = getCollection(COLLECTIONS.COMMENTS);

  const allComments = await comments
    .find({ postId: post._id })
    .sort({ createdAt: 1 })
    .toArray();

  const repliesMap = new Map();

  allComments.forEach((comment) => {
    if (comment.parentId) {
      const parentKey = String(comment.parentId);
      if (!repliesMap.has(parentKey)) {
        repliesMap.set(parentKey, []);
      }
      repliesMap.get(parentKey).push(comment);
    }
  });

  const topLevel = allComments
    .filter((comment) => !comment.parentId)
    .map((comment) => {
      const replies = (repliesMap.get(String(comment._id)) || []).map((reply) =>
        serializeComment(reply)
      );
      return serializeComment(comment, replies);
    });

  return {
    post: serializePost(post),
    comments: topLevel,
  };
}

/**
 * Delete a forum post and its comments.
 */
async function deletePost(postId, user) {
  const post = await getPostDocument(postId);
  assertPostOwnerOrAdmin(post, user);

  console.log("Delete forum post:", {
    postId: String(post._id),
    title: post.title,
    authorRole: post.authorRole,
    deletedBy: user.role,
  });

  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const comments = getCollection(COLLECTIONS.COMMENTS);

  const [postDeleteResult, commentDeleteResult] = await Promise.all([
    posts.deleteOne({ _id: post._id }),
    comments.deleteMany({ postId: post._id }),
  ]);

  console.log("Forum post delete result:", {
    post: postDeleteResult,
    commentsRemoved: commentDeleteResult.deletedCount,
  });

  return { id: String(post._id) };
}

/**
 * Like a post (removes dislike if present).
 */
async function likePost(postId, userId) {
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const post = await getPostDocument(postId);
  const userKey = String(userId);

  const likedBy = (post.likedBy || []).map(String);
  const dislikedBy = (post.dislikedBy || []).map(String);

  const hasLiked = likedBy.includes(userKey);
  const updatedLikedBy = hasLiked
    ? likedBy.filter((id) => id !== userKey)
    : [...likedBy.filter((id) => id !== userKey), userKey];

  const updatedDislikedBy = dislikedBy.filter((id) => id !== userKey);

  const result = await posts.findOneAndUpdate(
    { _id: post._id },
    {
      $set: {
        likedBy: updatedLikedBy,
        dislikedBy: updatedDislikedBy,
        likes: updatedLikedBy.length,
        dislikes: updatedDislikedBy.length,
        likeCount: updatedLikedBy.length,
        dislikeCount: updatedDislikedBy.length,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return serializePost(result);
}

/**
 * Dislike a post (removes like if present).
 */
async function dislikePost(postId, userId) {
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const post = await getPostDocument(postId);
  const userKey = String(userId);

  const likedBy = (post.likedBy || []).map(String);
  const dislikedBy = (post.dislikedBy || []).map(String);

  const hasDisliked = dislikedBy.includes(userKey);
  const updatedDislikedBy = hasDisliked
    ? dislikedBy.filter((id) => id !== userKey)
    : [...dislikedBy.filter((id) => id !== userKey), userKey];

  const updatedLikedBy = likedBy.filter((id) => id !== userKey);

  const result = await posts.findOneAndUpdate(
    { _id: post._id },
    {
      $set: {
        likedBy: updatedLikedBy,
        dislikedBy: updatedDislikedBy,
        likes: updatedLikedBy.length,
        dislikes: updatedDislikedBy.length,
        likeCount: updatedLikedBy.length,
        dislikeCount: updatedDislikedBy.length,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return serializePost(result);
}

/**
 * Add a top-level comment to a post.
 */
async function addComment(postId, user, content) {
  if (!content?.trim()) {
    throw new AppError("Comment content is required", 400);
  }

  const post = await getPostDocument(postId);
  const comments = getCollection(COLLECTIONS.COMMENTS);
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const now = new Date();

  const doc = {
    postId: post._id,
    userId: toObjectId(user.userId),
    authorName: user.name,
    content: content.trim(),
    parentId: null,
    createdAt: now,
    updatedAt: now,
  };

  const result = await comments.insertOne(doc);

  await posts.updateOne(
    { _id: post._id },
    { $inc: { commentCount: 1 }, $set: { updatedAt: now } }
  );

  const created = await comments.findOne({ _id: result.insertedId });
  return serializeComment(created);
}

/**
 * Reply to an existing comment.
 */
async function replyComment(commentId, user, content) {
  if (!content?.trim()) {
    throw new AppError("Reply content is required", 400);
  }

  const parent = await getCommentDocument(commentId);
  const comments = getCollection(COLLECTIONS.COMMENTS);
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);
  const now = new Date();

  const doc = {
    postId: parent.postId,
    userId: toObjectId(user.userId),
    authorName: user.name,
    content: content.trim(),
    parentId: parent._id,
    createdAt: now,
    updatedAt: now,
  };

  const result = await comments.insertOne(doc);

  await posts.updateOne(
    { _id: parent.postId },
    { $inc: { commentCount: 1 }, $set: { updatedAt: now } }
  );

  const created = await comments.findOne({ _id: result.insertedId });
  return serializeComment(created);
}

/**
 * Edit a comment.
 */
async function editComment(commentId, user, content) {
  if (!content?.trim()) {
    throw new AppError("Comment content is required", 400);
  }

  const comment = await getCommentDocument(commentId);
  assertCommentOwner(comment, user);

  const comments = getCollection(COLLECTIONS.COMMENTS);
  const result = await comments.findOneAndUpdate(
    { _id: comment._id },
    {
      $set: {
        content: content.trim(),
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  return serializeComment(result);
}

/**
 * Delete a comment (and its replies).
 */
async function deleteComment(commentId, user) {
  const comment = await getCommentDocument(commentId);
  assertCommentOwner(comment, user);

  const comments = getCollection(COLLECTIONS.COMMENTS);
  const posts = getCollection(COLLECTIONS.FORUM_POSTS);

  const replies = await comments.find({ parentId: comment._id }).toArray();
  const idsToDelete = [comment._id, ...replies.map((reply) => reply._id)];

  await comments.deleteMany({ _id: { $in: idsToDelete } });

  await posts.updateOne(
    { _id: comment.postId },
    {
      $inc: { commentCount: -idsToDelete.length },
      $set: { updatedAt: new Date() },
    }
  );

  return { id: String(comment._id) };
}

module.exports = {
  createPost,
  getAllPosts,
  getPostById,
  deletePost,
  likePost,
  dislikePost,
  addComment,
  replyComment,
  editComment,
  deleteComment,
};
