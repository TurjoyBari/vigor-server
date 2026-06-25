const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const classService = require("./class.service");

function buildSnapshotFields(classData) {
  return {
    className: classData.className,
    trainerName: classData.trainerName || classData.trainer || "Unknown Trainer",
    image: classData.image || null,
    category: classData.category || "",
    difficulty: classData.difficulty || "",
    duration: classData.duration || "",
    schedule: classData.schedule || "",
    location: classData.location || "VIGOR Studio",
    price: Number(classData.price) || 0,
  };
}

/**
 * Serialize favorite from MongoDB favorites collection (class snapshot).
 */
function serializeFavorite(favorite) {
  return {
    id: String(favorite._id),
    favoriteId: String(favorite._id),
    userId: String(favorite.userId),
    classId: String(favorite.classId),
    className: favorite.className || "Unknown Class",
    trainerName: favorite.trainerName || "Unknown Trainer",
    image: favorite.image || null,
    category: favorite.category || "",
    difficulty: favorite.difficulty || "",
    duration: favorite.duration || "",
    schedule: favorite.schedule || "",
    location: favorite.location || "VIGOR Studio",
    price: Number(favorite.price) || 0,
    addedAt: favorite.addedAt || favorite.createdAt,
    createdAt: favorite.createdAt || favorite.addedAt,
  };
}

async function enrichLegacyFavorite(favorite) {
  if (favorite.className) {
    return serializeFavorite(favorite);
  }

  try {
    const classData = await classService.getClassById(String(favorite.classId));
    return serializeFavorite({
      ...favorite,
      ...buildSnapshotFields(classData),
    });
  } catch {
    return serializeFavorite(favorite);
  }
}

/**
 * Check if a class is in the user's favorites.
 */
async function checkFavorite(userId, classId) {
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  const existing = await favorites.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  return {
    isFavorite: Boolean(existing),
    favoriteId: existing ? String(existing._id) : null,
  };
}

/**
 * Add class to favorites with class snapshot (prevents duplicates).
 */
async function addFavorite(userId, classId) {
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  const classData = await classService.getClassById(classId);
  if (!classData) {
    throw new AppError("Class not found", 404);
  }

  const existing = await favorites.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  if (existing) {
    throw new AppError("Class is already in your favorites", 409);
  }

  const now = new Date();
  const favoriteDoc = {
    userId: userObjectId,
    classId: classObjectId,
    ...buildSnapshotFields(classData),
    addedAt: now,
    createdAt: now,
  };

  const result = await favorites.insertOne(favoriteDoc);
  const favorite = await favorites.findOne({ _id: result.insertedId });

  // console.log("Favorite saved:", favorite);

  return serializeFavorite(favorite);
}

/**
 * Get all favorites for a user from MongoDB favorites collection.
 */
async function getFavoritesByUserId(userId) {
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const userObjectId = toObjectId(userId, "userId");

  const list = await favorites
    .find({ userId: userObjectId })
    .sort({ addedAt: -1, createdAt: -1 })
    .toArray();

  // console.log("Favorites from DB for user:", userId, list);

  if (!list.length) return [];

  return Promise.all(list.map(enrichLegacyFavorite));
}

/**
 * Get current user's favorites.
 */
async function getFavorites(userId) {
  return getFavoritesByUserId(userId);
}

/**
 * Remove a favorite by favorite id or class id.
 */
async function removeFavorite(userId, favoriteId) {
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const userObjectId = toObjectId(userId, "userId");

  let favorite = await favorites.findOne({
    _id: toObjectId(favoriteId, "favoriteId"),
    userId: userObjectId,
  });

  if (!favorite) {
    favorite = await favorites.findOne({
      userId: userObjectId,
      classId: toObjectId(favoriteId, "classId"),
    });
  }

  if (!favorite) {
    throw new AppError("Favorite not found", 404);
  }

  await favorites.deleteOne({ _id: favorite._id });

  // console.log("Favorite removed:", String(favorite._id));

  return { id: String(favorite._id), classId: String(favorite.classId) };
}

module.exports = {
  checkFavorite,
  addFavorite,
  getFavorites,
  getFavoritesByUserId,
  removeFavorite,
  serializeFavorite,
  buildSnapshotFields,
};
