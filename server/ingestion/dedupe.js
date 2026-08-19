/**
 * إزالة التكرار.
 *
 * طبقتان:
 *
 * 1) المفتاح القاطع: source_url
 *    يُغطّي إعادة فحص المصدر — نفس الإعلان في جولات متتالية لا يُدرَج مرتين.
 *    وهو أيضًا القيد الفريد في قاعدة البيانات (external_offers.source_url).
 *
 * 2) المفتاح المركّب: نفس العقار معروضًا برابطين مختلفين
 *    (نوع + موقع + مساحة ± تفاوت + شريحة سعر).
 *    هذا احتمالي لا قاطع، لذا يُوسم للمراجعة ولا يُحذف بصمت.
 *
 * لا يُستخدم نموذج لغة هنا. المطابقة على حقول منظّمة أدق وأرخص.
 */

/** تفاوت مسموح في المساحة لاعتبار عرضين نفس العقار. */
const SIZE_TOLERANCE = 0.02; // 2%

/** عرض الشريحة السعرية — يمنع اعتبار فرق بسيط عقارين مختلفين. */
const PRICE_BUCKET = 0.03; // 3%

/**
 * توحيد قانوني للرابط قبل أي مقارنة.
 *
 * ضروري لا تجميلي: روابط هذا المصدر تحوي محارف عربية، و new URL()
 * يرمّزها نسبة مئوية. فالرابط نفسه قد يصل مرة خامًا ومرة مرمّزًا —
 * ومقارنة النصين مباشرة كانت ستُدرج العرض مرتين.
 *
 * يوحّد أيضًا: النطاق بحروف صغيرة · إزالة www · إزالة الشظية · إزالة / النهائية.
 */
export function canonicalUrl(url) {
  const text = String(url ?? "").trim();
  if (!text) return "";
  try {
    const parsed = new URL(text);
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    return parsed.href.replace(/\/$/, "");
  } catch {
    return text;
  }
}

/** مفتاح قاطع. */
export function exactKey(offer) {
  return canonicalUrl(offer?.source_url);
}

/**
 * مفتاح مركّب تقريبي. يعيد null إن نقصت المقوّمات —
 * فلا نطابق على بيانات ناقصة وننتج تكرارًا وهميًا.
 */
export function fuzzyKey(offer) {
  if (!offer?.type_category || !offer?.location_key || !offer?.size_m2) return null;

  const sizeBucket = Math.round(offer.size_m2 / (1 + SIZE_TOLERANCE));
  const priceBucket =
    offer.price_amount == null
      ? "na"
      : Math.round(offer.price_amount / (1 + PRICE_BUCKET));

  return `${offer.type_category}|${offer.location_key}|${sizeBucket}|${priceBucket}`;
}

/**
 * يزيل التكرار داخل دفعة واحدة.
 *
 * @param {object[]} offers
 * @param {Set<string>} knownUrls روابط موجودة مسبقًا في قاعدة البيانات
 * @returns {{unique: object[], duplicates: object[], suspected: object[]}}
 */
export function dedupe(offers, { knownUrls = new Set() } = {}) {
  // الروابط المعروفة تُوحَّد بنفس القاعدة، وإلا فشلت المطابقة لاختلاف الترميز.
  const known = new Set([...knownUrls].map(canonicalUrl));
  const seenExact = new Set();
  const seenFuzzy = new Map();

  const unique = [];
  const duplicates = [];
  const suspected = [];

  for (const offer of offers ?? []) {
    const key = exactKey(offer);

    if (!key) {
      duplicates.push({ offer, reason: "missing_source_url" });
      continue;
    }

    // تكرار داخل نفس الدفعة
    if (seenExact.has(key)) {
      duplicates.push({ offer, reason: "duplicate_in_batch" });
      continue;
    }

    // موجود مسبقًا في قاعدة البيانات -> إعادة فحص، لا إدراج جديد
    if (known.has(key)) {
      duplicates.push({ offer, reason: "already_in_database" });
      seenExact.add(key);
      continue;
    }

    seenExact.add(key);

    const fuzzy = fuzzyKey(offer);
    if (fuzzy) {
      const previous = seenFuzzy.get(fuzzy);
      if (previous) {
        // ليس حذفًا: نمرّره موسومًا ليراجعه إنسان.
        suspected.push({ offer, matches: previous.source_url, key: fuzzy });
        unique.push({ ...offer, possible_duplicate_of: previous.source_url });
        continue;
      }
      seenFuzzy.set(fuzzy, offer);
    }

    unique.push(offer);
  }

  return { unique, duplicates, suspected };
}
