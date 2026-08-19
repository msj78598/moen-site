/**
 * مهام الاستيعاب والتحقق.
 *
 * الجدولة هي القرار، والمهام هي التنفيذ. لا نموذج لغة في أي منهما.
 *
 * ===== لماذا هذه المواعيد =====
 *   ingestion   كل 6 ساعات — الجدولة الحقيقية لكل مصدر تأتي من
 *               scrape_interval_minutes، وهذه مجرد نبضة تفحص الاستحقاق.
 *               مصدر بفترة يومية لن يعمل إلا مرة واحدة رغم 4 نبضات.
 *   verification يوميًا — فحص حياة الروابط مكلف على المصدر، ولا تنتهي
 *               الإعلانات العقارية بوتيرة أسرع من ذلك.
 *
 * ===== الأمان =====
 * كل شيء محكوم ببوابة الإذن. لا يوجد مصدر granted حاليًا، فهذه المهام
 * تعمل وتُنهي بلا أي اتصال شبكي وبلا أي كتابة.
 */

import { registerJob } from "../scheduler/scheduler.js";
import { runAgent } from "../core/agent.js";
import { orchestratorAgent } from "../agents/orchestrator.js";
import { verifierAgent } from "../agents/verifier.js";
import { loadSources, summarize, isDueForRun } from "../sources/registry.js";
import { getAdapter } from "../ingestion/adapters/index.js";
import { createHttpFetcher } from "../ingestion/fetcher.js";
import { createGraphApiFetcher } from "../ingestion/fetchers/graph-api.js";
import { config } from "../core/config.js";
import { createMemoryStore, createSupabaseStore } from "../review/review-queue.js";
import { detectExtendedColumns } from "../writers/external-offers-writer.js";

/** يجهّز السياق المشترك للوكلاء: جالب حقيقي + مخزن مراجعة + كشف الأعمدة. */
export async function buildAgentContext(ctx) {
  const reviewStore = ctx.db
    ? createSupabaseStore({ db: ctx.db, logger: ctx.logger })
    : createMemoryStore();

  return {
    ...ctx,
    // الجالب الحقيقي — لا يُستدعى إلا لمصدر granted+enabled.
    fetcher: ctx.fetcher ?? createHttpFetcher(),
    // جالب مخصص لكل نوع مصدر. فيسبوك يحتاج Graph API لا HTTP عادي.
    fetcherFor: (source) =>
      source?.adapter === "muain_ababneh_facebook" && config.facebook.pageToken
        ? createGraphApiFetcher({
            token: config.facebook.pageToken,
            pageId: config.facebook.pageId,
            limit: source.max_offers_per_run ?? 20,
          })
        : null,
    reviewStore,
    extendedColumns: await detectExtendedColumns(ctx.db),
  };
}

export function registerIngestionJobs() {
  registerJob({
    name: "ingestion",
    description: "بحث ← نشر ← تحقق. محكوم ببوابة الإذن وجدولة كل مصدر.",
    schedule: "0 */6 * * *",
    timeoutMs: 600_000,
    maxAttempts: 1, // الاستيعاب ليس idempotent تمامًا؛ لا نعيده تلقائيًا
    async handler(ctx) {
      const agentCtx = await buildAgentContext(ctx);
      const result = await runAgent(
        orchestratorAgent,
        { runSearch: true, runPublish: true, runVerify: false, respectSchedule: true },
        agentCtx
      );

      if (result.errors.length) {
        ctx.logger?.error?.("ALERT_INGESTION_ERRORS", { errors: result.errors });
      }
      return result;
    },
  });

  registerJob({
    name: "verification",
    description: "فحص حياة العروض المنشورة وأرشفة المنتهي بدليل مؤكَّد فقط.",
    schedule: "0 4 * * *",
    timeoutMs: 900_000,
    maxAttempts: 1,
    async handler(ctx) {
      const agentCtx = await buildAgentContext(ctx);
      const result = await runAgent(verifierAgent, {}, agentCtx);

      if (result.blocked) {
        ctx.logger?.error?.("ALERT_ARCHIVE_BLOCKED", {
          reason: result.blocked_reason,
          impact: "لم تُؤرشف أي عروض — الجولة مشبوهة.",
        });
      }
      if (result.review_items.length) {
        await agentCtx.reviewStore.addMany(result.review_items);
      }
      return {
        checked: result.checked, active: result.active,
        archived: result.archived.length, review: result.review_items.length,
        blocked: result.blocked,
      };
    },
  });

  registerJob({
    name: "sources-status",
    description: "يعرض حالة سجل المصادر وأيها مستحق. قراءة فقط.",
    schedule: "0 */12 * * *",
    timeoutMs: 60_000,
    async handler(ctx) {
      const { sources, origin } = await loadSources({ db: ctx.db, logger: ctx.logger });
      const rows = summarize(sources, { hasAdapter: (n) => Boolean(getAdapter(n)) });
      const due = sources.filter((s) => isDueForRun(s));

      ctx.logger?.info?.("sources_status", {
        origin, total: rows.length,
        runnable: rows.filter((r) => r.runnable).length,
        due: due.length,
        sources: rows,
      });
      return { origin, sources: rows, due: due.length };
    },
  });
}
