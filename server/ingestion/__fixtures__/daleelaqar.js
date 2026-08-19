/**
 * بيانات محلية مصنوعة يدويًا للاختبار.
 *
 * ⚠️ لا شيء هنا منسوخ من أي موقع حقيقي. الأرقام والأحياء والأكواد
 *    مؤلَّفة بالكامل. الغرض محاكاة *شكل* الاستجابة لا محتواها،
 *    فلا مسألة حقوق ولا بيانات طرف ثالث.
 *
 * الحالات المغطّاة مأخوذة من أعطال حقيقية رُصدت في الإنتاج:
 *   - عرض كامل
 *   - عرض بلا سعر
 *   - سعر مشوّه ("..")
 *   - سعر بالمتر بأرقام عربية
 *   - رابط مكرر
 *   - رابط من نطاق أجنبي (يجب رفضه)
 *   - انهيار JSON-LD (يجبر الخط على الخطة البديلة)
 */

export const BASE_URL = "https://daleelaqar.com/search/عقارات-للبيع/اربد";

/** روابط بالشكل الذي يتوقعه المحوّل: .../<type>/للبيع/<area>/... */
const listingUrl = (locality, type, areaSeg, basin, code) =>
  `https://daleelaqar.com/nav/عقارات/${locality}/حوض/${type}/للبيع/${areaSeg}/${basin}/${code}`;

export const URLS = {
  complete:   listingUrl("اربد", "أرض", "854-متر", "ايدون", "LST100234"),
  noPrice:    listingUrl("اربد", "شقة", "134-متر", "البارحه", "LST100235"),
  badPrice:   listingUrl("اربد", "منزل", "377-متر", "بشرى", "LST100236"),
  perMeter:   listingUrl("اربد", "أرض", "1000-متر", "الصريح", "LST100237"),
  duplicate:  listingUrl("اربد", "أرض", "854-متر", "ايدون", "LST100234"), // نفس رابط complete
  foreign:    "https://not-our-source.example.com/listing/999",
  unparsable: "https://daleelaqar.com/about-us",
};

/** صفحة سليمة: JSON-LD موجود وفيه أسعار. */
export const HEALTHY_PAGE = `<!doctype html><html><head>
<script type="application/ld+json" id="search-jsonld">
${JSON.stringify({
  "@context": "https://schema.org",
  mainEntity: {
    "@type": "ItemList",
    itemListElement: [
      { item: { url: URLS.complete,  name: "أرض للبيع", offers: { price: 80000, priceCurrency: "JOD" } } },
      { item: { url: URLS.noPrice,   name: "شقة للبيع", offers: {} } },
      { item: { url: URLS.badPrice,  name: "منزل للبيع", offers: { price: "..", priceCurrency: "JOD" } } },
      { item: { url: URLS.perMeter,  name: "أرض للبيع", offers: { price: "٤ دنانير للمتر" } } },
      { item: { url: URLS.duplicate, name: "أرض للبيع", offers: { price: 80000, priceCurrency: "JOD" } } },
      { item: { url: URLS.foreign,   name: "عرض من نطاق آخر", offers: { price: 50000 } } },
      { item: { url: URLS.unparsable, name: "صفحة ليست إعلانًا" } },
    ],
  },
})}
</script></head><body></body></html>`;

/**
 * صفحة متدهورة: JSON-LD مفقود تمامًا.
 * تحاكي العطل الحقيقي الذي أسقط الحصيلة من ~86 عرضًا إلى 8
 * وجعل كل الأسعار "السعر حسب المصدر".
 */
export const DEGRADED_PAGE = `<!doctype html><html><body>
<a href="${URLS.complete}">عرض</a>
<a href="${URLS.noPrice}">عرض</a>
<a href="${URLS.unparsable}">من نحن</a>
</body></html>`;

/** صفحة فارغة تمامًا — لا JSON-LD ولا روابط إعلانات. */
export const EMPTY_PAGE = `<!doctype html><html><body><p>لا نتائج</p></body></html>`;

export const PAGES = {
  [BASE_URL]: HEALTHY_PAGE,
};

export const DEGRADED_PAGES = {
  [BASE_URL]: DEGRADED_PAGE,
};

export const EMPTY_PAGES = {
  [BASE_URL]: EMPTY_PAGE,
};

/** مصدر تجريبي مسموح — للاختبار فقط، لا يعكس حالة الإنتاج. */
export const GRANTED_SOURCE = Object.freeze({
  source_name: "مصدر اختباري",
  source_url: BASE_URL,
  source_type: "listing_site",
  adapter: "daleelaqar",
  permission_status: "granted",
  enabled: true,
  max_offers_per_run: 36,
  max_allowed_drop_percent: 30,
});

/** مصدر بحالة الإنتاج الفعلية: إذن غير محسوم ومعطّل. */
export const PENDING_SOURCE = Object.freeze({
  ...GRANTED_SOURCE,
  source_name: "دليل عقار",
  permission_status: "pending",
  enabled: false,
});

/** مسموح لكنه معطّل تشغيليًا. */
export const DISABLED_SOURCE = Object.freeze({
  ...GRANTED_SOURCE,
  source_name: "مصدر معطّل",
  permission_status: "granted",
  enabled: false,
});

/** مرفوض نهائيًا. */
export const DENIED_SOURCE = Object.freeze({
  ...GRANTED_SOURCE,
  source_name: "مصدر مرفوض",
  permission_status: "denied",
  enabled: true,
});
