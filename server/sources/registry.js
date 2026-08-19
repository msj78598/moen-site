/**
 * سجل المصادر.
 *
 * مسؤوليته واحدة: تحميل المصادر وقراءة إعداداتها.
 * قرار "هل يُسمح بالتشغيل" ليس هنا — هو في ingestion/permission-gate.js.
 * (كان مختلطًا بهذا الملف في Sprint 2، وفُصل في Sprint 3.)
 *
 * يقرأ من جدول public.sources، ويعود إلى البذرة إن لم يكن الجدول متاحًا،
 * فيظل التطوير والاختبار ممكنين بلا قاعدة بيانات.
 */

import { SOURCE_SEED } from "./seed.js";
import {
  evaluateSource,
  selectRunnable,
  assertRunnable,
  PERMISSION,
  BLOCK_REASON,
  BLOCK_MESSAGE,
  PermissionDeniedError,
} from "../ingestion/permission-gate.js";

/** قيم افتراضية لأي حقل ناقص — مطابقة لـ DEFAULT في 0007_sources.sql. */
/** تصنيف المصادر — يُحفظ مع كل عرض ولا يُخلط بين النوعين. */
export const SOURCE_CLASS = Object.freeze({
  OFFICE: "office",                          // عروض مكتب — منشورات المكتب نفسه
  MARKETING: "marketing_brokerage",          // وساطة تسويقية — سوق خارجي
  EXTERNAL: "external",                      // غير مصنّف
});

export const SOURCE_DEFAULTS = Object.freeze({
  source_type: SOURCE_CLASS.EXTERNAL,
  permission_status: PERMISSION.PENDING,
  enabled: false,
  scrape_interval_minutes: 1440,
  max_offers_per_run: 36,
  max_allowed_drop_percent: 30,
});

/**
 * يقرأ إعدادات التشغيل لمصدر مع تطبيق الافتراضيات.
 * وجودها في مكان واحد يمنع تناثر أرقام سحرية في الخط.
 */
export function sourceConfig(source) {
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };

  return {
    source_name: source?.source_name ?? "(بلا اسم)",
    source_url: source?.source_url ?? "",
    source_type: source?.source_type ?? SOURCE_DEFAULTS.source_type,
    classification: source?.classification ?? source?.source_type ?? SOURCE_DEFAULTS.source_type,
    adapter: source?.adapter ?? null,
    permission_status: source?.permission_status ?? SOURCE_DEFAULTS.permission_status,
    enabled: source?.enabled === true,
    scrape_interval_minutes: num(
      source?.scrape_interval_minutes, SOURCE_DEFAULTS.scrape_interval_minutes
    ),
    max_offers_per_run: num(source?.max_offers_per_run, SOURCE_DEFAULTS.max_offers_per_run),
    max_allowed_drop_percent: num(
      source?.max_allowed_drop_percent, SOURCE_DEFAULTS.max_allowed_drop_percent
    ),
  };
}

/**
 * هل حان موعد فحص هذا المصدر؟
 * يُستخدم لاحقًا عند الجدولة؛ لا جدولة في Sprint 3.
 */
export function isDueForRun(source, now = new Date()) {
  const { scrape_interval_minutes } = sourceConfig(source);
  const last = source?.last_checked_at ? new Date(source.last_checked_at) : null;
  if (!last || Number.isNaN(last.getTime())) return true;
  return now - last >= scrape_interval_minutes * 60_000;
}

/**
 * يحمّل المصادر. لا يكتب شيئًا إطلاقًا.
 * @returns {{sources: object[], origin: "database"|"seed"}}
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
        hint: "شغّل supabase/migrations/0007_sources.sql — تُستخدم البذرة مؤقتًا",
      });
      return { sources: SOURCE_SEED, origin: "seed" };
    }
    throw new Error(`تعذر قراءة سجل المصادر: ${error.message}`);
  }

  // قراءة بالمفتاح العام تُرجع صفرًا لأن RLS تحصر السجل بالموظفين.
  if (!data?.length) {
    logger?.warn?.("sources_empty_or_hidden", {
      hint: "RLS تحصر sources بالموظفين — تُستخدم البذرة مؤقتًا",
    });
    return { sources: SOURCE_SEED, origin: "seed" };
  }

  return { sources: data, origin: "database" };
}

/** ملخّص للتقارير. */
export function summarize(sources, { hasAdapter } = {}) {
  return (sources ?? []).map((source) => {
    const config = sourceConfig(source);
    const verdict = evaluateSource(source, { hasAdapter });
    return {
      source_name: config.source_name,
      permission_status: config.permission_status,
      enabled: config.enabled,
      adapter: config.adapter,
      runnable: verdict.allowed,
      blocked_reason: verdict.reason,
    };
  });
}

// إعادة تصدير للتوافق: البوابة هي المصدر الوحيد لهذه الرموز.
export {
  evaluateSource, selectRunnable, assertRunnable,
  PERMISSION, BLOCK_REASON, BLOCK_MESSAGE, PermissionDeniedError,
};
