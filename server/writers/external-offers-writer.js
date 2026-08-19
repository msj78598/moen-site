/**
 * أداة الكتابة الآمنة: publish_candidate  ->  external_offers
 *
 * ===== لماذا أداة وليست دالة =====
 * الكتابة تمر عبر طبقة الأدوات القائمة (server/core/tools.js) فترث
 * إجباريًا: التحقق من المدخلات · التحقق من الصلاحيات · التحقق من
 * المخرجات · التسجيل في سجل التدقيق · رفض أي مستدعٍ بلا هوية وكيل.
 * لا يوجد مسار التفافي: `invokeTool` هو المنفذ الوحيد.
 *
 * ===== ضمانات هذه المرحلة =====
 *   INSERT فقط. لا UPDATE ولا DELETE ولا أرشفة.
 *   لا يكتب إلا بـ service_role (server/core/db.js) — وإلا يرفض صراحةً.
 *   يشترط candidate.status === "publish_candidate".
 *   يعيد التحقق من العرض بنفسه ولا يثق بمن ناداه.
 *   يمنع التكرار بمقارنة الرابط الموحّد قبل الكتابة، وقيد UNIQUE في
 *   قاعدة البيانات هو الحاجز الأخير.
 *
 * ===== فجوة مُعلَنة =====
 * جدول external_offers لا يحوي أعمدة لـ:
 *   title · type_category · size_m2 · price_amount · price_currency
 *   · price_unit · listing_code · location_key
 * هذه البيانات تُحسب في الخط ثم تُفقد عند الكتابة. لم تُنشأ أي ترحيلة
 * لإضافتها — راجع تقرير المرحلة.
 */

import { defineTool, invokeTool, LEVEL, z } from "../core/tools.js";
import { canWrite } from "../core/db.js";
import { canonicalUrl } from "../ingestion/dedupe.js";
import { validateOffer } from "../ingestion/validate.js";
import { CANDIDATE_STATUS } from "../ingestion/pipeline.js";

/** نص يدل على غياب المساحة — كما "السعر عند التواصل" للسعر. ليس اختراعًا لقيمة. */
export const NO_SIZE_TEXT = "المساحة غير محددة";

/** الحالة المعيارية في قاعدة البيانات — ليست علامة الخط. */
const DB_STATUS_PUBLISHED = "published";

export const WRITE_REJECT = Object.freeze({
  NOT_CANDIDATE: "not_a_publish_candidate",
  INVALID: "candidate_invalid",
  DUPLICATE: "already_exists",
  NO_WRITE_CREDENTIALS: "missing_write_credentials",
  DB_ERROR: "database_error",
});

/**
 * الأعمدة الموجودة فعلًا في public.external_offers.
 * قائمة بيضاء صريحة: الحمولة تُبنى منها حصرًا، فيستحيل تسرّب أي حقل
 * داخلي (مثل علامة status أو quality_breakdown) إلى قاعدة البيانات.
 */
const WRITABLE_COLUMNS = Object.freeze([
  "type", "location", "size", "price", "note",
  "source_name", "source_url", "checked_at", "status", "quality_score",
]);

/**
 * أعمدة القيم المطبَّعة — تضيفها ترحيلة 0008.
 *
 * تُكتب فقط عند تأكيد وجودها. قبل الترحيلة تُهمَل بصمت بدل أن تُفشل
 * الإدراج بخطأ "عمود غير موجود"، فيعمل النظام قبل الترحيلة وبعدها.
 */
const EXTENDED_COLUMNS = Object.freeze([
  "title", "type_category", "location_key", "size_m2",
  "price_amount", "price_currency", "price_unit", "listing_code",
]);

/**
 * يفحص مرة واحدة هل طُبّقت ترحيلة 0008.
 * القراءة رخيصة والنتيجة تُخبّأ في السياق.
 */
export async function detectExtendedColumns(db) {
  if (!db) return false;
  const { error } = await db.from("external_offers").select("price_amount").limit(1);
  if (!error) return true;
  const missingColumn =
    error.code === "42703" || error.code === "PGRST204" ||
    /column .* does not exist/i.test(error.message ?? "");
  if (missingColumn) return false;
  return false;
}

