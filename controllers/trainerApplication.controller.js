const trainerApplicationService = require("../services/trainerApplication.service");
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
  reviewApplication,
  getTrainers,
  demoteTrainer,
};
