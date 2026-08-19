/**
 * تعريف المهام المجدولة.
 *
 * الجدولة مختارة بناءً على الواقع المرصود لا على أرقام افتراضية:
 *   - العروض العقارية لا تتغيّر كل 15 دقيقة. الكشط الحالي يومي وكان يكفي.
 *   - المراقبة رخيصة (قراءة فقط) فتُشغَّل كل ست ساعات.
 *   - كل شيء بتوقيت Asia/Riyadh كما هو مضبوط في المشروع أصلًا.
 */

import { registerJob } from "../scheduler/scheduler.js";
import { runAgent } from "../core/agent.js";
import { monitorAgent } from "../agents/monitor.js";
import { isMissingTable } from "../core/audit.js";
import { registerIngestionJobs } from "./ingestion-job.js";

/** الجداول التي يعتمد عليها Sprint 1 و 2. */
export const REQUIRED_TABLES = Object.freeze([
  "properties", "team", "contacts", "external_offers", "leads", "audit_log",
]);

/** تصنيف نتيجة فحص جدول — دالة نقية قابلة للاختبار. */
export function classifyTableCheck(error) {
  if (!error) return "ok";
  if (isMissingTable(error)) return "missing";
  return `error: ${error.message}`;
}

export function registerAllJobs() {
  registerIngestionJobs();

  registerJob({
    name: "monitor",
    description: "فحص صحة البيانات والروابط والحداثة. قراءة فقط، بلا ذكاء اصطناعي.",
    schedule: "0 */6 * * *", // كل 6 ساعات
    timeoutMs: 180_000,
    maxAttempts: 2,
    async handler(ctx) {
      const report = await runAgent(monitorAgent, { checkLinks: true, maxLinksToCheck: 10 }, ctx);

      const critical = report.findings.filter((f) => f.severity === "critical");
      const warnings = report.findings.filter((f) => f.severity === "warning");

      // التنبيه حاليًا عبر السجل المنظّم. قناة الإشعارات تأتي في Sprint لاحق.
      if (critical.length) {
        ctx.logger?.error?.("ALERT_CRITICAL", {
          count: critical.length,
          findings: critical.map((f) => ({ code: f.code, message: f.message })),
        });
      }

      return {
        critical: critical.length,
        warnings: warnings.length,
        stats: report.stats,
        findings: report.findings,
      };
    },
  });

  registerJob({
    name: "db-health",
    description: "فحص اتصال قاعدة البيانات وجاهزية الجداول التي يحتاجها Sprint 1.",
    schedule: "*/30 * * * *", // كل 30 دقيقة — رخيص جدًا
    timeoutMs: 30_000,
    async handler(ctx) {
      const checks = {};
      // جداول Sprint 1 المطلوبة. غيابها لا يُعتبر عطلًا بل "لم تُطبَّق الترحيلات بعد".
      for (const table of REQUIRED_TABLES) {
        // ⚠️ لا تستخدم { head: true } هنا: تشغيل حقيقي أثبت أنه يبتلع خطأ
        // "الجدول غير موجود" ويُرجع نجاحًا كاذبًا (count=null بلا error).
        const { error } = await ctx.db.from(table).select("id").limit(1);
        checks[table] = classifyTableCheck(error);
      }

      const missing = Object.entries(checks).filter(([, v]) => v === "missing").map(([k]) => k);
      if (missing.length) {
        ctx.logger?.warn?.("migrations_pending", {
          missing,
          hint: "راجع supabase/migrations/README.md",
        });
      }
      return { checks, missing };
    },
  });
}
