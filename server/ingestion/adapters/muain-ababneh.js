/**
 * محوّل مصدر "معين عبابنه — مكتب عقاري" (صفحة فيسبوك).
 *
 * ===== الفرق عن دليل عقار =====
 *   دليل عقار    : سوق إعلانات عام، بيانات منظّمة (JSON-LD)، روابط قياسية.
 *   معين عبابنه  : مصدر خاص بالمكتب، نص حرّ بلهجة أردنية، بلا أي بنية.
 * كلاهما مصدر مستقل في السجل، ويغذّيان نفس خط الاستيعاب.
 *
 * ===== حالة الوصول =====
 * ⚠️ لا يوجد مسار وصول آلي مشروع لهذه الصفحة حاليًا.
 * فيسبوك يمنع القراءة الآلية لصفحات الويب في شروط استخدامه، والمسار
 * الرسمي الوحيد هو Graph API بتوكن من مالك الصفحة.
 *
 * لذلك:
 *   - لم يُكتب أي كود يسجّل دخولًا أو يستخدم كوكيز أو يلتف على الحماية.
 *   - الجالب مجرّد: عند توفر توكن رسمي يُستبدل بـ graphFetcher بلا تعديل
 *     سطر واحد في هذا المحوّل.
 *   - المصدر pending + disabled، وبوابة الإذن ترفضه قبل أي نداء شبكة.
 *
 * ===== ما يفعله المحوّل =====
 * يستقبل منشورات (نصًا) ويستخرج ما *يمكن إثباته من النص فقط*.
 * لا يخترع قيمة. الغامض يذهب إلى المراجعة لا إلى النشر.
 *
 * لا نموذج لغة هنا: القواعد الحتمية كافية لصيغ الأرقام الأردنية،
 * وأرخص وأدق وقابلة للتفسير.
 */

import { toLatinDigits, foldArabic, cleanText } from "../normalize.js";

export const HOST = "facebook.com";
export const PAGE_HANDLE = "m.yn.babnh.babnh";
export const PAGE_URL = `https://www.facebook.com/${PAGE_HANDLE}`;

/** نطاق المصدر: صفحة واحدة محددة، لا فيسبوك كله. */
export function isAllowedPath(url) {
  try {
    const { hostname, pathname } = new URL(url);
    const host = hostname.replace(/^(www|web|m)\./, "");
    if (host !== HOST) return false;
    return pathname.includes(PAGE_HANDLE);
  } catch {
    return false;
  }
}

// ===============================================================
// تصنيف المنشور: عقاري أم لا
// ===============================================================

const PROPERTY_TERMS = [
  "ارض", "اراضي", "قطعه", "قطعة", "دونم", "شقه", "شقة", "فيلا", "منزل", "بيت",
  "عماره", "عمارة", "بنايه", "مزرعه", "مزرعة", "محل", "مكتب", "مستودع", "قوشان", "حوض",
];
const SALE_TERMS = ["للبيع", "للايجار", "للإيجار", "بيع", "ايجار", "مطلوب", "معروض", "فرصه", "فرصة"];

/**
 * هل المنشور إعلان عقاري؟
 * يشترط دليلين: مصطلح عقاري + دليل عرض (سعر أو مساحة أو كلمة بيع).
 * منشور شخصي أو اجتماعي لا يجتمع فيه الاثنان.
 */
export function classifyPost(text) {
  const folded = foldArabic(toLatinDigits(text ?? ""));
  if (!folded) return { isProperty: false, reason: "empty_post" };

  const hasProperty = PROPERTY_TERMS.some((t) => folded.includes(t));
  if (!hasProperty) return { isProperty: false, reason: "no_property_term" };

  const hasSaleIntent = SALE_TERMS.some((t) => folded.includes(t));
  const hasNumbers = /\d/.test(folded);
  if (!hasSaleIntent && !hasNumbers) {
    return { isProperty: false, reason: "no_sale_intent" };
  }

  return { isProperty: true, reason: null };
}

// ===============================================================
// الأرقام بالصيغ الأردنية
// ===============================================================

const DUNUM_M2 = 1000;

/**
 * يفصل الواو الملتصقة بالأرقام: "وا٧١٦" -> " و 716"
 *
 * ⚠️ ممنوع استخدام \b هنا: JavaScript يعرّف حدّ الكلمة بـ [A-Za-z0-9_]
 * فقط، والحروف العربية ليست "كلمة" عنده — فـ \bوا لا تطابق أبدًا.
 * هذا الخطأ جعل "١٨الف وا٥٨٠" تُقرأ 18000 بدل 18580.
 */
