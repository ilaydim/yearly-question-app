import { getDatabase } from './init';
import type { Category } from './types';

export async function getAllCategories(): Promise<Category[]> {
  const database = await getDatabase();
  return database.getAllAsync<Category>('SELECT * FROM categories ORDER BY name');
}
