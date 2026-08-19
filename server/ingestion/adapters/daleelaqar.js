/**
 * محوّل "دليل عقار" — مرحلتان.
 *
 * ===== ما انكسر ولماذا =====
 * كان المحوّل يقرأ من صفحة البحث وسمًا اسمه `search-jsonld`. الموقع
 * أعاد بناء صفحة البحث لتُحمّل القوائم ديناميكيًا، فاختفى ذلك الوسم
 * ولم يبقَ في HTML إلا 9 روابط. النتيجة: انهيار من ~86 عرضًا إلى 8،
 * واختفاء الأسعار تمامًا، وأرشفة 78 عرضًا حيًا لأسبوع.
 *
 * ===== الحل =====
 * لا نقرأ صفحة البحث إطلاقًا. نستخدم ما يعلنه الموقع للزواحف:
 *
 *   1) الاكتشاف: sitemap.xml المُعلَن في robots.txt
 *      يعطي 18,330 رابطًا، منها 1,658 في نطاق إربد.
 *   2) التفاصيل: صفحة الإعلان تحمل JSON-LD من نوع RealEstateListing
 *      فيه السعر والعملة والتوفر والعنوان.
 *
 * ===== احترام الموقع =====
 * robots.txt يمنع /property/ ويسمح بـ /nav/. كل روابط الـsitemap تحت
 * /nav/ — تحققنا: 10,931 من 10,931 في lands.xml.
 * المسار الممنوع مرفوض بنيويًا في isAllowedPath، وبين طلبات التفاصيل
 * مهلة تهذيب، والعدد محكوم بـ max_offers_per_run.
 *
 * المحوّل لا يلمس الشبكة بنفسه — يستقبل جالبًا محقونًا.
 */

export const HOST = "daleelaqar.com";
export const SITEMAP_URL = "https://daleelaqar.com/sitemap.xml";

/** مسارات يمنعها robots.txt صراحةً. */
const DISALLOWED_PREFIXES = [
  "/property/", "/not-found", "/simple-nav", "/login",
  "/nav/notifications", "/nav/main/notifications", "/nav/profile", "/nav/favorite",
];

const ALLOWED_TYPES = ["أرض", "شقة", "مبنى", "فيلا", "منزل", "مزرعة", "محل", "مكتب", "مستودع"];

/** نطاق عمل المكتب: إربد ومناطقها. */
export const TARGET_AREAS = [
  "اربد", "إربد", "ايدون", "إيدون", "بشرى", "الحصن", "الصريح", "حوارة",
  "بيت راس", "النعيمة", "كفر يوبا", "المغير", "السريج", "حكما", "زبدة",
  "البارحه", "البارحة", "سال", "راحوب", "الرمثا", "المزار الشمالي",
];

/** مقاطع بنيوية في المسار — ليست أماكن. */
const STRUCTURAL = new Set([
  "nav", "عقارات", "عقار", "للبيع", "للايجار", "للإيجار",
  "حوض", "جدول الأحياء", "جدول الاحياء", "search", "ar", "en",
]);

function decodeSegment(value = "") {
  try {
    return decodeURIComponent(value).replace(/-/g, " ").trim();
  } catch {
    return String(value).replace(/-/g, " ").trim();
  }
}

/** حاجز robots — يُفحص قبل أي طلب تفاصيل. */
export function isAllowedPath(url) {
  try {
    const { pathname, hostname } = new URL(url);
    if (hostname.replace(/^www\./, "") !== HOST) return false;
    return !DISALLOWED_PREFIXES.some((p) => pathname.startsWith(p));
  } catch {
    return false;
  }
}

function isStructural(segment) {
  const s = segment.trim();
  if (!s || STRUCTURAL.has(s)) return true;
  if (/^\d+$/.test(s)) return true;                 // أرقام مجردة
  if (/^\d+\s*(متر|م2|م²)$/.test(s)) return true;   // مقطع المساحة
  if (/^اراضي\s/.test(s)) return true;              // تصنيف لا مكان
  return false;
}

// ===============================================================
// المرحلة 1 — الاكتشاف من الـsitemap
// ===============================================================

/** يستخرج <loc> من أي ملف sitemap. */
export function parseSitemap(xml) {
  return [...String(xml ?? "").matchAll(/<loc>\s*([^<\s]+)\s*<\/loc>/g)].map((m) => m[1]);
}

/**
 * يفكّك رابط إعلان إلى حقول خام.
 * يعيد null إن لم يطابق الشكل المتوقع — بلا تخمين.
 *
 * الشكل الحالي:
 *   /nav/محافظة-اربد/اراضي-اربد/اربد/جدول-الأحياء/المردمه/أرض/للبيع/514متر/01285
 */
