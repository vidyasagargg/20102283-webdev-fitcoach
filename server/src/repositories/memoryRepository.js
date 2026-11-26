/**
 * Repository pattern, in-memory implementation.
 * Same interface as MongoRepository. Used by the automated tests and by
 * `DATA_STORE=memory` for a zero-setup local demo. Supports the subset of
 * query operators the services use: equality, $gte, $lte, $in, $ne.
 */
import { randomBytes } from 'node:crypto';

const newId = () => randomBytes(12).toString('hex');
const clone = (v) => structuredClone(v);

function matches(doc, filter) {
  return Object.entries(filter).every(([key, cond]) => {
    const value = doc[key];
    if (cond && typeof cond === 'object' && !Array.isArray(cond)) {
      return Object.entries(cond).every(([op, arg]) => {
        switch (op) {
          case '$gte':
            return value >= arg;
          case '$lte':
            return value <= arg;
          case '$gt':
            return value > arg;
          case '$lt':
            return value < arg;
          case '$in':
            return arg.includes(value);
          case '$ne':
            return value !== arg;
          default:
            throw new Error(`Unsupported operator ${op}`);
        }
      });
    }
    return value === cond;
  });
}

export class MemoryRepository {
  constructor({ unique = [] } = {}) {
    this.docs = new Map();
    this.unique = unique; // e.g. [['email']] or [['userId','date']]
  }

  #checkUnique(doc, ignoreId) {
    for (const keys of this.unique) {
      for (const other of this.docs.values()) {
        if (other.id !== ignoreId && keys.every((k) => other[k] === doc[k])) {
          const err = new Error(`Duplicate key: ${keys.join(', ')}`);
          err.code = 11000;
          throw err;
        }
      }
    }
  }

  async create(data) {
    const now = new Date().toISOString();
    const doc = { ...clone(data), id: newId(), createdAt: now, updatedAt: now };
    this.#checkUnique(doc);
    this.docs.set(doc.id, doc);
    return clone(doc);
  }

  async find(filter = {}, { sort = { date: 1 }, limit = 0, skip = 0 } = {}) {
    let out = [...this.docs.values()].filter((d) => matches(d, filter));
    const keys = Object.entries(sort);
    if (keys.length) {
      out.sort((a, b) => {
        for (const [field, dir] of keys) {
          const av = a[field] ?? '';
          const bv = b[field] ?? '';
          if (av !== bv) return (av < bv ? -1 : 1) * dir;
        }
        return a.createdAt < b.createdAt ? -1 : 1;
      });
    }
    return out.slice(skip, limit ? skip + limit : undefined).map(clone);
  }

  async findOne(filter) {
    const doc = [...this.docs.values()].find((d) => matches(d, filter));
    return doc ? clone(doc) : null;
  }

  async updateOne(filter, patch, { increment = {} } = {}) {
    const doc = [...this.docs.values()].find((d) => matches(d, filter));
    if (!doc) return null;
    const next = { ...doc, ...clone(patch), updatedAt: new Date().toISOString() };
    for (const [field, amount] of Object.entries(increment)) {
      next[field] = (next[field] ?? 0) + amount;
    }
    this.#checkUnique(next, doc.id);
    this.docs.set(doc.id, next);
    return clone(next);
  }

  async upsert(filter, patch) {
    const existing = await this.findOne(filter);
    if (existing) return this.updateOne({ id: existing.id }, patch);
    return this.create({ ...filter, ...patch });
  }

  async deleteOne(filter) {
    const doc = [...this.docs.values()].find((d) => matches(d, filter));
    if (!doc) return false;
    this.docs.delete(doc.id);
    return true;
  }

  async deleteMany(filter) {
    const victims = [...this.docs.values()].filter((d) => matches(d, filter));
    victims.forEach((d) => this.docs.delete(d.id));
    return victims.length;
  }

  async count(filter = {}) {
    return [...this.docs.values()].filter((d) => matches(d, filter)).length;
  }
}
