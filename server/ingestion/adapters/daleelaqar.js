/**
 * محوّل "دليل عقار".
 *
 * ⚠️ هذا المصدر permission_status = pending. المحوّل مكتوب ومختبَر
 *    ببيانات محلية مصنوعة، ولا يُشغَّل على المصدر الحقيقي حتى يُحسم الإذن.
 *
 * ===== الفرق الجوهري عن السكربت القديم =====
 *
 * القديم (scripts/update-external-offers.mjs) كان يستنتج كل شيء من شكل
 * مسار الرابط: النوع من مقطع، المساحة من مقطع آخر بـ regex. فحين تغيّر
 * شكل الروابط انهارت الحصيلة من ~86 عرضًا إلى 8، واختفت الأسعار تمامًا،
 * وأُرشف 78 عرضًا يوميًا لأسبوع كامل.
 *
 * الجديد:
 *   1) JSON-LD أولًا — بيانات معلنة ومنظّمة يصرّح بها الموقع نفسه.
 *   2) مسار الرابط كخطة بديلة، مع تسجيل صريح أن الاستخراج تدهور.
 *   3) لا يرمي استثناءً عند فشل عرض واحد — يعزله ويكمل.
 *
 * المحوّل لا يلمس الشبكة: يستقبل HTML ويعيد عروضًا خامًا. الجلب وظيفة
 * fetcher.js، والتنظيف وظيفة normalize.js.
 */

export const HOST = "daleelaqar.com";

/** الأنواع المقبولة من هذا المصدر. */
const ALLOWED_TYPES = ["أرض", "شقة", "مبنى", "فيلا", "منزل", "مزرعة", "محل"];

/** نطاق إربد ومناطقها — نطاق عمل المكتب. */
const TARGET_AREAS = [
  "اربد", "إربد", "ايدون", "إيدون", "بشرى", "الحصن", "الصريح", "حوارة",
  "بيت راس", "النعيمة", "كفر يوبا", "المغير", "السريج", "حكما",
  "زبدة فركوح", "البارحه", "البارحة",
];

function decodeSegment(value = "") {
  try {
    return decodeURIComponent(value).replace(/-/g, " ").trim();
  } catch {
    return String(value).replace(/-/g, " ").trim();
  }
}

function absolutize(base, href) {
  try {
    return new URL(href, base).href;
  } catch {
    return null;
  }
}

