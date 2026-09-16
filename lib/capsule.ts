// Yıl Sonu Kapsülü'nün ne zaman "açık" olduğunu belirleyen saf tarih hesaplaması —
// DB'de ayrı bir kilit/pencere tarihi tutmuyoruz, her çağrıda buradan hesaplanıyor.
//
// Pencere: her yıl 20 Aralık - 10 Ocak arası (yıl sınırını aşıyor, örn. 20 Aralık 2026 -
// 10 Ocak 2027). Bu pencerede yazılan yeni kapsül HER ZAMAN "gelecek yıl" için olur
// (örn. yukarıdaki pencerede writingYear=2027), açığa çıkan kapsül ise bir önceki
// pencerede yazılmış olan (revealYear=2026) kapsüldür. Pencerenin Aralık tarafında da
// Ocak tarafında da bu iki değer birbirinin aynısı kalır (tutarlılık için önemli).
const WINDOW_START_MONTH = 12; // Aralık
const WINDOW_START_DAY = 20;
const WINDOW_END_MONTH = 1; // Ocak
const WINDOW_END_DAY = 10;

export interface CapsuleWindow {
  isOpen: boolean;
  // Pencere kapalıyken de anlamlı: "şu an içinde bulunduğumuz kapsül döngüsü" — yani
  // pencere son açıldığında/açılacağında geçerli olacak writing/reveal yılları.
  writingYear: number;
  revealYear: number;
  // Sadece isOpen:false iken dolu — pencerenin (bu yılın 20 Aralık'ının) kaç gün
  // sonra açılacağı. Pencere zaten açıksa null.
  daysUntilOpen: number | null;
}

function startOfDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

export function getCurrentCapsuleWindow(today: Date): CapsuleWindow {
  const month = today.getMonth() + 1; // 1-12
  const day = today.getDate();
  const year = today.getFullYear();

  const isDecemberSide = month === WINDOW_START_MONTH && day >= WINDOW_START_DAY;
  const isJanuarySide = month === WINDOW_END_MONTH && day <= WINDOW_END_DAY;
  const isOpen = isDecemberSide || isJanuarySide;

  // Aralık tarafındaysak (year=2026): writingYear=2027, revealYear=2026.
  // Ocak tarafındaysak (year=2027, hâlâ aynı döngü): writingYear=2027, revealYear=2026.
  // Pencere şu an kapalıysa: bir sonraki döngü referans alınır (bu yılın 20 Aralık'ı
  // henüz gelmediyse, hedef hâlâ "bu yıl + 1"dir).
  const cycleYear = isJanuarySide ? year - 1 : year;
  const writingYear = cycleYear + 1;
  const revealYear = cycleYear;

  if (isOpen) {
    return { isOpen: true, writingYear, revealYear, daysUntilOpen: null };
  }

  // Kapalıyken pencere her zaman "bu takvim yılının 20 Aralık'ında" açılır — çünkü
  // kapalı aralık (11 Ocak - 19 Aralık) içindeyken o tarih her zaman hâlâ ileridedir.
  const nextWindowStart = startOfDay(new Date(year, WINDOW_START_MONTH - 1, WINDOW_START_DAY));
  const todayStart = startOfDay(today);
  const daysUntilOpen = Math.round(
    (nextWindowStart.getTime() - todayStart.getTime()) / (24 * 60 * 60 * 1000)
  );

  return { isOpen: false, writingYear, revealYear, daysUntilOpen };
}