function normalizeNumberText(text) {
  return toLatinDigits(String(text ?? ""))
    .replace(/[٬،]/g, ",")
    .replace(/(\d)\s*,\s*(\d{3})/g, "$1$2")   // 18,580 -> 18580
    .replace(/\s*وا\s*(?=\d)/g, " و ")         // "وا580" -> " و 580"
    .replace(/\s+و\s*(?=\d)/g, " و ");
}

/**
 * يستخرج المساحة بالمتر المربع.
 * يفهم: "٣دونم وا٧١٦ متر" · "3 دونم" · "716 م" · "دونم ونص"
 * يعيد null عند الغموض — لا تخمين.
 */
export function extractSize(text) {
  const t = normalizeNumberText(text);
  const folded = foldArabic(t);

  const dunum = folded.match(/(\d+(?:\.\d+)?)\s*(?:دونم|دنم)/);

  // ⚠️ أول رقم متبوع بـ"متر" ليس بالضرورة المساحة: "شارع قبلي ١٢ متر"
  //    يصف عرض الشارع، والتقاطه أعطى أرضًا بمساحة 12 م².
  //    الترتيب: ما يسبقه "مساحه" صراحةً، ثم أول رقم معقول بعيد عن
  //    سياق الشوارع والمسافات.
  const MIN_PLOT_M2 = 40;
  const explicit = folded.match(/مساح[هة][^\d]{0,12}(\d{2,7})/);

  const meters = explicit ?? [...folded.matchAll(/(\d{2,7})\s*(?:متر|م2|م²)/g)]
    .filter((m) => {
      // النافذة قصيرة عمدًا: "شارع قبلي ١٢ متر" يصف الشارع، بينما
      // "امتداد لشارع الهاشمي باتجاه بشرى ٦٦٢متر" يصف القطعة.
      // الفارق أن وصف الشارع يلتصق بالرقم مباشرة.
      const before = folded.slice(Math.max(0, m.index - 14), m.index);
      return Number(m[1]) >= MIN_PLOT_M2 && !/شارع|عرض|بعيده|بعيد|طول|ارتفاع/.test(before);
    })[0];

  if (!dunum && !meters) return { m2: null, source: null };

  let m2 = 0;
  const parts = [];
  if (dunum) { m2 += Number(dunum[1]) * DUNUM_M2; parts.push(dunum[0]); }
  if (meters) { m2 += Number(meters[1]); parts.push(meters[0]); }

  if (!Number.isFinite(m2) || m2 <= 0) return { m2: null, source: null };
  return { m2: Math.round(m2), source: parts.join(" + ") };
}

/**
 * يوسّع "الف" إلى آلاف — بحذر.
 *
 * ⚠️ صيغتان مختلفتان في كتابة المكتب:
 *   "١٨الف وا٥٨٠"  -> 18 ألفًا و580 = 18,580   (الرقم مُضاعِف)
 *   "٢٩٦٦٠الف"     -> 29,660                   (الرقم كامل و"الف" لفظية)
 *
 * القاعدة: الرقم الذي يبلغ ١٠٠٠ فأكثر مكتوب كاملًا، فلا يُضاعَف.
 * بدون هذا التمييز قُرئت ٢٩٦٦٠الف كـ 29,660,000 — أي ألف ضعف السعر.
 */
const THOUSAND_MULTIPLIER_MAX = 999;

function expandThousands(text) {
  return normalizeNumberText(text)
    .replace(/(\d+)\s*(?:الف|ألف|آلاف)\s*(?:و\s*(\d+))?/g, (match, k, rest) => {
      const base = Number(k);
      if (base > THOUSAND_MULTIPLIER_MAX) {
        // رقم كامل و"الف" لفظية — يُترك كما هو مع بقية العبارة.
        return rest ? `${base} و ${rest}` : String(base);
      }
      return String(base * 1000 + Number(rest ?? 0));
    });
}

/**
 * يستخرج السعر: الإجمالي وسعر المتر.
 * يعيد null لكل ما لا يمكن إثباته من النص.
 */
