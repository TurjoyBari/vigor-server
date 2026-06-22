const userService = require("../services/user.service");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");
const AppError = require("../utils/AppError");

/**
 * POST /api/users
 */
async function createUser(req, res) {
  const user = await userService.createUser(req.body);
  return sendCreated(res, { user }, "User created successfully");
}

/**
 * GET /api/users
 */
async function getAllUsers(req, res) {
  const { role, status, search } = req.query;
  const users = await userService.getAllUsers({ role, status, search });
  return sendSuccess(res, { users, total: users.length }, "Users fetched successfully");
}

/**
 * GET /api/users/:id
 */
async function getUser(req, res) {
  const { id } = req.params;

  const isAdmin = req.user.role === "admin";
  const isSelf = String(req.user.userId) === String(id);

  if (!isAdmin && !isSelf) {
    throw new AppError("You do not have permission to view this user", 403);
  }

  const user = await userService.getUserById(id);
  return sendSuccess(res, { user }, "User fetched successfully");
}

/**
 * PATCH /api/users/:id/block
 */
async function blockUser(req, res) {
  const user = await userService.blockUser(req.params.id, req.user.userId);
  return sendSuccess(res, { user }, "User blocked successfully");
}

/**
 * PATCH /api/users/:id/unblock
 */
async function unblockUser(req, res) {
  const user = await userService.unblockUser(req.params.id);
  return sendSuccess(res, { user }, "User unblocked successfully");
}

/**
 * PATCH /api/users/:id/make-admin
 */
async function makeAdmin(req, res) {
  const user = await userService.makeAdmin(req.params.id);
  return sendSuccess(res, { user }, "User promoted to admin successfully");
}

module.exports = {
  createUser,
  getAllUsers,
  getUser,
  blockUser,
  unblockUser,
  makeAdmin,
};