const candidateSchema = z.object({
  status: z.literal(CANDIDATE_STATUS.PUBLISH),
  type: z.string().min(2),
  location: z.string().min(2),
  source_url: z.string().url(),
  source_name: z.string().min(2),
  quality_score: z.number().int().min(0).max(100),
  checked_at: z.string().min(8),
}).passthrough();

/**
 * يحوّل مرشحًا إلى صف جاهز للإدراج.
 * دالة نقية ومُصدَّرة ليُختبر أن العلامة الداخلية لا تصل لقاعدة البيانات.
 */
export function buildRow(candidate, { extended = false } = {}) {
  const row = {
    type: candidate.type,
    location: candidate.location,
    size: candidate.size?.trim() ? candidate.size : NO_SIZE_TEXT,
    price: candidate.price,
    note: candidate.note ?? null,
    source_name: candidate.source_name,
    source_url: canonicalUrl(candidate.source_url),
    checked_at: candidate.checked_at,
    quality_score: candidate.quality_score,
    // تُضبط هنا صراحةً. علامة الخط "publish_candidate" لا تُنسخ أبدًا.
    status: DB_STATUS_PUBLISHED,
  };

  if (extended) {
    row.title = candidate.title ?? null;
    row.type_category = candidate.type_category ?? null;
    row.location_key = candidate.location_key ?? null;
    row.size_m2 = candidate.size_m2 ?? null;
    row.price_amount = candidate.price_amount ?? null;
    row.price_currency = candidate.price_currency ?? null;
    row.price_unit = candidate.price_unit ?? null;
    row.listing_code = candidate.listing_code || null;
  }

  // حارس بنيوي: لا مفتاح خارج القوائم البيضاء.
  const allowed = extended ? [...WRITABLE_COLUMNS, ...EXTENDED_COLUMNS] : WRITABLE_COLUMNS;
  for (const key of Object.keys(row)) {
    if (!allowed.includes(key)) delete row[key];
  }
  return row;
}

/** فحص المرشح قبل أي لمس لقاعدة البيانات. */
export function screenCandidate(candidate, { allowedHost } = {}) {
  const parsed = candidateSchema.safeParse(candidate);
  if (!parsed.success) {
    const wrongStatus = parsed.error.issues.some((i) => i.path[0] === "status");
    return {
      ok: false,
      reason: wrongStatus ? WRITE_REJECT.NOT_CANDIDATE : WRITE_REJECT.INVALID,
      details: parsed.error.issues,
    };
  }

  // إعادة تحقق كاملة: الكاتب لا يثق بمن ناداه حتى لو كان الخط نفسه.
  const revalidated = validateOffer(candidate, { allowedHost });
  if (!revalidated.ok) {
    return { ok: false, reason: WRITE_REJECT.INVALID, details: revalidated.reason };
  }

  return { ok: true };
}

// ===============================================================
// الأداة
// ===============================================================

