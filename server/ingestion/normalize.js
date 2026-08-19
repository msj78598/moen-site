/**
 * تطبيع وتنظيف بيانات العروض.
 *
 * ===== المبدأ الحاكم =====
 * لا تُخترع قيمة مفقودة أبدًا. إن تعذّر استخراج السعر يبقى null
 * ويُعرض "السعر عند التواصل" — ولا يُخمَّن ولا يُحسب من قيم أخرى.
 *
 * سبب وجود هذا الملف: البيانات الحالية في الإنتاج تحوي أسعارًا مثل ".."
 * و"٤دنانير للمتر"، ومواقع مكررة مثل "إربد - اربد - الطوال".
 *
 * كل الدوال هنا نقية — بلا شبكة وبلا قاعدة بيانات.
 */

export const NO_PRICE_TEXT = "السعر عند التواصل";

const ARABIC_INDIC = "٠١٢٣٤٥٦٧٨٩";
const PERSIAN_INDIC = "۰۱۲۳۴۵۶۷۸۹";

/** يحوّل الأرقام العربية والفارسية إلى لاتينية. "٤" -> "4" */
export function toLatinDigits(text) {
  return String(text ?? "").replace(/[٠-٩۰-۹]/g, (d) => {
    const a = ARABIC_INDIC.indexOf(d);
    if (a !== -1) return String(a);
    return String(PERSIAN_INDIC.indexOf(d));
  });
}

/** توحيد أشكال الألف والهاء للمقارنة فقط — لا يُستخدم للعرض. */
export function foldArabic(text) {
  return String(text ?? "")
    .replace(/[إأآا]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ًٌٍَُِّْـ]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

/** يزيل الفراغات الزائدة والرموز المعلّقة. */
export function cleanText(value) {
  const text = String(value ?? "")
    .replace(/[‎‏‪-‮]/g, "") // محارف اتجاه غير مرئية
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^[\s.،,\-–—_/\\|]+|[\s.،,\-–—_/\\|]+$/g, "")
    .trim();
  return text;
}

/**
 * هل هذه القيمة "قمامة" لا معنى لها؟
 * أمثلة حقيقية من الإنتاج: ".." و "-" و "؟"
 */