/** المسار الأول: البيانات المنظّمة التي يعلنها الموقع. */
export function extractStructured(html, baseUrl) {
  const match = String(html ?? "").match(
    /<script[^>]+id=["']search-jsonld["'][^>]*>([\s\S]*?)<\/script>/i
  );
  if (!match) return { listings: [], ok: false, reason: "no_jsonld" };

  try {
    const data = JSON.parse(match[1]);
    const items = data?.mainEntity?.itemListElement ?? [];
    const listings = items
      .map((entry) => {
        const item = entry?.item ?? {};
        const url = absolutize(baseUrl, item.url ?? item["@id"] ?? "");
        if (!url) return null;
        return {
          url,
          price: item.offers?.price ?? null,
          currency: item.offers?.priceCurrency ?? null,
          name: item.name ?? null,
        };
      })
      .filter(Boolean);

    return { listings, ok: listings.length > 0, reason: listings.length ? null : "jsonld_empty" };
  } catch (error) {
    return { listings: [], ok: false, reason: `jsonld_parse_failed: ${error.message}` };
  }
}

/** الخطة البديلة: روابط الإعلانات من الصفحة. أضعف — يُسجَّل استخدامه. */
export function extractLinks(html, baseUrl, { limit = 200 } = {}) {
  const hrefs = [...String(html ?? "").matchAll(/href=["']([^"']+)["']/gi)]
    .map((m) => m[1])
    .filter((href) => href.includes("/nav/") && href.includes("/للبيع/"))
    .map((href) => absolutize(baseUrl, href))
    .filter(Boolean);

  return [...new Set(hrefs)].slice(0, limit).map((url) => ({ url, price: null, currency: null }));
}

/**
 * يفكّك رابط إعلان إلى حقول خام.
 * يعيد null إن لم يطابق الشكل المتوقع — بلا تخمين.
 */
/**
 * كلمات بنيوية في المسار — ليست أماكن.
 *
 * سبب وجودها: السكربت القديم كان يقرأ الموقع من مواضع ثابتة
 * (parts[3] و parts[5])، فأي تغيّر في عمق المسار يجعله يلتقط
 * "للبيع" أو "حوض" ويعرضها للزائر كأنها اسم حي.
 */
const STRUCTURAL_SEGMENTS = new Set([
  "nav", "عقارات", "عقار", "للبيع", "للايجار", "للإيجار", "حوض", "search", "ar", "en",
]);

function isStructural(segment) {
  const s = segment.trim();
  if (!s) return true;
  if (STRUCTURAL_SEGMENTS.has(s)) return true;
  if (/^\d+$/.test(s)) return true;              // أرقام مجردة
  if (/\d+\s*(متر|م2|م²)/.test(s)) return true;  // مقطع المساحة
  return false;
}

export function parseListingUrl(listingUrl) {
  let parsed;
  try {
    parsed = new URL(listingUrl);
  } catch {
    return null;
  }

  const parts = parsed.pathname.split("/").filter(Boolean).map(decodeSegment);
  const saleIndex = parts.indexOf("للبيع");
  if (saleIndex < 3) return null;

  const type = parts[saleIndex - 1] ?? "";
  const areaSegment = parts[saleIndex + 1] ?? "";
  const lastPart = parts.at(-1) ?? "";
  const listingCode = /^[+-]?\d+$/.test(lastPart) ? (parts.at(-2) ?? "") : lastPart;
  const pathText = parts.join(" ");

  if (!ALLOWED_TYPES.some((t) => type.includes(t))) return null;
  if (!TARGET_AREAS.some((a) => pathText.includes(a))) return null;

  // الموقع يُبنى من المقاطع التي تبدو أماكن فعلًا، لا من مواضع ثابتة.
  const placeSegments = parts.filter(
    (segment, index) =>
      index !== saleIndex &&
      index !== saleIndex - 1 &&   // النوع
      segment !== listingCode &&
      !isStructural(segment)
  );

  return {
    type,
    location: ["إربد", ...placeSegments].join(" - "), // التكرار يُزال في normalize
    size: areaSegment,          // يُستخرج الرقم منه في normalize
    listing_code: listingCode,
    source_url: listingUrl,
  };
}

/**
 * نقطة الدخول للمحوّل.
 *
 * @param {{html: string, url: string}} page
 * @returns {{offers: object[], strategy: string, degraded: boolean, stats: object}}
 */
export function extract(page) {
  const { html, url: baseUrl } = page ?? {};

  const structured = extractStructured(html, baseUrl);
  const usedStructured = structured.ok;

  const candidates = usedStructured
    ? structured.listings
    : extractLinks(html, baseUrl);

  const offers = [];
  let unparsable = 0;

  for (const candidate of candidates) {
    const base = parseListingUrl(candidate.url);
    if (!base) {
      unparsable += 1;
      continue;
    }
    offers.push({
      ...base,
      price:
        candidate.price === null || candidate.price === undefined
          ? ""
          : `${candidate.price} ${candidate.currency ?? "JOD"}`,
    });
  }

  return {
    offers,
    strategy: usedStructured ? "jsonld" : "links",
    // إشارة صريحة: الخطة البديلة تعني فقدان الأسعار وضعف الاستخراج.
    degraded: !usedStructured,
    stats: {
      candidates: candidates.length,
      parsed: offers.length,
      unparsable,
      jsonldReason: structured.reason,
    },
  };
}

export const adapter = Object.freeze({
  name: "daleelaqar",
  host: HOST,
  extract,
});