export function parseListingUrl(listingUrl) {
  if (!isAllowedPath(listingUrl)) return null;

  let parsed;
  try {
    parsed = new URL(listingUrl);
  } catch {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean).map(decodeSegment);
  const saleIndex = parts.indexOf("للبيع");
  if (saleIndex < 2) return null;

  const type = parts[saleIndex - 1] ?? "";
  const sizeSegment = parts[saleIndex + 1] ?? "";
  const listingCode = parts.at(-1) ?? "";
  const pathText = parts.join(" ");

  if (!ALLOWED_TYPES.some((t) => type.includes(t))) return null;
  if (!TARGET_AREAS.some((a) => pathText.includes(a))) return null;
  if (!/\d/.test(sizeSegment)) return null;

  const places = parts.filter(
    (segment, index) =>
      index !== saleIndex && index !== saleIndex - 1 &&
      index !== saleIndex + 1 && index !== parts.length - 1 &&
      !isStructural(segment)
  );

  return {
    type,
    location: places.join(" - "),   // التكرار يُزال في normalize
    size: sizeSegment,
    listing_code: listingCode,
    source_url: listingUrl,
  };
}

/**
 * يكتشف روابط الإعلانات ضمن نطاق العمل.
 *
 * @param {{fetchPage:(url:string)=>Promise<{html:string}>}} fetcher
 * @returns {{urls:string[], stats:object}}
 */
export async function discover({ fetcher, limit = 500, areas = TARGET_AREAS } = {}) {
  const index = await fetcher.fetchPage(SITEMAP_URL);
  const children = parseSitemap(index.html).filter((u) => u.endsWith(".xml"));

  const stats = { children: children.length, scanned: 0, inScope: 0, unparsable: 0 };
  const urls = [];
  const seen = new Set();

  for (const child of children) {
    if (urls.length >= limit) break;
    let page;
    try {
      page = await fetcher.fetchPage(child);
    } catch {
      continue; // ملف فرعي واحد لا يُسقط الاكتشاف
    }

    for (const loc of parseSitemap(page.html)) {
      stats.scanned += 1;
      if (urls.length >= limit) break;

      let decoded;
      try { decoded = decodeURIComponent(loc); } catch { decoded = loc; }
      if (!areas.some((a) => decoded.includes(a))) continue;
      stats.inScope += 1;

      if (!parseListingUrl(loc)) { stats.unparsable += 1; continue; }
      if (seen.has(loc)) continue;
      seen.add(loc);
      urls.push(loc);
    }
  }

  return { urls, stats };
}

// ===============================================================
// المرحلة 2 — تفاصيل الإعلان
// ===============================================================

/**
 * يقرأ JSON-LD من نوع RealEstateListing.
 * هذه بيانات منظّمة يعلنها الموقع بنفسه — أدق من قراءة نص الصفحة.
 */
export function extractDetail({ html, url }) {
  const base = parseListingUrl(url);
  if (!base) return null;

  let listing = null;
  for (const match of String(html ?? "").matchAll(
    /<script[^>]*type="application\/ld\+json"[^>]*>([\s\S]*?)<\/script>/g
  )) {
    try {
      const data = JSON.parse(match[1]);
      if (data?.["@type"] === "RealEstateListing") { listing = data; break; }
    } catch {
      // وسم تالف لا يُسقط بقية الوسوم
    }
  }

  if (!listing) {
    // الرابط وحده يعطي النوع والموقع والمساحة — عرض بلا سعر أفضل من لا شيء.
    return { ...base, title: null, price: "", availability: null, degraded: true };
  }

  const offers = listing.offers ?? {};
  const price = offers.price;

  return {
    ...base,
    title: listing.name ?? null,
    price: price === undefined || price === null
      ? ""
      : `${price} ${offers.priceCurrency ?? "JOD"}`,
    availability: offers.availability ?? null,
    degraded: false,
  };
}

/**
 * التوافق مع العقد القديم: يستقبل صفحة ويعيد عروضًا.
 * يُستخدم حين تُمرَّر صفحة تفاصيل واحدة.
 */
export function extract(page) {
  const detail = extractDetail({ html: page?.html, url: page?.url });
  return {
    offers: detail ? [detail] : [],
    strategy: detail?.degraded ? "url_only" : "jsonld_detail",
    degraded: Boolean(detail?.degraded),
    stats: { candidates: 1, parsed: detail ? 1 : 0, unparsable: detail ? 0 : 1 },
  };
}

export const adapter = Object.freeze({
  name: "daleelaqar",
  host: HOST,
  discover,
  extractDetail,
  extract,
  isAllowedPath,
});
