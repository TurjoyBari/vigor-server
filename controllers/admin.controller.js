const dashboardService = require("../services/dashboard.service");
const userService = require("../services/user.service");
const { sendSuccess } = require("../utils/apiResponse");

async function getOverview(req, res) {
  const data = await dashboardService.getAdminOverview();
  return sendSuccess(res, data, "Admin overview fetched successfully");
}

async function getTransactions(req, res) {
  const transactions = await dashboardService.getAdminTransactions();
  return sendSuccess(
    res,
    { transactions, total: transactions.length },
    "Transactions fetched successfully"
  );
}

async function getProfile(req, res) {
  const user = await userService.getUserById(req.user.userId);
  return sendSuccess(res, { user }, "Profile fetched successfully");
}

async function updateProfile(req, res) {
  const user = await dashboardService.updateProfile(req.user.userId, req.body);
  return sendSuccess(res, { user }, "Profile updated successfully");
}

module.exports = {
  getOverview,
  getTransactions,
  getProfile,
  updateProfile,
};
