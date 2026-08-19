/**
 * وكيل النشر.
 *
 * Identity:        publisher
 * Purpose:         يُدرج المرشحين المؤهلين في external_offers. إدراج فقط.
 * Level:           4 (نشر تلقائي على حقول محددة)
 * Allowed Tools:   publish_external_offer
 * Forbidden Tools: كل ما عداها — والمنع بنيوي لأن الأدوات الأخرى غير مدرجة
 * Input Schema:    قائمة مرشحين + نطاق المصدر المسموح
 * Output Schema:   عدّادات ونتائج لكل عرض
 * Failure Policy:  continue — فشل عرض لا يوقف الدفعة
 * Retry Policy:    محاولة واحدة؛ الإدراج ليس idempotent بطبعه فلا نكرره
 * Audit Policy:    كل نداء أداة يُسجَّل، إضافةً إلى trigger التدقيق على الجدول
 * LLM:             لا يستخدمه إطلاقًا
 *
 * ===== لماذا يوجد هذا الملف =====
 * طبقة الأدوات ترفض أي نداء بلا هوية وكيل (assertAllowed تفشل بلا
 * ctx.agent). فوجود هذا الوكيل هو ما يجعل "المستدعي المجهول" مستحيلًا
 * بنيويًا لا بالاتفاق.
 *
 * ⚠️ لا شيء يشغّل هذا الوكيل تلقائيًا. لا جدولة ولا مهمة مرتبطة به.
 */

import { z } from "zod";
import { defineAgent, LEVEL } from "../core/agent.js";
import { publishCandidates } from "../writers/external-offers-writer.js";
import "../writers/external-offers-writer.js";

export const publisherAgent = defineAgent({
  name: "publisher",
  purpose: "يُدرج العروض الخارجية المؤهلة. إدراج فقط — لا تعديل ولا حذف ولا أرشفة.",
  level: LEVEL.PUBLISH,
  usesLLM: false,

  allowedTools: ["publish_external_offer"],
  forbiddenTools: [],

  inputSchema: z.object({
    candidates: z.array(z.record(z.string(), z.unknown())).default([]),
    allowedHost: z.string().optional(),
  }),

  outputSchema: z.object({
    written: z.array(z.string()),
    skipped: z.array(z.object({ source_url: z.string().nullable(), reason: z.string() })),
    failed: z.array(z.object({ source_url: z.string().nullable(), error: z.string() })),
    counts: z.object({
      written: z.number(), skipped: z.number(), failed: z.number(),
    }),
  }),

  failurePolicy: { onError: "continue", maxConsecutiveFailures: 5 },
  retryPolicy: { maxAttempts: 1, backoffMs: 0 },

  async run({ candidates, allowedHost }, ctx) {
    const result = await publishCandidates(candidates, ctx, { allowedHost });

    ctx.logger?.info?.("publish_complete", {
      written: result.counts.written,
      skipped: result.counts.skipped,
      failed: result.counts.failed,
    });

    return result;
  },
});
