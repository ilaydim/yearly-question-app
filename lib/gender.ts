// Kayıt formu ve Profili Düzenle ekranı arasında paylaşılan cinsiyet seçenekleri —
// DB'de İngilizce sabit değer olarak tutulur (dile bağlı olmasın diye), görüntülenen
// etiket i18n'den ("gender" sözlüğü) geliyor.
export const GENDER_OPTIONS = ['female', 'male', 'unspecified'] as const;
export type Gender = (typeof GENDER_OPTIONS)[number];
