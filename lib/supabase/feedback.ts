import { supabase, isSupabaseConfigured } from './client';

export const FEEDBACK_NOT_CONFIGURED = 'FEEDBACK_NOT_CONFIGURED';

export interface FeedbackInput {
  message: string;
  email?: string | null;
}

export async function submitFeedback({ message, email }: FeedbackInput): Promise<void> {
  if (!isSupabaseConfigured) {
    throw new Error(FEEDBACK_NOT_CONFIGURED);
  }
  const { error } = await supabase.from('feedback').insert({
    message: message.trim(),
    email: email?.trim() || null,
  });
  if (error) throw error;
}
