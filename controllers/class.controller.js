const classService = require("../services/class.service");
const { sendSuccess, sendCreated } = require("../utils/apiResponse");

async function createClass(req, res) {
  const classItem = await classService.createClass(req.user.userId, req.body);
  return sendCreated(res, { class: classItem }, "Class created successfully");
}

async function getAllClasses(req, res) {
  const classes = await classService.getAllClasses(req.query);
  return sendSuccess(
    res,
    { classes, total: classes.length },
    "Classes fetched successfully"
  );
}

async function getApprovedClasses(req, res) {
  console.log(req.query);

  const result = await classService.getApprovedClasses(req.query);

  return sendSuccess(res, result, "Approved classes fetched successfully");
}

async function getFeaturedClasses(req, res) {
  const limit = req.query.limit ? Number(req.query.limit) : 6;
  const classes = await classService.getFeaturedClasses(limit);
  return sendSuccess(
    res,
    { classes, total: classes.length },
    "Featured classes fetched successfully"
  );
}

async function getClassById(req, res) {
  const classItem = await classService.getClassById(req.params.id);
  return sendSuccess(res, { class: classItem }, "Class fetched successfully");
}

async function updateClass(req, res) {
  const classItem = await classService.updateClass(
    req.params.id,
    req.user.userId,
    req.user.role,
    req.body
  );
  return sendSuccess(res, { class: classItem }, "Class updated successfully");
}

async function deleteClass(req, res) {
  const result = await classService.deleteClass(
    req.params.id,
    req.user.userId,
    req.user.role
  );
  return sendSuccess(res, result, "Class deleted successfully");
}

async function approveClass(req, res) {
  console.log("PATCH approve class:", req.params.id);
  const classItem = await classService.approveClass(req.params.id);
  return sendSuccess(res, { class: classItem }, "Class approved successfully");
}

async function rejectClass(req, res) {
  console.log("PATCH reject class:", req.params.id);
  const classItem = await classService.rejectClass(req.params.id);
  return sendSuccess(res, { class: classItem }, "Class rejected successfully");
}

async function getTrainerClasses(req, res) {
  const classes = await classService.getAllClasses({
    ...req.query,
    trainerId: req.user.userId,
  });
  return sendSuccess(
    res,
    { classes, total: classes.length },
    "Trainer classes fetched successfully"
  );
}

async function getClassStudents(req, res) {
  const students = await classService.getClassStudents(
    req.params.id,
    req.user.userId,
    req.user.role
  );
  return sendSuccess(res, { students, total: students.length }, "Students fetched successfully");
}

module.exports = {
  createClass,
  getAllClasses,
  getApprovedClasses,
  getFeaturedClasses,
  getClassById,
  updateClass,
  deleteClass,
  approveClass,
  rejectClass,
  getTrainerClasses,
  getClassStudents,
};
