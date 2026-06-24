const trainerApplicationService = require("../services/trainerApplication.service");
const AppError = require("../utils/AppError");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");

async function applyTrainer(req, res) {
  const application = await trainerApplicationService.applyTrainer(
    req.user.userId,
    req.body
  );
  return sendCreated(res, { application }, "Trainer application submitted successfully");
}

async function getApplications(req, res) {
  const applications = await trainerApplicationService.getApplications(req.query);
  return sendSuccess(
    res,
    { applications, total: applications.length },
    "Trainer applications fetched successfully"
  );
}

/**
 * GET /api/trainer-applications/user/:userId
 */
async function getApplicationByUserId(req, res) {
  const { userId } = req.params;

  if (req.user.role !== "admin" && String(req.user.userId) !== String(userId)) {
    throw new AppError("You do not have permission to view this application", 403);
  }

  const application = await trainerApplicationService.getApplicationByUserId(userId);

  return sendSuccess(
    res,
    { application },
    application
      ? "Trainer application fetched successfully"
      : "No trainer application found for this user"
  );
}

/**
 * PATCH /api/trainer-applications/:id/approve
 */
async function approveApplication(req, res) {
  const application = await trainerApplicationService.approveApplication(req.params.id);
  return sendSuccess(res, { application }, "Trainer application approved successfully");
}

/**
 * PATCH /api/trainer-applications/:id/reject
 */
async function rejectApplication(req, res) {
  const feedback = req.body.feedback || req.body.adminFeedback || "";
  const application = await trainerApplicationService.rejectApplication(
    req.params.id,
    feedback
  );
  return sendSuccess(res, { application }, "Trainer application rejected successfully");
}

async function reviewApplication(req, res) {
  const application = await trainerApplicationService.reviewApplication(
    req.params.id,
    req.body
  );
  return sendSuccess(res, { application }, "Trainer application reviewed successfully");
}

async function getTrainers(req, res) {
  const trainers = await trainerApplicationService.getTrainers();
  return sendSuccess(
    res,
    { trainers, total: trainers.length },
    "Trainers fetched successfully"
  );
}

async function demoteTrainer(req, res) {
  const trainer = await trainerApplicationService.demoteTrainer(req.params.id);
  return sendSuccess(res, { trainer }, "Trainer demoted to user successfully");
}

module.exports = {
  applyTrainer,
  getApplications,
  getApplicationByUserId,
  approveApplication,
  rejectApplication,
  reviewApplication,
  getTrainers,
  demoteTrainer,
};
