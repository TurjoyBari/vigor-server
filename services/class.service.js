const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");

const CLASS_STATUSES = {
  PENDING: "pending",
  APPROVED: "approved",
  REJECTED: "rejected",
};

const DEFAULT_CLASS_IMAGE =
  "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?auto=format&fit=crop&w=1200&q=80";

function mapStatusForClient(status) {
  if (status === CLASS_STATUSES.APPROVED) return "published";
  return status;
}

function serializeClass(classDoc, trainer = null) {
  if (!classDoc) return null;

  return {
    id: String(classDoc._id),
    trainerId: String(classDoc.trainerId),
    trainer: trainer?.name || classDoc.trainerName || "Unknown Trainer",
    className: classDoc.className,
    image: classDoc.image || DEFAULT_CLASS_IMAGE,
    category: classDoc.category,
    difficulty: classDoc.difficulty,
    duration: classDoc.duration,
    schedule: classDoc.schedule,
    price: Number(classDoc.price) || 0,
    description: classDoc.description,
    status: mapStatusForClient(classDoc.status),
    bookingCount: classDoc.bookingCount || 0,
    studentCount: classDoc.bookingCount || 0,
    createdAt: classDoc.createdAt,
    updatedAt: classDoc.updatedAt,
  };
}

function buildClassQuery(filters = {}) {
  const query = {};
  const andConditions = [];

  if (filters.trainerId) {
    const trainerObjectId = toObjectId(filters.trainerId, "trainerId");
    andConditions.push({
      $or: [{ trainerId: trainerObjectId }, { trainerId: String(filters.trainerId) }],
    });
  }

  if (filters.status) {
    const statuses = String(filters.status)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);

    const normalized = statuses.map((status) =>
      status === "published" ? CLASS_STATUSES.APPROVED : status
    );

    if (normalized.length === 1) {
      query.status = normalized[0];
    } else if (normalized.length > 1) {
      query.status = { $in: normalized };
    }
  }

  const categoryInput = filters.categories ?? filters.category;
  if (categoryInput) {
    const categories = String(categoryInput)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    query.category = categories.length === 1 ? categories[0] : { $in: categories };
  }

  if (filters.difficulty) {
    const levels = String(filters.difficulty)
      .split(",")
      .map((item) => item.trim())
      .filter(Boolean);
    query.difficulty = levels.length === 1 ? levels[0] : { $in: levels };
  }

  if (filters.search?.trim()) {
    query.className = {
      $regex: filters.search.trim(),
      $options: "i",
    };
  }

  if (andConditions.length === 1) {
    Object.assign(query, andConditions[0]);
  } else if (andConditions.length > 1) {
    query.$and = andConditions;
  }

  return query;
}

async function attachTrainerNames(classes) {
  if (!classes.length) return [];

  const users = getCollection(COLLECTIONS.USERS);
  const trainerIds = [...new Set(classes.map((item) => String(item.trainerId)))];

  const trainers = await users
    .find({
      _id: {
        $in: trainerIds.map((id) => toObjectId(id)),
      },
    })
    .project({ name: 1 })
    .toArray();

  const trainerMap = new Map(trainers.map((trainer) => [String(trainer._id), trainer]));

  return classes.map((classDoc) =>
    serializeClass(classDoc, trainerMap.get(String(classDoc.trainerId)))
  );
}

async function getClassDocumentById(classId) {
  const classes = getCollection(COLLECTIONS.CLASSES);
  const classDoc = await classes.findOne({ _id: toObjectId(classId, "classId") });

  if (!classDoc) {
    throw new AppError("Class not found", 404);
  }

  return classDoc;
}

function assertTrainerOwnership(classDoc, userId) {
  if (String(classDoc.trainerId) !== String(userId)) {
    throw new AppError("You can only manage your own classes", 403);
  }
}

/**
 * Add a new class (trainer) — saved to MongoDB classes collection.
 */
