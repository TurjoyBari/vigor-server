const { getCollection, COLLECTIONS } = require("../config/db");
const AppError = require("../utils/AppError");
const { toObjectId } = require("../utils/objectId");
const classService = require("./class.service");

function serializeFavorite(favorite, classDoc) {
  return {
    id: String(favorite._id),
    favoriteId: String(favorite._id),
    classId: String(favorite.classId),
    className: classDoc?.className || "Unknown Class",
    trainerName: classDoc?.trainer || "Unknown Trainer",
    image: classDoc?.image || null,
    category: classDoc?.category || "",
    createdAt: favorite.createdAt,
  };
}

/**
 * Add class to favorites (prevents duplicates).
 */
async function addFavorite(userId, classId) {
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const userObjectId = toObjectId(userId, "userId");
  const classObjectId = toObjectId(classId, "classId");

  await classService.getClassById(classId);

  const existing = await favorites.findOne({
    userId: userObjectId,
    classId: classObjectId,
  });

  if (existing) {
    throw new AppError("Class is already in your favorites", 409);
  }

  const now = new Date();
  const result = await favorites.insertOne({
    userId: userObjectId,
    classId: classObjectId,
    createdAt: now,
  });

  const favorite = await favorites.findOne({ _id: result.insertedId });
  const classDoc = await classService.getClassById(classId);

  return serializeFavorite(favorite, classDoc);
}

/**
 * Get user favorites with class details.
 */
async function getFavorites(userId) {
  const favorites = getCollection(COLLECTIONS.FAVORITES);
  const userObjectId = toObjectId(userId, "userId");

  const list = await favorites
    .find({ userId: userObjectId })
    .sort({ createdAt: -1 })
    .toArray();

  if (!list.length) return [];

  const results = await Promise.all(
    list.map(async (favorite) => {
      try {
        const classDoc = await classService.getClassById(String(favorite.classId));
        return serializeFavorite(favorite, classDoc);
      } catch {
        return serializeFavorite(favorite, null);
      }
    })
  );

  return results;
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
  return { id: String(favorite._id) };
}

module.exports = {
  addFavorite,
  getFavorites,
  removeFavorite,
};