export function extractPrice(text) {
  const raw = String(text ?? "");
  const t = expandThousands(raw);
  const folded = foldArabic(t);

  const result = { total: null, perM2: null, currency: null, evidence: {} };

  // سعر المتر: "سعر المتر المربع ٥دنانير"
  const per = folded.match(/سعر\s*(?:ال)?متر[^\d]{0,20}(\d+(?:\.\d+)?)/);
  if (per) { result.perM2 = Number(per[1]); result.evidence.perM2 = per[0]; }

  // السعر الإجمالي: "سعر القطعه كامله 18580"
  const total = folded.match(
    /(?:سعر\s*(?:ال)?(?:قطعه|قطعة|ارض|الارض|كامل|كامله)[^\d]{0,25}|السعر[^\d]{0,15})(\d{3,9})/
  );
  if (total) { result.total = Number(total[1]); result.evidence.total = total[0]; }

  if (result.total !== null || result.perM2 !== null) {
    result.currency = /دولار|usd/.test(folded) ? "USD" : "JOD";
  }
  return result;
}

/** رقم هاتف أردني معلن في المنشور. */
export function extractPhone(text) {
  const digits = toLatinDigits(String(text ?? "")).replace(/[\s-]/g, "");
  const match = digits.match(/(?:00962|\+962|962|0)?7[789]\d{7}/);
  if (!match) return null;
  const found = match[0].replace(/^(00962|\+962|962)/, "0");
  return found.startsWith("0") ? found : `0${found}`;
}

// ===============================================================
// الموقع
// ===============================================================

const KNOWN_AREAS = [
  "اربد", "إربد", "المغير", "راحوب", "ايدون", "إيدون", "بشرى", "الحصن",
  "الصريح", "حوارة", "بيت راس", "النعيمة", "كفر يوبا", "السريج", "حكما",
  "زبدة", "فركوح", "البارحه", "البارحة", "سال", "الرمثا", "المزار",
];

/**
 * يستخرج الموقع من النص والوسوم.
 * لا يخمّن: ما لم يُذكر لا يُضاف.
 */
