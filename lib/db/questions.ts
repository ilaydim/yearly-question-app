import { getDatabase } from './init';
import type { Entry, Question } from './types';

export async function getQuestionForDate(month: number, day: number): Promise<Question | null> {
  const database = await getDatabase();
  return database.getFirstAsync<Question>(
    'SELECT * FROM questions WHERE recurrence_month = ? AND recurrence_day = ?',
    month,
    day
  );
}

export async function getEntriesForQuestion(questionId: string): Promise<Entry[]> {
  const database = await getDatabase();
  return database.getAllAsync<Entry>(
    'SELECT * FROM entries WHERE question_id = ? ORDER BY date DESC',
    questionId
  );
}
