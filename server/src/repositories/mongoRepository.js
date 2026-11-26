/**
 * Repository pattern, MongoDB implementation.
 * Services only see this small interface (create/find/findOne/update/delete/count),
 * so the database can be swapped (see memoryRepository.js) without touching
 * business logic. Results are plain objects with a string `id` instead of `_id`.
 */
import mongoose from 'mongoose';

const toPlain = (doc) => {
  if (!doc) return null;
  const { _id, ...rest } = doc;
  return { id: String(_id), ...rest, userId: rest.userId ? String(rest.userId) : undefined };
};

/** Translates the repository filter (`id`) into a Mongo filter (`_id`). */
function toMongoFilter(filter = {}) {
  const out = { ...filter };
  if ('id' in out) {
    if (!mongoose.isValidObjectId(out.id)) return null; // cannot match anything
    out._id = out.id;
    delete out.id;
  }
  if ('userId' in out && !mongoose.isValidObjectId(out.userId)) return null;
  return out;
}

export class MongoRepository {
  constructor(Model) {
    this.Model = Model;
  }

  async create(data) {
    const doc = await this.Model.create(data);
    return toPlain(doc.toObject());
  }

  async find(filter = {}, { sort = { date: 1 }, limit = 0, skip = 0 } = {}) {
    const f = toMongoFilter(filter);
    if (!f) return [];
    const docs = await this.Model.find(f).sort(sort).skip(skip).limit(limit).lean();
    return docs.map(toPlain);
  }

  async findOne(filter) {
    const f = toMongoFilter(filter);
    if (!f) return null;
    return toPlain(await this.Model.findOne(f).lean());
  }

  async updateOne(filter, patch, { increment } = {}) {
    const f = toMongoFilter(filter);
    if (!f) return null;
    const update = { $set: patch, ...(increment && { $inc: increment }) };
    const doc = await this.Model.findOneAndUpdate(f, update, { new: true, runValidators: true }).lean();
    return toPlain(doc);
  }

  /** Insert or update the single document that matches `filter`. */
  async upsert(filter, patch) {
    const f = toMongoFilter(filter);
    if (!f) return null;
    const doc = await this.Model.findOneAndUpdate(
      f,
      { $set: patch }, // equality fields in the filter are copied in on insert
      { new: true, upsert: true, runValidators: true, setDefaultsOnInsert: true },
    ).lean();
    return toPlain(doc);
  }

  async deleteOne(filter) {
    const f = toMongoFilter(filter);
    if (!f) return false;
    const res = await this.Model.deleteOne(f);
    return res.deletedCount > 0;
  }

  async deleteMany(filter) {
    const f = toMongoFilter(filter);
    if (!f) return 0;
    const res = await this.Model.deleteMany(f);
    return res.deletedCount;
  }

  async count(filter = {}) {
    const f = toMongoFilter(filter);
    if (!f) return 0;
    return this.Model.countDocuments(f);
  }
}
