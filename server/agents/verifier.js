/**
 * وكيل التحقق.
 *
 * Identity:        verifier
 * Purpose:         يتابع حياة العروض المنشورة ويؤرشف المنتهي فقط بدليل مؤكَّد.
 * Level:           3 (تنفيذ غير حساس — تغيير status لا أكثر)
 * Allowed Tools:   search_external_offers · check_url_liveness · archive_external_offer
 * Forbidden Tools: publish_external_offer — الوكيل لا ينشر شيئًا
 * Failure Policy:  continue — فشل فحص عرض لا يوقف البقية
 * Retry Policy:    محاولتان داخل الفحص نفسه، لا إعادة تشغيل للوكيل
 * Audit Policy:    كل نداء أداة يُسجَّل + trigger التدقيق على الجدول
 * LLM:             لا يستخدمه
 *
 * ===== الضمانة الأهم =====
 * لا يؤرشف بسبب فشل مؤقت. يمر كل قرار أرشفة بثلاث بوابات:
 * حارس الجولة الناقصة · حالة حياة قاطعة مؤكَّدة مرتين · سقف الدفعة.
 * وما لم يُحسم يذهب لطابور المراجعة لا للأرشيف.
 */

import { z } from "zod";
import { defineAgent, LEVEL } from "../core/agent.js";
import { decideLiveness, LIVENESS } from "../verification/liveness.js";
import { archiveDecided } from "../writers/archive-writer.js";
import { fromLivenessDecision } from "../review/review-queue.js";
import { evaluateRunIntegrity } from "../ingestion/archive-guard.js";

import "../tools/read-tools.js";
import "../writers/archive-writer.js";

export const verifierAgent = defineAgent({
  name: "verifier",
  purpose: "يفحص حياة العروض المنشورة ويؤرشف المنتهي بدليل مؤكَّد فقط.",
  level: LEVEL.EXECUTE,
  usesLLM: false,

  allowedTools: ["search_external_offers", "check_url_liveness", "archive_external_offer"],
  forbiddenTools: ["publish_external_offer"],

  inputSchema: z.object({
    limit: z.number().int().min(1).max(200).default(50),
    attempts: z.number().int().min(1).max(5).default(2),
    maxAllowedDropPercent: z.number().int().min(0).max(100).default(30),
  }),

  outputSchema: z.object({
    checked: z.number(),
    active: z.number(),
    archived: z.array(z.string()),
    review_items: z.array(z.record(z.string(), z.unknown())),
    blocked: z.boolean(),
    blocked_reason: z.string().nullable(),
    counts: z.record(z.string(), z.number()),
  }),

  failurePolicy: { onError: "continue", maxConsecutiveFailures: 5 },
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },

  async run({ limit, attempts, maxAllowedDropPercent }, ctx) {
    const offers = await ctx.tool("search_external_offers", { status: "published", limit });
    const rows = offers.rows.filter((r) => r.source_url);

    const decisions = [];
    const counts = {
      [LIVENESS.ACTIVE]: 0, [LIVENESS.EXPIRED]: 0, [LIVENESS.UNAVAILABLE]: 0,
      [LIVENESS.CHECK_FAILED]: 0, [LIVENESS.REVIEW_REQUIRED]: 0,
    };

    for (const row of rows) {
      const probes = [];
      for (let i = 0; i < attempts; i += 1) {
        try {
          // الأداة تعيد { ok, status, error } — نحوّلها إلى شكل الفحص.
          const result = await ctx.tool("check_url_liveness", { url: row.source_url });
          probes.push({ ok: result.ok, status: result.status, error: result.error });
          if (result.ok) break; // إشارة حياة واحدة تكفي
        } catch (error) {
          probes.push({ ok: false, status: null, error: error.message });
        }
      }

      const decision = { ...decideLiveness(probes), source_url: row.source_url, offer_id: row.id };
      decisions.push(decision);
      counts[decision.state] = (counts[decision.state] ?? 0) + 1;
    }

    // ===== حكم سلامة الجولة =====
    // خط الأساس هنا هو عدد المنشور، والحالي هو ما استطعنا فحصه بنجاح.
    // انهيار الفحص الجماعي (شبكة مقطوعة) يمنع الأرشفة بالكامل.
    const successfullyChecked = decisions.filter(
      (d) => d.state !== LIVENESS.CHECK_FAILED
    ).length;

    const runIntegrity = evaluateRunIntegrity({
      previousCount: rows.length,
      currentCount: successfullyChecked,
      maxAllowedDropPercent,
    });

    const archiveResult = await archiveDecided(decisions, ctx, {
      runIntegrity,
      publishedCount: rows.length,
    });

    // كل ما لم يُحسم يذهب للمراجعة — لا شيء يضيع.
    const reviewItems = decisions
      .filter((d) => d.state === LIVENESS.REVIEW_REQUIRED || d.state === LIVENESS.CHECK_FAILED)
      .map((d) => fromLivenessDecision(d, { source: "external_offers" }));

    ctx.logger?.info?.("verification_complete", {
      checked: rows.length,
      archived: archiveResult.counts.archived,
      review: reviewItems.length,
      blocked: archiveResult.blocked,
      counts,
    });

    return {
      checked: rows.length,
      active: counts[LIVENESS.ACTIVE] ?? 0,
      archived: archiveResult.archived,
      review_items: reviewItems,
      blocked: archiveResult.blocked,
      blocked_reason: archiveResult.blocked_reason,
      counts,
    };
  },
});
