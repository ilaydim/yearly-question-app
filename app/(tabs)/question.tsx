import { useCallback, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { getEntriesForQuestion, getQuestionForDate } from '../../lib/db/questions';
import { createEntry, updateEntry } from '../../lib/db/entries';
import { initDatabase, QUESTION_CATEGORY_ID } from '../../lib/db/init';
import { generateId } from '../../lib/db/id';
import { toDateString } from '../../lib/date';
import type { Entry, Question } from '../../lib/db/types';

export default function QuestionScreen() {
  const [loaded, setLoaded] = useState(false);
  const [question, setQuestion] = useState<Question | null>(null);
  const [todayEntry, setTodayEntry] = useState<Entry | null>(null);
  const [pastEntries, setPastEntries] = useState<Entry[]>([]);
  const [answer, setAnswer] = useState('');

  const applyEntries = (entries: Entry[], todayStr: string) => {
    const today = entries.find((entry) => entry.date === todayStr) ?? null;
    setTodayEntry(today);
    setPastEntries(entries.filter((entry) => entry.date !== todayStr));
    setAnswer(today?.content ?? '');
  };

  const load = useCallback(async () => {
    try {
      await initDatabase();
      const now = new Date();
      const q = await getQuestionForDate(now.getMonth() + 1, now.getDate());
      setQuestion(q);
      if (q) {
        const entries = await getEntriesForQuestion(q.id);
        applyEntries(entries, toDateString(now));
      }
    } catch (error) {
      console.error('Soru yüklenemedi:', error);
    } finally {
      setLoaded(true);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const handleSubmit = async () => {
    if (!question || !answer.trim()) return;
    const todayStr = toDateString(new Date());
    try {
      if (todayEntry) {
        await updateEntry(todayEntry.id, { content: answer.trim() });
      } else {
        const now = new Date().toISOString();
        await createEntry({
          id: generateId(),
          date: todayStr,
          content: answer.trim(),
          mood: null,
          category_id: QUESTION_CATEGORY_ID,
          question_id: question.id,
          created_at: now,
          updated_at: now,
        });
      }
      const entries = await getEntriesForQuestion(question.id);
      applyEntries(entries, todayStr);
    } catch (error) {
      console.error('Cevap kaydedilemedi:', error);
    }
  };

  if (!loaded) return null;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      {!question ? (
        <Text style={styles.empty}>Bugün için bir soru bulunamadı.</Text>
      ) : (
        <>
          <Text style={styles.question}>{question.text}</Text>
          <TextInput
            style={styles.input}
            multiline
            placeholder="Cevabını yaz…"
            value={answer}
            onChangeText={setAnswer}
          />
          <Pressable style={styles.submitButton} onPress={handleSubmit}>
            <Text style={styles.submitText}>{todayEntry ? 'Güncelle' : 'Kaydet'}</Text>
          </Pressable>

          {todayEntry && (
            <View style={styles.pastSection}>
              <Text style={styles.pastTitle}>Geçmiş Yıllar</Text>
              {pastEntries.length === 0 ? (
                <Text style={styles.empty}>
                  Bu soruya ilk kez cevap veriyorsun, gelecek yıllarda geçmiş cevapların burada
                  birikecek.
                </Text>
              ) : (
                pastEntries.map((entry) => (
                  <View key={entry.id} style={styles.pastCard}>
                    <Text style={styles.pastYear}>{entry.date.slice(0, 4)}</Text>
                    <Text style={styles.pastContent}>{entry.content}</Text>
                  </View>
                ))
              )}
            </View>
          )}
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 16,
    gap: 12,
  },
  question: {
    fontSize: 22,
    fontWeight: '700',
    color: '#222',
  },
  input: {
    minHeight: 140,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#DDD',
    padding: 12,
    fontSize: 16,
    textAlignVertical: 'top',
  },
  submitButton: {
    backgroundColor: '#4F46E5',
    borderRadius: 8,
    paddingVertical: 14,
    alignItems: 'center',
  },
  submitText: {
    color: '#FFF',
    fontSize: 16,
    fontWeight: '700',
  },
  pastSection: {
    marginTop: 12,
    gap: 10,
  },
  pastTitle: {
    fontSize: 13,
    fontWeight: '600',
    color: '#666',
  },
  pastCard: {
    padding: 14,
    borderRadius: 10,
    backgroundColor: '#F7F7FA',
    gap: 4,
  },
  pastYear: {
    fontSize: 13,
    fontWeight: '700',
    color: '#4F46E5',
  },
  pastContent: {
    fontSize: 15,
    color: '#222',
  },
  empty: {
    textAlign: 'center',
    marginTop: 40,
    color: '#888',
    fontSize: 15,
  },
});
