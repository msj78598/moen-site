/**
 * التحقق من صحة العروض المُطبَّعة.
 *
 * هذا هو الحاجز الوحيد بين أي مخرَج (من محلّل حتمي أو من نموذج لغة لاحقًا)
 * وبين قاعدة البيانات. ما لا يجتاز zod لا يُكتب — بلا استثناء وبلا ترقيع.
 *
 * قاعدة الإثبات: كل عرض خارجي يجب أن يحمل مصدره (source_url + source_name).
 * عرض بلا مصدر يُرفض مهما بدا مكتملًا — لا نشر لما لا نستطيع إثباته.
 */

import { z } from "zod";
import { NO_PRICE_TEXT } from "./normalize.js";

export const REJECT_REASON = Object.freeze({
  SCHEMA: "schema_invalid",
  NO_SOURCE_URL: "missing_source_url",
  NO_TYPE: "missing_type",
  NO_LOCATION: "missing_location",
  UNTRUSTED_HOST: "host_not_allowed",
  DUPLICATE: "duplicate",
  LOW_QUALITY: "quality_below_threshold",
});

/** مخطط العرض المُطبَّع الجاهز للنشر. */
export const normalizedOfferSchema = z.object({
  type: z.string().min(2).max(120),
  type_category: z.string().nullable(),
  location: z.string().min(2).max(240),
  location_key: z.string(),
  size: z.string(),
  size_m2: z.number().positive().nullable(),
  price: z.string().min(1),
  price_amount: z.number().positive().nullable(),
  price_currency: z.string().nullable(),
  price_unit: z.enum(["total", "per_m2"]),
  source_name: z.string().min(2).max(120),
  source_url: z.string().url(),
  listing_code: z.string().optional().default(""),
  note: z.string().nullable().optional(),
  raw: z.record(z.string(), z.unknown()).optional(),
});

/**
 * يتحقق أن الرابط يعود فعلًا إلى نطاق المصدر المصرّح به.
 * يمنع تسلّل روابط من نطاق آخر عبر صفحة المصدر (إعلانات، إعادة توجيه).
 */
export function isHostAllowed(url, allowedHost) {
  if (!allowedHost) return true;
  try {
    const host = new URL(url).hostname.replace(/^www\./, "");
    const allowed = String(allowedHost).replace(/^www\./, "");
    return host === allowed || host.endsWith(`.${allowed}`);
  } catch {
    return false;
  }
}

/**
 * @returns {{ok: true, offer: object} | {ok: false, reason: string, details?: unknown}}
 */
export function validateOffer(offer, { allowedHost } = {}) {
  if (!offer?.source_url) return { ok: false, reason: REJECT_REASON.NO_SOURCE_URL };
  if (!offer?.type) return { ok: false, reason: REJECT_REASON.NO_TYPE };
  if (!offer?.location) return { ok: false, reason: REJECT_REASON.NO_LOCATION };

  if (!isHostAllowed(offer.source_url, allowedHost)) {
    return { ok: false, reason: REJECT_REASON.UNTRUSTED_HOST, details: offer.source_url };
  }

  const parsed = normalizedOfferSchema.safeParse(offer);
  if (!parsed.success) {
    return { ok: false, reason: REJECT_REASON.SCHEMA, details: parsed.error.issues };
  }

  // ضمان أخير: لا يخرج عرض بسعر فارغ أو مشوّه — يعرض النص المتفق عليه.
  const clean = { ...parsed.data };
  if (clean.price_amount === null && clean.price !== NO_PRICE_TEXT) {
    clean.price = NO_PRICE_TEXT;
  }

  return { ok: true, offer: clean };
}
