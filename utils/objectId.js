const { ObjectId } = require("mongodb");
const AppError = require("./AppError");

function isValidObjectId(id) {
  return ObjectId.isValid(id) && String(new ObjectId(id)) === String(id);
}

function toObjectId(id, fieldName = "id") {
  if (!isValidObjectId(id)) {
    throw new AppError(`Invalid ${fieldName}`, 400);
  }
  return new ObjectId(id);
}

module.exports = {
  isValidObjectId,
  toObjectId,
};