export const publishExternalOffer = defineTool({
  name: "publish_external_offer",
  description: "يُدرج عرضًا خارجيًا واحدًا في external_offers. إدراج فقط، بلا تعديل أو حذف.",
  level: LEVEL.PUBLISH,
  capability: "write_external_offers",
  writes: true,

  input: z.object({
    candidate: z.record(z.string(), z.unknown()),
    allowedHost: z.string().optional(),
    knownUrls: z.array(z.string()).optional(),
  }),

  output: z.object({
    written: z.boolean(),
    reason: z.string().nullable(),
    source_url: z.string().nullable(),
  }),

  async handler({ candidate, allowedHost, knownUrls = [] }, ctx) {
    const { db } = ctx;

    // 1) لا كتابة بلا صلاحية حقيقية. المفتاح العام لا يكفي.
    //
    // القدرة تُحقن من السياق وتعود افتراضيًا إلى canWrite الحقيقية.
    // السبب: config مجمّد وقت الاستيراد، فلا يمكن اختبار الحارس بضبط
    // متغيّر بيئة لاحقًا. الحقن يجعل الحارس قابلًا للإثبات في الاتجاهين.
    const writeAllowed = ctx.canWrite ?? canWrite;
    if (!writeAllowed()) {
      return { written: false, reason: WRITE_REJECT.NO_WRITE_CREDENTIALS, source_url: null };
    }

    // 2) فحص المرشح
    const screened = screenCandidate(candidate, { allowedHost });
    if (!screened.ok) {
      return { written: false, reason: screened.reason, source_url: candidate?.source_url ?? null };
    }

    const row = buildRow(candidate, { extended: Boolean(ctx.extendedColumns) });

    // 3) منع التكرار بالرابط الموحّد — قبل الكتابة
    const known = new Set(knownUrls.map(canonicalUrl));
    if (known.has(row.source_url)) {
      return { written: false, reason: WRITE_REJECT.DUPLICATE, source_url: row.source_url };
    }

    const { data: existing, error: lookupError } = await db
      .from("external_offers")
      .select("id")
      .eq("source_url", row.source_url)
      .maybeSingle();

    if (lookupError) {
      throw new Error(`تعذر فحص التكرار: ${lookupError.message}`);
    }
    if (existing) {
      return { written: false, reason: WRITE_REJECT.DUPLICATE, source_url: row.source_url };
    }

    // 4) الإدراج — INSERT فقط
    const { error } = await db.from("external_offers").insert(row);

    if (error) {
      // 23505 = انتهاك القيد الفريد: سباق أدرج نفس الرابط بيننا. ليس فشلًا.
      if (error.code === "23505") {
        return { written: false, reason: WRITE_REJECT.DUPLICATE, source_url: row.source_url };
      }
      // الفشل يُرمى ليُسجَّل في سجل التدقيق كـ failure ولا يُعتبر نجاحًا.
      throw new Error(`فشل إدراج العرض: ${error.message}`);
    }

    return { written: true, reason: null, source_url: row.source_url };
  },
});

// ===============================================================
// المنسّق: دفعة مرشحين
// ===============================================================

/**
 * ينشر دفعة من المرشحين عبر الأداة.
 *
 * لا يستقبل عميل قاعدة بيانات مباشرة — يمر بـ invokeTool الذي يفرض
 * هوية الوكيل والصلاحيات والتدقيق. استدعاؤه بلا ctx.agent يفشل.
 *
 * @returns {{written: object[], skipped: object[], failed: object[], counts: object}}
 */
export async function publishCandidates(candidates, ctx, { allowedHost } = {}) {
  const written = [];
  const skipped = [];
  const failed = [];

  // قراءة واحدة لروابط الجدول لتقليل الاستعلامات داخل الحلقة.
  let knownUrls = [];
  if (ctx?.db) {
    const { data, error } = await ctx.db.from("external_offers").select("source_url");
    if (error) throw new Error(`تعذر قراءة الروابط الموجودة: ${error.message}`);
    knownUrls = (data ?? []).map((r) => r.source_url);
  }

  for (const candidate of candidates ?? []) {
    try {
      const result = await invokeTool(
        "publish_external_offer",
        { candidate, allowedHost, knownUrls },
        ctx
      );

      if (result?.written) {
        written.push(result.source_url);
        knownUrls.push(result.source_url); // يمنع التكرار داخل نفس الدفعة
      } else if (result?.skipped) {
        skipped.push({ source_url: candidate?.source_url ?? null, reason: "dry_run" });
      } else {
        skipped.push({ source_url: result?.source_url ?? null, reason: result?.reason ?? "unknown" });
      }
    } catch (error) {
      // فشل عرض لا يُسقط الدفعة، ولا يُحسب نجاحًا.
      failed.push({ source_url: candidate?.source_url ?? null, error: error.message });
    }
  }

  return {
    written,
    skipped,
    failed,
    counts: { written: written.length, skipped: skipped.length, failed: failed.length },
  };
}
