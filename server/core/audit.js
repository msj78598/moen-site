/**
 * سجل تدقيق الوكلاء.
 *
 * يعمل على مستويين:
 *   1) السجل المنظّم (دائمًا) — يعمل حتى قبل تطبيق أي migration.
 *   2) جدول audit_log في قاعدة البيانات (عند توفره).
 *
 * إن لم يكن الجدول موجودًا بعد، لا ينهار شيء: يُسجَّل تحذير مرة واحدة
 * ويستمر العمل. التدقيق لا يجوز أن يكون سبب تعطّل النظام.
 */

import { redact } from "./logger.js";

/**
 * هل يعني هذا الخطأ أن الجدول غير موجود؟
 * مُصدَّر ليكون قابلًا للاختبار — اكتُشفت الحاجة إليه من تشغيل حقيقي
 * أظهر تحذيرًا مكررًا لكل نداء أداة.
 */
export function isMissingTable(error) {
  if (!error) return false;
  if (error.code === "42P01" || error.code === "PGRST205") return true;
  return /does not exist|could not find the table/i.test(error.message ?? "");
}

/** يقصّ الحمولات الكبيرة حتى لا يتضخم السجل. */
function summarize(value, maxChars = 800) {
  if (value === undefined || value === null) return null;
  const text = typeof value === "string" ? value : JSON.stringify(redact(value));
  if (!text) return null;
  return text.length > maxChars ? `${text.slice(0, maxChars)}…[مقتطع]` : text;
}

export function createAudit({ db, logger, enabled = true, actorKind = "agent" }) {
  let tableAvailable = enabled;
  let warned = false;

  return {
    /**
     * @param {object} entry
     * @param {string} entry.agent
     * @param {string} entry.action
     * @param {string} entry.status   success | failure | skipped_dry_run
     */
    async record(entry) {
      const row = {
        actor_kind: actorKind,
        actor_name: entry.agent ?? null,
        action: entry.action,
        target_table: entry.targetTable ?? null,
        target_id: entry.targetId ? String(entry.targetId) : null,
        status: entry.status ?? "success",
        error_message: entry.error ? summarize(entry.error, 400) : null,
        context: {
          runId: entry.runId ?? null,
          durationMs: entry.durationMs ?? null,
          input: summarize(entry.input),
          note: entry.note ?? null,
        },
      };

      logger?.info?.("audit", {
        agent: entry.agent, action: entry.action, status: row.status,
        durationMs: entry.durationMs, runId: entry.runId,
      });

      if (!tableAvailable || !db) return;

      const { error } = await db.from("audit_log").insert(row);
      if (error) {
        // الجدول غير موجود -> نتوقف عن المحاولة بدل إغراق السجل بتحذير لكل نداء.
        // PostgREST يُرجع PGRST205 ("Could not find the table … in the schema cache")
        // بينما Postgres الخام يُرجع 42P01. نغطي الحالتين.
        if (isMissingTable(error)) {
          tableAvailable = false;
          if (!warned) {
            warned = true;
            logger?.warn?.("جدول audit_log غير موجود — التدقيق في السجل المنظّم فقط", {
              hint: "شغّل supabase/migrations/0004_audit_log.sql",
            });
          }
          return;
        }
        logger?.warn?.("تعذر كتابة سجل التدقيق", { error: error.message });
      }
    },
  };
}
