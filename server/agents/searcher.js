/**
 * وكيل البحث والاستيعاب.
 *
 * Identity:        searcher
 * Purpose:         يشغّل خط الاستيعاب على المصادر المسموحة ويُخرج مرشحين.
 * Level:           2 (اقتراح — لا يكتب في قاعدة البيانات إطلاقًا)
 * Allowed Tools:   search_external_offers (لقراءة الروابط الموجودة فقط)
 * Forbidden Tools: publish_external_offer · archive_external_offer
 * Failure Policy:  continue — عزل كل مصدر عن الآخر
 * Retry Policy:    محاولة واحدة لكل جولة
 * LLM:             لا يستخدمه
 *
 * ===== العزل =====
 * كل مصدر يُشغَّل في محاولة مستقلة. فشل مصدر A لا يمنع مصدر B، وفشل
 * إعلان واحد لا يُسقط الجولة — الخط نفسه يعزل ذلك داخليًا.
 */

import { z } from "zod";
import { defineAgent, LEVEL } from "../core/agent.js";
import { runIngestion, RUN_STATUS } from "../ingestion/pipeline.js";
import { selectRunnable } from "../ingestion/permission-gate.js";
import { getAdapter } from "../ingestion/adapters/index.js";
import { sourceConfig, isDueForRun } from "../sources/registry.js";
import { fromPipelineReview } from "../review/review-queue.js";

import "../tools/read-tools.js";

export const searcherAgent = defineAgent({
  name: "searcher",
  purpose: "يشغّل الاستيعاب على المصادر المسموحة المستحقة ويُخرج مرشحين ومراجعات.",
  level: LEVEL.SUGGEST,
  usesLLM: false,

  allowedTools: ["search_external_offers"],
  forbiddenTools: ["publish_external_offer", "archive_external_offer"],

  inputSchema: z.object({
    sources: z.array(z.record(z.string(), z.unknown())).default([]),
    respectSchedule: z.boolean().default(true),
    now: z.string().optional(),
  }),

  outputSchema: z.object({
    reports: z.array(z.record(z.string(), z.unknown())),
    publish_candidates: z.array(z.record(z.string(), z.unknown())),
    review_items: z.array(z.record(z.string(), z.unknown())),
    blocked_sources: z.array(z.record(z.string(), z.unknown())),
    counts: z.record(z.string(), z.number()),
  }),

  failurePolicy: { onError: "continue", maxConsecutiveFailures: 5 },
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },

  async run({ sources, respectSchedule, now }, ctx) {
    const clockNow = now ? new Date(now) : new Date();

    // ===== بوابة الإذن — قبل أي شيء =====
    const { runnable, blocked } = selectRunnable(sources, {
      hasAdapter: (name) => Boolean(getAdapter(name)),
      logger: ctx.logger,
    });

    // ===== الجدولة =====
    const due = respectSchedule
      ? runnable.filter((s) => isDueForRun(s, clockNow))
      : runnable;

    const notDue = runnable.length - due.length;

    // ===== الروابط الموجودة — لمنع إعادة إدراج ما هو منشور =====
    let knownUrls = new Set();
    try {
      const existing = await ctx.tool("search_external_offers", { status: "any", limit: 500 });
      knownUrls = new Set(existing.rows.map((r) => r.source_url).filter(Boolean));
    } catch (error) {
      // قراءة الروابط ليست حرجة: غيابها يعني اعتماد أكبر على قيد UNIQUE.
      ctx.logger?.warn?.("known_urls_unavailable", { error: error.message });
    }

    const reports = [];
    const publishCandidates = [];
    const reviewItems = [];

    for (const source of due) {
      const config = sourceConfig(source);
      try {
        const report = await runIngestion(source, {
          fetcher: ctx.fetcher,
          knownUrls,
          logger: ctx.logger,
        });
        reports.push(report);

        publishCandidates.push(...report.publish_candidates);
        reviewItems.push(
          ...report.review_required.map((item) =>
            fromPipelineReview(item, { source: config.source_name })
          )
        );

        // منع التكرار عبر المصادر داخل نفس الجولة
        for (const candidate of report.publish_candidates) knownUrls.add(candidate.source_url);
      } catch (error) {
        // عزل: عطل مصدر لا يوقف البقية.
        ctx.logger?.error?.("source_isolated_failure", {
          source: config.source_name, error: error.message,
        });
        reports.push({
          source: config.source_name, status: RUN_STATUS.FAILED,
          errors: [{ code: "unexpected_error", message: error.message }],
          publish_candidates: [], review_required: [],
        });
      }
    }

    return {
      reports,
      publish_candidates: publishCandidates,
      review_items: reviewItems,
      blocked_sources: blocked,
      counts: {
        sources_total: sources.length,
        runnable: runnable.length,
        not_due: notDue,
        ran: due.length,
        blocked: blocked.length,
        publish_candidates: publishCandidates.length,
        review_items: reviewItems.length,
        suspicious: reports.filter((r) => r.status === RUN_STATUS.SUSPICIOUS).length,
        failed: reports.filter((r) => r.status === RUN_STATUS.FAILED).length,
      },
    };
  },
});
