/**
 * خط الاستيعاب.
 *
 *   Permission Gate → Fetch → Extract → Normalize → Validate
 *                   → Dedupe → Score → Report
 *
 * الجدولة تقرر متى يعمل؛ الخط ينفّذ فقط. (Traditional Code = Control)
 *
 * ===== ثلاثة ضمانات =====
 *
 * 1) البوابة طبقة مستقلة (permission-gate.js) وتُستدعى قبل الجالب،
 *    فيستحيل الاتصال بمصدر غير مصرّح. مغطّى باختبار يتحقق أن الجالب
 *    لم يُستدعَ أصلًا.
 *
 * 2) لا كتابة على قاعدة البيانات إطلاقًا. المخرَج تقرير فقط، وقرار
 *    النشر يتخذه المستدعي عبر أداة لها صلاحية وتدقيق.
 *
 * 3) فشل مصدر لا يُسقط النظام: تُعاد حالة failed مع خطأ منظّم.
 */

import { normalizeOffer } from "./normalize.js";
import { validateOffer, REJECT_REASON } from "./validate.js";
import { dedupe } from "./dedupe.js";
import { decide, PUBLISH_THRESHOLD } from "./score.js";
import { getAdapter } from "./adapters/index.js";
import { evaluateSource } from "./permission-gate.js";
import { sourceConfig } from "../sources/registry.js";
import { evaluateRunIntegrity, RUN_INTEGRITY } from "./archive-guard.js";

export const RUN_STATUS = Object.freeze({
  COMPLETED: "completed",
  SKIPPED: "skipped",
  FAILED: "failed",
  // الجولة جلبت نتائج لكن حصيلتها هبطت هبوطًا غير منطقي.
  // النشر يبقى مسموحًا؛ الأرشفة تُمنع. راجع archive-guard.js
  SUSPICIOUS: "suspicious",
});

/**
 * علامة قرار الخط على كل عرض.
 *
 * ⚠️ تنبيه للصيانة: الاسم `status` يشبه عمود external_offers.status
 * (published | draft | archived | rejected) لكنه ليس هو. هذه علامة
 * داخلية لمخرجات الخط، ولا تُكتب في قاعدة البيانات أبدًا: الكاتب يبني
 * حمولته من قائمة أعمدة صريحة ولا ينشر الكائن كما هو.
 */
export const CANDIDATE_STATUS = Object.freeze({
  PUBLISH: "publish_candidate",
  REVIEW: "review_required",
});

export const ERROR_CODE = Object.freeze({
  PERMISSION: "permission_denied",
  ADAPTER: "adapter_missing",
  FETCH: "fetch_failed",
  EXTRACT: "extract_failed",
  UNEXPECTED: "unexpected_error",
});

/** يبني هيكل التقرير الفارغ — عقد ثابت لا يتغيّر شكله بين المسارات. */
function emptyReport(source, startedAt) {
  return {
    source: source?.source_name ?? "(بلا اسم)",
    status: RUN_STATUS.COMPLETED,
    started_at: startedAt,
    completed_at: null,
    duration_ms: 0,

    fetched_count: 0,
    valid_count: 0,
    invalid_count: 0,
    duplicate_count: 0,

    publish_candidates: [],
    review_required: [],

    degraded: false,
    errors: [],

    // حكم سلامة الجولة — يقرر هل يُسمح بالأرشفة. راجع archive-guard.js
    run_integrity: null,

    // تفاصيل تشخيصية إضافية — خارج العقد الأساسي
    details: {
      stages: {},
      rejected: [],
      duplicates: [],
      suspected_duplicates: [],
    },
  };
}

function finish(report, clock) {
  report.completed_at = clock();
  report.duration_ms = Date.parse(report.completed_at) - Date.parse(report.started_at);
  return report;
}

/**
 * يشغّل الخط على مصدر واحد.
 *
 * @param {object} source  صف من سجل المصادر
 * @param {object} options
 * @param {{fetchPage: Function}} options.fetcher
 * @param {Set<string>} [options.knownUrls]  روابط موجودة مسبقًا في قاعدة البيانات
 * @param {number} [options.threshold]
 * @param {object} [options.logger]
 * @param {() => string} [options.clock]  حقن الوقت ليكون التقرير قابلًا للاختبار
 */
