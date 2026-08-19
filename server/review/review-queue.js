/**
 * طابور المراجعة.
 *
 * الغرض: ألا تضيع أي حالة غير مؤكدة. كل ما لم يجتز حواجز النشر أو
 * التحقق يُسجَّل هنا بسببه، بدل أن يُهمل بصمت أو يُنشر على أمل.
 *
 * ===== قاعدة إلزامية =====
 * لا يتحول عنصر إلى published تلقائيًا. الترقية قرار بشري صريح،
 * ولذلك لا توجد هنا أي دالة تنشر.
 *
 * ===== التخزين =====
 * مخزنان بنفس الواجهة:
 *   memoryStore   افتراضي — يعمل الآن بلا قاعدة بيانات
 *   supabaseStore يحتاج جدول public.review_queue (ترحيلة 0009، غير مطبَّقة)
 *
 * اختيار المخزن يتم عند التشغيل، فلا يتعطل النظام بانتظار الترحيلة.
 */

import { canonicalUrl } from "../ingestion/dedupe.js";

export const REVIEW_STATUS = Object.freeze({
  PENDING: "pending",     // بانتظار مراجعة بشرية
  APPROVED: "approved",   // وافق عليه إنسان
  REJECTED: "rejected",   // رفضه إنسان
  RESOLVED: "resolved",   // عولج بطريقة أخرى
});

export const REVIEW_KIND = Object.freeze({
  INGESTION: "ingestion_review",     // عرض لم يجتز عتبة الجودة
  VERIFICATION: "verification_review", // إشارات حياة متضاربة
  ARCHIVE_BLOCKED: "archive_blocked",  // أرشفة مُنعت لجولة مشبوهة
  DUPLICATE_SUSPECT: "duplicate_suspect",
});

/**
 * يبني عنصر طابور من مخرجات الخط أو التحقق.
 * دالة نقية — العقد كامل ولا حقل مفقود.
 */
export function buildReviewItem({
  kind, source, sourceUrl, reason, qualityScore = null,
  errors = [], warnings = [], details = {}, now = new Date().toISOString(),
}) {
  return {
    kind,
    source: source ?? null,
    source_url: sourceUrl ? canonicalUrl(sourceUrl) : null,
    reason: reason ?? null,
    quality_score: qualityScore,
    errors: Array.isArray(errors) ? errors : [errors].filter(Boolean),
    warnings: Array.isArray(warnings) ? warnings : [warnings].filter(Boolean),
    details,
    status: REVIEW_STATUS.PENDING,
    decision_reason: null,
    created_at: now,
    last_attempt_at: now,
    attempts: 1,
  };
}

/** يحوّل عنصر review_required من الخط إلى عنصر طابور. */
export function fromPipelineReview(item, { source, now } = {}) {
  return buildReviewItem({
    kind: REVIEW_KIND.INGESTION,
    source,
    sourceUrl: item?.source_url,
    reason: item?.reason ?? "quality_below_threshold",
    qualityScore: item?.quality_score ?? null,
    warnings: item?.missing_fields ?? [],
    details: { type: item?.type ?? null, location: item?.location ?? null },
    now,
  });
}

/** يحوّل قرار تحقق غير حاسم إلى عنصر طابور. */
export function fromLivenessDecision(decision, { source, now } = {}) {
  return buildReviewItem({
    kind: REVIEW_KIND.VERIFICATION,
    source,
    sourceUrl: decision?.source_url,
    reason: decision?.reason ?? decision?.state,
    details: { liveness_state: decision?.state, attempts: decision?.states?.length ?? 0 },
    now,
  });
}

// ===============================================================
// المخازن
// ===============================================================

/** مخزن في الذاكرة — يعمل الآن، ولا يعتمد على أي ترحيلة. */
export function createMemoryStore() {
  const items = new Map();

  const keyOf = (item) => `${item.kind}|${item.source_url ?? item.reason}`;

  return {
    kind: "memory",

    async add(item) {
      const key = keyOf(item);
      const existing = items.get(key);
      if (existing) {
        // لا تكرار: نحدّث المحاولة بدل إنشاء عنصر جديد.
        existing.attempts += 1;
        existing.last_attempt_at = item.last_attempt_at;
        return { added: false, updated: true, item: existing };
      }
      items.set(key, { ...item });
      return { added: true, updated: false, item: items.get(key) };
    },

    async addMany(list) {
      const results = [];
      for (const item of list ?? []) results.push(await this.add(item));
      return {
        added: results.filter((r) => r.added).length,
        updated: results.filter((r) => r.updated).length,
      };
    },

    async list({ status = REVIEW_STATUS.PENDING, kind = null } = {}) {
      return [...items.values()]
        .filter((i) => (status ? i.status === status : true))
        .filter((i) => (kind ? i.kind === kind : true));
    },

    async size() {
      return items.size;
    },

    /** قرار بشري فقط — لا ترقية تلقائية إلى published. */
    async decide(key, { status, decisionReason }) {
      const item = items.get(key);
      if (!item) return { ok: false, reason: "not_found" };
      if (!Object.values(REVIEW_STATUS).includes(status)) {
        return { ok: false, reason: "invalid_status" };
      }
      item.status = status;
      item.decision_reason = decisionReason ?? null;
      return { ok: true, item };
    },

    _key: keyOf,
  };
}

/**
 * مخزن Supabase — يتطلب جدول public.review_queue.
 * يعود إلى الذاكرة تلقائيًا إن لم يكن الجدول موجودًا، فلا يتعطل النظام.
 */
export function createSupabaseStore({ db, logger, fallback = createMemoryStore() }) {
  let tableAvailable = true;

  const missing = (error) =>
    error?.code === "42P01" || error?.code === "PGRST205" ||
    /does not exist|could not find the table/i.test(error?.message ?? "");

  return {
    kind: "supabase",

    async add(item) {
      if (!tableAvailable) return fallback.add(item);
      const { error } = await db.from("review_queue").insert(item);
      if (error) {
        if (missing(error)) {
          tableAvailable = false;
          logger?.warn?.("review_queue_table_missing", {
            hint: "شغّل supabase/migrations/0009_review_queue.sql — يُستخدم مخزن الذاكرة مؤقتًا",
          });
          return fallback.add(item);
        }
        throw new Error(`تعذر إضافة عنصر مراجعة: ${error.message}`);
      }
      return { added: true, updated: false, item };
    },

    async addMany(list) {
      const results = [];
      for (const item of list ?? []) results.push(await this.add(item));
      return {
        added: results.filter((r) => r.added).length,
        updated: results.filter((r) => r.updated).length,
      };
    },

    async list(filter = {}) {
      if (!tableAvailable) return fallback.list(filter);
      let query = db.from("review_queue").select("*");
      if (filter.status) query = query.eq("status", filter.status);
      if (filter.kind) query = query.eq("kind", filter.kind);
      const { data, error } = await query;
      if (error) {
        if (missing(error)) { tableAvailable = false; return fallback.list(filter); }
        throw new Error(`تعذر قراءة طابور المراجعة: ${error.message}`);
      }
      return data ?? [];
    },

    async size() {
      return (await this.list({})).length;
    },
  };
}