export function extractLocation(text) {
  const folded = foldArabic(String(text ?? ""));
  const found = [];

  for (const area of KNOWN_AREAS) {
    const key = foldArabic(area);
    if (folded.includes(key) && !found.some((f) => foldArabic(f) === key)) found.push(area);
  }

  // "حوض البركه" — الحوض وحدة عقارية أردنية معتمدة
  const basin = String(text ?? "").match(/حوض\s+([^\s#\n,،.]+)/);
  if (basin) found.push(`حوض ${basin[1]}`);

  return found.length ? found.join(" - ") : null;
}

const TYPE_HINTS = [
  { category: "land", label: "أرض", terms: ["ارض", "اراضي", "قطعه ارض", "دونم", "قوشان", "زراعي"] },
  { category: "apartment", label: "شقة", terms: ["شقه", "شقق", "استوديو"] },
  { category: "villa", label: "فيلا", terms: ["فيلا", "فلل"] },
  { category: "house", label: "منزل", terms: ["منزل", "بيت", "دار"] },
  { category: "building", label: "مبنى", terms: ["عماره", "بنايه", "برج", "مجمع"] },
  { category: "farm", label: "مزرعة", terms: ["مزرعه", "مزارع", "شاليه"] },
  { category: "shop", label: "محل", terms: ["محل", "معرض", "متجر"] },
  { category: "office", label: "مكتب", terms: ["مكتب"] },
];

export function extractType(text) {
  const folded = foldArabic(toLatinDigits(String(text ?? "")));
  for (const hint of TYPE_HINTS) {
    if (hint.terms.some((t) => folded.includes(t))) return hint;
  }
  return null;
}

/** عنوان مختصر من أول سطر ذي معنى — لا يُولَّد نص جديد. */
export function extractTitle(text) {
  const lines = String(text ?? "").split(/\n+/).map(cleanText).filter(Boolean);
  const meaningful = lines.find(
    (l) => l.length >= 8 && !/^بسم الله|^الله يبارك|^#/.test(l)
  );
  return meaningful ? meaningful.slice(0, 120) : null;
}

// ===============================================================
// تحويل منشور إلى عرض خام
// ===============================================================

/**
 * @param {{id:string, text:string, permalink:string, created_time?:string}} post
 * @returns {{offer:object|null, skipped:boolean, reason:string|null}}
 */
export function postToOffer(post) {
  const text = post?.text ?? "";
  const verdict = classifyPost(text);
  if (!verdict.isProperty) return { offer: null, skipped: true, reason: verdict.reason };

  const type = extractType(text);
  if (!type) return { offer: null, skipped: true, reason: "type_unknown" };

  const location = extractLocation(text);
  const size = extractSize(text);
  const price = extractPrice(text);
  const phone = extractPhone(text);

  // السعر الإجمالي هو المعلن. سعر المتر لا يُضرب بالمساحة لإنتاج إجمالي
  // لم يذكره صاحب المنشور.
  const priceText = price.total !== null
    ? `${price.total} ${price.currency}`
    : price.perM2 !== null
      ? `${price.perM2} ${price.currency} للمتر`
      : "";

  return {
    offer: {
      title: extractTitle(text),
      type: type.label,
      location: location ?? "",
      size: size.m2 ? `${size.m2} م²` : "",
      price: priceText,
      note: cleanText(text).slice(0, 500),
      listing_code: post?.id ? String(post.id) : "",
      source_url: post?.permalink ?? "",
      published_at: post?.created_time ?? null,
      contact_phone: phone,
      // إسناد كل قيمة إلى موضعها في النص — للتدقيق ولمراجعة البشر.
      evidence: {
        size: size.source, price: price.evidence, type: type.category, location,
      },
    },
    skipped: false,
    reason: null,
  };
}

// ===============================================================
// عقد المحوّل
// ===============================================================

/**
 * الاكتشاف: يستقبل مصدر منشورات مجرّدًا.
 * الجالب هو من يقرر من أين تأتي المنشورات (Graph API لاحقًا، أو
 * بيانات محلية في الاختبار). المحوّل لا يعرف ولا يتصل بشيء.
 */
export async function discover({ fetcher, limit = 50 } = {}) {
  const page = await fetcher.fetchPage(PAGE_URL);

  let posts;
  try {
    const parsed = typeof page.html === "string" ? JSON.parse(page.html) : page.html;
    posts = parsed?.data ?? parsed?.posts ?? [];
  } catch {
    return { urls: [], stats: { posts: 0, error: "unreadable_feed" }, posts: [] };
  }

  const usable = posts
    .filter((p) => p?.permalink && isAllowedPath(p.permalink))
    .slice(0, limit);

  return {
    urls: usable.map((p) => p.permalink),
    posts: usable,
    stats: { posts: posts.length, usable: usable.length },
  };
}

/** يحوّل منشورًا واحدًا. يُستدعى من مسار المرحلتين. */
export function extractDetail({ post }) {
  const { offer } = postToOffer(post ?? {});
  return offer;
}

/** العقد أحادي المرحلة: مجموعة منشورات دفعة واحدة. */
export function extract(page) {
  let posts;
  try {
    const parsed = typeof page?.html === "string" ? JSON.parse(page.html) : page?.html;
    posts = parsed?.data ?? parsed?.posts ?? [];
  } catch {
    return {
      offers: [], strategy: "posts", degraded: true,
      stats: { candidates: 0, parsed: 0, unparsable: 0, error: "unreadable_feed" },
    };
  }

  const offers = [];
  const skipped = [];

  for (const post of posts) {
    if (!post?.permalink || !isAllowedPath(post.permalink)) {
      skipped.push({ id: post?.id ?? null, reason: "outside_page_scope" });
      continue;
    }
    const { offer, reason } = postToOffer(post);
    if (offer) offers.push(offer);
    else skipped.push({ id: post?.id ?? null, reason });
  }

  return {
    offers,
    strategy: "posts",
    // بلا سعر ولا مساحة في أغلب المنشورات = استخراج ضعيف يستحق الانتباه.
    degraded: offers.length > 0 && offers.every((o) => !o.price && !o.size),
    stats: {
      candidates: posts.length, parsed: offers.length,
      unparsable: skipped.length, skipped,
    },
  };
}

/**
 * ⚠️ لا يُصدَّر discover في العقد عمدًا.
 * تغذية الصفحة تعيد كل المنشورات دفعة واحدة، فمسار المرحلة الواحدة
 * (extract) هو الصحيح. مسار المرحلتين مخصص لمصادر تحتاج جلب صفحة
 * تفاصيل مستقلة لكل إعلان — وهذا ليس حال فيسبوك.
 * discover و extractDetail مُصدَّرتان للاختبار والاستخدام المستقبلي.
 */
export const adapter = Object.freeze({
  name: "muain_ababneh_facebook",
  host: HOST,
  pageHandle: PAGE_HANDLE,
  extract,
  isAllowedPath,
});
