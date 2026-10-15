/**
 * Factory that builds the full set of repositories for the configured store.
 * Dependency injection: app.js receives `repos` instead of importing models,
 * which keeps routes and services testable and database-agnostic.
 */
import { MemoryRepository } from './memoryRepository.js';

export const COLLECTIONS = ['users', 'workouts', 'meals', 'water', 'daily', 'measurements', 'reviews'];

export async function createRepositories(store) {
  if (store === 'memory') {
    return {
      users: new MemoryRepository({ unique: [['email']] }),
      workouts: new MemoryRepository(),
      meals: new MemoryRepository(),
      water: new MemoryRepository(),
      daily: new MemoryRepository({ unique: [['userId', 'date']] }),
      measurements: new MemoryRepository({ unique: [['userId', 'date']] }),
      reviews: new MemoryRepository(),
    };
  }
  const { MongoRepository } = await import('./mongoRepository.js');
  const { models } = await import('../models/index.js');
  return Object.fromEntries(COLLECTIONS.map((name) => [name, new MongoRepository(models[name])]));
}
