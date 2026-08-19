/**
 * خط الاستيعاب.
 *
 *   Fetch → Extract → Normalize → Validate → Deduplicate → Score → Publish/Reject
 *
 * كل مرحلة دالة نقية أو معزولة، وكلها تُختبر وحدها.
 * الخط لا يقرر متى يعمل — الجدولة تقرر. (Traditional Code = Control)
 *
 * ===== ثلاثة ضمانات =====
 *
 * 1) بوابة المصدر قبل أي شيء: لا جلب ولا اتصال لمصدر غير granted+enabled.
 *    الفحص يسبق استدعاء الجالب، فيستحيل الوصول للشبكة لمصدر ممنوع.
 *
 * 2) لا كتابة داخل الخط. المخرَج تقرير فيه ما يستحق النشر.
 *    الكتابة قرار منفصل يتخذه المستدعي، ويمر بأداة لها صلاحية وتدقيق.
 *
 * 3) فشل عرض واحد لا يُسقط الجولة. يُعزل بسببه ويستمر الباقي.
 */

import { normalizeOffer } from "./normalize.js";
import { validateOffer, REJECT_REASON } from "./validate.js";
import { dedupe } from "./dedupe.js";
import { decide, PUBLISH_THRESHOLD } from "./score.js";
import { getAdapter } from "./adapters/index.js";
import { evaluateSource } from "../sources/registry.js";

/**
 * يشغّل الخط على مصدر واحد.
 *
 * @param {object} source            صف من سجل المصادر
 * @param {object} deps
 * @param {{fetchPage: Function}} deps.fetcher
 * @param {Set<string>} [deps.knownUrls]  روابط موجودة مسبقًا في قاعدة البيانات
 * @param {number} [deps.threshold]
 * @param {object} [deps.logger]
 */
export async function runIngestion(source, {
  fetcher,
  knownUrls = new Set(),
  threshold = PUBLISH_THRESHOLD,
  logger,
} = {}) {
  const startedAt = Date.now();

  const report = {
    source: source?.source_name ?? "(بلا اسم)",
    stages: {},
    toPublish: [],
    toReview: [],
    rejected: [],
    duplicates: [],
    suspectedDuplicates: [],
    skipped: false,
    skipReason: null,
    degraded: false,
    durationMs: 0,
  };

  // ===== البوابة =====
  const verdict = evaluateSource(source);
  if (!verdict.allowed) {
    report.skipped = true;
    report.skipReason = verdict.reason;
    report.durationMs = Date.now() - startedAt;
    logger?.warn?.("ingestion_skipped", { source: report.source, reason: verdict.reason });
    return report;
  }

  const adapter = getAdapter(source.adapter);
  if (!adapter) {
    report.skipped = true;
    report.skipReason = "adapter_missing";
    report.durationMs = Date.now() - startedAt;
    return report;
  }

  // ===== 1) Fetch =====
  let page;
  try {
    page = await fetcher.fetchPage(source.source_url);
    report.stages.fetch = { ok: true, fetchedAt: page.fetchedAt, bytes: page.html?.length ?? 0 };
  } catch (error) {
    report.skipped = true;
    report.skipReason = "fetch_failed";
    report.stages.fetch = { ok: false, error: error.message };
    report.durationMs = Date.now() - startedAt;
    logger?.error?.("ingestion_fetch_failed", { source: report.source, error: error.message });
    return report;
  }

  // ===== 2) Extract =====
  const extracted = adapter.extract({ html: page.html, url: page.url });
  report.stages.extract = {
    count: extracted.offers.length,
    strategy: extracted.strategy,
    degraded: extracted.degraded,
    ...extracted.stats,
  };
  report.degraded = extracted.degraded;

  if (extracted.degraded) {
    // ليس خطأً يوقف الجولة، لكنه إشارة يجب أن تظهر: الأسعار مفقودة والدقة أقل.
    logger?.warn?.("extraction_degraded", {
      source: report.source,
      strategy: extracted.strategy,
      reason: extracted.stats?.jsonldReason,
    });
  }

  // ===== 3) Normalize + 4) Validate =====
  const validated = [];
  for (const raw of extracted.offers) {
    const normalized = normalizeOffer(raw, { sourceName: source.source_name });
    const result = validateOffer(normalized, { allowedHost: adapter.host });

    if (result.ok) {
      validated.push(result.offer);
    } else {
      report.rejected.push({
        source_url: normalized.source_url || raw?.source_url || null,
        reason: result.reason,
        details: result.details ?? null,
      });
    }
  }
  report.stages.normalizeValidate = {
    input: extracted.offers.length,
    valid: validated.length,
    rejected: report.rejected.length,
  };

  // ===== 5) Deduplicate =====
  const { unique, duplicates, suspected } = dedupe(validated, { knownUrls });
  report.duplicates = duplicates.map((d) => ({
    source_url: d.offer?.source_url ?? null,
    reason: d.reason,
  }));
  report.suspectedDuplicates = suspected.map((s) => ({
    source_url: s.offer?.source_url ?? null,
    matches: s.matches,
  }));
  report.stages.dedupe = {
    input: validated.length,
    unique: unique.length,
    duplicates: duplicates.length,
    suspected: suspected.length,
  };

  // ===== 6) Score + 7) Publish/Reject =====
  const maxPerRun = source.max_offers_per_run ?? 36;
  for (const offer of unique) {
    const verdictScore = decide(offer, { threshold });
    const enriched = {
      ...offer,
      quality_score: verdictScore.score,
      checked_at: String(page.fetchedAt).slice(0, 10),
      status: "published",
    };

    if (verdictScore.action === "publish" && report.toPublish.length < maxPerRun) {
      report.toPublish.push(enriched);
    } else if (verdictScore.action === "publish") {
      // تجاوز سقف الجولة — لا يُهمل بصمت.
      report.toReview.push({ ...enriched, status: "draft", reason: "max_offers_per_run" });
    } else {
      report.toReview.push({
        ...enriched,
        status: "draft",
        reason: verdictScore.reason,
        missing: verdictScore.missing,
      });
    }
  }
  report.stages.score = {
    publish: report.toPublish.length,
    review: report.toReview.length,
    threshold,
  };

  report.durationMs = Date.now() - startedAt;
  logger?.info?.("ingestion_complete", {
    source: report.source,
    publish: report.toPublish.length,
    review: report.toReview.length,
    rejected: report.rejected.length,
    duplicates: report.duplicates.length,
    degraded: report.degraded,
  });

  return report;
}

/** يشغّل الخط على عدة مصادر ويجمّع النتائج. */
export async function runAllSources(sources, deps = {}) {
  const reports = [];
  for (const source of sources ?? []) {
    reports.push(await runIngestion(source, deps));
  }

  return {
    reports,
    totals: {
      sources: reports.length,
      ran: reports.filter((r) => !r.skipped).length,
      skipped: reports.filter((r) => r.skipped).length,
      toPublish: reports.reduce((n, r) => n + r.toPublish.length, 0),
      toReview: reports.reduce((n, r) => n + r.toReview.length, 0),
      rejected: reports.reduce((n, r) => n + r.rejected.length, 0),
    },
  };
}

export { REJECT_REASON, PUBLISH_THRESHOLD };
