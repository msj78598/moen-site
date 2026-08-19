/**
 * أداة الأرشفة الآمنة.
 *
 * ===== ثلاث بوابات قبل أي أرشفة =====
 *   1) حارس الجولة الناقصة (archive-guard) — يُمنع الكل إن هبطت الحصيلة.
 *   2) قرار الحياة (liveness) — لا أرشفة إلا بحالة قاطعة مؤكَّدة مرتين.
 *   3) سقف الدفعة — لا تُؤرشف نسبة كبيرة من المنشور في جولة واحدة.
 *
 * ===== ما لا تفعله =====
 * لا DELETE إطلاقًا. الأرشفة تحديث `status` إلى 'archived' فقط،
 * وقابلة للعكس بتحديث معاكس.
 *
 * جدول external_offers لا يحوي عمود deleted_at (تحققنا من الإنتاج)،
 * فالأرشفة هنا تعتمد على status وحده.
 */

import { defineTool, invokeTool, LEVEL, z } from "../core/tools.js";
import { canWrite } from "../core/db.js";
import { canonicalUrl } from "../ingestion/dedupe.js";
import { assertArchiveAllowed, ArchiveBlockedError } from "../ingestion/archive-guard.js";
import { LIVENESS } from "../verification/liveness.js";

export const ARCHIVE_REJECT = Object.freeze({
  NOT_ARCHIVABLE: "liveness_not_archivable",
  RUN_SUSPICIOUS: "run_integrity_blocked",
  BATCH_LIMIT: "batch_limit_exceeded",
  NO_WRITE_CREDENTIALS: "missing_write_credentials",
  NOT_FOUND: "offer_not_found",
});

/**
 * أقصى نسبة من العروض المنشورة يجوز أرشفتها في جولة واحدة.
 * حاجز مستقل عن حارس الجولة: حتى لو كانت الجولة سليمة، أرشفة نصف
 * المخزون دفعة واحدة إشارة عطل لا عملية صيانة.
 */
export const MAX_BATCH_ARCHIVE_PERCENT = 20;

export const archiveExternalOffer = defineTool({
  name: "archive_external_offer",
  description: "يؤرشف عرضًا خارجيًا واحدًا (status -> archived). لا حذف ولا تعديل لبقية الحقول.",
  level: LEVEL.EXECUTE,
  capability: "archive",
  writes: true,

  input: z.object({
    source_url: z.string().url(),
    liveness_state: z.enum([
      LIVENESS.EXPIRED, LIVENESS.UNAVAILABLE, LIVENESS.ACTIVE,
      LIVENESS.CHECK_FAILED, LIVENESS.REVIEW_REQUIRED,
    ]),
    reason: z.string().max(300),
  }),

  output: z.object({
    archived: z.boolean(),
    reason: z.string().nullable(),
    source_url: z.string(),
  }),

  async handler({ source_url, liveness_state, reason }, ctx) {
    const writeAllowed = ctx.canWrite ?? canWrite;
    if (!writeAllowed()) {
      return { archived: false, reason: ARCHIVE_REJECT.NO_WRITE_CREDENTIALS, source_url };
    }

    // الحالة غير القاطعة لا تُؤرشف مهما تكرر الفحص.
    if (liveness_state !== LIVENESS.EXPIRED && liveness_state !== LIVENESS.UNAVAILABLE) {
      return { archived: false, reason: ARCHIVE_REJECT.NOT_ARCHIVABLE, source_url };
    }

    const url = canonicalUrl(source_url);

    // تحديث الحالة فقط — لا لمس لأي حقل آخر ولا حذف.
    const { data, error } = await ctx.db
      .from("external_offers")
      .update({ status: "archived", updated_at: new Date().toISOString() })
      .eq("source_url", url)
      .eq("status", "published")
      .select("id")
      .maybeSingle();

    if (error) throw new Error(`فشل أرشفة العرض: ${error.message}`);

    // رفض RLS يظهر كنجاح بصفر صفوف — لا نعتبره أرشفة.
    if (!data) return { archived: false, reason: ARCHIVE_REJECT.NOT_FOUND, source_url: url };

    ctx.logger?.info?.("offer_archived", { source_url: url, liveness_state, reason });
    return { archived: true, reason: null, source_url: url };
  },
});

/**
 * يؤرشف دفعة بعد اجتياز كل البوابات.
 *
 * @param {object[]} decisions مخرجات checkOffer
 * @param {object} ctx
 * @param {object} options
 * @param {object} options.runIntegrity  حكم archive-guard للجولة
 * @param {number} options.publishedCount عدد المنشور حاليًا — لحساب سقف الدفعة
 */
export async function archiveDecided(decisions, ctx, {
  runIntegrity,
  publishedCount = 0,
  maxBatchPercent = MAX_BATCH_ARCHIVE_PERCENT,
} = {}) {
  const archived = [];
  const skipped = [];
  const failed = [];

  // ===== البوابة 1: حارس الجولة الناقصة =====
  try {
    assertArchiveAllowed(runIntegrity);
  } catch (error) {
    if (!(error instanceof ArchiveBlockedError)) throw error;
    ctx.logger?.error?.("archive_blocked_by_guard", {
      reason: runIntegrity?.status ?? "missing_verdict",
      drop_percent: runIntegrity?.drop_percent ?? null,
    });
    return {
      archived: [], failed: [],
      skipped: (decisions ?? []).map((d) => ({
        source_url: d.source_url, reason: ARCHIVE_REJECT.RUN_SUSPICIOUS,
      })),
      blocked: true,
      blocked_reason: runIntegrity?.status ?? "missing_verdict",
      counts: { archived: 0, skipped: decisions?.length ?? 0, failed: 0 },
    };
  }

  // ===== البوابة 2: الحالات القاطعة فقط =====
  const archivable = (decisions ?? []).filter((d) => d.archivable);
  for (const d of decisions ?? []) {
    if (!d.archivable) {
      skipped.push({ source_url: d.source_url, reason: d.state });
    }
  }

  // ===== البوابة 3: سقف الدفعة =====
  const limit = publishedCount > 0
    ? Math.max(1, Math.floor((publishedCount * maxBatchPercent) / 100))
    : archivable.length;

  if (archivable.length > limit) {
    ctx.logger?.error?.("archive_batch_limit", {
      requested: archivable.length, limit, published: publishedCount,
    });
    return {
      archived: [], failed: [],
      skipped: archivable.map((d) => ({
        source_url: d.source_url, reason: ARCHIVE_REJECT.BATCH_LIMIT,
      })).concat(skipped),
      blocked: true,
      blocked_reason: ARCHIVE_REJECT.BATCH_LIMIT,
      counts: { archived: 0, skipped: (decisions?.length ?? 0), failed: 0 },
    };
  }

  for (const decision of archivable) {
    try {
      const result = await invokeTool("archive_external_offer", {
        source_url: decision.source_url,
        liveness_state: decision.state,
        reason: decision.reason ?? decision.state,
      }, ctx);

      if (result?.archived) archived.push(result.source_url);
      else if (result?.skipped) skipped.push({ source_url: decision.source_url, reason: "dry_run" });
      else skipped.push({ source_url: decision.source_url, reason: result?.reason ?? "unknown" });
    } catch (error) {
      failed.push({ source_url: decision.source_url, error: error.message });
    }
  }

  return {
    archived, skipped, failed, blocked: false, blocked_reason: null,
    counts: { archived: archived.length, skipped: skipped.length, failed: failed.length },
  };
}
