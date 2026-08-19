/**
 * المنسّق.
 *
 * ⚠️ منسّق بالكود لا بنموذج لغة. تسلسل المراحل ثابت ومحسوم مسبقًا،
 * ولا يوجد نموذج يقرر "أي وكيل يعمل الآن". هذا قرار معماري مقصود:
 * عدد المهام محدود ومعروف، فالحتمية أدق وأرخص وأسهل تصحيحًا.
 *
 * التسلسل:
 *   1) Searcher   -> مرشحون + مراجعات   (لا يكتب)
 *   2) Publisher  -> إدراج المرشحين      (INSERT فقط)
 *   3) Verifier   -> فحص وأرشفة محروسة   (UPDATE status فقط)
 *   4) طابور المراجعة يلتقط كل ما لم يُحسم
 *
 * ===== العزل =====
 * فشل مرحلة لا يُسقط ما قبلها. كل مرحلة تُغلَّف بـ try/catch وتُسجَّل
 * نتيجتها، ويستمر التسلسل ما أمكن.
 */

import { z } from "zod";
import { defineAgent, runAgent, LEVEL } from "../core/agent.js";
import { searcherAgent } from "./searcher.js";
import { publisherAgent } from "./publisher.js";
import { verifierAgent } from "./verifier.js";
import { createMemoryStore } from "../review/review-queue.js";
import { loadSources } from "../sources/registry.js";

export const PHASE = Object.freeze({
  SEARCH: "search",
  PUBLISH: "publish",
  VERIFY: "verify",
  REVIEW: "review",
});

export const orchestratorAgent = defineAgent({
  name: "orchestrator",
  purpose: "ينسّق تشغيل وكلاء البحث والنشر والتحقق بتسلسل حتمي.",
  level: LEVEL.SUGGEST, // لا يملك أدوات كتابة بنفسه — الوكلاء الفرعيون يملكونها
  usesLLM: false,

  // المنسّق لا يستخدم أدوات مباشرة؛ يفوّض للوكلاء.
  allowedTools: ["search_external_offers"],
  forbiddenTools: ["publish_external_offer", "archive_external_offer"],

  inputSchema: z.object({
    runSearch: z.boolean().default(true),
    runPublish: z.boolean().default(true),
    runVerify: z.boolean().default(true),
    respectSchedule: z.boolean().default(true),
    allowedHost: z.string().optional(),
  }),

  outputSchema: z.object({
    phases: z.record(z.string(), z.unknown()),
    review_queue_size: z.number(),
    errors: z.array(z.record(z.string(), z.unknown())),
  }),

  failurePolicy: { onError: "continue", maxConsecutiveFailures: 3 },
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },

  async run({ runSearch, runPublish, runVerify, respectSchedule, allowedHost }, ctx) {
    const phases = {};
    const errors = [];
    const reviewStore = ctx.reviewStore ?? createMemoryStore();

    const guard = async (phase, fn) => {
      try {
        phases[phase] = await fn();
      } catch (error) {
        errors.push({ phase, message: error.message });
        ctx.logger?.error?.("phase_failed", { phase, error: error.message });
        phases[phase] = { failed: true, error: error.message };
      }
    };

    // ===== 1) البحث =====
    let candidates = [];
    if (runSearch) {
      await guard(PHASE.SEARCH, async () => {
        const { sources, origin } = await loadSources({ db: ctx.db, logger: ctx.logger });
        const result = await runAgent(
          searcherAgent, { sources, respectSchedule }, ctx
        );
        candidates = result.publish_candidates;
        await reviewStore.addMany(result.review_items);
        return { origin, ...result.counts, blocked_sources: result.blocked_sources };
      });
    }

    // ===== 2) النشر =====
    if (runPublish && candidates.length) {
      await guard(PHASE.PUBLISH, async () => {
        const result = await runAgent(
          publisherAgent, { candidates, allowedHost }, ctx
        );
        return result.counts;
      });
    } else if (runPublish) {
      phases[PHASE.PUBLISH] = { written: 0, skipped: 0, failed: 0, note: "لا مرشحين" };
    }

    // ===== 3) التحقق =====
    if (runVerify) {
      await guard(PHASE.VERIFY, async () => {
        const result = await runAgent(verifierAgent, {}, ctx);
        await reviewStore.addMany(result.review_items);
        return {
          checked: result.checked, active: result.active,
          archived: result.archived.length,
          blocked: result.blocked, blocked_reason: result.blocked_reason,
        };
      });
    }

    const size = await reviewStore.size();
    phases[PHASE.REVIEW] = { pending: size };

    ctx.logger?.info?.("orchestration_complete", { phases, errors: errors.length });

    return { phases, review_queue_size: size, errors };
  },
});
