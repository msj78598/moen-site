/**
 * سجل المصادر.
 *
 * يقرأ من جدول public.sources إن وُجد، وإلا يعود إلى البذرة في seed.js.
 * هذا يجعل خط الاستيعاب قابلًا للتطوير والاختبار قبل تنفيذ الترحيل.
 *
 * ===== البوابة =====
 * لا يعمل مصدر إلا باجتماع شرطين:
 *   permission_status === 'granted'   (إذن موثّق)
 *   enabled === true                  (مفعّل تشغيليًا)
 *
 * القرار يُتخذ هنا بالكود، لا في تعليمات نموذج ولا في تعليق.
 */

import { SOURCE_SEED } from "./seed.js";

export const PERMISSION = Object.freeze({
  PENDING: "pending",
  GRANTED: "granted",
  DENIED: "denied",
});

/** سبب منع التشغيل — قيمة واحدة صريحة بدل منطق متناثر. */
export const BLOCK_REASON = Object.freeze({
  NOT_GRANTED: "permission_not_granted",
  DISABLED: "source_disabled",
  NO_ADAPTER: "adapter_missing",
  UNKNOWN_SOURCE: "unknown_source",
});

/**
 * هل يُسمح بتشغيل هذا المصدر؟
 * دالة نقية — قلب البوابة، وأكثر ما يجب أن يُختبر.
 *
 * @returns {{allowed: boolean, reason: string|null}}
 */
export function evaluateSource(source) {
  if (!source) return { allowed: false, reason: BLOCK_REASON.UNKNOWN_SOURCE };

  if (source.permission_status !== PERMISSION.GRANTED) {
    return { allowed: false, reason: BLOCK_REASON.NOT_GRANTED };
  }
  if (source.enabled !== true) {
    return { allowed: false, reason: BLOCK_REASON.DISABLED };
  }
  if (!source.adapter) {
    return { allowed: false, reason: BLOCK_REASON.NO_ADAPTER };
  }
  return { allowed: true, reason: null };
}

/** يرشّح المصادر المسموح تشغيلها فقط، مع تسجيل سبب استبعاد كل مصدر. */
export function selectRunnable(sources, { logger } = {}) {
  const runnable = [];
  const blocked = [];

  for (const source of sources ?? []) {
    const verdict = evaluateSource(source);
    if (verdict.allowed) {
      runnable.push(source);
    } else {
      blocked.push({ source_name: source?.source_name ?? "(بلا اسم)", reason: verdict.reason });
      logger?.warn?.("source_blocked", {
        source: source?.source_name,
        reason: verdict.reason,
        permission_status: source?.permission_status,
        enabled: source?.enabled,
      });
    }
  }

  return { runnable, blocked };
}

/**
 * يحمّل المصادر من قاعدة البيانات، ويعود إلى البذرة إن لم يكن الجدول موجودًا.
 * لا يكتب شيئًا إطلاقًا.
 */
export async function loadSources({ db, logger } = {}) {
  if (!db) return { sources: SOURCE_SEED, origin: "seed" };

  const { data, error } = await db.from("sources").select("*").order("source_name");

  if (error) {
    const missing =
      error.code === "42P01" ||
      error.code === "PGRST205" ||
      /does not exist|could not find the table/i.test(error.message ?? "");

    if (missing) {
      logger?.warn?.("sources_table_missing", {
        hint: "شغّل supabase/migrations/0007_sources.sql — يُستخدم seed.js مؤقتًا",
      });
      return { sources: SOURCE_SEED, origin: "seed" };
    }
    throw new Error(`تعذر قراءة سجل المصادر: ${error.message}`);
  }

  return { sources: data ?? [], origin: "database" };
}

/** ملخّص للعرض في التقارير. */
export function summarize(sources) {
  return (sources ?? []).map((s) => ({
    source_name: s.source_name,
    permission_status: s.permission_status,
    enabled: s.enabled,
    adapter: s.adapter,
    runnable: evaluateSource(s).allowed,
  }));
}