export function isGarbage(value) {
  const text = cleanText(toLatinDigits(value));
  if (!text) return true;
  if (!/[\p{L}\p{N}]/u.test(text)) return true;      // بلا أي حرف أو رقم
  if (/^[.\-_?؟*#]+$/.test(String(value).trim())) return true;
  return false;
}

// ===============================================================
// نوع العقار
// ===============================================================

const TYPE_RULES = [
  { category: "land",      label: "أرض",   patterns: ["ارض", "اراضي", "قطعه ارض", "قطعة ارض", "قوشان"] },
  { category: "apartment", label: "شقة",   patterns: ["شقه", "شقق", "استوديو"] },
  { category: "villa",     label: "فيلا",  patterns: ["فيلا", "فلل", "فيلل"] },
  { category: "house",     label: "منزل",  patterns: ["منزل", "بيت", "دار", "منازل"] },
  { category: "building",  label: "مبنى",  patterns: ["مبني", "بنايه", "عماره", "عمارات", "برج"] },
  { category: "farm",      label: "مزرعة", patterns: ["مزرعه", "مزارع"] },
  { category: "shop",      label: "محل",   patterns: ["محل", "متجر", "معرض"] },
  { category: "office",    label: "مكتب",  patterns: ["مكتب", "مكاتب"] },
  { category: "warehouse", label: "مستودع", patterns: ["مستودع", "مخزن", "هنجر"] },
];

/**
 * يصنّف نوع العقار من نص حر.
 * لا يُستخدم نموذج لغة هنا — القواعد كافية ومحسومة وأرخص وأدق.
 *
 * @returns {{category: string|null, label: string|null, raw: string}}
 */
export function normalizeType(value) {
  const raw = cleanText(value);
  if (isGarbage(raw)) return { category: null, label: null, raw: "" };

  const folded = foldArabic(raw);
  for (const rule of TYPE_RULES) {
    if (rule.patterns.some((p) => folded.includes(p))) {
      return { category: rule.category, label: rule.label, raw };
    }
  }
  // نوع غير معروف: نحتفظ بالنص كما هو ولا نخترع تصنيفًا.
  return { category: null, label: null, raw };
}

// ===============================================================
// الموقع
// ===============================================================

/**
 * ينظّف الموقع ويزيل التكرار بين مقاطعه.
 * "إربد - اربد - الطوال" -> "إربد - الطوال"   (اربد و إربد نفس المقطع)
 */
export function normalizeLocation(value) {
  const raw = cleanText(value);
  if (isGarbage(raw)) return { display: "", segments: [], key: "" };

  const seen = new Set();
  const segments = [];

  for (const part of raw.split(/\s*[-–—/|,،]\s*/)) {
    const piece = cleanText(part);
    if (!piece || isGarbage(piece)) continue;
    const folded = foldArabic(piece);
    if (seen.has(folded)) continue;
    seen.add(folded);
    segments.push(piece);
  }

  return {
    display: segments.join(" - "),
    segments,
    key: segments.map(foldArabic).join("|"),
  };
}

// ===============================================================
// المساحة
// ===============================================================

const DUNUM_PER_M2 = 1000;

/**
 * يستخرج المساحة بالمتر المربع.
 * يقبل: "854 م²" · "28700 م2" · "المساحه 545م2" · "3 دونم"
 *
 * @returns {{m2: number|null, display: string, raw: string}}
 */
export function normalizeSize(value) {
  const raw = cleanText(value);
  if (isGarbage(raw)) return { m2: null, display: "", raw: "" };

  const text = toLatinDigits(raw).replace(/,/g, "");
  const folded = foldArabic(text);

  const dunum = folded.match(/(\d+(?:\.\d+)?)\s*(دونم|دنم)/);
  if (dunum) {
    const m2 = Math.round(Number(dunum[1]) * DUNUM_PER_M2);
    return Number.isFinite(m2) && m2 > 0
      ? { m2, display: `${m2.toLocaleString("en-US")} م²`, raw }
      : { m2: null, display: "", raw };
  }

  const meters = text.match(/(\d+(?:\.\d+)?)\s*(?:م²|م2|م\b|متر|mm?2|sqm|m²)/i)
    ?? text.match(/(\d{2,})/); // رقم مجرد كبير بما يكفي ليكون مساحة

  if (!meters) return { m2: null, display: "", raw };

  const m2 = Math.round(Number(meters[1]));
  if (!Number.isFinite(m2) || m2 <= 0) return { m2: null, display: "", raw };

  return { m2, display: `${m2.toLocaleString("en-US")} م²`, raw };
}

// ===============================================================
// السعر
// ===============================================================

const CURRENCIES = [
  { code: "JOD", patterns: ["دينار", "دنانير", "jod", "jd"] },
  { code: "USD", patterns: ["دولار", "usd", "$"] },
  { code: "SAR", patterns: ["ريال", "sar"] },
];

/**
 * يستخرج السعر. يرفض القمامة ولا يخترع شيئًا.
 *
 * أمثلة حقيقية من الإنتاج:
 *   "120,000"        -> { amount: 120000, currency: "JOD" }
 *   ".."             -> { amount: null }  -> "السعر عند التواصل"
 *   "٤دنانير للمتر"  -> { amount: 4, unit: "per_m2" }
 *
 * ملاحظة مقصودة: عند السعر بالمتر لا نضربه بالمساحة لننتج سعرًا إجماليًا.
 * ذلك حساب لم يعلنه المصدر، ونشره كسعر إجمالي تضليل.
 *
 * @returns {{amount:number|null, currency:string|null, unit:string, display:string, raw:string}}
 */
export function normalizePrice(value) {
  const raw = cleanText(value);
  const fallback = { amount: null, currency: null, unit: "total", display: NO_PRICE_TEXT, raw };

  if (isGarbage(raw)) return fallback;

  const text = toLatinDigits(raw);
  const folded = foldArabic(text);

  // نص يدل صراحةً على غياب السعر
  if (/عند التواصل|عند الاتصال|حسب المصدر|للاستفسار|السعر غير|تواصل/.test(folded)) {
    return fallback;
  }

  const digits = text.replace(/[,،\s]/g, "").match(/(\d+(?:\.\d+)?)/);
  if (!digits) return fallback;

  const amount = Number(digits[1]);
  if (!Number.isFinite(amount) || amount <= 0) return fallback;

  const currency =
    CURRENCIES.find((c) => c.patterns.some((p) => folded.includes(p)))?.code ?? "JOD";

  const unit = /للمتر|\/\s*م|بالمتر|per\s*m/.test(folded) ? "per_m2" : "total";

  const formatted = amount.toLocaleString("en-US");
  const currencyLabel = currency === "JOD" ? "دينار" : currency;
  const display =
    unit === "per_m2"
      ? `${formatted} ${currencyLabel} للمتر`
      : `${formatted} ${currencyLabel}`;

  return { amount, currency, unit, display, raw };
}

// ===============================================================
// العنوان
// ===============================================================

/** أقصى طول معقول لعنوان إعلان. ما زاد يُقتطع لا يُرفض. */
const TITLE_MAX = 160;

/**
 * ينظّف عنوان الإعلان كما أعلنه المصدر.
 *
 * لا يُولَّد عنوان ولا يُركَّب من الحقول الأخرى: العنوان إما أعلنه المصدر
 * أو لا وجود له. توليده هنا اختراع لمعلومة لم تُنشر.
 */
export function normalizeTitle(value) {
  const raw = cleanText(value);
  if (isGarbage(raw)) return null;
  return raw.length > TITLE_MAX ? `${raw.slice(0, TITLE_MAX).trim()}…` : raw;
}

// ===============================================================
// التطبيع الكامل لعرض واحد
// ===============================================================

/**
 * يحوّل عرضًا خامًا مستخرَجًا إلى الشكل المُطبَّع.
 * لا يرفض ولا يقبل — الحكم وظيفة validate.js. هنا تنظيف فقط.
 */
export function normalizeOffer(rawOffer, { sourceName } = {}) {
  const type = normalizeType(rawOffer?.type);
  const location = normalizeLocation(rawOffer?.location);
  const size = normalizeSize(rawOffer?.size);
  const price = normalizePrice(rawOffer?.price);

  const title = normalizeTitle(rawOffer?.title);

  return {
    // العرض
    title,
    type: type.label ?? type.raw,
    type_category: type.category,
    location: location.display,
    location_key: location.key,
    size: size.display,
    size_m2: size.m2,
    price: price.display,
    price_amount: price.amount,
    price_currency: price.currency,
    price_unit: price.unit,

    // المصدر — إلزامي ولا يُخترع
    source_name: sourceName ?? cleanText(rawOffer?.source_name),
    source_url: cleanText(rawOffer?.source_url),
    listing_code: cleanText(rawOffer?.listing_code),

    note: cleanText(rawOffer?.note) || null,

    // الخام محفوظ للتدقيق وإعادة المعالجة
    raw: {
      title: rawOffer?.title ?? null,
      type: rawOffer?.type ?? null,
      location: rawOffer?.location ?? null,
      size: rawOffer?.size ?? null,
      price: rawOffer?.price ?? null,
    },
  };
}
