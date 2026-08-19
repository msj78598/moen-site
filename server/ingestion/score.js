/**
 * درجة الجودة.
 *
 * سبب وجود هذا الملف: السكربت القديم كان يكتب quality_score = 85 ثابتًا
 * لكل عرض (scripts/update-external-offers.mjs:176) — رقم بلا أي معنى،
 * لا يفرّق بين عرض كامل البيانات وعرض بلا سعر ولا مساحة.
 *
 * الدرجة هنا محسوبة من إشارات حقيقية وقابلة للتفسير: كل عرض يحمل
 * تفصيل نقاطه، فيمكن معرفة سبب رفضه بلا تخمين.
 */

/** أوزان مجموعها 100. */
const WEIGHTS = Object.freeze({
  hasSourceUrl: 20,   // إثبات المصدر — أهم عنصر
  hasType: 15,
  hasCategory: 10,    // صُنّف بنجاح ضمن الأنواع المعروفة
  hasLocation: 15,
  locationDetail: 10, // أكثر من مقطع (مدينة + حي)
  hasSize: 15,
  hasPrice: 10,
  hasListingCode: 5,
});

/**
 * الحد الأدنى للنشر التلقائي. ما دونه يذهب للمراجعة لا للنشر.
 *
 * 65 مُعايَرة على حالات حقيقية:
 *   مصدر+نوع+تصنيف+موقع بلا مساحة وبلا سعر = 60  -> مراجعة (شبه فارغ)
 *   نفسه + مساحة                            = 75  -> نشر
 *   نفسه + سعر بلا مساحة                    = 70  -> نشر
 * أي أن غياب السعر وحده لا يمنع النشر، لكن غياب المساحة والسعر معًا يمنعه.
 */
export const PUBLISH_THRESHOLD = 65;

/**
 * @returns {{score: number, breakdown: object, missing: string[]}}
 */
export function scoreOffer(offer) {
  const breakdown = {};
  const missing = [];

  const award = (key, condition) => {
    breakdown[key] = condition ? WEIGHTS[key] : 0;
    if (!condition) missing.push(key);
  };

  award("hasSourceUrl", Boolean(offer?.source_url));
  award("hasType", Boolean(offer?.type));
  award("hasCategory", Boolean(offer?.type_category));
  award("hasLocation", Boolean(offer?.location));
  award("locationDetail", (offer?.location_key?.split("|").filter(Boolean).length ?? 0) >= 2);
  award("hasSize", offer?.size_m2 != null && offer.size_m2 > 0);
  award("hasPrice", offer?.price_amount != null && offer.price_amount > 0);
  award("hasListingCode", Boolean(offer?.listing_code));

  const score = Object.values(breakdown).reduce((sum, v) => sum + v, 0);
  return { score, breakdown, missing };
}

/**
 * القرار النهائي.
 *
 * ملاحظة مقصودة: غياب السعر وحده لا يمنع النشر — كثير من الإعلانات
 * العقارية الحقيقية بلا سعر معلن، وعرضها بـ"السعر عند التواصل" سلوك
 * صادق. الذي يمنع النشر هو نقص ما يُثبت العرض: المصدر والنوع والموقع.
 */
export function decide(offer, { threshold = PUBLISH_THRESHOLD } = {}) {
  const { score, breakdown, missing } = scoreOffer(offer);

  if (score >= threshold) {
    return { action: "publish", score, breakdown, missing };
  }
  return { action: "review", score, breakdown, missing, reason: "quality_below_threshold" };
}
