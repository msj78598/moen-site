/**
 * طبقة الأدوات (Tools).
 *
 * هذه هي الحدود الوحيدة التي يستطيع أي وكيل — أو أي نموذج لغة — التصرف من خلالها.
 * لا يوجد وصول حر إلى Supabase، ولا SQL خام، ولا DELETE.
 *
 * كل نداء أداة يمر إجباريًا بالخطوات الست:
 *   1) التحقق من المدخلات   (zod)
 *   2) التحقق من الصلاحيات   (permissions.js)
 *   3) التحقق من صحة المخرجات (zod)
 *   4) تنفيذ العملية المحددة فقط
 *   5) التسجيل في Audit Log
 *   6) رفض أي عملية غير معرّفة
 *
 * لا يمكن تخطي أي خطوة: التنفيذ لا يتم إلا عبر invokeTool.
 */

import { z } from "zod";
import { assertAllowed, LEVEL } from "./permissions.js";

const registry = new Map();

export class ToolError extends Error {
  constructor(message, { code = "tool_error", cause } = {}) {
    super(message);
    this.name = "ToolError";
    this.code = code;
    this.cause = cause;
  }
}

export class ToolValidationError extends ToolError {
  constructor(message, issues) {
    super(message, { code: "validation_error" });
    this.name = "ToolValidationError";
    this.issues = issues;
  }
}

/**
 * يعرّف أداة ويسجّلها.
 *
 * @param {object}   spec
 * @param {string}   spec.name         اسم فريد
 * @param {string}   spec.description  ماذا تفعل — يُعرض للنموذج عند الحاجة
 * @param {number}   spec.level        أدنى مستوى صلاحية مطلوب (LEVEL.*)
 * @param {string}   spec.capability   تصنيف العملية (يُفحص ضد FORBIDDEN_ALWAYS)
 * @param {z.ZodType} spec.input       مخطط المدخلات
 * @param {z.ZodType} spec.output      مخطط المخرجات
 * @param {boolean}  [spec.writes]     هل تكتب في قاعدة البيانات؟ (يحترم dry-run)
 * @param {Function} spec.handler      (input, ctx) => output
 */
export function defineTool(spec) {
  const required = ["name", "description", "level", "capability", "input", "output", "handler"];
  for (const key of required) {
    if (spec[key] === undefined) throw new ToolError(`تعريف الأداة ناقص: ${key}`);
  }
  if (registry.has(spec.name)) throw new ToolError(`الأداة "${spec.name}" معرّفة مسبقًا.`);

  const tool = Object.freeze({ writes: false, ...spec });
  registry.set(tool.name, tool);
  return tool;
}

export function getTool(name) {
  const tool = registry.get(name);
  // رفض أي عملية غير معرّفة — الخطوة السادسة.
  if (!tool) throw new ToolError(`أداة غير معروفة: "${name}". لا يُسمح بتنفيذ عمليات غير معرّفة.`, {
    code: "unknown_tool",
  });
  return tool;
}

export function listTools() {
  return [...registry.values()].map(({ name, description, level, capability, writes }) => ({
    name, description, level, capability, writes,
  }));
}

/** للاختبارات فقط. */
export function _resetRegistry() {
  registry.clear();
}

/**
 * المسار الوحيد لتنفيذ أداة.
 *
 * @param {string} name
 * @param {unknown} rawInput
 * @param {object} ctx  { agent, db, logger, audit, dryRun, runId }
 */
export async function invokeTool(name, rawInput, ctx) {
  const tool = getTool(name);
  const startedAt = Date.now();
  const logger = ctx.logger?.child?.({ tool: name }) ?? ctx.logger;

  // 2) الصلاحيات — قبل أي شيء آخر يلمس البيانات.
  assertAllowed({ agent: ctx.agent, tool });

  // 1) المدخلات
  const parsedInput = tool.input.safeParse(rawInput);
  if (!parsedInput.success) {
    const error = new ToolValidationError(
      `مدخلات غير صالحة للأداة "${name}".`,
      parsedInput.error.issues
    );
    await ctx.audit?.record({
      agent: ctx.agent.name, action: name, status: "failure",
      error: error.message, runId: ctx.runId,
    });
    throw error;
  }

  // dry-run: الأدوات الكاتبة لا تنفّذ، لكن تُسجَّل نيّتها.
  if (tool.writes && ctx.dryRun) {
    logger?.warn?.("dry-run: تم تخطي أداة كاتبة", { input: parsedInput.data });
    await ctx.audit?.record({
      agent: ctx.agent.name, action: name, status: "skipped_dry_run",
      input: parsedInput.data, runId: ctx.runId,
    });
    return { dryRun: true, skipped: true };
  }

  try {
    // 4) التنفيذ
    const raw = await tool.handler(parsedInput.data, ctx);

    // 3) المخرجات — النتيجة نفسها لا يُوثق بها بلا تحقق.
    const parsedOutput = tool.output.safeParse(raw);
    if (!parsedOutput.success) {
      throw new ToolValidationError(
        `مخرجات غير صالحة من الأداة "${name}".`,
        parsedOutput.error.issues
      );
    }

    // 5) السجل
    await ctx.audit?.record({
      agent: ctx.agent.name, action: name, status: "success",
      input: parsedInput.data, durationMs: Date.now() - startedAt, runId: ctx.runId,
    });

    return parsedOutput.data;
  } catch (error) {
    await ctx.audit?.record({
      agent: ctx.agent.name, action: name, status: "failure",
      input: parsedInput.data, error: error.message,
      durationMs: Date.now() - startedAt, runId: ctx.runId,
    });
    throw error;
  }
}

export { LEVEL, z };