async function createClass(trainerId, payload) {
  const {
    className,
    image = null,
    category,
    difficulty,
    duration,
    schedule,
    price,
    description,
  } = payload;

  // console.log("Create class request:", {
  //   trainerId,
  //   className,
  //   category,
  //   difficulty,
  //   duration,
  //   schedule,
  //   price,
  // });

  if (!className?.trim()) throw new AppError("Class name is required", 400);
  if (!category?.trim()) throw new AppError("Category is required", 400);
  if (!difficulty?.trim()) throw new AppError("Difficulty is required", 400);
  if (!duration?.trim()) throw new AppError("Duration is required", 400);
  if (!schedule?.trim()) throw new AppError("Schedule is required", 400);

  const numericPrice = Number(price);
  if (price === undefined || price === null || Number.isNaN(numericPrice)) {
    throw new AppError("Valid price is required", 400);
  }
  if (numericPrice < 0) {
    throw new AppError("Price cannot be negative", 400);
  }

  if (!description?.trim()) throw new AppError("Description is required", 400);

  const classes = getCollection(COLLECTIONS.CLASSES);
  const users = getCollection(COLLECTIONS.USERS);
  const trainerObjectId = toObjectId(trainerId, "trainerId");
  const trainer = await users.findOne(
    { _id: trainerObjectId },
    { projection: { name: 1, role: 1, email: 1 } }
  );

  if (!trainer) {
    throw new AppError("Trainer not found", 404);
  }

  if (trainer.role !== "trainer" && trainer.role !== "admin") {
    throw new AppError("Only trainers can create classes", 403);
  }

  const now = new Date();

  const doc = {
    trainerId: trainerObjectId,
    trainerName: trainer.name || "Trainer",
    className: className.trim(),
    image: image?.trim() || DEFAULT_CLASS_IMAGE,
    category: category.trim(),
    difficulty: difficulty.trim(),
    duration: duration.trim(),
    schedule: schedule.trim(),
    price: numericPrice,
    description: description.trim(),
    status: CLASS_STATUSES.PENDING,
    bookingCount: 0,
    createdAt: now,
    updatedAt: now,
  };

  const result = await classes.insertOne(doc);
  const created = await classes.findOne({ _id: result.insertedId });

  // console.log("Class Created from DB:", {
  //   id: String(created._id),
  //   trainerId: String(created.trainerId),
  //   trainerName: created.trainerName,
  //   className: created.className,
  //   status: created.status,
  //   bookingCount: created.bookingCount,
  // });

  return serializeClass(created, trainer);
}

/**
 * Get all classes with search and filters.
 */
async function getAllClasses(filters = {}) {
  const classes = getCollection(COLLECTIONS.CLASSES);
  const query = buildClassQuery(filters);

  const list = await classes.find(query).sort({ createdAt: -1 }).toArray();
  return attachTrainerNames(list);
}

/**
 * Get approved/published classes only — search, filter, paginated.
 */
async function getApprovedClasses(filters = {}) {
  const classes = getCollection(COLLECTIONS.CLASSES);
  const normalizedFilters = {
    ...filters,
    status: CLASS_STATUSES.APPROVED,
  };

  // console.log(normalizedFilters);

  const query = buildClassQuery(normalizedFilters);

  // console.log(query);

  const page = Math.max(Number(filters.page) || 1, 1);
  const limit = Math.min(Math.max(Number(filters.limit) || 12, 1), 100);
  const skip = (page - 1) * limit;

  const [list, total] = await Promise.all([
    classes.find(query).sort({ createdAt: -1 }).skip(skip).limit(limit).toArray(),
    classes.countDocuments(query),
  ]);

  const serialized = await attachTrainerNames(list);
  const totalPages = total === 0 ? 0 : Math.ceil(total / limit);

  // console.log({
  //   total,
  //   page,
  //   totalPages,
  //   returned: serialized.length,
  // });

  return {
    classes: serialized,
    total,
    page,
    totalPages,
    limit,
  };
}

/**
 * Get top featured classes — approved only, sorted by bookingCount desc.
 */
async function getFeaturedClasses(limit = 6) {
  const classes = getCollection(COLLECTIONS.CLASSES);
  const parsedLimit = Math.min(Math.max(Number(limit) || 6, 1), 20);

  const list = await classes
    .find({ status: CLASS_STATUSES.APPROVED })
    .sort({ bookingCount: -1, createdAt: -1 })
    .limit(parsedLimit)
    .toArray();

  return attachTrainerNames(list);
}

/**
 * Get a single class by id.
 */
async function getClassById(classId) {
  const classDoc = await getClassDocumentById(classId);
  const users = getCollection(COLLECTIONS.USERS);
  const trainer = await users.findOne(
    { _id: toObjectId(String(classDoc.trainerId)) },
    { projection: { name: 1 } }
  );

  return serializeClass(classDoc, trainer);
}

