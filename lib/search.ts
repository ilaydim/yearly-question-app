// Sonuç listesinde eşleşen kelimenin etrafında kısa bir önizleme oluşturur
// (örn. "...dün akşam yürüyüşe çıktık ve..."), tüm entry metnini göstermek yerine.
export function buildSearchSnippet(content: string, query: string, contextChars = 22): string {
  const trimmedQuery = query.trim();
  if (!trimmedQuery) return content.slice(0, contextChars * 2).trim();

  const matchIndex = content.toLowerCase().indexOf(trimmedQuery.toLowerCase());
  if (matchIndex === -1) return content.slice(0, contextChars * 2).trim();

  const start = Math.max(0, matchIndex - contextChars);
  const end = Math.min(content.length, matchIndex + trimmedQuery.length + contextChars);

  const prefix = start > 0 ? '…' : '';
  const suffix = end < content.length ? '…' : '';
  return `${prefix}${content.slice(start, end).trim()}${suffix}`;
}
