const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const { serializeUser } = require("./auth.service");

const APPLICATION_STATUS = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

function serializeApplication(application, user = null) {
  return {
    id: String(application._id),
    userId: String(application.userId),
    name: user?.name || application.applicantName || "Unknown",
    email: user?.email || application.applicantEmail || "",
    experience: application.experience,
    specialty: application.specialty,
    status: application.status,
    feedback: application.feedback || "",
    adminFeedback: application.feedback || "",
    submittedAt: application.createdAt,
    createdAt: application.createdAt,
    updatedAt: application.updatedAt,
  };
}

/**
 * Submit trainer application.
 */
async function applyTrainer(userId, payload) {
  const { experience, specialty } = payload;

  if (!experience?.trim()) {
    throw new AppError("Experience is required", 400);
  }

  if (!specialty?.trim()) {
    throw new AppError("Specialty is required", 400);
  }

  const users = getCollection(COLLECTIONS.USERS);
  const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);
  const userObjectId = toObjectId(userId, "userId");

  const user = await users.findOne({ _id: userObjectId });
  if (!user) {
    throw new AppError("User not found", 404);
  }

  if (user.role === "trainer" || user.role === "admin") {
    throw new AppError("You are already a trainer or admin", 400);
  }

  const pending = await applications.findOne({
    userId: userObjectId,
    status: APPLICATION_STATUS.PENDING,
  });

  if (pending) {
    throw new AppError("You already have a pending trainer application", 409);
  }

  const now = new Date();
  const doc = {
    userId: userObjectId,
    applicantName: user.name,
    applicantEmail: user.email,
    experience: experience.trim(),
    specialty: specialty.trim(),
    status: APPLICATION_STATUS.PENDING,
    feedback: "",
    createdAt: now,
    updatedAt: now,
  };

  const result = await applications.insertOne(doc);

  await users.updateOne(
    { _id: userObjectId },
    {
      $set: {
        trainerApplicationStatus: APPLICATION_STATUS.PENDING,
        trainerExperience: experience.trim(),
        trainerSpecialty: specialty.trim(),
        trainerApplicationSubmittedAt: now,
        trainerFeedback: "",
        updatedAt: now,
      },
    }
  );

  const created = await applications.findOne({ _id: result.insertedId });
  return serializeApplication(created, user);
}

/**
 * Get all trainer applications (admin).
 */
async function getApplications(filters = {}) {
  const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);
  const users = getCollection(COLLECTIONS.USERS);
  const query = {};

  if (filters.status) {
    const statuses = String(filters.status)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    query.status = statuses.length === 1 ? statuses[0] : { $in: statuses };
  }

  const list = await applications.find(query).sort({ createdAt: -1 }).toArray();

  const userIds = [...new Set(list.map((item) => String(item.userId)))];
  const userDocs = await users
    .find({ _id: { $in: userIds.map((id) => toObjectId(id)) } })
    .toArray();

  const userMap = new Map(userDocs.map((user) => [String(user._id), user]));

  return list.map((application) =>
    serializeApplication(application, userMap.get(String(application.userId)))
  );
}

/**
 * Review trainer application — approve or reject.
 */
async function reviewApplication(applicationId, { status, feedback = "" }) {
  if (![APPLICATION_STATUS.APPROVED, APPLICATION_STATUS.REJECTED].includes(status)) {
    throw new AppError("Status must be approved or rejected", 400);
  }

  const applications = getCollection(COLLECTIONS.TRAINER_APPLICATIONS);
  const users = getCollection(COLLECTIONS.USERS);

  const application = await applications.findOne({
    _id: toObjectId(applicationId, "applicationId"),
  });

  if (!application) {
    throw new AppError("Trainer application not found", 404);
  }

  const now = new Date();

  const result = await applications.findOneAndUpdate(
    { _id: application._id },
    {
      $set: {
        status,
        feedback: feedback.trim(),
        updatedAt: now,
      },
    },
    { returnDocument: "after" }
  );

  const userUpdate = {
    trainerApplicationStatus: status,
    trainerFeedback: feedback.trim(),
    updatedAt: now,
  };

  if (status === APPLICATION_STATUS.APPROVED) {
    userUpdate.role = "trainer";
  }

  await users.updateOne({ _id: application.userId }, { $set: userUpdate });

  const user = await users.findOne({ _id: application.userId });
  return serializeApplication(result, user);
}

/**
 * Get all trainers.
 */
async function getTrainers() {
  const users = getCollection(COLLECTIONS.USERS);
  const list = await users
    .find({ role: "trainer" }, { projection: { password: 0 } })
    .sort({ createdAt: -1 })
    .toArray();

  return list.map(serializeUser);
}

/**
 * Demote trainer back to user role.
 */
async function demoteTrainer(trainerId) {
  const users = getCollection(COLLECTIONS.USERS);
  const result = await users.findOneAndUpdate(
    { _id: toObjectId(trainerId, "trainerId"), role: "trainer" },
    {
      $set: {
        role: "user",
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after", projection: { password: 0 } }
  );

  if (!result) {
    throw new AppError("Trainer not found", 404);
  }

  return serializeUser(result);
}

module.exports = {
  APPLICATION_STATUS,
  applyTrainer,
  getApplications,
  reviewApplication,
  getTrainers,
  demoteTrainer,
};