/**
 * Update a class.
 */
async function updateClass(classId, userId, role, payload) {
  const classDoc = await getClassDocumentById(classId);

  if (role !== "admin") {
    assertTrainerOwnership(classDoc, userId);
  }

  const allowedFields = [
    "className",
    "image",
    "category",
    "difficulty",
    "duration",
    "schedule",
    "price",
    "description",
  ];

  const update = { updatedAt: new Date() };

  allowedFields.forEach((field) => {
    if (payload[field] !== undefined) {
      update[field] = field === "price" ? Number(payload[field]) : payload[field];
    }
  });

  if (role !== "admin") {
    update.status = CLASS_STATUSES.PENDING;
  }

  const classes = getCollection(COLLECTIONS.CLASSES);
  const result = await classes.findOneAndUpdate(
    { _id: classDoc._id },
    { $set: update },
    { returnDocument: "after" }
  );

  return getClassById(String(result._id));
}

/**
 * Delete a class.
 */
async function deleteClass(classId, userId, role) {
  const classDoc = await getClassDocumentById(classId);

  if (role !== "admin") {
    assertTrainerOwnership(classDoc, userId);
  }

  const classes = getCollection(COLLECTIONS.CLASSES);
  await classes.deleteOne({ _id: classDoc._id });

  return { id: String(classDoc._id) };
}

/**
 * Approve a class (admin) — updates MongoDB status to approved.
 */
async function approveClass(classId) {
  // console.log("Approve class request:", classId);

  const classes = getCollection(COLLECTIONS.CLASSES);
  const result = await classes.findOneAndUpdate(
    { _id: toObjectId(classId, "classId") },
    {
      $set: {
        status: CLASS_STATUSES.APPROVED,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new AppError("Class not found", 404);
  }

  // console.log("Class approved in DB:", {
  //   id: String(result._id),
  //   className: result.className,
  //   trainerName: result.trainerName,
  //   status: result.status,
  //   updatedAt: result.updatedAt,
  // });

  return getClassById(String(result._id));
}

/**
 * Reject a class (admin) — updates MongoDB status to rejected.
 */
async function rejectClass(classId) {
  // console.log("Reject class request:", classId);

  const classes = getCollection(COLLECTIONS.CLASSES);
  const result = await classes.findOneAndUpdate(
    { _id: toObjectId(classId, "classId") },
    {
      $set: {
        status: CLASS_STATUSES.REJECTED,
        updatedAt: new Date(),
      },
    },
    { returnDocument: "after" }
  );

  if (!result) {
    throw new AppError("Class not found", 404);
  }

  // console.log("Class rejected in DB:", {
  //   id: String(result._id),
  //   className: result.className,
  //   trainerName: result.trainerName,
  //   status: result.status,
  //   updatedAt: result.updatedAt,
  // });

  return getClassById(String(result._id));
}

/**
 * Get students enrolled in a trainer class.
 */
async function getClassStudents(classId, trainerId, role) {
  const classDoc = await getClassDocumentById(classId);

  if (role !== "admin") {
    assertTrainerOwnership(classDoc, trainerId);
  }

  const bookings = getCollection(COLLECTIONS.BOOKINGS);
  const users = getCollection(COLLECTIONS.USERS);

  const bookingList = await bookings
    .find({ classId: classDoc._id })
    .sort({ bookedAt: -1 })
    .toArray();

  if (!bookingList.length) return [];

  const userDocs = await users
    .find({
      _id: { $in: bookingList.map((booking) => booking.userId) },
    })
    .project({ name: 1, email: 1 })
    .toArray();

  const userMap = new Map(userDocs.map((user) => [String(user._id), user]));

  return bookingList.map((booking) => {
    const user = userMap.get(String(booking.userId));
    return {
      id: String(booking.userId),
      name: user?.name || "Unknown",
      email: user?.email || "",
      enrolledAt: booking.bookedAt
        ? new Date(booking.bookedAt).toISOString().split("T")[0]
        : null,
    };
  });
}

module.exports = {
  CLASS_STATUSES,
  createClass,
  getAllClasses,
  getApprovedClasses,
  getFeaturedClasses,
  getClassById,
  updateClass,
  deleteClass,
  approveClass,
  rejectClass,
  getClassStudents,
};