export async function runIngestion(source, {
  fetcher,
  knownUrls = new Set(),
  threshold = PUBLISH_THRESHOLD,
  logger,
  clock = () => new Date().toISOString(),
} = {}) {
  const report = emptyReport(source, clock());
  const config = sourceConfig(source);

  // ===== 1) بوابة الإذن — قبل أي شيء يلمس الشبكة =====
  const verdict = evaluateSource(source, { hasAdapter: (name) => Boolean(getAdapter(name)) });
  if (!verdict.allowed) {
    report.status = RUN_STATUS.SKIPPED;
    report.errors.push({
      code: verdict.reason === ERROR_CODE.ADAPTER ? ERROR_CODE.ADAPTER : ERROR_CODE.PERMISSION,
      reason: verdict.reason,
      message: verdict.message,
      source: report.source,
    });
    logger?.warn?.("ingestion_skipped", { source: report.source, reason: verdict.reason });
    return finish(report, clock);
  }

  const adapter = getAdapter(config.adapter);

  try {
    // ===== 2) Fetch =====
    let page;
    try {
      page = await fetcher.fetchPage(config.source_url);
      report.details.stages.fetch = {
        ok: true, fetched_at: page.fetchedAt, bytes: page.html?.length ?? 0,
      };
    } catch (error) {
      report.status = RUN_STATUS.FAILED;
      report.details.stages.fetch = { ok: false };
      report.errors.push({
        code: ERROR_CODE.FETCH, message: error.message, source: report.source,
      });
      logger?.error?.("ingestion_fetch_failed", { source: report.source, error: error.message });
      return finish(report, clock);
    }

    // ===== 3) Extract =====
    let extracted;
    try {
      extracted = adapter.extract({ html: page.html, url: page.url });
    } catch (error) {
      report.status = RUN_STATUS.FAILED;
      report.errors.push({
        code: ERROR_CODE.EXTRACT, message: error.message, source: report.source,
      });
      return finish(report, clock);
    }

    report.fetched_count = extracted.offers.length;
    report.degraded = Boolean(extracted.degraded);
    report.details.stages.extract = {
      count: extracted.offers.length,
      strategy: extracted.strategy,
      degraded: extracted.degraded,
      ...extracted.stats,
    };

    // التدهور ليس خطأ يوقف الجولة، لكنه إشارة يجب أن تظهر:
    // الأسعار والعناوين تختفي والدقة تنخفض. البيانات تكمل إلى التحقق.
    if (extracted.degraded) {
      logger?.warn?.("extraction_degraded", {
        source: report.source,
        strategy: extracted.strategy,
        reason: extracted.stats?.jsonldReason,
      });
    }

    // ===== 4) Normalize + 5) Validate =====
    const validated = [];
    for (const raw of extracted.offers) {
      const normalized = normalizeOffer(raw, { sourceName: config.source_name });
      const result = validateOffer(normalized, { allowedHost: adapter.host });

      if (result.ok) {
        validated.push(result.offer);
      } else {
        report.details.rejected.push({
          source_url: normalized.source_url || raw?.source_url || null,
          reason: result.reason,
          details: result.details ?? null,
        });
      }
    }
    report.valid_count = validated.length;
    report.invalid_count = report.details.rejected.length;
    report.details.stages.validate = {
      input: extracted.offers.length,
      valid: report.valid_count,
      invalid: report.invalid_count,
    };

    // ===== 6) Deduplicate =====
    const { unique, duplicates, suspected } = dedupe(validated, { knownUrls });
    report.duplicate_count = duplicates.length;
    report.details.duplicates = duplicates.map((d) => ({
      source_url: d.offer?.source_url ?? null, reason: d.reason,
    }));
    report.details.suspected_duplicates = suspected.map((s) => ({
      source_url: s.offer?.source_url ?? null, matches: s.matches,
    }));
    report.details.stages.dedupe = {
      input: validated.length, unique: unique.length, duplicates: duplicates.length,
      suspected: suspected.length,
    };

    // ===== 7) Score =====
    for (const offer of unique) {
      const scored = decide(offer, { threshold });
      const enriched = {
        ...offer,
        quality_score: scored.score,
        quality_breakdown: scored.breakdown,
        missing_fields: scored.missing,
        checked_at: String(page.fetchedAt).slice(0, 10),
      };

      if (scored.action === "publish" && report.publish_candidates.length < config.max_offers_per_run) {
        report.publish_candidates.push({ ...enriched, status: CANDIDATE_STATUS.PUBLISH });
      } else if (scored.action === "publish") {
        // تجاوز سقف الجولة — لا يُهمل بصمت.
        report.review_required.push({
          ...enriched, status: CANDIDATE_STATUS.REVIEW, reason: "max_offers_per_run",
        });
      } else {
        report.review_required.push({
          ...enriched, status: CANDIDATE_STATUS.REVIEW, reason: scored.reason,
        });
      }
    }
    report.details.stages.score = {
      publish: report.publish_candidates.length,
      review: report.review_required.length,
      threshold,
    };

    // ===== 8) حارس الأرشفة =====
    //
    // المقارنة على fetched_count لا على publish_candidates: انهيار
    // الاستخراج يظهر في عدد ما وصل من المصدر، بينما عدد المرشحين
    // يتأثر أيضًا بالتكرار وسقف الجولة فيربك الإشارة.
    report.run_integrity = evaluateRunIntegrity({
      previousCount: source?.last_offer_count ?? null,
      currentCount: report.fetched_count,
      maxAllowedDropPercent: config.max_allowed_drop_percent,
    });

    if (report.run_integrity.status === RUN_INTEGRITY.SUSPICIOUS) {
      report.status = RUN_STATUS.SUSPICIOUS;
      logger?.error?.("run_suspicious", {
        source: report.source,
        previous: report.run_integrity.previous_count,
        current: report.run_integrity.current_count,
        drop_percent: report.run_integrity.drop_percent,
        threshold: report.run_integrity.threshold,
        impact: "الأرشفة ممنوعة لهذه الجولة. النشر غير متأثر.",
      });
    }

    logger?.info?.("ingestion_complete", {
      source: report.source,
      fetched: report.fetched_count,
      publish: report.publish_candidates.length,
      review: report.review_required.length,
      invalid: report.invalid_count,
      duplicates: report.duplicate_count,
      degraded: report.degraded,
    });

    return finish(report, clock);
  } catch (error) {
    // شبكة أمان: أي عطل غير متوقع يُعزل ولا يُسقط بقية المصادر.
    report.status = RUN_STATUS.FAILED;
    report.errors.push({
      code: ERROR_CODE.UNEXPECTED, message: error.message, source: report.source,
    });
    logger?.error?.("ingestion_unexpected_error", {
      source: report.source, error: error.message,
    });
    return finish(report, clock);
  }
}

/** يشغّل الخط على عدة مصادر. فشل مصدر لا يمنع البقية. */
export async function runAllSources(sources, options = {}) {
  const reports = [];
  for (const source of sources ?? []) {
    reports.push(await runIngestion(source, options));
  }

  const sum = (key) => reports.reduce((n, r) => n + (r[key] ?? 0), 0);

  return {
    reports,
    totals: {
      sources: reports.length,
      completed: reports.filter((r) => r.status === RUN_STATUS.COMPLETED).length,
      skipped: reports.filter((r) => r.status === RUN_STATUS.SKIPPED).length,
      failed: reports.filter((r) => r.status === RUN_STATUS.FAILED).length,
      fetched_count: sum("fetched_count"),
      valid_count: sum("valid_count"),
      invalid_count: sum("invalid_count"),
      duplicate_count: sum("duplicate_count"),
      publish_candidates: reports.reduce((n, r) => n + r.publish_candidates.length, 0),
      review_required: reports.reduce((n, r) => n + r.review_required.length, 0),
      errors: reports.flatMap((r) => r.errors),
    },
  };
}

export { REJECT_REASON, PUBLISH_THRESHOLD };
